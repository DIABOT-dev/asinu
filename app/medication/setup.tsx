import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Platform, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { AiDataConsentModal } from "../../src/components/AiDataConsentModal";
import { hasAiDataConsent } from "../../src/lib/aiDataConsent";
import { Audio } from "../../src/lib/audio";
import { useToastStore } from "../../src/stores/toast.store";
import {
  v21Api,
  MedOverview,
  MedKind,
  Anchor,
  Meals,
} from "../../src/features/v21/v21.api";
import {
  Action,
  Choice,
  Field,
  Heading,
  Note,
  V21Layout,
  v21Error,
} from "../../src/features/v21/V21Layout";
type Draft = {
  display_name: string;
  printed_name?: string;
  kind: MedKind | null;
  source: "PHOTO_AI" | "CHIP" | "VOICE";
  confirmed: boolean;
  photo_media_id?: string;
  anchors: Anchor[];
};
const anchors: Anchor[] = [
  "before_breakfast",
  "after_breakfast",
  "after_lunch",
  "after_dinner",
  "bedtime",
];
const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const noDose = (s: string) =>
  !/(\d\s*(mg|mcg|µg|ml|iu|g|u|units?)\b|\d\s*(viên|tablets?|capsules?)\b)/iu.test(
    s
  );
const blank = (): Draft => ({
  display_name: "",
  kind: "MEDICINE",
  source: "CHIP",
  confirmed: false,
  anchors: [],
});
function clock(value: string, offset: number) {
  const [h, m] = value.slice(0, 5).split(":").map(Number),
    n = (h * 60 + m + offset + 1440) % 1440;
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
export default function MedicationSetup() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>(),
    patient = Number(patientId),
    router = useRouter(),
    { t } = useTranslation("v21");
  const [data, setData] = useState<MedOverview | null>(null),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<Draft[]>([]),
    [meals, setMeals] = useState<Meals>({
      breakfast: "06:30",
      lunch: "11:30",
      dinner: "18:00",
      bedtime: "21:30",
    }),
    [slots, setSlots] = useState<
      { time_local: string; meal_anchor: Anchor; item_indexes: number[] }[]
    >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState<string | null>(null),
    [scanFailures, setScanFailures] = useState(0),
    [consent, setConsent] = useState(false),
    [listening, setListening] = useState(false);
  const pendingPhoto = useRef<(() => Promise<void>) | null>(null),
    requestId = useRef(randomUUID()),
    recording = useRef<
      | Awaited<ReturnType<typeof Audio.Recording.createAsync>>["recording"]
      | null
    >(null),
    recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBody = useRef<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await v21Api.overview(patient);
      setData(d);
      setMeals({
        breakfast: d.meals.breakfast.slice(0, 5),
        lunch: d.meals.lunch.slice(0, 5),
        dinner: d.meals.dinner.slice(0, 5),
        bedtime: d.meals.bedtime.slice(0, 5),
      });
    } catch (e) {
      v21Error(e, t);
    } finally {
      setLoading(false);
    }
  }, [patient, t]);
  useEffect(() => {
    void reload();
    return () => {
      if (recordTimer.current) clearTimeout(recordTimer.current);
      if (recording.current)
        void recording.current.stopAndUnloadAsync().catch(() => {});
    };
  }, [reload]);
  const update = (i: number, x: Partial<Draft>) =>
    setDraft((old) => old.map((d, n) => (i === n ? { ...d, ...x } : d)));
  const leave = () => {
    if (step > 1 && !busy) {
      setStep((s) => s - 1);
      return;
    }
    if (!draft.length && !photo) {
      router.back();
      return;
    }
    Alert.alert(t("discardTitle"), t("discardBody"), [
      { text: t("keepEditing"), style: "cancel" },
      { text: t("leave"), style: "destructive", onPress: () => router.back() },
    ]);
  };
  const withConsent = async (work: () => Promise<void>) => {
    if (await hasAiDataConsent()) await work();
    else {
      pendingPhoto.current = work;
      setConsent(true);
    }
  };
  const pick = async (camera: boolean) => {
    if (busy) return;
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      useToastStore.getState().show(t("photoPermission"), "error");
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          exif: false,
        });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto(asset.uri);
    await withConsent(async () => {
      setBusy(true);
      try {
        const form = new FormData();
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          (form as any).append("image", await response.blob(), "medicine.jpg");
        } else
          form.append("image", {
            uri: asset.uri,
            name: "medicine.jpg",
            type: asset.mimeType || "image/jpeg",
          } as any);
        const scan = await v21Api.scan(patient, form);
        if (!scan.readable || !scan.items.length) {
          setScanFailures((n) => n + 1);
          useToastStore
            .getState()
            .show(t(scanFailures ? "scanFallback" : "scanRetry"), "info");
          return;
        }
        setDraft(
          scan.items.map((item) => ({
            display_name: item.display_name || "",
            printed_name: item.printed_name,
            kind: item.kind,
            source: "PHOTO_AI",
            confirmed: false,
            photo_media_id: scan.mediaId,
            anchors: item.suggested_slots.filter((a): a is Anchor =>
              anchors.includes(a as Anchor)
            ),
          }))
        );
        setStep(2);
        if (scan.partial)
          useToastStore.getState().show(t("partialScan"), "info");
      } catch (e) {
        setScanFailures((n) => n + 1);
        v21Error(e, t);
      } finally {
        setBusy(false);
      }
    });
  };
  const stopVoice = async () => {
    if (!recording.current) return;
    const rec = recording.current;
    recording.current = null;
    setListening(false);
    if (recordTimer.current) clearTimeout(recordTimer.current);
    setBusy(true);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      const form = new FormData();
      if (Platform.OS === "web") {
        (form as any).append(
          "audio",
          await (await fetch(uri)).blob(),
          "name.webm"
        );
      } else
        form.append("audio", {
          uri,
          name: "name.m4a",
          type: "audio/m4a",
        } as any);
      const r = await v21Api.transcribe(patient, form);
      setDraft((old) => [
        ...old,
        { ...blank(), display_name: r.text, source: "VOICE" },
      ]);
      setStep(2);
    } catch (e) {
      v21Error(e, t);
    } finally {
      setBusy(false);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(
        () => {}
      );
    }
  };
  const voice = () =>
    void withConsent(async () => {
      if (busy) return;
      if (listening) {
        await stopVoice();
        return;
      }
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        useToastStore.getState().show(t("voicePermission"), "error");
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const r = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recording.current = r.recording;
        setListening(true);
        recordTimer.current = setTimeout(() => void stopVoice(), 20000);
      } catch (e) {
        v21Error(e, t);
      }
    });
  const review = () => {
    if (!Object.values(meals).every(validTime)) {
      useToastStore.getState().show(t("timeInvalid"), "error");
      return;
    }
    if (draft.some((x) => !x.anchors.length)) {
      useToastStore.getState().show(t("whenTake"), "error");
      return;
    }
    const grouped = new Map<
      string,
      { time_local: string; meal_anchor: Anchor; item_indexes: number[] }
    >();
    draft.forEach((d, i) =>
      d.anchors.forEach((a) => {
        const time =
          a === "before_breakfast"
            ? clock(meals.breakfast, -30)
            : a === "after_breakfast"
            ? clock(meals.breakfast, 30)
            : a === "after_lunch"
            ? clock(meals.lunch, 30)
            : a === "after_dinner"
            ? clock(meals.dinner, 30)
            : meals.bedtime;
        const row = grouped.get(time) || {
          time_local: time,
          meal_anchor: a,
          item_indexes: [],
        };
        row.item_indexes.push(i);
        grouped.set(time, row);
      })
    );
    if (grouped.size > 4) {
      useToastStore.getState().show(t("scheduleLimit"), "error");
      return;
    }
    setSlots(
      [...grouped.values()].sort((a, b) =>
        a.time_local.localeCompare(b.time_local)
      )
    );
    setStep(4);
  };
  const save = async () => {
    if (busy) return;
    if (slots.some((s) => !validTime(s.time_local))) {
      useToastStore.getState().show(t("timeInvalid"), "error");
      return;
    }
    const grouped = new Map<string, (typeof slots)[number]>();
    for (const s of slots) {
      const existing = grouped.get(s.time_local);
      grouped.set(
        s.time_local,
        existing
          ? {
              ...existing,
              item_indexes: [
                ...new Set([...existing.item_indexes, ...s.item_indexes]),
              ],
            }
          : s
      );
    }
    const body = {
      items: draft.map(({ anchors: _, ...d }) => ({ ...d, confirmed: true })),
      meals,
      slots: [...grouped.values()],
    };
    const json = JSON.stringify(body);
    if (savedBody.current && savedBody.current !== json)
      requestId.current = randomUUID();
    savedBody.current = json;
    setBusy(true);
    try {
      const r = await v21Api.setup(patient, {
        request_id: requestId.current,
        ...body,
      });
      useToastStore
        .getState()
        .show(t(r.pendingConsent ? "consentSent" : "scheduleSaved"), "success");
      router.replace("/medication" as any);
    } catch (e) {
      v21Error(e, t);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <V21Layout title={t("setupTitle")} onBack={leave}>
        <Note>{t("step", { current: step, label: t(`step${step}`) })}</Note>
        {!data && (
          <>
            <Note>{t(loading ? "loading" : "error")}</Note>
            {!loading && (
              <Action
                secondary
                label={t("retry")}
                onPress={() => void reload()}
              />
            )}
          </>
        )}
        {step === 1 && (
          <>
            <Heading>{t("step1")}</Heading>
            <Note>{t("photoIntro")}</Note>
            {photo && (
              <Image
                source={{ uri: photo }}
                resizeMode="contain"
                style={{ height: 180, width: "100%", borderRadius: 18 }}
              />
            )}
            {data?.flags.scan && scanFailures < 2 ? (
              <>
                <Action
                  label={t("camera")}
                  disabled={busy}
                  onPress={() => void pick(true)}
                />
                <Action
                  secondary
                  label={t("library")}
                  disabled={busy}
                  onPress={() => void pick(false)}
                />
              </>
            ) : (
              <Note>
                {t(scanFailures >= 2 ? "scanFallback" : "scanNotEnabled")}
              </Note>
            )}
            {busy && <Note>{t("scanBusy")}</Note>}
            <Action
              secondary
              label={t("manual")}
              disabled={busy || !data}
              onPress={() => {
                if (!draft.length) setDraft([blank()]);
                setStep(2);
              }}
            />
            <Action
              secondary
              label={t(listening ? "stopVoice" : "voiceName")}
              disabled={busy || !data}
              onPress={voice}
            />
            {listening && <Note>{t("voiceListening")}</Note>}
          </>
        )}
        {step === 2 && (
          <>
            <Heading>{t("step2")}</Heading>
            <Note>{t("confirmNames")}</Note>
            {draft.map((d, i) => (
              <View key={i} style={{ gap: 12, paddingBottom: 18 }}>
                <Field
                  accessibilityLabel={t("name")}
                  placeholder={t("name")}
                  maxLength={30}
                  value={d.display_name}
                  onChangeText={(value) =>
                    update(i, { display_name: value, confirmed: false })
                  }
                />
                {!!d.display_name && !noDose(d.display_name) && (
                  <Note>{t("noDosage")}</Note>
                )}
                <View style={{ gap: 8 }}>
                  {(["MEDICINE", "SUPPLEMENT"] as MedKind[]).map((kind) => (
                    <Choice
                      key={kind}
                      label={t(kind)}
                      selected={d.kind === kind}
                      onPress={() => update(i, { kind, confirmed: false })}
                    />
                  ))}
                </View>
                <Choice
                  label={t("itemConfirmed")}
                  selected={d.confirmed}
                  onPress={() => update(i, { confirmed: !d.confirmed })}
                />
                <Action
                  secondary
                  label={t("removeItem")}
                  onPress={() =>
                    setDraft((old) => old.filter((_, n) => n !== i))
                  }
                />
              </View>
            ))}
            <View style={{ gap: 8 }}>
              {[
                ...(/diabet|tiểu đường/i.test(JSON.stringify(data?.conditions))
                  ? ["medicine_diabetes"]
                  : []),
                ...(/hypertension|huyết áp/i.test(
                  JSON.stringify(data?.conditions)
                )
                  ? ["medicine_pressure"]
                  : []),
                ...(/cardio|heart|tim mạch/i.test(
                  JSON.stringify(data?.conditions)
                )
                  ? ["medicine_heart"]
                  : []),
                "medicine_generic",
                "supplement",
                "medicine_other",
              ].map((code) => (
                <Action
                  key={code}
                  secondary
                  label={t(code)}
                  onPress={() =>
                    setDraft((old) => [
                      ...old,
                      {
                        ...blank(),
                        display_name: t(code),
                        kind: code === "supplement" ? "SUPPLEMENT" : "MEDICINE",
                      },
                    ])
                  }
                />
              ))}
            </View>
            <Action
              secondary
              label={t("addItem")}
              disabled={draft.length >= 20}
              onPress={() => setDraft((old) => [...old, blank()])}
            />
            <Action
              label={t("next")}
              disabled={
                !draft.length ||
                draft.some(
                  (d) =>
                    !d.kind ||
                    !d.confirmed ||
                    !d.display_name.trim() ||
                    !noDose(d.display_name)
                )
              }
              onPress={() => setStep(3)}
            />
          </>
        )}
        {step === 3 && (
          <>
            <Heading>{t("step3")}</Heading>
            <Note>{t("mealIntro")}</Note>
            {(Object.keys(meals) as (keyof Meals)[]).map((key) => (
              <View key={key} style={{ gap: 8 }}>
                <Note>{t(key)}</Note>
                <Field
                  accessibilityLabel={t(key)}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  value={meals[key]}
                  onChangeText={(value) =>
                    setMeals((m) => ({ ...m, [key]: value }))
                  }
                />
              </View>
            ))}
            {draft.map((d, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Heading>{d.display_name}</Heading>
                <Note>{t("whenTake")}</Note>
                {anchors.map((a) => (
                  <Choice
                    key={a}
                    label={t(a === "bedtime" ? "anchor_bedtime" : a)}
                    selected={d.anchors.includes(a)}
                    onPress={() =>
                      update(i, {
                        anchors: d.anchors.includes(a)
                          ? d.anchors.filter((x) => x !== a)
                          : [...d.anchors, a],
                      })
                    }
                  />
                ))}
              </View>
            ))}
            <Action label={t("next")} onPress={review} />
          </>
        )}
        {step === 4 && (
          <>
            <Heading>{t("step4")}</Heading>
            <Note>{t("reviewIntro")}</Note>
            {slots.map((s, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Field
                  accessibilityLabel={t("timeLabel")}
                  value={s.time_local}
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={(value) =>
                    setSlots((old) =>
                      old.map((x, n) =>
                        n === i ? { ...x, time_local: value } : x
                      )
                    )
                  }
                />
                {s.item_indexes.map((n) => (
                  <Note key={n}>{draft[n]?.display_name}</Note>
                ))}
                {(s.time_local < "07:00" || s.time_local >= "21:00") && (
                  <Note>{t("pushOnly")}</Note>
                )}
              </View>
            ))}
            <Action
              label={t(data?.self ? "save" : "sendConsent")}
              disabled={busy}
              onPress={() => void save()}
            />
          </>
        )}
      </V21Layout>
      <AiDataConsentModal
        visible={consent}
        onDecline={() => {
          setConsent(false);
          pendingPhoto.current = null;
        }}
        onAgree={() => {
          setConsent(false);
          const work = pendingPhoto.current;
          pendingPhoto.current = null;
          if (work) void work();
        }}
      />
    </>
  );
}
