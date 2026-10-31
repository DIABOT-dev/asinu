import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { v21Api, MedOverview } from "../../src/features/v21/v21.api";
import {
  Action,
  Heading,
  Note,
  V21Layout,
  v21Error,
} from "../../src/features/v21/V21Layout";
import { useToastStore } from "../../src/stores/toast.store";
import { useMedicationAudio } from "../../src/features/v21/useMedicationAudio";
import { acceptMedicationCallOnce } from "../../src/features/v21/medication.accept";
import { endVoipCall } from "../../src/lib/voip";
export default function MedicationConsent() {
  const { scheduleId, attemptId } = useLocalSearchParams<{
      scheduleId: string;
      attemptId?: string;
    }>(),
    { t, i18n } = useTranslation("v21"),
    router = useRouter();
  const [data, setData] = useState<MedOverview | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    v21Api
      .overview()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => v21Error(e, t));
    return () => {
      active = false;
      if (attemptId) endVoipCall(attemptId);
    };
  }, [t, attemptId]);
  const played = useRef(false),
    audio = useMedicationAudio(
      scheduleId,
      attemptId,
      undefined,
      i18n.language,
      true,
    );
  useEffect(() => {
    if (attemptId) void acceptMedicationCallOnce(attemptId).catch(() => {});
  }, [attemptId]);
  useEffect(() => {
    if (data && !played.current) {
      played.current = true;
      void audio.play("consent");
    }
  }, [data]);
  const schedule = data?.schedules.find((s) => s.id === scheduleId);
  const review =
    schedule?.consent_state === "PENDING"
      ? data?.schedules.filter((s) => s.consent_state === "PENDING") || []
      : schedule
        ? [schedule]
        : [];
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    void audio.stop();
    try {
      await v21Api.consentMany(
        review.map((s) => s.id),
        accept,
      );
      useToastStore.getState().show(t("consentDone"), "success");
      if (attemptId) await endVoipCall(attemptId);
      router.replace("/medication" as any);
    } catch (e) {
      v21Error(e, t);
    } finally {
      setBusy(false);
    }
  };
  return (
    <V21Layout title={t("consentTitle")}>
      <Note>{t("consentIntro")}</Note>
      {!data && <Note>{t("loading")}</Note>}
      {data && !schedule && (
        <>
          <Note>{t("scheduleInactive")}</Note>
          <Action
            secondary
            label={t("close")}
            onPress={() => router.replace("/medication" as any)}
          />
        </>
      )}
      {schedule && (
        <>
          {review.map((s) => (
            <React.Fragment key={s.id}>
              <Heading>{s.time_local}</Heading>
              {s.item_ids.map((id) => (
                <Note key={id}>
                  {data?.items.find((i) => i.id === id)?.display_name}
                </Note>
              ))}
              {s.pushOnly && <Note>{t("pushOnly")}</Note>}
            </React.Fragment>
          ))}
          {schedule.consent_state === "PENDING" ? (
            <>
              <Action
                label={t("acceptConsent")}
                disabled={busy}
                onPress={() => void answer(true)}
              />
              <Action
                secondary
                label={t("declineConsent")}
                disabled={busy}
                onPress={() => void answer(false)}
              />
            </>
          ) : (
            <Note>{t(schedule.consent_state)}</Note>
          )}
        </>
      )}
    </V21Layout>
  );
}
