import { LinearGradient } from "expo-linear-gradient";
import { DoctorConsultationIntake } from "../src/features/doctor-consultation/DoctorConsultationIntake";
import { useConsultationDraft } from "../src/features/doctor-consultation/useConsultationDraft";
import { useConsultationScreening } from "../src/features/doctor-consultation/useConsultationScreening";
import {
  useConsultationDirectory,
  type DoctorRecommendation,
  type DoctorSpecialty,
} from "../src/features/doctor-consultation/useConsultationDirectory";
import { runNativePermission } from "../src/lib/native-permissions";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File as CacheFile } from "expo-file-system";
import { ScaledText as Text } from "../src/components/ScaledText";
import { AppAlertModal } from "../src/components/AppAlertModal";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { useAuthStore } from "../src/features/auth/auth.store";
import { apiClient, getApiErrorMessage } from "../src/lib/apiClient";
import { env } from "../src/lib/env";
import { healthStoreSession } from "../src/lib/healthStoreSession";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../src/hooks/useGuardedRouter";
import { showToast } from "../src/stores/toast.store";

type DoctorTaskResponse = { ok: boolean; data?: { task_id: string } };
type DoctorTaskListResponse = {
  ok: boolean;
  data?: {
    tasks: Array<{
      tenant_id?: string;
      task_id: string;
      summary: string;
      created_at: string;
      status?: string | null;
      follow_up_until?: string | null;
      latest_message?: string | null;
      latest_sender_type?: "patient" | "doctor" | null;
      latest_message_at?: string | null;
    }>;
  };
};
type DoctorReview = {
  score: number;
  comment: string | null;
  authorLabel?: string;
  verified?: boolean;
  createdAt: string;
};
type DoctorReviewsResponse = {
  ok: boolean;
  data?: {
    summary: { averageRating: number; ratingCount: number };
    items: DoctorReview[];
  };
};
type PendingAttachment = {
  id: string;
  kind: "image" | "pdf";
  uri: string;
  name: string;
  mimeType: string;
  webFile?: File;
};

const MAX_CONSULTATION_IMAGES = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const removeCachedDocument = (uri: string | null) => {
  if (!uri?.startsWith("file://")) return;
  try {
    new CacheFile(uri).delete();
  } catch {
    // The cache may have been cleared by the OS already.
  }
};

const CONSULTATION_STEPS = [
  { step: 1, labelKey: "doctorConsultationStepCondition" },
  { step: 2, labelKey: "doctorConsultationStepScreening" },
  { step: 3, labelKey: "doctorConsultationStepSpecialist" },
  { step: 4, labelKey: "doctorConsultationStepReview" },
] as const;
type ConsultationStep = (typeof CONSULTATION_STEPS)[number]["step"];
const SPECIALTY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  general: "medkit-outline",
  general_practice: "medkit-outline",
  internal_medicine: "pulse-outline",
  cardiology: "heart-outline",
  endocrinology: "water-outline",
  dermatology: "hand-left-outline",
  pediatrics: "happy-outline",
  nutrition: "nutrition-outline",
  psychology: "chatbubbles-outline",
};
const specialtyKey = (code: string) => code.toLowerCase().replace(/-/g, "_");

const createSubmissionTaskId = () =>
  `doctor-task:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}`;
const PENDING_SUBMISSION_KEY = "@asinu/doctor-consultation/pending-task-id";
const createClientMessageId = () => {
  const cryptoObject = (
    globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    }
  );
};

const ACTIVE_CONSULTATION_STATUSES = new Set([
  "new",
  "queued",
  "assigned",
  "accepted",
  "started",
  "in_progress",
  "waiting_user",
  "waiting_approval",
  "waiting_doctor",
]);

const isActiveConsultation = (task: {
  status?: string | null;
  follow_up_until?: string | null;
}) => {
  if (!task.status) return true;
  if (task.status && ACTIVE_CONSULTATION_STATUSES.has(task.status)) return true;
  return Boolean(
    task.status === "completed" &&
      task.follow_up_until &&
      new Date(task.follow_up_until).getTime() > Date.now()
  );
};

export default function DoctorConsultationScreen() {
  const [draftVersion, setDraftVersion] = useState(0);
  return (
    <DoctorConsultationForm
      key={draftVersion}
      onDiscarded={() => setDraftVersion((version) => version + 1)}
    />
  );
}

