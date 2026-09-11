import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
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
  specialties: string[];
  reputation: number;
  estimatedWaitMinutes: number;
  preferred: boolean;
};
type DoctorRecommendationResponse = {
  ok: boolean;
  data?: { items: DoctorRecommendation[]; estimatedWaitMinutes: number | null };
};

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

  const loadTasks = async () => {
    try {
      const response = await apiClient<DoctorTaskListResponse>(
        `/api/doctor/tasks?tenant_id=${encodeURIComponent(env.doctorTenantId)}`
      );
      setTasks(response.data?.tasks ?? []);
    } catch {
      setTasks([]);
    }
  };

  useEffect(() => {
    void loadTasks();
    void apiClient<DoctorRecommendationResponse>(
      "/api/doctor/recommendations",
      {
        method: "POST",
        body: {
          tenant_id: env.doctorTenantId,
          specialty: "internal_medicine",
          service_flow: "clinical",
          priority: "normal",
          limit: 3,
        },
      }
    )
      .then((response) => setRecommendations(response.data?.items ?? []))
      .catch(() => setRecommendations([]));
  }, []);

  const submit = async () => {
    if (!summary.trim() || !consentAccepted || isSubmitting) {
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
            tenant_id: env.doctorTenantId,
            specialty: "internal_medicine",
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
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface },
          ]}
        >
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
        <View
          style={[
            styles.formCard,
            { backgroundColor: colors.surface },
          ]}
        >
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
                        {t("doctorConsultationDoctorMeta", {
                          rating: doctor.reputation.toFixed(1),
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
          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.surface },
            ]}
          >
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
                  {task.latest_message || t("doctorConsultationWaiting")}
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
  doctorCardCopy: { flex: 1 },
  doctorName: { fontSize: 15, fontWeight: "700" },
  doctorMeta: { fontSize: 13, marginTop: 3 },
  recommendationHint: { fontSize: 12, lineHeight: 18 },
});
