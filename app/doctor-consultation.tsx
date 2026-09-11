import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScaledText as Text } from "../src/components/ScaledText";
import { useAuthStore } from "../src/features/auth/auth.store";
import { ApiError, apiClient } from "../src/lib/apiClient";
import { env } from "../src/lib/env";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useGuardedRouter } from "../src/hooks/useGuardedRouter";
import { showToast } from "../src/stores/toast.store";
import { radius, spacing } from "../src/styles";

type DoctorTaskResponse = { ok: boolean; data?: { task_id: string } };
type DoctorTaskListResponse = {
  ok: boolean;
  data?: {
    tasks: Array<{
      task_id: string;
      summary: string;
      created_at: string;
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

const isAttachmentMessage = (content?: string | null) =>
  typeof content === "string" && content.startsWith("[ASINU_ATTACHMENT]");

const specialtyLabels: Record<string, string> = {
  general: "Đa khoa",
  general_practice: "Đa khoa",
  internal_medicine: "Nội khoa",
  cardiology: "Tim mạch",
  endocrinology: "Nội tiết và đái tháo đường",
  dermatology: "Da liễu",
  pediatrics: "Nhi khoa",
  nutrition: "Dinh dưỡng",
  psychology: "Tâm lý",
};

const doctorInitials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function DoctorConsultationScreen() {
  const { t } = useTranslation("home");
  const router = useRouter();
  const { colors } = useThemeColors();
  const profile = useAuthStore((state) => state.profile);
  const [summary, setSummary] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tasks, setTasks] = useState<
    NonNullable<DoctorTaskListResponse["data"]>["tasks"]
  >([]);
  const [recommendations, setRecommendations] = useState<
    DoctorRecommendation[]
  >([]);
  const [preferredDoctorId, setPreferredDoctorId] = useState<string | null>(
    null
  );
  const [specialties, setSpecialties] = useState<DoctorSpecialty[]>([]);
  const [clinics, setClinics] = useState<DoctorClinic[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState(env.doctorTenantId);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const loadTasks = async (tenantId = selectedTenantId) => {
    try {
      const response = await apiClient<DoctorTaskListResponse>(
        `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`
      );
      setTasks(response.data?.tasks ?? []);
    } catch {
      setTasks([]);
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
            : items[0]?.tenant_id || current
        );
      })
      .catch(() => {
        setClinics([]);
        setSpecialties([]);
        setRecommendations([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
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
            : items[0]?.code || ""
        );
      })
      .catch(() => {
        setSpecialties([]);
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
      }
    )
      .then((response) => setRecommendations(response.data?.items ?? []))
      .catch(() => setRecommendations([]));
  }, [selectedSpecialty, selectedTenantId]);

  const submit = async () => {
    if (
      !summary.trim() ||
      !consentAccepted ||
      !selectedSpecialty ||
      isSubmitting
    ) {
      showToast(t("doctorConsultationRequired"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
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
            consent_version: profile?.consentVersion || "v1.0.0",
            preferred_doctor_id: preferredDoctorId,
          },
        }
      );
      showToast(t("doctorConsultationSuccess"), "success");
      const taskId = response.data?.task_id;
      if (taskId) {
        router.replace({
          pathname: "/doctor-consultation/[taskId]",
          params: { taskId },
        } as never);
      } else {
        await loadTasks();
      }
    } catch (error) {
      // Keep the friendly fallback, but surface the API's actual message so a
      // rejected request is actionable instead of looking like a silent failure.
      const message =
        error instanceof ApiError && error.message.trim()
          ? error.message
          : error instanceof Error && error.message.trim()
          ? error.message
          : t("doctorConsultationError");
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          <Text style={[styles.backText, { color: colors.textPrimary }]}>
            {t("common:back")}
          </Text>
        </Pressable>
        <View style={[styles.hero, { backgroundColor: colors.surface }]}>
          <View
            style={[styles.icon, { backgroundColor: colors.primary + "18" }]}
          >
            <Ionicons name="medkit-outline" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t("doctorConsultationTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("doctorConsultationSubtitle")}
          </Text>
        </View>
        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t("doctorConsultationSummaryLabel")}
          </Text>
          <TextInput
            multiline
            maxLength={5000}
            onChangeText={setSummary}
            placeholder={t("doctorConsultationSummaryPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            textAlignVertical="top"
            value={summary}
          />
          <View style={styles.clinicSection}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t("doctorConsultationClinicLabel")}
            </Text>
            <Text
              style={[styles.specialtyHint, { color: colors.textSecondary }]}
            >
              {t("doctorConsultationClinicHint")}
            </Text>
            <View style={styles.specialtyOptions}>
              {clinics.map((clinic) => {
                const selected = clinic.tenant_id === selectedTenantId;
                return (
                  <Pressable
                    key={clinic.tenant_id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedTenantId(clinic.tenant_id)}
                    style={[
                      styles.specialtyOption,
                      {
                        backgroundColor: selected
                          ? colors.primary + "14"
                          : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.specialtyName,
                        {
                          color: selected ? colors.primary : colors.textPrimary,
                        },
                      ]}
                    >
                      {clinic.name}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.specialtySection}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t("doctorConsultationSpecialtyLabel")}
            </Text>
            <Text
              style={[styles.specialtyHint, { color: colors.textSecondary }]}
            >
              {t("doctorConsultationSpecialtyHint")}
            </Text>
            <View style={styles.specialtyOptions}>
              {specialties.map((specialty) => {
                const selected = specialty.code === selectedSpecialty;
                return (
                  <Pressable
                    key={specialty.code}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedSpecialty(specialty.code)}
                    style={[
                      styles.specialtyOption,
                      {
                        backgroundColor: selected
                          ? colors.primary + "14"
                          : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.specialtyName,
                        {
                          color: selected ? colors.primary : colors.textPrimary,
                        },
                      ]}
                    >
                      {specialtyLabels[specialty.code] || specialty.name}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
          {recommendations.length > 0 && (
            <View style={styles.recommendationList}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t("doctorConsultationRecommendedDoctors")}
              </Text>
              {recommendations.map((doctor) => {
                const selected = preferredDoctorId === doctor.doctorId;
                return (
                  <Pressable
                    key={doctor.doctorId}
                    onPress={() =>
                      setPreferredDoctorId(selected ? null : doctor.doctorId)
                    }
                    style={[
                      styles.doctorCard,
                      {
                        backgroundColor: selected
                          ? colors.primary + "14"
                          : colors.background,
                      },
                    ]}
                  >
                    {doctor.avatarUrl ? (
                      <Image
                        accessibilityLabel={doctor.fullName}
                        source={{ uri: doctor.avatarUrl }}
                        style={styles.doctorAvatar}
                      />
                    ) : (
                      <View
                        accessibilityLabel={doctor.fullName}
                        style={[
                          styles.doctorAvatar,
                          styles.doctorAvatarFallback,
                          { backgroundColor: colors.primary + "18" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.doctorInitials,
                            { color: colors.primary },
                          ]}
                        >
                          {doctorInitials(doctor.fullName)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.doctorCardCopy}>
                      <Text
                        style={[
                          styles.doctorName,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {doctor.fullName}
                      </Text>
                      <Text
                        style={[
                          styles.doctorMeta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {(doctor.ratingCount ?? 0) > 0
                          ? t("doctorConsultationDoctorMeta", {
                              rating: doctor.reputation.toFixed(1),
                              ratingCount: doctor.ratingCount,
                              minutes: doctor.estimatedWaitMinutes,
                            })
                          : t("doctorConsultationDoctorNoRating", {
                              minutes: doctor.estimatedWaitMinutes,
                            })}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
              <Text
                style={[
                  styles.recommendationHint,
                  { color: colors.textSecondary },
                ]}
              >
                {t("doctorConsultationSoftPreference")}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => setConsentAccepted((value) => !value)}
            style={styles.consentRow}
          >
            <Ionicons
              name={consentAccepted ? "checkbox" : "square-outline"}
              size={24}
              color={consentAccepted ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.consentText, { color: colors.textSecondary }]}>
              {t("doctorConsultationConsent")}
            </Text>
          </Pressable>
          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[
              styles.submit,
              {
                backgroundColor: colors.primary,
                opacity: isSubmitting ? 0.65 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {t("doctorConsultationSubmit")}
              </Text>
            )}
          </Pressable>
        </View>
        {tasks.length > 0 && (
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {t("doctorConsultationThreads")}
            </Text>
            {tasks.map((task) => (
              <Pressable
                key={task.task_id}
                onPress={() =>
                  router.push({
                    pathname: "/doctor-consultation/[taskId]",
                    params: { taskId: task.task_id },
                  } as never)
                }
                style={[
                  styles.threadCard,
                  {
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.threadTitle, { color: colors.textPrimary }]}
                >
                  {task.summary}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.threadPreview,
                    { color: colors.textSecondary },
                  ]}
                >
                  {isAttachmentMessage(task.latest_message)
                    ? t("doctorConsultationAttachPhoto")
                    : task.latest_message || t("doctorConsultationWaiting")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
  },
  backText: { fontSize: 15, fontWeight: "600" },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  title: { fontSize: 26, fontWeight: "800", marginTop: spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 23 },
  formCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: { fontSize: 16, fontWeight: "700" },
  specialtySection: { gap: spacing.xs },
  clinicSection: { gap: spacing.xs },
  specialtyHint: { fontSize: 13, lineHeight: 19 },
  specialtyOptions: { gap: spacing.sm, marginTop: spacing.xs },
  specialtyOption: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  specialtyName: { fontSize: 15, fontWeight: "700" },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 150,
    padding: spacing.md,
  },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  consentText: { flex: 1, fontSize: 14, lineHeight: 21 },
  submit: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  threadCard: {
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  threadTitle: { fontSize: 15, fontWeight: "700" },
  threadPreview: { fontSize: 14, lineHeight: 20 },
  recommendationList: { gap: spacing.sm },
  doctorCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  doctorAvatar: { borderRadius: 24, height: 48, width: 48 },
  doctorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  doctorInitials: { fontSize: 15, fontWeight: "800" },
  doctorCardCopy: { flex: 1 },
  doctorName: { fontSize: 15, fontWeight: "700" },
  doctorMeta: { fontSize: 13, marginTop: 3 },
  recommendationHint: { fontSize: 12, lineHeight: 18 },
});