function DoctorConsultationForm({ onDiscarded }: { onDiscarded: () => void }) {
  const { t, i18n } = useTranslation("home");
  const router = useRouter();
  const { colors, isDark } = useThemeColors();
  const profile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{
    previousTaskId?: string;
    tenantId?: string;
  }>();
  const previousTaskId =
    typeof params.previousTaskId === "string"
      ? params.previousTaskId
      : undefined;
  const parentTenant =
    typeof params.tenantId === "string" ? params.tenantId : undefined;
  const [reconsultationReady, setReconsultationReady] = useState(
    !previousTaskId
  );
  const pendingSubmissionKey = `${PENDING_SUBMISSION_KEY}:${
    profile?.id ?? "anonymous"
  }:${previousTaskId ?? "new"}`;

  const [selectedStep, setCurrentStep] = useState<ConsultationStep | null>(null);
  const [showExperts, setShowExperts] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);

  // Form State
  const conditionDraft = useConsultationDraft(
    profile?.id ?? null,
    previousTaskId ?? ""
  );
  const {
    summary,
    answers: savedAnswers,
    locale: savedLocale,
    screeningConfirmed,
  } = conditionDraft.values;
  const screeningLocale = i18n.language.startsWith("en") ? "en" : "vi";
  const answers = savedLocale === screeningLocale ? savedAnswers : [];
  const screening = useConsultationScreening({
    owner: profile?.id ?? null,
    ready: conditionDraft.ready,
    summary,
    answers,
    locale: screeningLocale,
    onAnswersChange: (value) => {
      conditionDraft.update("locale", screeningLocale);
      conditionDraft.update("answers", value);
      setConsentAccepted(false);
      setEmergencyConfirmed(false);
    },
    onReady: () => {
      if (currentStep === 2) showToast(t("doctorScreeningRecorded"), "success");
    },
  });
  const {
    symptom_onset: symptomOnset,
    progression,
    severity,
  } = screening.result?.intake ?? {};
  const screeningReady =
    screening.result?.status === "ready" &&
    screening.result.suitable_for_remote_care;
  const resumeAtSpecialty = screeningConfirmed && savedLocale === screeningLocale && screeningReady;
  const restoredStep = resumeAtSpecialty ? 3 : answers.length > 0 ? 2 : 1;
  const requestedStep = conditionDraft.ready && summary.trim()
    ? selectedStep ?? restoredStep
    : 1;
  const needsScreening = requestedStep > 2 && !screeningReady;
  const currentStep = needsScreening ? 2 : requestedStep;
  const canGoBack = currentStep === 1;
  useFocusEffect(useCallback(() => {
    if (canGoBack || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [canGoBack]));
  const directory = useConsultationDirectory();
  const {
    recommendations: allRecommendations,
    preferredDoctorId,
    specialties,
    selectedSpecialty,
    estimatedWaitMinutes,
    selectSpecialty: setSelectedSpecialty,
    selectDoctor: setPreferredDoctorId,
  } = directory;
  const recommendations = previousTaskId
    ? allRecommendations.filter(
        (doctor) => doctor.routingTenantId === parentTenant
      )
    : allRecommendations;
  const choosingSpecialty = currentStep === 3 && (!showExperts || !selectedSpecialty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const formBusy = useRef(false);
  const liveDraftKey = useRef<string | null>(pendingSubmissionKey);
  useEffect(() => {
    liveDraftKey.current = pendingSubmissionKey;
    return () => {
      liveDraftKey.current = null;
    };
  }, [pendingSubmissionKey]);
  const [activeConsultation, setActiveConsultation] = useState<
    NonNullable<DoctorTaskListResponse["data"]>["tasks"][number] | null
  >(null);
  const [activeWarningVisible, setActiveWarningVisible] = useState(false);
  const activeWarningTaskRef = useRef<string | null>(null);
  // Tenant routing is intentionally opaque to patients. It is only retained
  // long enough to submit the task to the provider backend.
  const [selectedTenantId, setSelectedTenantId] = useState(env.doctorTenantId);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [pickingAttachment, setPickingAttachment] = useState(false);
  const pickerInFlight = useRef(false);
  const cachedDocument = useRef<string | null>(null);
  const imageCount = pendingAttachments.filter(({ kind }) => kind === "image").length;
  const hasDocument = pendingAttachments.some(({ kind }) => kind === "pdf");
  const [reviewDoctor, setReviewDoctor] = useState<DoctorRecommendation | null>(
    null
  );
  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState({
    averageRating: 0,
    ratingCount: 0,
  });
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    setCurrentStep(null);
    setShowExperts(false);
    setConsentAccepted(false);
    setEmergencyConfirmed(false);
    setDiscardVisible(false);
    setIsDiscarding(false);
  }, [pendingSubmissionKey]);

  useEffect(() => {
    if (needsScreening) {
      setCurrentStep(2);
      setConsentAccepted(false);
      setEmergencyConfirmed(false);
    }
  }, [needsScreening]);

  const submissionTaskIdRef = useRef<string | null>(null);
  const uploadedAttachmentIds = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    submissionTaskIdRef.current = null;
    uploadedAttachmentIds.current.clear();
    setPendingAttachments([]);
    setPickingAttachment(false);
    void AsyncStorage.getItem(pendingSubmissionKey).then((taskId) => {
      if (!active) return;
      if (taskId && !submissionTaskIdRef.current)
        submissionTaskIdRef.current = taskId;
    });
    return () => {
      active = false;
      removeCachedDocument(cachedDocument.current);
      cachedDocument.current = null;
    };
  }, [pendingSubmissionKey]);

  useEffect(() => {
    let active = true;
    setReconsultationReady(!previousTaskId);
    if (previousTaskId && parentTenant) {
      apiClient<{ data?: { specialty: string; tenant_id: string } }>(
        `/api/doctor/tasks/${encodeURIComponent(
          previousTaskId
        )}/reconsultation?tenant_id=${encodeURIComponent(parentTenant)}`
      )
        .then((result) => {
          if (active && result.data) {
            setSelectedSpecialty(result.data.specialty);
            setSelectedTenantId(result.data.tenant_id);
            setReconsultationReady(true);
          }
        })
        .catch((error) => {
          if (active)
            showToast(
              getApiErrorMessage(error, t, t("doctorCareError")),
              "error"
            );
        });
    }
    return () => {
      active = false;
    };
  }, [previousTaskId, parentTenant, setSelectedSpecialty, t]);

  const loadTasks = async (tenantId = selectedTenantId) => {
    try {
      const response = await apiClient<DoctorTaskListResponse>(
        `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`
      );
      const nextTasks = response.data?.tasks ?? [];
      const current = nextTasks.find(isActiveConsultation) ?? null;
      setActiveConsultation(current);
      if (current && activeWarningTaskRef.current !== current.task_id) {
        activeWarningTaskRef.current = current.task_id;
        setActiveWarningVisible(true);
      }
      if (!current) activeWarningTaskRef.current = null;
    } catch {
      setActiveConsultation(null);
    }
  };

  useEffect(() => {
    if (!selectedTenantId) return;
    void loadTasks(selectedTenantId);
  }, [selectedTenantId]);

  const handleRefresh = async () => {
    if (refreshInFlight.current || isSubmitting) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        directory.refresh(),
        selectedTenantId ? loadTasks(selectedTenantId) : Promise.resolve(),
      ]);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  };

  const openReviews = async (doctor: DoctorRecommendation) => {
    setReviewDoctor(doctor);
    setReviews([]);
    setReviewSummary({
      averageRating: doctor.reputation || 0,
      ratingCount: doctor.ratingCount || 0,
    });
    setReviewsLoading(true);
    try {
      const response = await apiClient<DoctorReviewsResponse>(
        `/api/doctor/specialists/${encodeURIComponent(doctor.doctorId)}/reviews`
      );
      setReviews(response.data?.items ?? []);
      if (response.data?.summary) setReviewSummary(response.data.summary);
    } catch {
      showToast(t("doctorConsultationReviewsError"), "error");
    } finally {
      setReviewsLoading(false);
    }
  };

  const pickAttachment = async (kind: PendingAttachment["kind"]) => {
    const remainingImages = MAX_CONSULTATION_IMAGES - imageCount;
    if (pickerInFlight.current || formBusy.current || (kind === "image" ? remainingImages <= 0 : hasDocument)) return;

    const session = healthStoreSession.capture();
    const isCurrent = () =>
      liveDraftKey.current === pendingSubmissionKey && healthStoreSession.isCurrent(session);
    if (!isCurrent()) return;
    pickerInFlight.current = true;
    setPickingAttachment(true);
    try {
      if (kind === "pdf") {
        const { getDocumentAsync } = await import("expo-document-picker");
        const result = await runNativePermission(
          () => getDocumentAsync({ type: "application/pdf", multiple: false, copyToCacheDirectory: true, base64: false }),
          { key: "consultation-document-picker" }
        );
        const document = result.canceled ? undefined : result.assets[0];
        if (!document) return;
        const validType = /\.pdf$/i.test(document.name) &&
          (!document.mimeType || document.mimeType === "application/pdf" || document.mimeType === "application/octet-stream");
        const tooLarge = (document.size ?? 0) > MAX_ATTACHMENT_BYTES;
        if (!isCurrent() || !validType || tooLarge) {
          removeCachedDocument(document.uri);
          if (isCurrent()) showToast(t(tooLarge ? "doctorConsultationAttachmentTooLarge" : "doctorConsultationAttachmentFormat"), "error");
          return;
        }
        cachedDocument.current = document.uri;
        setPendingAttachments((attachments) => [...attachments, {
          id: createClientMessageId(),
          kind,
          uri: document.uri,
          name: document.name,
          mimeType: "application/pdf",
          webFile: document.file,
        }]);
        return;
      }

      const permission = await runNativePermission(
        () => ImagePicker.requestMediaLibraryPermissionsAsync(),
        { key: "photo-library", canRun: isCurrent }
      );
      if (!isCurrent()) return;
      if (!permission.granted) {
        showToast(t("doctorConsultationPhotoPermission"), "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingImages,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        quality: 0.8,
      });
      if (result.canceled || !isCurrent()) return;

      const added: PendingAttachment[] = [];
      let tooLarge = false;
      let unsupported = false;
      for (const asset of result.assets.slice(0, remainingImages)) {
        const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(asset.uri)?.[1]?.toLowerCase();
        const mimeType = (extension && IMAGE_MIME_TYPES[extension]) || asset.mimeType;
        const format = Object.keys(IMAGE_MIME_TYPES).find((key) => IMAGE_MIME_TYPES[key] === mimeType);
        if ((asset.fileSize ?? 0) > MAX_ATTACHMENT_BYTES) {
          tooLarge = true;
          continue;
        }
        if (!mimeType || !format) {
          unsupported = true;
          continue;
        }
        added.push({
          id: createClientMessageId(),
          kind,
          uri: asset.uri,
          name: (asset.fileName?.replace(/\.[^.]+$/, "") || "photo") + "." + format,
          mimeType,
          webFile: asset.file,
        });
      }
      setPendingAttachments((attachments) => [...attachments, ...added]);
      if (tooLarge || unsupported) {
        showToast(t(tooLarge ? "doctorConsultationAttachmentTooLarge" : "doctorConsultationAttachmentFormat"), "error");
      }
    } catch {
      if (isCurrent()) showToast(t("doctorConsultationAttachmentError"), "error");
    } finally {
      pickerInFlight.current = false;
      if (liveDraftKey.current === pendingSubmissionKey) setPickingAttachment(false);
    }
  };

  const removeAttachment = (attachment: PendingAttachment) => {
    if (attachment.kind === "pdf") {
      removeCachedDocument(attachment.uri);
      cachedDocument.current = null;
    }
    setPendingAttachments((attachments) => attachments.filter(({ id }) => id !== attachment.id));
  };

  const submit = async () => {
    if (formBusy.current || pickerInFlight.current) return;
    if (
      !summary.trim() ||
      !consentAccepted ||
      !selectedSpecialty ||
      !symptomOnset ||
      !progression ||
      !severity ||
      !screeningReady ||
      !reconsultationReady ||
      !emergencyConfirmed ||
      isSubmitting
    ) {
      showToast(t("doctorConsultationRequired"), "error");
      return;
    }
    formBusy.current = true;
    setIsSubmitting(true);
    const submissionTaskId =
      submissionTaskIdRef.current ?? createSubmissionTaskId();
    submissionTaskIdRef.current = submissionTaskId;
    const routingTenantId =
      (previousTaskId ? parentTenant : undefined) ||
      selectedDoctor?.routingTenantId ||
      recommendations[0]?.routingTenantId ||
      selectedSpecialtyItem?.routingTenantId ||
      selectedTenantId;
    let sendingAttachments = false;
    try {
      await AsyncStorage.setItem(pendingSubmissionKey, submissionTaskId);
      const response = await apiClient<DoctorTaskResponse>(
        "/api/doctor/tasks",
        {
          method: "POST",
          body: {
            tenant_id: routingTenantId,
            specialty: selectedSpecialty,
            service_flow: "clinical",
            priority: "normal",
            source_channel: "asinu-mobile",
            service_code: "doctor-consultation",
            summary: summary.trim(),
            clinical_intake: {
              symptom_onset: symptomOnset,
              progression,
              severity,
              emergency_confirmation: true,
              screening_answers: answers,
              screening_locale: screeningLocale,
            },
            consent_version: profile?.consentVersion || "v1.0.0",
            preferred_doctor_id: preferredDoctorId,
            task_id: submissionTaskId,
            ...(previousTaskId ? { previous_task_id: previousTaskId } : {}),
          },
        }
      );
      const taskId = response.data?.task_id;
      if (taskId) {
        sendingAttachments = true;
        for (const attachment of pendingAttachments) {
          if (uploadedAttachmentIds.current.has(attachment.id)) continue;
          const formData = new FormData();
          if (attachment.webFile) {
            formData.append("file", new File([attachment.webFile], attachment.name, { type: attachment.mimeType }));
          } else {
            formData.append("file", {
              uri: attachment.uri,
              name: attachment.name,
              type: attachment.mimeType,
            } as unknown as Blob);
          }
          await apiClient(
            `/api/doctor/tasks/${encodeURIComponent(taskId)}/attachments?tenant_id=${encodeURIComponent(routingTenantId)}`,
            {
              method: "POST",
              body: formData,
              headers: { "X-Client-Message-Id": attachment.id },
            }
          );
          uploadedAttachmentIds.current.add(attachment.id);
        }
        sendingAttachments = false;
        await conditionDraft.clear();
        showToast(t("doctorConsultationSuccess"), "success");
        submissionTaskIdRef.current = null;
        uploadedAttachmentIds.current.clear();
        await AsyncStorage.removeItem(pendingSubmissionKey);
        removeCachedDocument(cachedDocument.current);
        cachedDocument.current = null;
        setPendingAttachments([]);
        router.replace({
          pathname: "/doctor-consultation/[taskId]",
          params: { taskId, tenantId: routingTenantId },
        } as never);
      } else {
        await loadTasks();
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "CONSULTATION_SCREENING_REQUIRED"
      ) {
        setCurrentStep(2);
        setConsentAccepted(false);
        setEmergencyConfirmed(false);
        void screening.check();
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "DOCTOR_TASK_CLOSED"
      ) {
        submissionTaskIdRef.current = null;
        uploadedAttachmentIds.current.clear();
        await AsyncStorage.removeItem(pendingSubmissionKey);
        showToast(t("doctorConsultationClosedRequest"), "error");
      } else {
        showToast(
          getApiErrorMessage(error, t, sendingAttachments ? "doctorConsultationAttachmentError" : "doctorConsultationError"),
          "error"
        );
      }
    } finally {
      formBusy.current = false;
      setIsSubmitting(false);
    }
  };

  const selectedDoctor = recommendations.find(
    (doctor) => doctor.doctorId === preferredDoctorId
  );
  const selectedSpecialtyItem = specialties.find(
    (specialty) => specialty.code === selectedSpecialty
  );
  const getSpecialtyLabel = (specialty: DoctorSpecialty) =>
    t(`doctorConsultationSpecialty_${specialtyKey(specialty.code)}`, {
      defaultValue: specialty.name,
    });

  const getDoctorSpecialtyLabel = (value: string) => {
    const label = value.trim();
    if (["tổng quát", "đa khoa"].includes(label.toLowerCase())) {
      return t("doctorConsultationSpecialty_general");
    }
    const code = specialtyKey(label);
    const option = specialties.find(
      (item) => specialtyKey(item.code) === code
    );
    return getSpecialtyLabel({
      code,
      name: option?.name ?? (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(label) ? "" : label),
    });
  };
  const autoAssign = preferredDoctorId === null;
  const expertListWidth = Math.min(screenWidth, 720) - 40;
  const specialtyTileWidth = screenWidth < 340 || fontScale > 1.25
    ? expertListWidth
    : (expertListWidth - 12) / 2;
  const expertCardGap = 10;
  const expertCardWidth = expertListWidth > 540 ? (expertListWidth - 36) / 2 : expertListWidth - 24;
  const canAdvanceExpertStep = Boolean(selectedSpecialty) && !pickingAttachment && (choosingSpecialty || !directory.loading);
  const selectionColors = (selected: boolean) => ({
    backgroundColor: selected ? colors.primaryLight : colors.surface,
    borderColor: selected ? colors.primaryText : colors.border,
  });
  const renderSelectionMark = (selected: boolean) => (
    <View style={[styles.expertRadio, { borderColor: selected ? colors.primaryText : colors.textSecondary }]}>
      {selected && <View style={[styles.expertRadioDot, { backgroundColor: colors.primaryText }]} />}
    </View>
  );

  const canDiscard =
    conditionDraft.ready &&
    (Boolean(summary) || selectedStep !== null) &&
    !isSubmitting &&
    !isDiscarding &&
    !pickingAttachment;
  const handleDiscard = async () => {
    if (formBusy.current || !canDiscard) return;
    const session = healthStoreSession.capture();
    const isCurrent = () =>
      liveDraftKey.current === pendingSubmissionKey &&
      session.owner === (profile?.id ?? null) &&
      (!session.owner || healthStoreSession.isCurrent(session));
    if (!isCurrent()) return;
    formBusy.current = true;
    setIsDiscarding(true);
    let removedTaskId: string | null = null;
    try {
      const savedTaskId = await AsyncStorage.getItem(pendingSubmissionKey);
      if (!isCurrent()) return;
      await AsyncStorage.removeItem(pendingSubmissionKey);
      removedTaskId = submissionTaskIdRef.current ?? savedTaskId;
      if (!isCurrent()) return;
      if (!(await conditionDraft.clear({ discard: true }))) return;
      if (!isCurrent()) return;
      showToast(t("doctorConsultationDiscarded"), "success");
      onDiscarded();
    } catch {
      if (!isCurrent()) return;
      if (removedTaskId) {
        await AsyncStorage.setItem(pendingSubmissionKey, removedTaskId).catch(() => {});
      }
      if (isCurrent()) showToast(t("doctorConsultationDiscardError"), "error");
    } finally {
      formBusy.current = false;
      if (liveDraftKey.current === pendingSubmissionKey) setIsDiscarding(false);
    }
  };

  const handleStartScreening = () => {
    if (formBusy.current || currentStep !== 1 || !conditionDraft.ready || !summary.trim()) return;
    Keyboard.dismiss();
    setCurrentStep(2);
    return screening.check();
  };

  const handleChooseSpecialist = () => {
    if (formBusy.current || currentStep !== 2) return;
    if (!screeningReady || !symptomOnset || !progression || !severity) {
      showToast(t("doctorConsultationScreeningRequired"), "error");
      return;
    }
    if (!summary.trim()) {
      showToast(t("doctorConsultationSummaryRequired"), "error");
      return;
    }
    if (!conditionDraft.update("screeningConfirmed", true)) return;
    setShowExperts(false);
    setCurrentStep(3);
  };

  const handleShowExperts = () => {
    if (formBusy.current || !choosingSpecialty || !selectedSpecialty) return;
    setShowExperts(true);
  };

  const handleReview = () => {
    if (formBusy.current || pickerInFlight.current || currentStep !== 3 || choosingSpecialty || directory.loading || !screeningReady) return;
    if (!selectedSpecialty) {
      showToast(t("doctorConsultationSpecialtyRequired"), "error");
      return;
    }
    setCurrentStep(4);
  };

  const handleConfirm = () => {
    if (!emergencyConfirmed) {
      showToast(t("doctorConsultationEmergencyRequired"), "error");
      return;
    }
    if (!consentAccepted) {
      showToast(t("doctorConsultationConsentRequired"), "error");
      return;
    }
    void submit();
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.screen,
          { backgroundColor: currentStep >= 3 || isDark ? colors.background : "#F5FBFC" },
        ]}
      >
        {currentStep < 3 && (
          <LinearGradient
            pointerEvents="none"
            accessible={false}
            colors={
              isDark
                ? ["#12312F", "#151F28", "#0F1117"]
                : ["#E1F3EF", "#F0F8F7", "#F1F6FB"]
            }
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        )}

        <Stack.Screen options={{ headerShown: false, gestureEnabled: canGoBack }} />

        {/* Top Header Bar with Standard Back Button */}
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          {canGoBack ? (
            <ScreenBackButton onPress={() => router.back()} disabled={isDiscarding} />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
          <Text
            numberOfLines={2}
            style={[styles.topBarTitle, { color: colors.textPrimary }]}
          >
            {t("doctorConsultationHeaderTitle")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDiscard }}
            disabled={!canDiscard}
            onPress={() => {
              Keyboard.dismiss();
              setDiscardVisible(true);
            }}
            style={styles.discardAction}
          >
            <Text style={[styles.discardActionText, { color: canDiscard ? colors.danger : colors.textSecondary }]}>
              {t("doctorConsultationDiscardAction")}
            </Text>
          </Pressable>
        </View>

        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t(CONSULTATION_STEPS[currentStep - 1].labelKey)}
          accessibilityValue={{ min: 1, max: CONSULTATION_STEPS.length, now: currentStep }}
          style={[styles.stepperContainer, { borderBottomColor: colors.border }]}
        >
          {CONSULTATION_STEPS.map(({ step, labelKey }) => {
            const active = step === currentStep;
            const complete = step < currentStep;
            const badgeInk = active
              ? isDark ? colors.background : colors.surface
              : complete ? colors.primaryText : colors.textSecondary;
            return (
              <View key={step} style={styles.stepTabItem}>
                <View style={styles.stepTabContent}>
                  <View style={[styles.stepBadge, {
                    backgroundColor: active
                      ? colors.primaryText
                      : complete ? colors.primaryLight : colors.surfaceMuted,
                  }]}>
                    {complete ? (
                      <Ionicons accessible={false} name="checkmark" size={13} color={badgeInk} />
                    ) : (
                      <Text style={[styles.stepNumber, { color: badgeInk }]}>{step}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stepTitle,
                    active && styles.stepTitleActive,
                    { color: active ? colors.primaryText : colors.textSecondary },
                  ]}>
                    {t(labelKey)}
                  </Text>
                </View>
                {active && <View style={[styles.stepActiveUnderline, { backgroundColor: colors.primaryText }]} />}
              </View>
            );
          })}
        </View>

        {/* Wizard Scrollable Content */}
        <ScrollView
          key={currentStep === 3
            ? choosingSpecialty ? "consultation-specialty" : "consultation-experts"
            : currentStep === 2 && screening.result?.isDone && !screening.busy ? "screening-result" : currentStep}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: currentStep >= 3 ? 20 : insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              enabled={!isSubmitting && !isDiscarding}
              tintColor={colors.primaryText}
              colors={[colors.primaryText]}
            />
          }
        >
          {/* ========================================================================= */}
          {previousTaskId && (
            <Text
              style={{
                color: colors.textPrimary,
                marginBottom: 12,
                fontWeight: "600",
              }}
            >
              {t("doctorReconsult")}
            </Text>
          )}
          {/* Mô tả và sàng lọc */}
          {/* ========================================================================= */}
          {(isDiscarding || (currentStep === 1 && !conditionDraft.ready)) && (
            <ActivityIndicator
              accessibilityLabel={t("common:loading")}
              color={colors.primaryText}
            />
          )}
          {currentStep <= 2 && conditionDraft.ready && !isDiscarding && (
            <DoctorConsultationIntake
              key={pendingSubmissionKey}
              stage={currentStep === 1 ? "description" : "screening"}
              summary={summary}
              screening={screening}
              onSummaryChange={(value) => {
                if (formBusy.current || !conditionDraft.update("summary", value)) return;
                screening.reset();
                setConsentAccepted(false);
                setEmergencyConfirmed(false);
              }}
              onStartScreening={handleStartScreening}
              onContinue={handleChooseSpecialist}
            />
          )}

          {currentStep === 3 && !isDiscarding && (
            <View style={styles.expertStep}>
              <Text accessibilityRole="header" style={[styles.expertHeading, { color: colors.textPrimary }]}>
                {t(choosingSpecialty ? "doctorConsultationChooseSpecialtyTitle" : "doctorConsultationChooseExpertTitle")}
              </Text>
              {(directory.error || (directory.loading && (!choosingSpecialty || !specialties.length))) && (
                <View style={styles.directoryNotice} accessibilityLiveRegion="polite">
                  {directory.loading && <ActivityIndicator color={colors.primaryText} />}
                  <Text
                    accessibilityRole={directory.error ? "alert" : undefined}
                    style={[styles.expertSupportingText, styles.expertTextColumn, { color: colors.textSecondary }]}
                  >
                    {t(directory.loading ? "doctorConsultationDirectoryLoading" : "doctorConsultationDirectoryError")}
                  </Text>
                  {directory.error && !directory.loading && (
                    <Pressable accessibilityRole="button" onPress={handleRefresh} style={styles.expertTextAction}>
                      <Text style={[styles.expertActionLabel, { color: colors.primaryText }]}>{t("common:retry")}</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {choosingSpecialty ? (
                <View style={styles.specialtyGrid} accessibilityRole="radiogroup">
                  {specialties.map((specialty) => {
                    const selected = specialty.code === selectedSpecialty;
                    return (
                      <Pressable
                        key={specialty.code}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, selected }}
                        onPress={() => setSelectedSpecialty(specialty.code)}
                        style={({ pressed }) => [
                          styles.specialtyTile,
                          selectionColors(selected),
                          { width: specialtyTileWidth },
                          pressed && styles.expertPressed,
                        ]}
                      >
                        <View style={styles.specialtyTileTop}>
                          <View style={[styles.expertIconTile, { backgroundColor: selected ? colors.surface : colors.primaryLight }]}>
                            <Ionicons
                              accessible={false}
                              name={SPECIALTY_ICONS[specialtyKey(specialty.code)] ?? "medical-outline"}
                              size={22}
                              color={colors.primaryText}
                            />
                          </View>
                          {renderSelectionMark(selected)}
                        </View>
                        <Text style={[styles.specialtyTileLabel, { color: selected ? colors.primaryText : colors.textPrimary }]}>
                          {getSpecialtyLabel(specialty)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!specialties.length && !directory.loading && !directory.error && (
                    <Text style={[styles.expertSupportingText, { color: colors.textSecondary }]}>
                      {t("doctorConsultationNoSpecialties")}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <View
                    style={[styles.specialtySummary, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Ionicons accessible={false} name="medical-outline" size={18} color={colors.primaryText} />
                    <Text style={[styles.expertOptionTitle, styles.expertTextColumn, { color: colors.textPrimary }]}>
                      {getSpecialtyLabel(selectedSpecialtyItem ?? { code: selectedSpecialty, name: selectedSpecialty })}
                    </Text>
                  </View>

                  {recommendations.length > 0 ? (
                    <ScrollView
                      key={selectedSpecialty}
                      horizontal
                      scrollEnabled={recommendations.length > 1}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: expertCardGap }}
                      decelerationRate="fast"
                      disableIntervalMomentum
                      snapToInterval={expertCardWidth + expertCardGap}
                      accessibilityLabel={t("doctorConsultationSpecialistsTitle")}
                    >
                      {recommendations.map((doctor) => {
                        const selected = doctor.doctorId === preferredDoctorId;
                        const specialtyNames = [...new Set(doctor.specialties.map(getDoctorSpecialtyLabel).filter(Boolean))];
                        const availability = doctor.availability;
                        const online = availability === "online";
                        const availabilityColor = online ? colors.primaryText : colors.textSecondary;
                        const hasRating = Boolean(doctor.ratingCount) && Number.isFinite(doctor.reputation);
                        return (
                          <View key={doctor.doctorId} style={[
                            styles.doctorListItem,
                            {
                              backgroundColor: colors.surface,
                              borderColor: selected ? colors.primaryText : colors.border,
                              width: recommendations.length === 1 ? expertListWidth : expertCardWidth,
                            },
                          ]}>
                            <View style={styles.doctorListMain}>
                              <View style={[styles.doctorAvatarBox, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons accessible={false} name="person-outline" size={26} color={colors.primaryText} />
                                {doctor.avatarUrl ? <Image source={{ uri: doctor.avatarUrl }} style={styles.doctorAvatar} /> : null}
                              </View>
                              <View style={styles.expertTextColumn}>
                                <Text style={[styles.doctorName, { color: colors.textPrimary }]}>{doctor.fullName}</Text>
                                {specialtyNames.length > 0 && (
                                  <Text style={[styles.expertSupportingText, { color: colors.textSecondary }]}>
                                    {specialtyNames.join(" · ")}
                                  </Text>
                                )}
                                {availability && (
                                  <View style={styles.doctorStatus}>
                                    <View style={[styles.statusDot, { backgroundColor: availabilityColor }]} />
                                    <Text style={[styles.doctorStatusText, { color: availabilityColor }]}>
                                      {t(online ? "doctorConsultationSpecialistOnline" : availability === "busy"
                                        ? "doctorConsultationSpecialistBusy" : "doctorConsultationSpecialistOffline")}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={[styles.doctorDetailsRow, { borderTopColor: colors.border }]}>
                              {hasRating ? (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityHint={t("doctorConsultationViewReviews")}
                                  onPress={() => void openReviews(doctor)}
                                  style={styles.expertTextAction}
                                >
                                  <Ionicons accessible={false} name="star" size={14} color={colors.premiumDark} />
                                  <Text style={[styles.expertActionLabel, { color: colors.primaryText }]}>
                                    {t("doctorConsultationDoctorRating", {
                                      rating: new Intl.NumberFormat(screeningLocale, { maximumFractionDigits: 1 }).format(doctor.reputation),
                                      count: doctor.ratingCount,
                                    })}
                                  </Text>
                                  <Ionicons accessible={false} name="chevron-forward" size={13} color={colors.primaryText} />
                                </Pressable>
                              ) : (
                                <Text style={[styles.expertSupportingText, { color: colors.textSecondary }]}>
                                  {t("doctorConsultationUnrated")}
                                </Text>
                              )}
                              {doctor.estimatedWaitMinutes > 0 && (
                                <View style={styles.doctorWait}>
                                  <Ionicons accessible={false} name="time-outline" size={15} color={colors.textSecondary} />
                                  <Text style={[styles.expertSupportingText, styles.expertLooseText, { color: colors.textSecondary }]}>
                                    {t("doctorConsultationDoctorWait", { minutes: doctor.estimatedWaitMinutes })}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Pressable
                              accessibilityRole="radio"
                              accessibilityLabel={doctor.fullName}
                              accessibilityHint={t("doctorConsultationSelectExpert")}
                              accessibilityState={{ checked: selected, selected }}
                              onPress={() => {
                                setPreferredDoctorId(doctor.doctorId);
                                if (doctor.routingTenantId) setSelectedTenantId(doctor.routingTenantId);
                              }}
                              style={({ pressed }) => [
                                styles.doctorSelect,
                                { backgroundColor: selected ? colors.primaryText : colors.primaryLight },
                                pressed && styles.expertPressed,
                              ]}
                            >
                              <Ionicons accessible={false} name={selected ? "checkmark-circle-outline" : "add"} size={19}
                                color={selected ? isDark ? colors.background : colors.surface : colors.primaryText} />
                              <Text style={[styles.expertOptionTitle, styles.expertLooseText, {
                                color: selected ? isDark ? colors.background : colors.surface : colors.primaryText,
                              }]}>
                                {t(selected ? "doctorConsultationExpertSelected" : "doctorConsultationSelectExpert")}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    !directory.loading && !directory.error && (
                      <View style={[styles.emptyExperts, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons accessible={false} name="people-outline" size={26} color={colors.primaryText} />
                        <Text style={[styles.expertSupportingText, styles.expertTextColumn, { color: colors.textPrimary }]}>
                          {t("doctorConsultationNoSpecialists")}
                        </Text>
                      </View>
                    )
                  )}

                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: autoAssign, selected: autoAssign }}
                    onPress={() => setPreferredDoctorId(null)}
                    style={({ pressed }) => [
                      styles.autoAssignOption,
                      selectionColors(autoAssign),
                      pressed && styles.expertPressed,
                    ]}
                  >
                    <Ionicons accessible={false} name="shuffle-outline" size={20} color={colors.primaryText} />
                    <Text style={[styles.expertOptionTitle, styles.expertTextColumn, { color: colors.textPrimary }]}>
                      {t("doctorConsultationAutoAssign")}
                    </Text>
                    {renderSelectionMark(autoAssign)}
                  </Pressable>
                  <View style={styles.attachmentSection}>
                    <Text accessibilityRole="header" style={[styles.expertOptionTitle, { color: colors.textPrimary }]}>
                      {t("doctorConsultationPreAttachmentTitle")}
                    </Text>
                    <View style={styles.attachmentActions}>
                      {([
                        { kind: "image", icon: "image-outline", disabled: imageCount >= MAX_CONSULTATION_IMAGES,
                          label: t("doctorConsultationAttachImages", { count: imageCount, limit: MAX_CONSULTATION_IMAGES }) },
                        { kind: "pdf", icon: "document-text-outline", disabled: hasDocument,
                          label: t("doctorConsultationAttachDocument", { count: hasDocument ? 1 : 0 }) },
                      ] as const).map(({ kind, icon, disabled, label }) => (
                        <Pressable
                          key={kind}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: disabled || pickingAttachment }}
                          disabled={disabled || pickingAttachment}
                          onPress={() => void pickAttachment(kind)}
                          style={({ pressed }) => [
                            styles.attachOption,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            (pressed || disabled) && styles.expertPressed,
                          ]}
                        >
                          <Ionicons accessible={false} name={icon} size={19} color={colors.primaryText} />
                          <Text style={[styles.expertActionLabel, { color: colors.textPrimary }]}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {pendingAttachments.map((attachment) => (
                      <View key={attachment.id} style={[styles.attachmentPreviewBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {attachment.kind === "image" ? (
                          <Image source={{ uri: attachment.uri }} style={styles.attachmentThumbnail} />
                        ) : (
                          <View style={[styles.attachmentThumbnail, styles.documentThumbnail, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons accessible={false} name="document-text-outline" size={20} color={colors.primaryText} />
                          </View>
                        )}
                        <Text numberOfLines={2} style={[styles.expertTextColumn, { color: colors.textPrimary }]}>
                          {attachment.name}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("doctorConsultationRemoveAttachment", { name: attachment.name })}
                          disabled={pickingAttachment}
                          onPress={() => removeAttachment(attachment)}
                          style={styles.attachmentRemoveIcon}
                        >
                          <Ionicons accessible={false} name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {currentStep === 4 && !isDiscarding && (
            <View style={styles.reviewStep}>
              <Text accessibilityRole="header" style={[styles.reviewHeading, { color: colors.textPrimary }]}>
                {t("doctorConsultationReviewTitle")}
              </Text>

              <View style={[styles.reviewSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[
                  {
                    label: t("doctorConsultationSpecialtyLabel"),
                    value: selectedSpecialtyItem
                      ? getSpecialtyLabel(selectedSpecialtyItem)
                      : t("common:noDataAvailable"),
                  },
                  {
                    label: t("doctorConsultationAssignmentLabel"),
                    value: selectedDoctor?.fullName ?? t("doctorConsultationAutoAssign"),
                  },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.reviewField}>
                    <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>{label}</Text>
                    <Text style={[styles.reviewValue, { color: colors.textPrimary }]}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.reviewQueue, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons accessible={false} name="time-outline" size={22} color={colors.primaryText} />
                  <Text style={[styles.reviewQueueText, { color: colors.primaryText }]}>
                    {estimatedWaitMinutes == null
                      ? t("doctorConsultationEtaUnavailable")
                      : t("doctorConsultationEta", { minutes: estimatedWaitMinutes })}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.reviewWarning,
                { backgroundColor: isDark ? "#29191D" : "#FFF4F3", borderColor: isDark ? "#624045" : "#F0CDC8" },
              ]}>
                <Ionicons accessible={false} name="warning-outline" size={24} color={colors.danger} />
                <Text style={[styles.reviewBody, { color: colors.textPrimary }]}>
                  {t("doctorConsultationEmergencyNotice")}
                </Text>
              </View>

              <View style={styles.reviewConfirmations}>
                {([
                  { key: "doctorConsultationEmergencyConfirm", checked: emergencyConfirmed, setChecked: setEmergencyConfirmed },
                  { key: "doctorConsultationConsent", checked: consentAccepted, setChecked: setConsentAccepted },
                ] as const).map(({ key, checked, setChecked }) => (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => setChecked((value) => !value)}
                    style={({ pressed }) => [
                      styles.reviewCheckboxRow,
                      {
                        backgroundColor: checked ? colors.primaryLight : colors.surface,
                        borderColor: checked ? colors.primaryText : colors.border,
                      },
                      pressed && styles.expertPressed,
                    ]}
                  >
                    <View style={[
                      styles.reviewCheckbox,
                      {
                        backgroundColor: checked ? colors.primaryText : colors.surface,
                        borderColor: checked ? colors.primaryText : colors.textSecondary,
                      },
                    ]}>
                      {checked && (
                        <Ionicons accessible={false} name="checkmark" size={16} color={isDark ? colors.background : colors.surface} />
                      )}
                    </View>
                    <Text style={[styles.reviewBody, { color: colors.textPrimary }]}>{t(key)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
        {currentStep === 3 && !isDiscarding && (
          <View style={[styles.expertFooter, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdvanceExpertStep }}
              disabled={!canAdvanceExpertStep}
              onPress={choosingSpecialty ? handleShowExperts : handleReview}
              style={({ pressed }) => [
                styles.expertContinue,
                { backgroundColor: canAdvanceExpertStep ? colors.primaryText : colors.surfaceMuted },
                pressed && styles.expertPressed,
              ]}
            >
              <Text style={[styles.expertContinueText, { color: canAdvanceExpertStep ? isDark ? colors.background : colors.surface : colors.textSecondary }]}>
                {t(choosingSpecialty ? "doctorConsultationSeeSpecialists" : "common:continue")}
              </Text>
            </Pressable>
          </View>
        )}
        {currentStep === 4 && !isDiscarding && (
          <View style={[
            styles.expertFooter,
            { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
          ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting || directory.loading, busy: isSubmitting }}
              disabled={isSubmitting || directory.loading}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.expertContinue,
                styles.reviewSubmit,
                { backgroundColor: colors.primaryText },
                (pressed || directory.loading) && styles.expertPressed,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  accessibilityLabel={t("doctorConsultationSubmitting")}
                  color={isDark ? colors.background : colors.surface}
                />
              ) : (
                <Text style={[styles.reviewSubmitText, { color: isDark ? colors.background : colors.surface }]}>
                  {t("doctorConsultationSubmit")}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <AppAlertModal
        visible={discardVisible}
        title={t("doctorConsultationDiscardTitle")}
        message={t("doctorConsultationDiscardMessage")}
        onDismiss={() => setDiscardVisible(false)}
        buttons={[
          { text: t("doctorConsultationKeepDraft"), style: "cancel" },
          { text: t("doctorConsultationDiscardAction"), style: "destructive", onPress: handleDiscard },
        ]}
      />
      <AppAlertModal
        buttons={[
          {
            text: t("doctorConsultationOpenActive"),
            onPress: () => {
              if (!activeConsultation) return;
              router.push({
                pathname: "/doctor-consultation/[taskId]",
                params: {
                  taskId: activeConsultation.task_id,
                  tenantId: activeConsultation.tenant_id || selectedTenantId,
                },
              } as never);
            },
          },
          {
            text: t("doctorConsultationContinueLater"),
            style: "cancel",
          },
        ]}
        icon={{ name: "chat-processing-outline", color: "#3A968B" }}
        message={t("doctorConsultationActiveMessage")}
        onDismiss={() => setActiveWarningVisible(false)}
        title={t("doctorConsultationActiveTitle")}
        visible={activeWarningVisible && Boolean(activeConsultation)}
      />

      <Modal
        visible={Boolean(reviewDoctor)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewDoctor(null)}
      >
        <Pressable
          style={styles.reviewsOverlay}
          onPress={() => setReviewDoctor(null)}
        >
          <Pressable
            style={[styles.reviewsSheet, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.reviewsSheetHandle} />
            <View style={styles.reviewsSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.reviewsSheetTitle,
                    { color: colors.textPrimary },
                  ]}
                >
                  {reviewDoctor?.fullName}
                </Text>
                <Text style={styles.reviewsSheetSummary}>
                  {reviewSummary.averageRating.toFixed(1)} ★ ·{" "}
                  {t("doctorConsultationReviewCount", {
                    count: reviewSummary.ratingCount,
                  })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReviewDoctor(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            {reviewsLoading ? (
              <ActivityIndicator
                color="#3A968B"
                style={{ marginVertical: 32 }}
              />
            ) : reviews.length === 0 ? (
              <Text style={styles.emptyReviewsText}>
                {t("doctorConsultationNoReviews")}
              </Text>
            ) : (
              <ScrollView
                style={styles.reviewsScroll}
                showsVerticalScrollIndicator={false}
              >
                {reviews.map((review, index) => (
                  <View
                    key={`${review.createdAt}-${index}`}
                    style={[
                      styles.reviewItem,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.reviewItemHeader}>
                      <Text style={styles.reviewAuthor}>
                        {t("doctorConsultationAnonymizedReview")}
                      </Text>
                      <Text style={styles.reviewStars}>
                        {"★".repeat(Math.max(0, Math.min(5, review.score)))}
                      </Text>
                    </View>
                    {review.comment ? (
                      <Text
                        style={[
                          styles.reviewComment,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {review.comment}
                      </Text>
                    ) : null}
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString(
                        i18n.language.startsWith("en") ? "en-US" : "vi-VN"
                      )}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 52 : 16,
    paddingBottom: 10,
  },
  topBarSpacer: {
    width: 44,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    marginHorizontal: 10,
    textAlign: "center",
  },
  discardAction: {
    justifyContent: "center",
    maxWidth: "30%",
    minHeight: 44,
    minWidth: 44,
  },
  discardActionText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  stepperContainer: {
    borderBottomColor: "#E2ECE9",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  stepTabItem: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    position: "relative",
  },
  stepTabContent: {
    alignItems: "center",
    flexDirection: "column",
    minWidth: 0,
    width: "100%",
    gap: 3,
    paddingHorizontal: 2,
    paddingBottom: 9,
    paddingTop: 6,
  },
  stepBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stepNumber: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "500",
  },
  stepTitleActive: {
    fontWeight: "700",
  },
  stepActiveUnderline: {
    backgroundColor: "#3A968B",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    bottom: 0,
    height: 3,
    left: 8,
    position: "absolute",
    right: 8,
  },
  content: {
    gap: 16,
    padding: 20,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  expertStep: {
    gap: 16,
  },
  expertHeading: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  specialtyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  specialtyTile: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 106,
    gap: 12,
    padding: 13,
  },
  specialtyTileTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  specialtyTileLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  specialtySummary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expertPressed: {
    opacity: 0.72,
  },
  directoryNotice: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  autoAssignOption: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  expertIconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  expertOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  expertTextColumn: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  expertRadio: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  expertRadioDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  doctorListItem: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  doctorListMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  doctorAvatarBox: {
    alignItems: "center",
    borderRadius: 14,
    height: 70,
    justifyContent: "center",
    overflow: "hidden",
    width: 70,
  },
  doctorAvatar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: "100%",
  },
  doctorName: {
    fontSize: 20,
    fontWeight: "800",
  },
  expertSupportingText: {
    fontSize: 13,
  },
  expertLooseText: {
    flexShrink: 1,
  },
  doctorStatus: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
    maxWidth: "100%",
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  doctorStatusText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  doctorDetailsRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginTop: "auto",
    minHeight: 34,
    paddingTop: 3,
  },
  doctorSelect: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyExperts: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  doctorWait: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    maxWidth: "100%",
    minHeight: 26,
  },
  expertTextAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    minHeight: 44,
  },
  expertActionLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  attachmentSection: {
    gap: 8,
  },
  attachmentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attachOption: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expertFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  expertContinue: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 14,
    justifyContent: "center",
    maxWidth: 680,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
  },
  expertContinueText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  reviewsOverlay: {
    backgroundColor: "rgba(15, 47, 56, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
  },
  reviewsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    padding: 20,
  },
  reviewsSheetHandle: {
    alignSelf: "center",
    backgroundColor: "#CBD5E1",
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 42,
  },
  reviewsSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  reviewsSheetTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  reviewsSheetSummary: {
    color: "#3A968B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  reviewsScroll: {
    flexGrow: 0,
  },
  reviewItem: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  reviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewAuthor: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  reviewStars: {
    color: "#F59E0B",
    fontSize: 13,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  reviewDate: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 6,
  },
  emptyReviewsText: {
    color: "#64748B",
    fontSize: 14,
    paddingVertical: 28,
    textAlign: "center",
  },
  attachmentPreviewBox: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    padding: 10,
  },
  attachmentThumbnail: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  documentThumbnail: {
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentRemoveIcon: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  reviewStep: {
    gap: 18,
  },
  reviewHeading: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  reviewSummary: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  reviewField: {
    gap: 2,
  },
  reviewLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  reviewValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  reviewQueue: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewQueueText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    minWidth: 0,
  },
  reviewWarning: {
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  reviewBody: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
    minWidth: 0,
  },
  reviewConfirmations: {
    gap: 10,
  },
  reviewCheckboxRow: {
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    padding: 14,
  },
  reviewCheckbox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  },
  reviewSubmit: {
    minHeight: 56,
  },
  reviewSubmitText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
