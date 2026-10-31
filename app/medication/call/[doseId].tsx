import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  loadPendingAnswer,
  savePendingAnswer,
  clearPendingAnswer,
} from "../../../src/features/v21/medication.pending";
import { useTranslation } from "react-i18next";
import {
  v21Api,
  MedDetail,
  MedAnswer,
} from "../../../src/features/v21/v21.api";
import {
  Action,
  Heading,
  Note,
  V21Layout,
  v21Error,
} from "../../../src/features/v21/V21Layout";
import { useMedicationAudio } from "../../../src/features/v21/useMedicationAudio";
import { acceptMedicationCallOnce } from "../../../src/features/v21/medication.accept";
import { useAuthStore } from "../../../src/features/auth/auth.store";
import { endVoipCall } from "../../../src/lib/voip";
import { env } from "../../../src/lib/env";
import { useToastStore } from "../../../src/stores/toast.store";
export default function MedicationCall() {
  const { doseId, attemptId, nativeAnswered, quickButton } =
      useLocalSearchParams<{
        doseId: string;
        attemptId?: string;
        nativeAnswered?: string;
        quickButton?: string;
      }>(),
    { t, i18n } = useTranslation("v21"),
    router = useRouter(),
    user = useAuthStore((s) => s.profile?.id),
    accountToken = useAuthStore((s) => s.token);
  const [data, setData] = useState<MedDetail | null>(null),
    [result, setResult] = useState<MedAnswer | null>(null),
    [busy, setBusy] = useState(false),
    [showItems, setShowItems] = useState(false),
    [checkin, setCheckin] = useState(false),
    [done, setDone] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false),
    played = useRef(false),
    quick = useRef(false),
    scope = useRef({ active: false, revision: 0 });
  const audio = useMedicationAudio(
    doseId,
    nativeAnswered === "1" ? attemptId : undefined,
    data?.attempt?.deadline,
    i18n.language
  );
  const current = (revision: number, token: string | null) =>
    scope.current.active &&
    scope.current.revision === revision &&
    useAuthStore.getState().token === token;
  const refresh = async (quiet = false) => {
    const revision = scope.current.revision,
      token = useAuthStore.getState().token;
    try {
      const d = await v21Api.dose(doseId);
      if (!current(revision, token) || lock.current) return;
      setData(d);
      setFailed(false);
      setCheckin(d.needsCheckin ?? !!d.event.checkin_pending);
      if (d.event.state === "CANCELLED") {
        void audio.stop();
        if (attemptId) void endVoipCall(attemptId);
      }
      return d;
    } catch (e) {
      if (!current(revision, token)) return;
      setFailed(true);
      if (!quiet) v21Error(e, t);
    }
  };
  useEffect(() => {
    scope.current.active = true;
    scope.current.revision++;
    played.current = false;
    quick.current = false;
    lock.current = false;
    setBusy(false);
    setData(null);
    setResult(null);
    setCheckin(false);
    setDone(false);
    setFailed(false);
    void refresh();
    const timer = setInterval(() => {
      if (scope.current.active && !lock.current) void refresh(true);
    }, 3000);
    if (attemptId && nativeAnswered === "1")
      void acceptMedicationCallOnce(attemptId).catch(() => {});
    return () => {
      scope.current.active = false;
      scope.current.revision++;
      clearInterval(timer);
      void audio.stop();
      if (attemptId) void endVoipCall(attemptId);
    };
  }, [doseId, attemptId, user, accountToken]);
  const answer = async (button: number) => {
    if (lock.current || !data?.canAnswer) return;
    lock.current = true;
    setBusy(true);
    void audio.stop();
    const revision = ++scope.current.revision,
      token = useAuthStore.getState().token,
      owner = String(user);
    try {
      const stored = await loadPendingAnswer(owner, doseId);
      if (!current(revision, token)) return;
      // A changed choice is a new request, never silently replay another button.
      const requestId = stored?.button === button ? stored.id : randomUUID();
      await savePendingAnswer(owner, doseId, { button, id: requestId });
      if (!current(revision, token)) return;
      const r = await v21Api.answer(doseId, button, requestId);
      void clearPendingAnswer(owner, doseId);
      if (!current(revision, token)) return;
      setResult(r);
      setCheckin(!!r.needsCheckin);
      setData((d) =>
        d
          ? {
              ...d,
              event: { ...d.event, ...r.event },
              canAnswer: false,
              needsCheckin: r.needsCheckin,
              checkinDoseId: r.checkinDoseId,
            }
          : d
      );
      // Another device may already have won, or the answer window may be over.
      // Speak only the result actually accepted by the server.
      if (!r.answerWindowClosed) {
        const phase =
          r.event.state === "TAKEN"
            ? "taken"
            : r.event.state === "SKIPPED"
            ? "skipped"
            : r.event.state === "OUT_OF_MEDS"
            ? "out"
            : null;
        if (phase) void audio.play(phase);
      }
    } catch (e) {
      if (current(revision, token)) v21Error(e, t);
    } finally {
      if (current(revision, token)) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (!data || played.current) return;
    played.current = true;
    if (data.canAnswer && !quickButton) void audio.play("prompt");
    else if (data.needsCheckin ?? data.event.checkin_pending)
      void audio.play("checkin");
  }, [data]);
  useEffect(() => {
    if (data?.canAnswer && quickButton && !quick.current) {
      const button = Number(quickButton);
      if ([1, 2, 3].includes(button)) {
        quick.current = true;
        void answer(button);
      }
    }
  }, [data?.canAnswer, quickButton]);
  useEffect(() => {
    if (
      result &&
      !checkin &&
      ["finished", "error"].includes(audio.state.phase) &&
      attemptId
    )
      void endVoipCall(attemptId);
  }, [result, checkin, audio.state.phase, attemptId]);
  useEffect(() => {
    if (
      checkin &&
      audio.state.prompt?.key === "taken" &&
      ["finished", "error"].includes(audio.state.phase)
    )
      void audio.play("checkin");
  }, [checkin, audio.state.phase, audio.state.prompt?.key]);
  const health = async (status: "fine" | "tired" | "very_tired") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    void audio.stop();
    const revision = ++scope.current.revision,
      token = useAuthStore.getState().token;
    try {
      await v21Api.checkin(
        result?.checkinDoseId || data?.checkinDoseId || doseId,
        status
      );
      if (!current(revision, token)) return;
      setDone(true);
      setCheckin(false);
      setData((d) =>
        d
          ? {
              ...d,
              needsCheckin: false,
              checkinDoseId: undefined,
              event: { ...d.event, checkin_pending: false },
            }
          : d
      );
      if (attemptId) await endVoipCall(attemptId);
      useToastStore.getState().show(t("checkinSaved"), "success");
    } catch (e) {
      if (current(revision, token)) v21Error(e, t);
    } finally {
      if (current(revision, token)) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <V21Layout title={t("callTitle")}>
      {!data && <Note>{t(failed ? "error" : "loading")}</Note>}
      {failed && (
        <Action secondary label={t("retry")} onPress={() => void refresh()} />
      )}
      {data && (
        <>
          <Heading>
            {t(
              result?.answerWindowClosed
                ? "answerClosed"
                : done
                ? "recorded"
                : checkin
                ? "checkinQuestion"
                : result
                ? "recorded"
                : "callIntro"
            )}
          </Heading>
          {checkin && !done ? (
            <>
              {(["fine", "tired", "very_tired"] as const).map((status) => (
                <Action
                  key={status}
                  label={t(status)}
                  disabled={busy}
                  onPress={() => void health(status)}
                />
              ))}
            </>
          ) : data.canAnswer && !result ? (
            <>
              <Action
                label={t("TAKEN")}
                disabled={busy}
                onPress={() => void answer(1)}
              />
              <Action
                secondary
                label={t("SKIPPED")}
                disabled={busy}
                onPress={() => void answer(2)}
              />
              <Note>{t("skipExplained")}</Note>
              <Action
                secondary
                label={t("OUT_OF_MEDS")}
                disabled={busy}
                onPress={() => void answer(3)}
              />
            </>
          ) : (
            !done && (
              <Note>
                {t(data.event.state)}
                {!data.canAnswer && !result
                  ? " · " +
                    t(
                      data.event.state === "SCHEDULED"
                        ? "notDue"
                        : "answerClosed"
                    )
                  : ""}
              </Note>
            )
          )}
          <Action
            secondary
            label={t("viewItems")}
            onPress={() => setShowItems((v) => !v)}
          />
          {showItems &&
            data.items.map((item) => (
              <View key={item.id} style={{ gap: 8 }}>
                <Heading>{item.display_name}</Heading>
                <Note>{t(item.kind)}</Note>
                {item.photoUrl && (
                  <Image
                    source={{
                      uri: item.photoUrl.startsWith("/")
                        ? env.apiBaseUrl + item.photoUrl
                        : item.photoUrl,
                    }}
                    resizeMode="contain"
                    style={{ width: "100%", height: 180, borderRadius: 18 }}
                  />
                )}
              </View>
            ))}
          {(!data.canAnswer || result || done) && !checkin && (
            <Action
              label={t("home")}
              disabled={busy}
              onPress={() => {
                void audio.stop();
                router.replace("/(tabs)/home");
              }}
            />
          )}
        </>
      )}
    </V21Layout>
  );
}
