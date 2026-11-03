import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { hasAiDataConsent } from "../../lib/aiDataConsent";
import { Audio } from "../../lib/audio";
import { useToastStore } from "../../stores/toast.store";
import { v21Api, MedOverview, MedKind, Anchor, Meals } from "./v21.api";
import { v21Error } from "./V21Layout";
import { reportError } from "../../observability/sentry";
import {
  MedicationPhotoError,
  prepareMedicationPhoto,
  type MedicationPhotoUpload,
} from "./medication-photo";
export type MedicationDraft = {
  display_name: string;
  printed_name?: string;
  kind: MedKind | null;
  source: "PHOTO_AI" | "CHIP" | "VOICE";
  confirmed: boolean;
  photo_media_id?: string;
  anchors: Anchor[];
};
export const medicationAnchors: Anchor[] = [
  "before_breakfast",
  "after_breakfast",
  "after_lunch",
  "after_dinner",
  "bedtime",
];
export const validMedicationTime = (s: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const medicationNameHasNoDose = (s: string) =>
  !/(\d\s*(mg|mcg|µg|ml|iu|g|u|units?)\b|\d\s*(viên|tablets?|capsules?)\b)/iu.test(
    s
  );
const blank = (): MedicationDraft => ({
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
export function useMedicationSetup() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>(),
    patient = Number(patientId),
    router = useRouter(),
    { t } = useTranslation("v21");
  const [data, setData] = useState<MedOverview | null>(null),
    [step, setStep] = useState(1),
    [draft, setDraft] = useState<MedicationDraft[]>([]),
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
  const saving = useRef(false);
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
  const update = (i: number, x: Partial<MedicationDraft>) =>
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
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        useToastStore.getState().show(t("photoPermission"), "error");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.85,
        exif: false,
        base64: Platform.OS !== "web",
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        useToastStore.getState().show(t("medicationPhotoReadError"), "error");
        return;
      }
      setPhoto(asset.uri);
      await withConsent(async () => {
        setBusy(true);
        let upload: MedicationPhotoUpload | null = null;
        let stage = "photo_prepare";
        try {
          upload = await prepareMedicationPhoto(asset);
          stage = "photo_upload";
          const scan = await v21Api.scan(patient, upload.body);
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
                medicationAnchors.includes(a as Anchor)
              ),
            }))
          );
          setStep(2);
          if (scan.partial)
            useToastStore.getState().show(t("partialScan"), "info");
        } catch (error) {
          reportError(error, {
            component: "medication_setup",
            operation: stage,
          });
          if (error instanceof MedicationPhotoError) {
            useToastStore
              .getState()
              .show(
                t(
                  error.code === "MED_LOCAL_PHOTO_TOO_LARGE"
                    ? "medicationPhotoTooLarge"
                    : error.code === "MED_LOCAL_PHOTO_UNSUPPORTED"
                    ? "scanPhotoUnsupported"
                    : "medicationPhotoReadError"
                ),
                "error"
              );
          } else {
            v21Error(error, t, "medicationPhotoUploadError");
          }
        } finally {
          upload?.dispose();
          setBusy(false);
        }
      });
    } catch (error) {
      reportError(error, {
        component: "medication_setup",
        operation: "photo_picker",
      });
      useToastStore.getState().show(t("medicationPhotoReadError"), "error");
    }
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
    if (!Object.values(meals).every(validMedicationTime)) {
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
        if (!row.item_indexes.includes(i)) row.item_indexes.push(i);
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
    if (busy || saving.current) return;
    if (slots.some((s) => !validMedicationTime(s.time_local))) {
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
    saving.current = true;
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
      saving.current = false;
      setBusy(false);
    }
  };
  const canContinue =
    !!data &&
    !busy &&
    !listening &&
    (step === 2
      ? !!draft.length &&
        draft.every(
          (d) =>
            !!d.kind &&
            d.confirmed &&
            !!d.display_name.trim() &&
            medicationNameHasNoDose(d.display_name)
        )
      : step === 3
      ? Object.values(meals).every(validMedicationTime) &&
        !!draft.length &&
        draft.every((d) => d.anchors.length > 0)
      : step === 4
      ? !!slots.length && slots.every((s) => validMedicationTime(s.time_local))
      : false);
  return {
    data,
    step,
    draft,
    meals,
    slots,
    loading,
    busy,
    photo,
    scanFailures,
    consent,
    listening,
    reload,
    leave,
    pick,
    voice,
    update,
    setDraft,
    setMeals,
    setSlots,
    canContinue,
    addManual: () => {
      if (!draft.length) setDraft([blank()]);
      setStep(2);
    },
    addItem: (name = "", supplement = false) => {
      if (draft.length < 20)
        setDraft((old) => [
          ...old,
          {
            ...blank(),
            display_name: name,
            kind: supplement ? "SUPPLEMENT" : "MEDICINE",
          },
        ]);
    },
    next: () => {
      if (!canContinue) return;
      if (step === 2) setStep(3);
      else if (step === 3) review();
      else if (step === 4) void save();
    },
    declineAi: () => {
      setConsent(false);
      pendingPhoto.current = null;
    },
    agreeAi: () => {
      setConsent(false);
      const work = pendingPhoto.current;
      pendingPhoto.current = null;
      if (work) void work();
    },
  };
}
export type MedicationSetupController = ReturnType<typeof useMedicationSetup>;
