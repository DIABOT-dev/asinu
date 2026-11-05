import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "../../hooks/useGuardedRouter";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import { useTranslation } from "react-i18next";
import { hasAiDataConsent } from "../../lib/aiDataConsent";
import { Audio } from "../../lib/audio";
import { useToastStore } from "../../stores/toast.store";
import {
  v21Api,
  MedOverview,
  MedKind,
  Anchor,
  Meals,
  type MedPurposeLookup,
  type MedPurposeCode,
} from "./v21.api";
import {
  useMedicationPurposeLookup,
  validatedMedicationPurposeResult,
} from "./useMedicationPurposeLookup";
import { v21Error } from "./V21Layout";
import { reportError } from "../../observability/sentry";
import { useAuthStore } from "../auth/auth.store";
import { ApiError } from "../../lib/apiClient";
import { env } from "../../lib/env";
import {
  MedicationDraftSession,
  type DraftStatus,
} from "./medication-draft-session";
import type { MedDraftSnapshot, MedSetupDraft } from "./v21.api";
import {
  medicationTextHasNoDose,
  validMedicationNote,
} from "./medication-input";
import {
  MedicationPhotoError,
  prepareMedicationPhoto,
  type MedicationPhotoUpload,
} from "./medication-photo";
export type MedicationDraft = {
  clientId: string;
  display_name: string;
  printed_name?: string;
  kind: MedKind | null;
  source: "PHOTO_AI" | "CHIP" | "VOICE";
  confirmed: boolean;
  photo_media_id?: string;
  photo_uri?: string;
  timeHints?: string[];
  anchors: Anchor[];
  purposeLookup?: {
    key: string;
    loading: boolean;
    version?: number;
    result?: MedPurposeLookup;
  };
  selectedPurposeCodes?: MedPurposeCode[];
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
export const medicationNameHasNoDose = medicationTextHasNoDose;
const blank = (): MedicationDraft => ({
  clientId: randomUUID(),
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
const draftItem = ({ photo_uri: _uri, ...item }: MedicationDraft) => ({
  ...item,
  ...(item.purposeLookup?.result
    ? {
        purposeLookup: {
          ...item.purposeLookup,
          result: validatedMedicationPurposeResult(item.purposeLookup.result),
        },
      }
    : {}),
});
export function useMedicationSetup() {
  const { patientId, draftId, newPlan } = useLocalSearchParams<{
      patientId: string;
      draftId?: string;
      newPlan?: string;
    }>(),
    patient = Number(patientId),
    router = useRouter(),
    { t } = useTranslation("v21");
  const token = useAuthStore((s) => s.token);
  const user = String(useAuthStore((s) => s.profile?.id) ?? "");
  const scopeKey = `${user}:${patient}:${draftId || (newPlan === "1" ? "new" : "latest")}`;
  const translate = useRef(t);
  translate.current = t;
  const generation = useRef(0),
    focused = useRef(false),
    owner = useRef<string | null>(null),
    mealsLoaded = useRef(false);
  const viewVersion = generation.current;
  const current = useCallback(
    (expected: number) => {
      const auth = useAuthStore.getState();
      return (
        !!token &&
        !!user &&
        focused.current &&
        generation.current === expected &&
        owner.current === scopeKey &&
        auth.token === token &&
        String(auth.profile?.id ?? "") === user
      );
    },
    [token, user, scopeKey],
  );
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
      {
        time_local: string;
        meal_anchor: Anchor;
        item_indexes: number[];
        note?: string;
        sourceKeys?: string[];
      }[]
    >([]);
  const [loading, setLoading] = useState(true);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftErrorKey, setDraftErrorKey] = useState("draftSaveError");
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);
  const draftSession = useRef<MedicationDraftSession | null>(null);
  const draftLoaded = useRef(false);
  const draftCredential = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [scanning, setScanning] = useState(false),
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
  const reviewInputs = useRef<string | null>(null);
  const saving = useRef<object | null>(null);
  const purposes = useMedicationPurposeLookup({
    enabled: step === 2 && !busy && !!data,
    patient,
    scopeKey,
    version: viewVersion,
    current,
    draft,
    setDraft,
  });
  const createDraftSession = useCallback(
    (initial?: MedSetupDraft | null) =>
      new MedicationDraftSession(
        patient,
        () =>
          useAuthStore.getState().token === token &&
          String(useAuthStore.getState().profile?.id ?? "") === user,
        (status, error) => {
          if (current(generation.current)) {
            setDraftStatus(status);
            setDraftErrorKey(
              error instanceof ApiError && error.code === "MED_DRAFT_CHANGED"
                ? "draftConflict"
                : "draftSaveError",
            );
          }
          if (error)
            reportError(error, {
              component: "medication_setup",
              operation: "draft_save",
            });
        },
        initial,
      ),
    [patient, token, user, current],
  );
  const reload = useCallback(
    async (expected = generation.current, background = false) => {
      if (!current(expected)) return;
      if (!background || !draftLoaded.current) setLoading(true);
      try {
        const d = await v21Api.overview(patient);
        if (!current(expected)) return;
        const resumed = draftId
          ? (d.drafts || (d.draft ? [d.draft] : [])).find(
              (x) => x.id === draftId,
            )
          : newPlan === "1"
            ? null
            : d.draft;
        if (draftId && !resumed && !draftLoaded.current)
          throw new ApiError("", 409, { code: "MED_DRAFT_CHANGED" });
        setData(d);
        if (!draftLoaded.current) {
          draftLoaded.current = true;
          draftSession.current = createDraftSession(resumed);
          if (resumed) {
            const snapshot = resumed.snapshot;
            const photoUrl = (id?: string | null) =>
              id && resumed.photos[id]
                ? `${env.apiBaseUrl}${resumed.photos[id]}`
                : undefined;
            setDraft(
              snapshot.items.map((item) => ({
                ...item,
                photo_uri: photoUrl(item.photo_media_id),
                purposeLookup: item.purposeLookup?.result
                  ? { ...item.purposeLookup, loading: false }
                  : undefined,
              })),
            );
            setPhotoMediaId(snapshot.photoMediaId);
            setPhoto(photoUrl(snapshot.photoMediaId) || null);
            setMeals(snapshot.meals);
            setSlots(snapshot.slots);
            // A chosen draft opens its editable names/types. Existing items
            // must also remain reachable when an old draft was left on step 1.
            setStep(
              snapshot.items.length && (draftId || snapshot.step === 1)
                ? 2
                : snapshot.step,
            );
            if (snapshot.slots.length)
              reviewInputs.current = JSON.stringify({
                meals: snapshot.meals,
                items: snapshot.items.map((item) => ({
                  clientId: item.clientId,
                  anchors: item.anchors,
                })),
              });
            setDraftStatus("saved");
            mealsLoaded.current = true;
          }
        }
        if (!mealsLoaded.current)
          setMeals({
            breakfast: d.meals.breakfast.slice(0, 5),
            lunch: d.meals.lunch.slice(0, 5),
            dinner: d.meals.dinner.slice(0, 5),
            bedtime: d.meals.bedtime.slice(0, 5),
          });
        mealsLoaded.current = true;
      } catch (e) {
        if (current(expected)) v21Error(e, translate.current);
      } finally {
        if (current(expected)) setLoading(false);
      }
    },
    [patient, draftId, newPlan, current, createDraftSession],
  );
  useFocusEffect(
    useCallback(() => {
      const changed =
        owner.current !== scopeKey || draftCredential.current !== token;
      draftCredential.current = token;
      owner.current = scopeKey;
      focused.current = true;
      generation.current++;
      if (changed) {
        draftSession.current = null;
        draftLoaded.current = false;
        setDraftStatus("idle");
        setPhotoMediaId(null);
        setData(null);
        setDraft([]);
        setSlots([]);
        setPhoto(null);
        setStep(1);
        setScanFailures(0);
        mealsLoaded.current = false;
        reviewInputs.current = null;
        savedBody.current = null;
        requestId.current = randomUUID();
      }
      saving.current = null;
      pendingPhoto.current = null;
      setBusy(false);
      setScanning(false);
      setConsent(false);
      setListening(false);
      void reload(generation.current, !changed);
      return () => {
        void draftSession.current?.flush().catch(() => {});
        focused.current = false;
        generation.current++;
        pendingPhoto.current = null;
        if (recordTimer.current) clearTimeout(recordTimer.current);
        const rec = recording.current;
        recording.current = null;
        if (rec)
          void rec
            .stopAndUnloadAsync()
            .then(() => {
              if (!recording.current)
                return Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            })
            .catch(() => {});
      };
    }, [reload, scopeKey]),
  );
  const snapshot = (): MedDraftSnapshot | null => {
    if (!draft.length && !photoMediaId) return null;
    return {
      version: 1,
      step,
      items: draft.map(draftItem),
      meals,
      slots,
      photoMediaId,
    };
  };
  useEffect(() => {
    if (!current(viewVersion) || !draftLoaded.current || loading || busy)
      return;
    const value = snapshot();
    if (value) draftSession.current?.schedule(value);
  }, [
    step,
    draft,
    meals,
    slots,
    photoMediaId,
    loading,
    busy,
    viewVersion,
    current,
  ]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" || !current(viewVersion)) return;
      const value = snapshot();
      if (value) draftSession.current?.schedule(value);
      void draftSession.current?.flush().catch(() => {});
    });
    return () => subscription.remove();
  }, [step, draft, meals, slots, photoMediaId, viewVersion, current]);
  const exitDraft = async () => {
    const expected = viewVersion;
    if (!current(expected) || busy) return;
    const value = snapshot();
    if (value) draftSession.current?.schedule(value);
    setBusy(true);
    try {
      await draftSession.current?.flush();
      if (current(expected)) router.back();
    } catch {
      if (current(expected))
        useToastStore.getState().show(t("draftSaveError"), "error");
    } finally {
      if (current(expected)) setBusy(false);
    }
  };
  const retryDraft = async () => {
    const expected = viewVersion;
    if (!current(expected) || busy || listening) return;
    const value = snapshot();
    if (!value) return;
    draftSession.current?.schedule(value);
    setBusy(true);
    try {
      await draftSession.current?.flush();
    } catch {
      // Keep all edits and the retry action visible; the session records the error.
    } finally {
      if (current(expected)) setBusy(false);
    }
  };
  const update = (i: number, x: Partial<MedicationDraft>) => {
    if (current(viewVersion))
      setDraft((old) =>
        old.map((d, n) => {
          if (i !== n) return d;
          const identityChanged =
            (x.display_name !== undefined &&
              x.display_name !== d.display_name) ||
            (x.kind !== undefined && x.kind !== d.kind);
          return {
            ...d,
            ...x,
            ...(identityChanged
              ? {
                  confirmed: x.confirmed === true,
                  purposeLookup: undefined,
                  selectedPurposeCodes: [],
                }
              : {}),
          };
        }),
      );
  };
  const leave = () => {
    if (!current(viewVersion) || busy) return;
    if (step > 1 && !busy) {
      setStep((s) => s - 1);
      return;
    }
    if (!draft.length && !photo) {
      router.back();
      return;
    }
    void exitDraft();
  };
  const withConsent = async (work: () => Promise<void>) => {
    if (!current(viewVersion)) return;
    const granted = await hasAiDataConsent();
    if (!current(viewVersion)) return;
    if (granted) await work();
    else {
      pendingPhoto.current = work;
      setConsent(true);
    }
  };
  const pick = async (camera: boolean) => {
    const expected = viewVersion;
    if (busy || !current(expected)) return;
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!current(expected)) return;
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
      if (!current(expected)) return;
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        useToastStore.getState().show(t("medicationPhotoReadError"), "error");
        return;
      }
      setPhoto(asset.uri);
      await withConsent(async () => {
        if (!current(expected)) return;
        setBusy(true);
        setScanning(true);
        let upload: MedicationPhotoUpload | null = null;
        let stage = "photo_prepare";
        try {
          upload = await prepareMedicationPhoto(asset);
          if (!current(expected)) return;
          stage = "photo_upload";
          const scan = await v21Api.scan(patient, upload.body);
          if (!current(expected)) return;
          setPhotoMediaId(scan.mediaId);
          if (!scan.readable || !scan.items.length) {
            setScanFailures((n) => n + 1);
            useToastStore
              .getState()
              .show(t(scanFailures ? "scanFallback" : "scanRetry"), "info");
            return;
          }
          const items: MedicationDraft[] = scan.items.map((item) => ({
            clientId: randomUUID(),
            display_name: item.display_name || "",
            printed_name: item.printed_name,
            kind: item.kind,
            source: "PHOTO_AI",
            confirmed: false,
            photo_media_id: scan.mediaId,
            photo_uri: asset.uri,
            timeHints: item.suggested_slots.filter((a) =>
              ["morning", "noon", "evening"].includes(a),
            ),
            anchors: item.suggested_slots.filter((a): a is Anchor =>
              medicationAnchors.includes(a as Anchor),
            ),
          }));
          setDraft(items);
          setSlots([]);
          setStep(2);
          const session = draftSession.current;
          if (session) {
            session.schedule({
              version: 1,
              step: 2,
              items: items.map(draftItem),
              meals,
              slots: [],
              photoMediaId: scan.mediaId,
            });
            try {
              await session.flush();
            } catch {
              if (current(expected))
                useToastStore.getState().show(t("draftSaveError"), "error");
            }
          }
          if (!current(expected)) return;
          if (scan.partial)
            useToastStore.getState().show(t("partialScan"), "info");
        } catch (error) {
          if (!current(expected)) return;
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
                      : "medicationPhotoReadError",
                ),
                "error",
              );
          } else {
            v21Error(error, t, "medicationPhotoUploadError");
          }
        } finally {
          upload?.dispose();
          if (current(expected)) {
            setBusy(false);
            setScanning(false);
          }
        }
      });
    } catch (error) {
      if (!current(expected)) return;
      reportError(error, {
        component: "medication_setup",
        operation: "photo_picker",
      });
      useToastStore.getState().show(t("medicationPhotoReadError"), "error");
    }
  };
  const stopVoice = async () => {
    const expected = viewVersion;
    if (!current(expected)) return;
    if (!recording.current) return;
    const rec = recording.current;
    recording.current = null;
    setListening(false);
    if (recordTimer.current) clearTimeout(recordTimer.current);
    setBusy(true);
    try {
      await rec.stopAndUnloadAsync();
      if (!current(expected)) return;
      const uri = rec.getURI();
      if (!uri) return;
      const form = new FormData();
      if (Platform.OS === "web") {
        (form as any).append(
          "audio",
          await (await fetch(uri)).blob(),
          "name.webm",
        );
      } else form.append("audio", new File(uri));
      const r = await v21Api.transcribe(patient, form);
      if (!current(expected)) return;
      setDraft((old) => [
        ...old,
        { ...blank(), display_name: r.text, source: "VOICE" },
      ]);
      setStep(2);
    } catch (e) {
      if (current(expected)) v21Error(e, t);
    } finally {
      if (current(expected)) setBusy(false);
      if (!recording.current)
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(
          () => {},
        );
    }
  };
  const voice = () =>
    void withConsent(async () => {
      const expected = viewVersion;
      if (busy || !current(expected)) return;
      if (listening) {
        await stopVoice();
        return;
      }
      const permission = await Audio.requestPermissionsAsync();
      if (!current(expected)) return;
      if (!permission.granted) {
        useToastStore.getState().show(t("voicePermission"), "error");
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        if (!current(expected)) return;
        const r = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        if (!current(expected)) {
          await r.recording.stopAndUnloadAsync();
          return;
        }
        recording.current = r.recording;
        setListening(true);
        recordTimer.current = setTimeout(() => void stopVoice(), 20000);
      } catch (e) {
        if (current(expected)) v21Error(e, t);
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
    const inputs = JSON.stringify({
      meals,
      items: draft.map((d) => ({ clientId: d.clientId, anchors: d.anchors })),
    });
    if (reviewInputs.current === inputs && slots.length) {
      setStep(4);
      return;
    }
    const grouped = new Map<
      string,
      {
        time_local: string;
        meal_anchor: Anchor;
        item_indexes: number[];
        sourceKeys: string[];
      }
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
          sourceKeys: [],
        };
        if (!row.item_indexes.includes(i)) row.item_indexes.push(i);
        row.sourceKeys.push(`${d.clientId || i}:${a}`);
        grouped.set(time, row);
      }),
    );
    if (grouped.size > 4) {
      useToastStore.getState().show(t("scheduleLimit"), "error");
      return;
    }
    reviewInputs.current = inputs;
    setSlots(
      [...grouped.values()]
        .sort((a, b) => a.time_local.localeCompare(b.time_local))
        .map((slot) => {
          const note = [
            ...new Set(
              slots
                .filter((old) =>
                  old.sourceKeys?.some((key) => slot.sourceKeys.includes(key)),
                )
                .map((old) => old.note?.trim())
                .filter(Boolean),
            ),
          ].join("; ");
          return { ...slot, ...(note ? { note } : {}) };
        }),
    );
    setStep(4);
  };
  const save = async () => {
    const expected = viewVersion;
    if (busy || saving.current || !current(expected)) return;
    if (slots.some((s) => !validMedicationTime(s.time_local))) {
      useToastStore.getState().show(t("timeInvalid"), "error");
      return;
    }
    if (slots.some((s) => !validMedicationNote(s.note || ""))) {
      useToastStore.getState().show(t("medicationNoteInvalid"), "error");
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
              note: [
                ...new Set(
                  [existing.note?.trim(), s.note?.trim()].filter(Boolean),
                ),
              ].join("; "),
              item_indexes: [
                ...new Set([...existing.item_indexes, ...s.item_indexes]),
              ],
            }
          : s,
      );
    }
    if ([...grouped.values()].some((s) => !validMedicationNote(s.note || ""))) {
      useToastStore.getState().show(t("medicationNoteMergeInvalid"), "error");
      return;
    }
    const body = {
      items: draft.map(
        ({
          anchors: _,
          clientId: _id,
          photo_uri: _photo,
          timeHints: _hints,
          purposeLookup,
          selectedPurposeCodes,
          ...d
        }) => ({
          ...d,
          confirmed: true,
          ...(purposeLookup?.result?.token && selectedPurposeCodes?.length
            ? {
                tag_confirmation: {
                  token: purposeLookup.result.token,
                  codes: selectedPurposeCodes,
                },
              }
            : {}),
        }),
      ),
      meals,
      slots: [...grouped.values()].map(
        ({ note, sourceKeys: _keys, ...slot }) => ({
          ...slot,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      ),
    };
    const json = JSON.stringify(body);
    if (savedBody.current && savedBody.current !== json)
      requestId.current = randomUUID();
    savedBody.current = json;
    const operation = {};
    saving.current = operation;
    setBusy(true);
    try {
      const value = snapshot();
      if (value) draftSession.current?.schedule(value);
      await draftSession.current?.flush();
      if (!current(expected)) return;
      const r = await v21Api.setup(patient, {
        request_id: requestId.current,
        ...(draftSession.current?.revision
          ? {
              draft_id: draftSession.current.id,
              draft_revision: draftSession.current.revision,
            }
          : {}),
        ...body,
      });
      if (!current(expected)) return;
      draftSession.current?.complete();
      useToastStore
        .getState()
        .show(t(r.pendingConsent ? "consentSent" : "scheduleSaved"), "success");
      router.replace("/medication" as any);
    } catch (e) {
      if (current(expected)) {
        if (
          e instanceof ApiError &&
          (e.code === "MED_TAG_CONFIRMATION_EXPIRED" ||
            e.code === "MED_TAG_CONFIRMATION_INVALID")
        ) {
          draft.forEach((item) => purposes.retry(item));
          setStep(2);
        }
        v21Error(e, t);
      }
    } finally {
      if (saving.current === operation) {
        saving.current = null;
        if (current(expected)) setBusy(false);
      }
    }
  };
  const canContinue =
    current(viewVersion) &&
    !!data &&
    !busy &&
    !listening &&
    !purposes.pending &&
    (step === 2
      ? !!draft.length &&
        draft.every(
          (d) =>
            !!d.kind &&
            d.confirmed &&
            !d.purposeLookup?.loading &&
            !!d.display_name.trim() &&
            d.display_name.trim().length <= 30 &&
            medicationNameHasNoDose(d.display_name),
        )
      : step === 3
        ? Object.values(meals).every(validMedicationTime) &&
          !!draft.length &&
          draft.every((d) => d.anchors.length > 0)
        : step === 4
          ? !!slots.length &&
            slots.every(
              (s) =>
                validMedicationTime(s.time_local) &&
                validMedicationNote(s.note || ""),
            )
          : false);
  const owned = !!token && !!user && owner.current === scopeKey;
  return {
    data: owned ? data : null,
    step: owned ? step : 1,
    draft: owned ? draft : [],
    meals,
    slots: owned ? slots : [],
    loading,
    draftStatus,
    draftErrorKey,
    retryDraft,
    exitDraft,
    discardDraft: () => {
      if (!current(viewVersion) || busy || listening) return;
      const expected = viewVersion;
      Alert.alert(t("deleteDraftTitle"), t("deleteDraftBody"), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("deleteDraft"),
          style: "destructive",
          onPress: async () => {
            if (!current(expected)) return;
            setBusy(true);
            try {
              await draftSession.current?.remove();
              if (!current(expected)) return;
              draftSession.current = createDraftSession();
              draftLoaded.current = true;
              setDraft([]);
              setSlots([]);
              setPhoto(null);
              setPhotoMediaId(null);
              setScanFailures(0);
              setStep(1);
              reviewInputs.current = null;
              savedBody.current = null;
              requestId.current = randomUUID();
              if (draftId || newPlan !== "1")
                router.replace({
                  pathname: "/medication/setup",
                  params: { patientId: patient, newPlan: "1" },
                });
              useToastStore.getState().show(t("draftDeleted"), "success");
            } catch (error) {
              if (current(expected)) v21Error(error, t, "draftDeleteError");
            } finally {
              if (current(expected)) setBusy(false);
            }
          },
        },
      ]);
    },
    busy,
    scanning: current(viewVersion) && scanning,
    photo: owned ? photo : null,
    scanFailures,
    consent: owned ? consent : false,
    listening: owned ? listening : false,
    reload,
    leave,
    pick,
    voice,
    update,
    retryPurpose: (index: number) => {
      if (draft[index]) purposes.retry(draft[index]);
    },
    setDraft: (value: Parameters<typeof setDraft>[0]) => {
      if (current(viewVersion)) setDraft(value);
    },
    setMeals: (value: Parameters<typeof setMeals>[0]) => {
      if (current(viewVersion)) setMeals(value);
    },
    setSlots: (value: Parameters<typeof setSlots>[0]) => {
      if (current(viewVersion)) setSlots(value);
    },
    canContinue,
    addManual: () => {
      if (!current(viewVersion)) return;
      if (!draft.length) setDraft([blank()]);
      setStep(2);
    },
    addItem: (name = "", supplement = false) => {
      if (!current(viewVersion)) return;
      setDraft((old) => {
        const item = {
          ...blank(),
          display_name: name,
          kind: supplement ? ("SUPPLEMENT" as const) : ("MEDICINE" as const),
        };
        const empty = name
          ? old.findIndex(
              (d) =>
                d.source === "CHIP" &&
                !d.display_name.trim() &&
                !d.confirmed &&
                !d.printed_name,
            )
          : -1;
        if (empty >= 0)
          return old.map((d, index) => (index === empty ? item : d));
        return old.length < 20 ? [...old, item] : old;
      });
    },
    next: () => {
      if (!canContinue) return;
      if (step === 2) setStep(3);
      else if (step === 3) review();
      else if (step === 4) void save();
    },
    declineAi: () => {
      if (!current(viewVersion)) return;
      setConsent(false);
      pendingPhoto.current = null;
    },
    agreeAi: () => {
      if (!current(viewVersion)) return;
      setConsent(false);
      const work = pendingPhoto.current;
      pendingPhoto.current = null;
      if (work) void work();
    },
  };
}
export type MedicationSetupController = ReturnType<typeof useMedicationSetup>;
