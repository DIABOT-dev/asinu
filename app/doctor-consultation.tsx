import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ScaledText as Text } from "../src/components/ScaledText";
import { ScaledTextInput as TextInput } from "../src/components/ScaledTextInput";
import { AppAlertModal } from "../src/components/AppAlertModal";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { useAuthStore } from "../src/features/auth/auth.store";
import { apiClient, getApiErrorMessage } from "../src/lib/apiClient";
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
type DoctorRecommendation = {
  doctorId: string;
  fullName: string;
  avatarUrl?: string | null;
  specialties: string[];
  reputation: number;
  ratingCount?: number;
  estimatedWaitMinutes: number;
  preferred: boolean;
};
type DoctorRecommendationResponse = {
  ok: boolean;
  data?: { items: DoctorRecommendation[]; estimatedWaitMinutes: number | null };
};
type DoctorSpecialty = { code: string; name: string };
type DoctorSpecialtyResponse = {
  ok: boolean;
  data?: { items: DoctorSpecialty[] };
};
type DoctorClinic = { tenant_id: string; name: string; specialties: string[] };
type DoctorClinicResponse = { ok: boolean; data?: { items: DoctorClinic[] } };
type PendingAttachment = { uri: string; name: string; mimeType: string };

const createSubmissionTaskId = () =>
  `doctor-task:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
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
    },
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
    new Date(task.follow_up_until).getTime() > Date.now(),
  );
};

export default function DoctorConsultationScreen() {
  const { t } = useTranslation("home");
  const router = useRouter();
  const { colors, isDark } = useThemeColors();
  const profile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [summary, setSummary] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeConsultation, setActiveConsultation] = useState<
    NonNullable<DoctorTaskListResponse["data"]>["tasks"][number] | null
  >(null);
  const [activeWarningVisible, setActiveWarningVisible] = useState(false);
  const activeWarningTaskRef = useRef<string | null>(null);
  const [recommendations, setRecommendations] = useState<
    DoctorRecommendation[]
  >([]);
  const [preferredDoctorId, setPreferredDoctorId] = useState<string | null>(
    null,
  );
  const [specialties, setSpecialties] = useState<DoctorSpecialty[]>([]);
  const [clinics, setClinics] = useState<DoctorClinic[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<
    number | null
  >(null);
  const [symptomOnset, setSymptomOnset] = useState<
    "today" | "two_to_seven_days" | "over_one_week" | "ongoing" | ""
  >("");
  const [progression, setProgression] = useState<
    "improving" | "stable" | "worsening" | ""
  >("");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe" | "">(
    "",
  );
  const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);

  const submissionTaskIdRef = useRef<string | null>(null);
  const submissionAttachmentMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(PENDING_SUBMISSION_KEY).then((taskId) => {
      if (taskId && !submissionTaskIdRef.current)
        submissionTaskIdRef.current = taskId;
    });
  }, []);

  const loadTasks = async (tenantId = selectedTenantId) => {
    try {
      const response = await apiClient<DoctorTaskListResponse>(
        `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`,
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
    void apiClient<DoctorClinicResponse>("/api/doctor/clinics", {
      method: "POST",
      body: {},
      })
      .then((response) => {
        const items = response.data?.items ?? [];
        setClinics(items);
        setSelectedTenantId((current: string) =>
          items.some((clinic) => clinic.tenant_id === current)
            ? current
            : items[0]?.tenant_id || "",
        );
      })
      .catch(() => {
        setClinics([]);
        setSelectedTenantId("");
        setSpecialties([]);
        setSelectedSpecialty("");
        setRecommendations([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    setSpecialties([]);
    setSelectedSpecialty("");
    void loadTasks(selectedTenantId);
    void apiClient<DoctorSpecialtyResponse>("/api/doctor/specialties", {
      method: "POST",
      body: { tenant_id: selectedTenantId },
      })
      .then((response) => {
        const items = response.data?.items ?? [];
        setSpecialties(items);
        setSelectedSpecialty((current) =>
          items.some((item) => item.code === current)
            ? current
            : items[0]?.code || "",
        );
      })
      .catch(() => {
        setSpecialties([]);
        setSelectedSpecialty("");
        setRecommendations([]);
      });
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedSpecialty) return;
    setPreferredDoctorId(null);
    void apiClient<DoctorRecommendationResponse>(
      "/api/doctor/recommendations",
      {
        method: "POST",
        body: {
          tenant_id: selectedTenantId,
          specialty: selectedSpecialty,
          service_flow: "clinical",
          priority: "normal",
          limit: 3,
        },
      },
    )
      .then((response) => {
        setRecommendations(response.data?.items ?? []);
        setEstimatedWaitMinutes(response.data?.estimatedWaitMinutes ?? null);
      })
      .catch(() => {
        setRecommendations([]);
        setEstimatedWaitMinutes(null);
      });
  }, [selectedSpecialty, selectedTenantId]);

  const pickPreConsultationImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(t("doctorConsultationPhotoPermission"), "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset) return;
      setPendingAttachment({
        uri: asset.uri,
        name: asset.fileName || `doctor-consultation-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch {
      showToast(t("doctorConsultationAttachmentError"), "error");
    }
  };

  const submit = async () => {
    if (
      !summary.trim() ||
      !consentAccepted ||
      !selectedSpecialty ||
      !symptomOnset ||
      !progression ||
      !severity ||
      !emergencyConfirmed ||
      isSubmitting
    ) {
      showToast(t("doctorConsultationRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    const submissionTaskId =
      submissionTaskIdRef.current ?? createSubmissionTaskId();
    submissionTaskIdRef.current = submissionTaskId;
    try {
      await AsyncStorage.setItem(PENDING_SUBMISSION_KEY, submissionTaskId);
      const response = await apiClient<DoctorTaskResponse>(
        "/api/doctor/tasks",
        {
          method: "POST",
          body: {
            tenant_id: selectedTenantId,
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
            },
            consent_version: profile?.consentVersion || "v1.0.0",
            preferred_doctor_id: preferredDoctorId,
            task_id: submissionTaskId,
          },
        },
      );
      const taskId = response.data?.task_id;
      if (taskId) {
        if (pendingAttachment) {
          const formData = new FormData();
          formData.append("file", {
            uri: pendingAttachment.uri,
            name: pendingAttachment.name,
            type: pendingAttachment.mimeType,
          } as any);
          await apiClient(
            `/api/doctor/tasks/${encodeURIComponent(
              taskId,
            )}/attachments?tenant_id=${encodeURIComponent(selectedTenantId)}`,
            {
              method: "POST",
              body: formData,
              headers: {
                "X-Client-Message-Id":
                  submissionAttachmentMessageIdRef.current ??
                  (submissionAttachmentMessageIdRef.current =
                    createClientMessageId()),
              },
            },
          );
        }
        showToast(t("doctorConsultationSuccess"), "success");
        submissionTaskIdRef.current = null;
        submissionAttachmentMessageIdRef.current = null;
        await AsyncStorage.removeItem(PENDING_SUBMISSION_KEY);
        setPendingAttachment(null);
        router.replace({
          pathname: "/doctor-consultation/[taskId]",
          params: { taskId, tenantId: selectedTenantId },
        } as never);
      } else {
        await loadTasks();
      }
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t, "doctorConsultationError"),
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClinic = clinics.find(
    (clinic) => clinic.tenant_id === selectedTenantId,
  );
  const selectedDoctor = recommendations.find(
    (doctor) => doctor.doctorId === preferredDoctorId,
  );
  const selectedSpecialtyItem = specialties.find(
    (specialty) => specialty.code === selectedSpecialty,
  );
  const visibleSpecialties =
    selectedClinic?.specialties && selectedClinic.specialties.length > 0
      ? specialties.filter((specialty) =>
          selectedClinic.specialties.includes(specialty.code),
        )
      : specialties;
  const getSpecialtyLabel = (specialty: DoctorSpecialty) =>
    t(`doctorConsultationSpecialty_${specialty.code}`, {
      defaultValue: specialty.name,
    });

  const handleHeaderBack = () => {
    if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.back();
    }
  };

  const handleStep1Next = () => {
    if (!symptomOnset || !progression || !severity) {
      showToast(t("doctorConsultationScreeningRequired"), "error");
      return;
    }
    if (!summary.trim()) {
      showToast(t("doctorConsultationSummaryRequired"), "error");
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!selectedTenantId) {
      showToast(t("doctorConsultationClinicRequired"), "error");
      return;
    }
    if (!selectedSpecialty) {
      showToast(t("doctorConsultationSpecialtyRequired"), "error");
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Submit = () => {
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
          { backgroundColor: isDark ? colors.background : "#F5FBFC" },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />

        {/* Top Header Bar with Standard Back Button */}
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <ScreenBackButton onPress={handleHeaderBack} />
        </View>

        {/* 3-Step Wizard Navigation Stepper matching Mockup exactly */}
        <View style={styles.stepperContainer}>
          {/* Step 1 Tab */}
          <Pressable
            accessibilityLabel={t("doctorConsultationStepCondition")}
            accessibilityRole="tab"
            onPress={() => setCurrentStep(1)}
            style={styles.stepTabItem}
          >
            <View style={styles.stepTabContent}>
              <View
                style={[
                  styles.stepBadge,
                  currentStep === 1
                    ? styles.stepBadgeActive
                    : currentStep > 1
                      ? styles.stepBadgeCompleted
                      : styles.stepBadgeInactive,
                ]}
              >
                {currentStep > 1 ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      currentStep === 1
                        ? styles.stepNumberActive
                        : styles.stepNumberInactive,
                    ]}
                  >
                    1
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepTitle,
                  currentStep === 1
                    ? styles.stepTitleActive
                    : styles.stepTitleInactive,
                ]}
              >
                {t("doctorConsultationStepCondition")}
              </Text>
            </View>
            {currentStep === 1 && <View style={styles.stepActiveUnderline} />}
          </Pressable>

          {/* Step 2 Tab */}
          <Pressable
            accessibilityLabel={t("doctorConsultationStepClinic")}
            accessibilityRole="tab"
            onPress={() => setCurrentStep(2)}
            style={styles.stepTabItem}
          >
            <View style={styles.stepTabContent}>
              <View
                style={[
                  styles.stepBadge,
                  currentStep === 2
                    ? styles.stepBadgeActive
                    : currentStep > 2
                      ? styles.stepBadgeCompleted
                      : styles.stepBadgeInactive,
                ]}
              >
                {currentStep > 2 ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      currentStep === 2
                        ? styles.stepNumberActive
                        : styles.stepNumberInactive,
                    ]}
                  >
                    2
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepTitle,
                  currentStep === 2
                    ? styles.stepTitleActive
                    : styles.stepTitleInactive,
                ]}
              >
                {t("doctorConsultationStepClinic")}
              </Text>
            </View>
            {currentStep === 2 && <View style={styles.stepActiveUnderline} />}
          </Pressable>

          {/* Step 3 Tab */}
          <Pressable
            accessibilityLabel={t("doctorConsultationStepReview")}
            accessibilityRole="tab"
            onPress={() => setCurrentStep(3)}
            style={styles.stepTabItem}
          >
            <View style={styles.stepTabContent}>
              <View
                style={[
                  styles.stepBadge,
                  currentStep === 3
                    ? styles.stepBadgeActive
                    : styles.stepBadgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep === 3
                      ? styles.stepNumberActive
                      : styles.stepNumberInactive,
                  ]}
                >
                  3
                </Text>
              </View>
              <Text
                style={[
                  styles.stepTitle,
                  currentStep === 3
                    ? styles.stepTitleActive
                    : styles.stepTitleInactive,
                ]}
              >
                {t("doctorConsultationStepReview")}
              </Text>
            </View>
            {currentStep === 3 && <View style={styles.stepActiveUnderline} />}
          </Pressable>
        </View>

        {/* Wizard Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================================= */}
          {/* STEP 1: TÌNH TRẠNG                                                        */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <>
              {/* Hero Banner with Doctor Connect & Better Health badge */}
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: isDark ? colors.surface : "#EDFAF8",
                    borderColor: isDark ? colors.border : "#C6ECE5",
                  },
                ]}
              >
                <View style={styles.heroLeft}>
                  <Text style={styles.heroHeading}>
                    {t("doctorConsultationTitle")}
                  </Text>
                  <Text style={styles.heroSubheading}>
                    {t("doctorConsultationSubtitle")}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroDivider,
                    { backgroundColor: isDark ? colors.border : "#C6ECE5" },
                  ]}
                />

                <View style={styles.heroRight}>
                  <Ionicons
                    name="people"
                    size={28}
                    color="#3A968B"
                  />
                  <Text style={styles.heroRightText}>
                    {t("doctorConsultationHeroBadge")}
                  </Text>
                </View>
              </View>

              {/* Thông tin sàng lọc ban đầu */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#FFF4E5" },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color="#EA580C"
                    />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationScreeningTitle")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {t("doctorConsultationScreeningHint")}
                    </Text>
                  </View>
                </View>

                {/* Onset Question - 4 pills in 1 row */}
                <Text style={styles.questionLabel}>
                  {t("doctorConsultationOnsetLabel")}
                </Text>
                <View style={styles.optionRow4}>
                  {(
                    [
                      "today",
                      "two_to_seven_days",
                      "over_one_week",
                      "ongoing",
                    ] as const
                  ).map((value) => {
                    const selected = symptomOnset === value;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={value}
                        onPress={() => setSymptomOnset(value)}
                        style={[
                          styles.optionPillFlex,
                          {
                            backgroundColor: selected
                              ? "#EDFAF8"
                              : isDark
                                ? colors.background
                                : "#FFFFFF",
                            borderColor: selected
                              ? "#3A968B"
                              : isDark
                                ? colors.border
                                : "#E2ECE9",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionPillTextSmall,
                            {
                              color: selected
                                ? "#3A968B"
                                : isDark
                                  ? colors.textSecondary
                                  : "#2D4348",
                              fontWeight: selected ? "700" : "500",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t(`doctorConsultationOnset_${value}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Progression Question - 3 equal pills */}
                <Text style={styles.questionLabel}>
                  {t("doctorConsultationProgressionLabel")}
                </Text>
                <View style={styles.optionRow3}>
                  {(["improving", "stable", "worsening"] as const).map(
                    (value) => {
                      const selected = progression === value;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          key={value}
                          onPress={() => setProgression(value)}
                          style={[
                            styles.optionPillFlex,
                            {
                              backgroundColor: selected
                                ? "#EDFAF8"
                                : isDark
                                  ? colors.background
                                  : "#FFFFFF",
                              borderColor: selected
                                ? "#3A968B"
                                : isDark
                                  ? colors.border
                                  : "#E2ECE9",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              {
                                color: selected
                                  ? "#3A968B"
                                  : isDark
                                    ? colors.textSecondary
                                    : "#2D4348",
                                fontWeight: selected ? "700" : "500",
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {t(`doctorConsultationProgression_${value}`)}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>

                {/* Severity Question - 3 equal pills */}
                <Text style={styles.questionLabel}>
                  {t("doctorConsultationSeverityLabel")}
                </Text>
                <View style={styles.optionRow3}>
                  {(["mild", "moderate", "severe"] as const).map((value) => {
                    const selected = severity === value;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={value}
                        onPress={() => setSeverity(value)}
                        style={[
                          styles.optionPillFlex,
                          {
                            backgroundColor: selected
                              ? "#EDFAF8"
                              : isDark
                                ? colors.background
                                : "#FFFFFF",
                            borderColor: selected
                              ? "#3A968B"
                              : isDark
                                ? colors.border
                                : "#E2ECE9",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            {
                              color: selected
                                ? "#3A968B"
                                : isDark
                                  ? colors.textSecondary
                                  : "#2D4348",
                              fontWeight: selected ? "700" : "500",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t(`doctorConsultationSeverity_${value}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Bạn muốn bác sĩ hỗ trợ điều gì? */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#EDFAF8" },
                    ]}
                  >
                    <Ionicons name="document-text" size={20} color="#3A968B" />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationSummaryLabel")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {t("doctorConsultationSummaryHint")}
                    </Text>
                  </View>
                </View>

                {/* Text Area */}
                <View
                  style={[
                    styles.textAreaContainer,
                    {
                      backgroundColor: isDark ? colors.background : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#D4E2DF",
                    },
                  ]}
                >
                  <TextInput
                    maxLength={500}
                    multiline
                    onChangeText={setSummary}
                    placeholder={t("doctorConsultationSummaryPlaceholder")}
                    placeholderTextColor={
                      isDark ? colors.textSecondary : "#94A3B8"
                    }
                    style={[
                      styles.textInputField,
                      {
                        color: colors.textPrimary,
                      },
                    ]}
                    textAlignVertical="top"
                    value={summary}
                  />
                </View>
              </View>

              {/* Step 1 Primary Action */}
              <Pressable
                accessibilityRole="button"
                onPress={handleStep1Next}
                style={styles.primaryActionButton}
              >
                <Text style={styles.primaryActionButtonText}>
                  {t("common:continue")}
                </Text>
              </Pressable>
            </>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: NƠI TƯ VẤN                                                        */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <>
              {/* Card 1: Chọn phòng khám */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#EDFAF8" },
                    ]}
                  >
                    <Ionicons name="business" size={20} color="#3A968B" />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationClinicLabel")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {t("doctorConsultationClinicHint")}
                    </Text>
                  </View>
                </View>

                {/* Clinics Radio List */}
                <View style={styles.selectionList}>
                  {clinics.length === 0 ? (
                    <Text style={styles.emptySelectionText}>
                      {t("doctorConsultationNoClinics")}
                    </Text>
                  ) : (
                    clinics.map((clinic) => {
                    const selected = clinic.tenant_id === selectedTenantId;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={clinic.tenant_id}
                        onPress={() => setSelectedTenantId(clinic.tenant_id)}
                        style={[
                          styles.selectableItem,
                          {
                            backgroundColor: selected
                              ? isDark
                                ? "rgba(58,150,139,0.15)"
                                : "#EDFAF8"
                              : isDark
                                ? colors.background
                                : "#FFFFFF",
                            borderColor: selected
                              ? "#3A968B"
                              : isDark
                                ? colors.border
                                : "#D4E2DF",
                          },
                        ]}
                      >
                        <View style={styles.selectableItemLeft}>
                          {selected ? (
                            <View style={styles.radioActiveRing}>
                              <View style={styles.radioActiveDot} />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.radioInactiveRing,
                                {
                                  borderColor: isDark
                                    ? colors.border
                                    : "#94A3B8",
                                },
                              ]}
                            />
                          )}
                          <Text
                            style={[
                              styles.selectableItemText,
                              {
                                color: selected
                                  ? "#3A968B"
                                  : colors.textPrimary,
                              },
                            ]}
                          >
                            {clinic.name}
                          </Text>
                        </View>
                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#3A968B"
                          />
                        )}
                      </Pressable>
                    );
                    })
                  )}
                </View>
              </View>

              {/* Card 2: Chuyên khoa muốn được hỗ trợ */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#EDFAF8" },
                    ]}
                  >
                    <Ionicons name="pulse" size={20} color="#3A968B" />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationSpecialtyLabel")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {t("doctorConsultationSpecialtyHint")}
                    </Text>
                  </View>
                </View>

                {/* Specialties Radio List */}
                <View style={styles.selectionList}>
                  {visibleSpecialties.length === 0 ? (
                    <Text style={styles.emptySelectionText}>
                      {t("doctorConsultationNoSpecialties")}
                    </Text>
                  ) : (
                    visibleSpecialties.map((specialty) => {
                    const selected = specialty.code === selectedSpecialty;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={specialty.code}
                        onPress={() => setSelectedSpecialty(specialty.code)}
                        style={[
                          styles.selectableItem,
                          {
                            backgroundColor: selected
                              ? isDark
                                ? "rgba(58,150,139,0.15)"
                                : "#EDFAF8"
                              : isDark
                                ? colors.background
                                : "#FFFFFF",
                            borderColor: selected
                              ? "#3A968B"
                              : isDark
                                ? colors.border
                                : "#D4E2DF",
                          },
                        ]}
                      >
                        <View style={styles.selectableItemLeft}>
                          {selected ? (
                            <View style={styles.radioActiveRing}>
                              <View style={styles.radioActiveDot} />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.radioInactiveRing,
                                {
                                  borderColor: isDark
                                    ? colors.border
                                    : "#94A3B8",
                                },
                              ]}
                            />
                          )}
                          <Text
                            style={[
                              styles.selectableItemText,
                              {
                                color: selected
                                  ? "#3A968B"
                                  : colors.textPrimary,
                              },
                            ]}
                          >
                            {getSpecialtyLabel(specialty)}
                          </Text>
                        </View>
                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#3A968B"
                          />
                        )}
                      </Pressable>
                    );
                    })
                  )}
                </View>
              </View>

              {/* Card 3: Ảnh hoặc hồ sơ liên quan */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#EDFAF8" },
                    ]}
                  >
                    <Ionicons name="image" size={20} color="#3A968B" />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationPreAttachmentTitle")}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {t("doctorConsultationPreAttachmentHint")}
                    </Text>
                  </View>
                </View>

                {/* Upload Button or Selected Attachment */}
                {pendingAttachment ? (
                  <View
                    style={[
                      styles.attachmentPreviewBox,
                      {
                        backgroundColor: isDark
                          ? colors.background
                          : "#EDFAF8",
                        borderColor: "#3A968B",
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: pendingAttachment.uri }}
                      style={styles.attachmentThumbnail}
                    />
                    <View style={styles.attachmentMetaCol}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.attachmentMetaName,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {pendingAttachment.name}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          "doctorConsultationReplaceAttachment",
                        )}
                        onPress={() => void pickPreConsultationImage()}
                      >
                        <Text style={styles.attachmentChangeLink}>
                          {t("doctorConsultationReplaceAttachment")}
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      hitSlop={10}
                      onPress={() => setPendingAttachment(null)}
                      style={styles.attachmentRemoveIcon}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color="#94A3B8"
                      />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("doctorConsultationChooseAttachment")}
                    onPress={() => void pickPreConsultationImage()}
                    style={[
                      styles.uploadPhotoBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: "#3A968B",
                      },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color="#3A968B"
                    />
                    <Text style={styles.uploadPhotoBtnText}>
                      {t("doctorConsultationChooseAttachment")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Step 2 Bottom Navigation (Quay lại + Tiếp tục) */}
              <View style={styles.twoButtonsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCurrentStep(1)}
                  style={[
                    styles.secondaryNavBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isDark ? colors.border : "#A8DFD6",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryNavBtnText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t("common:back")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleStep2Next}
                  style={styles.primaryNavBtn}
                >
                  <Text style={styles.primaryNavBtnText}>
                    {t("common:continue")}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: XÁC NHẬN                                                          */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <>
              {/* Card: Xác nhận trước khi gửi */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2ECE9",
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: "#EDFAF8" },
                    ]}
                  >
                    <Ionicons name="document-text" size={20} color="#3A968B" />
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.cardTitle}>
                      {t("doctorConsultationReviewTitle")}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.summaryDivider,
                    { backgroundColor: isDark ? colors.border : "#E2ECE9", marginBottom: 4 },
                  ]}
                />

                {/* Key - Value Rows */}
                <View style={styles.summaryTable}>
                  <View style={styles.summaryTableRow}>
                    <Text
                      style={[
                        styles.summaryTableKey,
                        { color: isDark ? colors.textPrimary : "#0F2F38" },
                      ]}
                    >
                      {t("doctorConsultationClinicLabel")}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.summaryTableVal,
                        { color: isDark ? colors.textPrimary : "#0F2F38" },
                      ]}
                    >
                      {selectedClinic?.name || t("common:noDataAvailable")}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.summaryDivider,
                      { backgroundColor: isDark ? colors.border : "#F1F5F9" },
                    ]}
                  />

                  <View style={styles.summaryTableRow}>
                    <Text
                      style={[
                        styles.summaryTableKey,
                        { color: isDark ? colors.textPrimary : "#0F2F38" },
                      ]}
                    >
                      {t("doctorConsultationSpecialtyLabel")}
                    </Text>
                    <Text
                      style={[
                        styles.summaryTableVal,
                        { color: isDark ? colors.textPrimary : "#0F2F38" },
                      ]}
                    >
                      {selectedSpecialtyItem
                        ? getSpecialtyLabel(selectedSpecialtyItem)
                        : t("common:noDataAvailable")}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.summaryDivider,
                      { backgroundColor: isDark ? colors.border : "#F1F5F9" },
                    ]}
                  />

                  <View style={styles.summaryTableRow}>
                    <Text
                      style={[
                        styles.summaryTableKey,
                        { color: isDark ? colors.textPrimary : "#0F2F38" },
                      ]}
                    >
                      {t("doctorConsultationAssignmentLabel")}
                    </Text>
                    <Text
                      style={[
                        styles.summaryTableVal,
                        { color: selectedDoctor ? (isDark ? colors.textPrimary : "#0F2F38") : "#64748B" },
                      ]}
                    >
                      {selectedDoctor
                        ? selectedDoctor.fullName
                        : t("doctorConsultationAutoAssign")}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.summaryDivider,
                    { backgroundColor: isDark ? colors.border : "#F1F5F9", marginTop: 4 },
                  ]}
                />

                {/* Queue / Wait time status notice */}
                <View style={styles.queueStatusRow}>
                  <Ionicons name="time-outline" size={22} color="#3A968B" />
                  <Text style={styles.queueStatusText}>
                    {estimatedWaitMinutes == null
                      ? t("doctorConsultationEtaUnavailable")
                      : t("doctorConsultationEta", {
                          minutes: estimatedWaitMinutes,
                        })}
                  </Text>
                </View>

                {/* Emergency Red Warning Banner */}
                <View
                  style={[
                    styles.emergencyBanner,
                    {
                      backgroundColor: isDark
                        ? "rgba(185,28,28,0.12)"
                        : "#FEF2F2",
                      borderColor: isDark ? "rgba(185,28,28,0.3)" : "#FECACA",
                    },
                  ]}
                >
                  <Ionicons
                    name="warning-outline"
                    size={26}
                    color="#DC2626"
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={[
                      styles.emergencyBannerText,
                      { color: isDark ? "#FCA5A5" : "#DC2626" },
                    ]}
                  >
                    {t("doctorConsultationEmergencyNotice")}
                  </Text>
                </View>

                {/* Checkbox 1: Emergency confirmation */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: emergencyConfirmed }}
                  onPress={() => setEmergencyConfirmed((value) => !value)}
                  style={styles.consentCheckboxRow}
                >
                  <View
                    style={[
                      styles.checkboxSquare,
                      {
                        backgroundColor: emergencyConfirmed
                          ? "#3A968B"
                          : isDark
                            ? colors.background
                            : "#FFFFFF",
                        borderColor: emergencyConfirmed
                          ? "#3A968B"
                          : isDark
                            ? colors.border
                            : "#CBD5E1",
                      },
                    ]}
                  >
                    {emergencyConfirmed && (
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.consentCheckboxText,
                      { color: isDark ? colors.textPrimary : "#475569" },
                    ]}
                  >
                    {t("doctorConsultationEmergencyConfirm")}
                  </Text>
                </Pressable>

                {/* Checkbox 2: Consent */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentAccepted }}
                  onPress={() => setConsentAccepted((value) => !value)}
                  style={styles.consentCheckboxRow}
                >
                  <View
                    style={[
                      styles.checkboxSquare,
                      {
                        backgroundColor: consentAccepted
                          ? "#3A968B"
                          : isDark
                            ? colors.background
                            : "#FFFFFF",
                        borderColor: consentAccepted
                          ? "#3A968B"
                          : isDark
                            ? colors.border
                            : "#CBD5E1",
                      },
                    ]}
                  >
                    {consentAccepted && (
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.consentCheckboxText,
                      { color: isDark ? colors.textPrimary : "#475569" },
                    ]}
                  >
                    {t("doctorConsultationConsent")}
                  </Text>
                </Pressable>
              </View>

              {/* Step 3 Bottom Navigation (Quay lại + Gửi yêu cầu) */}
              <View style={styles.twoButtonsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCurrentStep(2)}
                  style={[
                    styles.secondaryNavBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isDark ? colors.border : "#A8DFD6",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryNavBtnText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t("common:back")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={handleStep3Submit}
                  style={[
                    styles.submitNavBtn,
                    { opacity: isSubmitting ? 0.7 : 1 },
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.submitNavBtnContent}>
                      <Ionicons
                        name="paper-plane"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.submitNavBtnText}>
                        {t("doctorConsultationSubmit")}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
    paddingBottom: 4,
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
    justifyContent: "center",
    position: "relative",
  },
  stepTabContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingBottom: 10,
    paddingTop: 8,
  },
  stepBadge: {
    alignItems: "center",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  stepBadgeActive: {
    backgroundColor: "#3A968B",
  },
  stepBadgeCompleted: {
    backgroundColor: "#3A968B",
  },
  stepBadgeInactive: {
    backgroundColor: "#E2E8F0",
  },
  stepNumber: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepNumberInactive: {
    color: "#64748B",
  },
  stepTitle: {
    fontSize: 13.5,
  },
  stepTitleActive: {
    color: "#3A968B",
    fontWeight: "700",
  },
  stepTitleInactive: {
    color: "#64748B",
    fontWeight: "500",
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
    gap: 14,
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    padding: 16,
  },
  heroLeft: {
    flex: 1.3,
  },
  heroHeading: {
    color: "#0F2F38",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroSubheading: {
    color: "#6B8289",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  heroDivider: {
    height: 48,
    marginHorizontal: 12,
    width: 1,
  },
  heroRight: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  heroRightText: {
    color: "#3A968B",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  cardIconBox: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  cardTitle: {
    color: "#0F2F38",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: "#6B8289",
    fontSize: 12.5,
    lineHeight: 17.5,
    marginTop: 2,
  },
  questionLabel: {
    color: "#0F2F38",
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 10,
  },
  optionRow4: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  optionRow3: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  optionPillFlex: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  optionPillTextSmall: {
    fontSize: 12,
  },
  optionPillText: {
    fontSize: 13,
  },
  textAreaContainer: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    minHeight: 100,
    padding: 12,
  },
  textInputField: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 76,
  },
  primaryActionButton: {
    alignItems: "center",
    backgroundColor: "#3A968B",
    borderRadius: 16,
    elevation: 2,
    height: 52,
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#3A968B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primaryActionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  selectionList: {
    gap: 10,
    marginTop: 4,
  },
  emptySelectionText: {
    color: "#6B8289",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
  selectableItem: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
  },
  selectableItemLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  selectableItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  radioActiveRing: {
    alignItems: "center",
    borderColor: "#3A968B",
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioActiveDot: {
    backgroundColor: "#3A968B",
    borderRadius: 5.5,
    height: 11,
    width: 11,
  },
  radioInactiveRing: {
    borderRadius: 11,
    borderWidth: 1.8,
    height: 22,
    width: 22,
  },
  uploadPhotoBtn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginTop: 4,
  },
  uploadPhotoBtnText: {
    color: "#3A968B",
    fontSize: 15,
    fontWeight: "700",
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
  attachmentMetaCol: {
    flex: 1,
  },
  attachmentMetaName: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  attachmentChangeLink: {
    color: "#3A968B",
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 3,
  },
  attachmentRemoveIcon: {
    padding: 4,
  },
  twoButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  secondaryNavBtn: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 0.6,
    height: 52,
    justifyContent: "center",
  },
  secondaryNavBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryNavBtn: {
    alignItems: "center",
    backgroundColor: "#3A968B",
    borderRadius: 16,
    elevation: 2,
    flex: 1,
    height: 52,
    justifyContent: "center",
    shadowColor: "#3A968B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primaryNavBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  summaryTable: {
    gap: 0,
  },
  summaryTableRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 10,
  },
  summaryTableKey: {
    color: "#0F2F38",
    fontSize: 14,
    fontWeight: "600",
    width: 125,
  },
  summaryTableVal: {
    color: "#0F2F38",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "left",
  },
  summaryDivider: {
    height: 1,
    width: "100%",
  },
  queueStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  queueStatusText: {
    color: "#3A968B",
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  emergencyBanner: {
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 14,
  },
  emergencyBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  consentCheckboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  checkboxSquare: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  consentCheckboxText: {
    color: "#475569",
    flex: 1,
    fontSize: 13,
    lineHeight: 18.5,
  },
  submitNavBtn: {
    alignItems: "center",
    backgroundColor: "#3A968B",
    borderRadius: 16,
    elevation: 2,
    flex: 1,
    height: 52,
    justifyContent: "center",
    shadowColor: "#3A968B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  submitNavBtnContent: {
    alignItems: "center",
    flexDirection: "row",
  },
  submitNavBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
