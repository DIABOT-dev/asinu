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

const DOCTOR_BANNER_ILLUSTRATION =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=350&auto=format&fit=crop&q=80";

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
  const { colors, isDark } = useThemeColors();
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
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#F4F7F9" },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: isDark ? colors.border : "#EEF2F6",
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.headerBackBtn}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {t("doctorConsultationHeaderTitle")}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner with Doctor Illustration */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? colors.surface : "#E6FAF7",
              borderColor: isDark ? colors.border : "#D3F5EF",
            },
          ]}
        >
          <View style={styles.heroLeft}>
            <View style={styles.heroMedkitBadge}>
              <Ionicons name="medkit" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
              {t("doctorConsultationTitle")}
            </Text>
            <Text
              style={[
                styles.heroSubheading,
                { color: isDark ? colors.textSecondary : "#64748B" },
              ]}
            >
              {t("doctorConsultationSubtitle")}
            </Text>
          </View>

          <View style={styles.heroRight}>
            <View style={styles.heroBadgeSpeech}>
              <Text style={styles.heroBadgeSpeechText}>
                {t("doctorConsultationHeroBadge")}
              </Text>
            </View>
            <Image
              source={{ uri: DOCTOR_BANNER_ILLUSTRATION }}
              style={styles.heroDoctorImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Form Card */}
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : "#F0F3F6",
            },
          ]}
        >
          {/* Section 1: Bạn muốn bác sĩ hỗ trợ điều gì? */}
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: "#E6FAF7" }]}>
              <Ionicons name="document-text" size={20} color="#00A88F" />
            </View>
            <View style={styles.sectionHeaderTextCol}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t("doctorConsultationSummaryLabel")}
              </Text>
              <Text
                style={[
                  styles.sectionHint,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                {t("doctorConsultationSummaryHint")}
              </Text>
            </View>
          </View>

          {/* Text Input area */}
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: isDark ? colors.background : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <TextInput
              multiline
              maxLength={500}
              onChangeText={setSummary}
              placeholder={t("doctorConsultationSummaryPlaceholder")}
              placeholderTextColor={isDark ? colors.textSecondary : "#94A3B8"}
              style={[
                styles.inputArea,
                {
                  color: colors.textPrimary,
                },
              ]}
              textAlignVertical="top"
              value={summary}
            />
            <Text
              style={[
                styles.charCounter,
                { color: isDark ? colors.textSecondary : "#94A3B8" },
              ]}
            >
              {}
            </Text>
          </View>

          {/* Section 2: Phòng khám */}
          {clinics.length > 0 && (
            <View style={[styles.clinicSection, { marginTop: spacing.md }]}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[styles.sectionIconBox, { backgroundColor: "#E6FAF7" }]}
                >
                  <Ionicons name="business" size={20} color="#00A88F" />
                </View>
                <View style={styles.sectionHeaderTextCol}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    {t("doctorConsultationClinicLabel")}
                  </Text>
                  <Text
                    style={[
                      styles.sectionHint,
                      { color: isDark ? colors.textSecondary : "#64748B" },
                    ]}
                  >
                    {t("doctorConsultationClinicHint")}
                  </Text>
                </View>
              </View>
              <View style={styles.clinicsList}>
                {clinics.map((clinic) => {
                  const selected = clinic.tenant_id === selectedTenantId;
                  return (
                    <Pressable
                      key={clinic.tenant_id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedTenantId(clinic.tenant_id)}
                      style={[
                        styles.clinicPill,
                        {
                          backgroundColor: selected
                            ? isDark
                              ? "rgba(0,168,143,0.15)"
                              : "#F0FBF9"
                            : isDark
                            ? colors.background
                            : "#FFFFFF",
                          borderColor: selected
                            ? "#00A88F"
                            : isDark
                            ? colors.border
                            : "#E2E8F0",
                        },
                      ]}
                    >
                      <View style={styles.clinicPillLeft}>
                        <Ionicons
                          name="business-outline"
                          size={19}
                          color={selected ? "#00A88F" : "#64748B"}
                        />
                        <Text
                          style={[
                            styles.clinicPillName,
                            { color: selected ? "#00A88F" : colors.textPrimary },
                          ]}
                        >
                          {clinic.name}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#00A88F"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Section 3: Chuyên khoa muốn được hỗ trợ */}
          <View style={[styles.sectionHeaderRow, { marginTop: spacing.md }]}> 
            <View style={[styles.sectionIconBox, { backgroundColor: "#E6FAF7" }]}>
              <Ionicons name="pulse" size={20} color="#00A88F" />
            </View>
            <View style={styles.sectionHeaderTextCol}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t("doctorConsultationSpecialtyLabel")}
              </Text>
              <Text
                style={[
                  styles.sectionHint,
                  { color: isDark ? colors.textSecondary : "#64748B" },
                ]}
              >
                {t("doctorConsultationSpecialtyHint")}
              </Text>
            </View>
          </View>

          {/* Specialty Options List */}
          <View style={styles.specialtiesList}>
            {specialties.map((specialty) => {
              const selected = specialty.code === selectedSpecialty;
              return (
                <Pressable
                  key={specialty.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedSpecialty(specialty.code)}
                  style={[
                    styles.specialtyPill,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? "rgba(0,168,143,0.15)"
                          : "#F0FBF9"
                        : isDark
                        ? colors.background
                        : "#FFFFFF",
                      borderColor: selected
                        ? "#00A88F"
                        : isDark
                        ? colors.border
                        : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.specialtyPillLeft}>
                    <View
                      style={[
                        styles.specialtyIconRound,
                        {
                          backgroundColor: selected
                            ? "#E0F7F4"
                            : isDark
                            ? colors.surface
                            : "#F1F5F9",
                        },
                      ]}
                    >
                      <Ionicons
                        name="pulse"
                        size={18}
                        color={selected ? "#00A88F" : "#64748B"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.specialtyPillName,
                        {
                          color: selected ? "#00A88F" : colors.textPrimary,
                        },
                      ]}
                    >
                      {specialtyLabels[specialty.code] || specialty.name}
                    </Text>
                  </View>

                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#00A88F"
                    />
                  ) : (
                    <View
                      style={[
                        styles.radioCircle,
                        { borderColor: isDark ? colors.border : "#CBD5E1" },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Section: Bác sĩ có thể tiếp nhận ngay */}
          {recommendations.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: "#E6FAF7" }]}>
                  <Ionicons name="people" size={20} color="#00A88F" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t("doctorConsultationRecommendedDoctors")}
                </Text>
              </View>

              <View style={styles.doctorCardsList}>
                {recommendations.map((doctor) => {
                  const selected = preferredDoctorId === doctor.doctorId;
                  return (
                    <Pressable
                      key={doctor.doctorId}
                      onPress={() =>
                        setPreferredDoctorId(selected ? null : doctor.doctorId)
                      }
                      style={[
                        styles.doctorSelectCard,
                        {
                          backgroundColor: selected
                            ? isDark
                              ? "rgba(0,168,143,0.12)"
                              : "#F8FCFB"
                            : isDark
                            ? colors.background
                            : "#FFFFFF",
                          borderColor: selected
                            ? "#00A88F"
                            : isDark
                            ? colors.border
                            : "#E2E8F0",
                        },
                      ]}
                    >
                      {doctor.avatarUrl ? (
                        <Image
                          accessibilityLabel={doctor.fullName}
                          source={{ uri: doctor.avatarUrl }}
                          style={styles.doctorAvatarImg}
                        />
                      ) : (
                        <View
                          accessibilityLabel={doctor.fullName}
                          style={[
                            styles.doctorAvatarImg,
                            styles.doctorAvatarFallback,
                            { backgroundColor: "#E6FAF7" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.doctorInitials,
                              { color: "#00A88F" },
                            ]}
                          >
                            {doctorInitials(doctor.fullName)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.doctorCardBody}>
                        <Text
                          style={[
                            styles.doctorCardName,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {doctor.fullName}
                        </Text>
                        <View style={styles.doctorCardMetaRow}>
                          <Ionicons name="star" size={14} color="#F59E0B" />
                          <Text
                            style={[
                              styles.doctorCardMetaText,
                              {
                                color: isDark
                                  ? colors.textSecondary
                                  : "#64748B",
                              },
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
                      </View>

                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#00A88F"
                        />
                      ) : (
                        <View
                          style={[
                            styles.radioCircle,
                            { borderColor: isDark ? colors.border : "#94A3B8" },
                          ]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Soft preference notice */}
              <View
                style={[
                  styles.softPreferenceCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(0,168,143,0.1)"
                      : "#F0FBF9",
                  },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={20}
                  color="#00A88F"
                  style={styles.softPreferenceIcon}
                />
                <Text
                  style={[
                    styles.softPreferenceText,
                    { color: isDark ? colors.textSecondary : "#475569" },
                  ]}
                >
                  {t("doctorConsultationSoftPreference")}
                </Text>
              </View>
            </View>
          )}

          {/* Consent Checkbox */}
          <Pressable
            onPress={() => setConsentAccepted((value) => !value)}
            style={styles.consentRow}
          >
            <View
              style={[
                styles.checkboxBox,
                {
                  backgroundColor: consentAccepted
                    ? "#00A88F"
                    : "transparent",
                  borderColor: consentAccepted
                    ? "#00A88F"
                    : isDark
                    ? colors.border
                    : "#94A3B8",
                },
              ]}
            >
              {consentAccepted && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text
              style={[
                styles.consentText,
                { color: isDark ? colors.textSecondary : "#475569" },
              ]}
            >
              {t("doctorConsultationConsent")}
            </Text>
          </Pressable>

          {/* Submit Button */}
          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[
              styles.submitBtn,
              {
                opacity: isSubmitting ? 0.65 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Ionicons
                  name="paper-plane"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.submitBtnText}>
                  {t("doctorConsultationSubmit")}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Previous Consultation Threads */}
        {tasks.length > 0 && (
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#F0F3F6",
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: "#E6FAF7" }]}>
                <Ionicons name="time" size={20} color="#00A88F" />
              </View>
              <View style={styles.sectionHeaderTextCol}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t("doctorConsultationThreads")}
                </Text>
                <Text
                  style={[
                    styles.sectionHint,
                    { color: isDark ? colors.textSecondary : "#64748B" },
                  ]}
                >
                  {t("doctorConsultationThreadsHint")}
                </Text>
              </View>
            </View>

            <View style={styles.threadsList}>
              {tasks.map((task) => (
                <Pressable
                  key={task.task_id}
                  onPress={() =>
                    router.push({
                      pathname: "/doctor-consultation/[taskId]",
                      params: {
                        taskId: task.task_id,
                        tenantId: selectedTenantId,
                      },
                    } as never)
                  }
                  style={[
                    styles.threadItem,
                    {
                      backgroundColor: isDark
                        ? colors.background
                        : "#FAFCFD",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
                  ]}
                >
                  <View style={styles.threadItemIconBox}>
                    <Ionicons
                      name="chatbubble-ellipses"
                      size={20}
                      color="#00A88F"
                    />
                  </View>
                  <View style={styles.threadItemContent}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.threadItemTitle,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {task.summary}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.threadItemPreview,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {isAttachmentMessage(task.latest_message)
                        ? t("doctorConsultationAttachPhoto")
                        : task.latest_message ||
                          t("doctorConsultationWaiting")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={isDark ? colors.textSecondary : "#94A3B8"}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? 54 : spacing.xl,
  },
  headerBackBtn: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    marginLeft: -8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginLeft: 4,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: 48,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 140,
    overflow: "hidden",
    padding: spacing.lg,
    position: "relative",
  },
  heroLeft: {
    flex: 1,
    justifyContent: "center",
    paddingRight: spacing.sm,
    zIndex: 2,
  },
  heroMedkitBadge: {
    alignItems: "center",
    backgroundColor: "#00A88F",
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    marginBottom: spacing.xs + 2,
    width: 38,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSubheading: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroRight: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    position: "relative",
    width: 120,
  },
  heroDoctorImage: {
    borderRadius: 18,
    height: 125,
    width: 100,
  },
  heroBadgeSpeech: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C2EFE8",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  heroBadgeSpeechText: {
    color: "#008B76",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionIconBox: {
    alignItems: "center",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sectionHeaderTextCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  inputBox: {
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 4,
    minHeight: 130,
    padding: spacing.md,
  },
  inputArea: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 85,
  },
  charCounter: {
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  clinicSection: {
    gap: spacing.xs,
  },
  clinicsList: {
    gap: spacing.sm,
    marginTop: 4,
  },
  clinicPill: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  clinicPillLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  clinicPillName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  specialtiesList: {
    gap: spacing.sm,
    marginTop: 4,
  },
  specialtyPill: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  specialtyPillLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  specialtyIconRound: {
    alignItems: "center",
    borderRadius: 12,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  specialtyPillName: {
    fontSize: 15,
    fontWeight: "700",
  },
  radioCircle: {
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    width: 22,
  },
  doctorCardsList: {
    gap: spacing.sm,
    marginTop: 4,
  },
  doctorSelectCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing.sm + 2,
    padding: spacing.md,
  },
  doctorAvatarImg: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  doctorAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  doctorInitials: {
    fontSize: 15,
    fontWeight: "800",
  },
  doctorCardBody: {
    flex: 1,
  },
  doctorCardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  doctorCardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 3,
  },
  doctorCardMetaText: {
    fontSize: 13,
  },
  softPreferenceCard: {
    alignItems: "flex-start",
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.xs + 2,
    marginTop: spacing.sm + 2,
    padding: spacing.md,
  },
  softPreferenceIcon: {
    marginTop: 1,
  },
  softPreferenceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  consentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkboxBox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: "#00A88F",
    borderRadius: 18,
    elevation: 2,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 52,
    shadowColor: "#00A88F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  submitBtnContent: {
    alignItems: "center",
    flexDirection: "row",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  threadsList: {
    gap: spacing.sm,
    marginTop: 4,
  },
  threadItem: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm + 2,
    padding: spacing.md,
  },
  threadItemIconBox: {
    alignItems: "center",
    backgroundColor: "#E6FAF7",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  threadItemContent: {
    flex: 1,
  },
  threadItemTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  threadItemPreview: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
