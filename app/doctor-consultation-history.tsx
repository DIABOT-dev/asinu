import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  SectionList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../src/components/ScaledText";
import { Screen } from "../src/components/Screen";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../src/hooks/useGuardedRouter";
import { apiClient } from "../src/lib/apiClient";
import { env } from "../src/lib/env";
import { radius, spacing, typography } from "../src/styles";

type ConsultationTask = {
  tenant_id?: string;
  task_id: string;
  summary: string;
  status?: string | null;
  follow_up_until?: string | null;
  created_at: string;
  latest_message?: string | null;
  latest_sender_type?: "patient" | "doctor" | null;
  latest_message_at?: string | null;
};

type TaskListResponse = {
  ok: boolean;
  data?: { tasks: ConsultationTask[] };
};

type ClinicListResponse = {
  ok: boolean;
  data?: { items: Array<{ tenant_id: string }> };
};

const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
  "expired",
  "failed",
  "emergency_referred",
  "forwarded",
]);

const statusKey = (status?: string | null) => {
  if (status === "accepted") return "doctorConsultationStatus_assigned";
  if (status === "started") return "doctorConsultationStatus_in_progress";
  return status
    ? `doctorConsultationStatus_${status}`
    : "doctorConsultationWaiting";
};

const previewText = (
  task: ConsultationTask,
  waitingLabel: string,
  attachmentLabel: string,
  voiceLabel: string
) => {
  if (task.latest_message?.startsWith("[ASINU_ATTACHMENT]"))
    return attachmentLabel;
  if (task.latest_message?.startsWith("[ASINU_VOICE]")) return voiceLabel;
  return task.latest_message || waitingLabel;
};

const isFollowUpOpen = (task: ConsultationTask) =>
  task.status === "completed" &&
  Boolean(
    task.follow_up_until &&
      new Date(task.follow_up_until).getTime() > Date.now()
  );

const formatDate = (value: string, language: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(language.startsWith("en") ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DoctorConsultationHistoryScreen() {
  const router = useRouter();
  const { t: tHome, i18n } = useTranslation("home");
  const { t: tSettings } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<ConsultationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const sections = useMemo(() => {
    const ongoing = tasks.filter(
      (task) =>
        !TERMINAL_STATUSES.has(task.status || "queued") || isFollowUpOpen(task)
    );
    const closed = tasks.filter(
      (task) =>
        TERMINAL_STATUSES.has(task.status || "queued") && !isFollowUpOpen(task)
    );
    return [
      { title: tSettings("doctorConsultationHistoryOngoing"), data: ongoing },
      { title: tSettings("doctorConsultationHistoryClosed"), data: closed },
    ].filter((section) => section.data.length > 0);
  }, [tasks, tSettings]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const clinicResponse = await apiClient<ClinicListResponse>(
        "/api/doctor/clinics",
        { method: "POST", body: {} }
      ).catch(() => null);
      const tenantIds = Array.from(
        new Set(
          [
            env.doctorTenantId,
            ...(clinicResponse?.data?.items ?? []).map(
              (item) => item.tenant_id
            ),
          ].filter(Boolean)
        )
      );
      const responses = await Promise.allSettled(
        tenantIds.map((tenantId) =>
          apiClient<TaskListResponse>(
            `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`,
            {
              retry: { attempts: 3, initialDelayMs: 500, backoffFactor: 2 },
            }
          )
        )
      );
      const merged = responses.flatMap((response) =>
        response.status === "fulfilled" ? response.value.data?.tasks ?? [] : []
      );
      const unique = Array.from(
        new Map(merged.map((task) => [task.task_id, task])).values()
      ).sort(
        (left, right) =>
          new Date(right.latest_message_at || right.created_at).getTime() -
          new Date(left.latest_message_at || left.created_at).getTime()
      );
      setTasks(unique);
      if (responses.every((response) => response.status === "rejected")) {
        setError(true);
      }
    } catch {
      setTasks([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const renderTask = useCallback(
    ({ item }: { item: ConsultationTask }) => {
      const status = item.status || "queued";
      const active = !TERMINAL_STATUSES.has(status) || isFollowUpOpen(item);
      const preview = previewText(
        item,
        tHome("doctorConsultationWaiting"),
        tHome("doctorConsultationAttachPhoto"),
        tHome("doctorConsultationVoiceMessage")
      );
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.summary}, ${tHome(
            statusKey(item.status),
            { defaultValue: tHome("doctorConsultationStatusUnknown") }
          )}`}
          onPress={() =>
            router.push({
              pathname: "/doctor-consultation/[taskId]",
              params: {
                taskId: item.task_id,
                tenantId: item.tenant_id || env.doctorTenantId,
              },
            } as never)
          }
          style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
        >
          <View style={styles.taskMetaRow}>
            <Text style={styles.taskDate}>
              {formatDate(
                item.created_at,
                i18n.resolvedLanguage ?? i18n.language
              )}
            </Text>
            <Text
              style={[
                styles.status,
                active ? styles.statusActive : styles.statusDone,
              ]}
            >
              {tHome(statusKey(item.status), {
                defaultValue: tHome("doctorConsultationStatusUnknown"),
              })}
            </Text>
          </View>
          <View style={styles.taskContent}>
            <View style={styles.taskBody}>
              <Text numberOfLines={2} style={styles.taskTitle}>
                {item.summary}
              </Text>
              <Text numberOfLines={2} style={styles.taskPreview}>
                {preview}
              </Text>
              {isFollowUpOpen(item) ? (
                <Text style={styles.followup}>
                  {tSettings("doctorConsultationHistoryFollowup")}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </Pressable>
      );
    },
    [
      colors,
      i18n.language,
      i18n.resolvedLanguage,
      router,
      styles,
      tHome,
      tSettings,
    ]
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <ScreenBackButton
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/profile")
            }
            accessibilityLabel={tCommon("back")}
          />
          <Text accessibilityRole="header" style={styles.headerTitle}>
            {tSettings("doctorConsultationHistory")}
          </Text>
          <View pointerEvents="none" style={styles.headerSpacer} />
        </View>

        <SectionList
          sections={sections}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
          )}
          keyExtractor={(item) => item.task_id}
          renderItem={renderTask}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => void loadHistory()}
          ListEmptyComponent={
            loading ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>{tCommon("loading")}</Text>
              </View>
            ) : error ? (
              <View style={styles.state}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={42}
                  color={colors.textSecondary}
                />
                <Text style={styles.stateText}>
                  {tHome("doctorConsultationThreadError")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tCommon("retry")}
                  style={styles.retry}
                  onPress={() => void loadHistory()}
                >
                  <Text style={styles.retryText}>{tCommon("retry")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.state}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.stateTitle}>
                  {tSettings("doctorConsultationHistoryEmpty")}
                </Text>
                <Text style={styles.stateText}>
                  {tSettings("doctorConsultationHistoryEmptyDescription")}
                </Text>
              </View>
            )
          }
        />
      </View>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>["colors"]) {
  const textSize = typography.size;
  return StyleSheet.create({
    page: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    headerSpacer: { height: 40, width: 40 },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: textSize.lg,
      fontWeight: "800",
      textAlign: "center",
    },
    listContent: { paddingHorizontal: 16, gap: 10 },
    taskCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    taskContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      width: "100%",
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: textSize.sm,
      fontWeight: "600",
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    followup: {
      color: colors.primaryText,
      fontSize: textSize.xs,
      marginTop: spacing.sm,
    },
    taskBody: { flex: 1, minWidth: 0 },
    taskTitle: {
      color: colors.textPrimary,
      fontSize: textSize.md,
      fontWeight: "700",
    },
    taskPreview: {
      color: colors.textSecondary,
      fontSize: textSize.sm,
      lineHeight: textSize.sm + 5,
      marginTop: 4,
    },
    taskMetaRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      width: "100%",
    },
    taskDate: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: textSize.xs,
      lineHeight: textSize.xs + 5,
      minWidth: 96,
    },
    status: {
      flexShrink: 1,
      borderRadius: 999,
      fontSize: textSize.xs,
      fontWeight: "700",
      lineHeight: textSize.xs + 5,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusActive: {
      backgroundColor: colors.primaryLight,
      color: colors.primaryText,
    },
    statusDone: {
      backgroundColor: colors.surfaceMuted,
      color: colors.textSecondary,
    },
    pressed: { opacity: 0.78 },
    state: {
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 28,
      paddingTop: 96,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: textSize.md,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      color: colors.textSecondary,
      fontSize: textSize.sm,
      textAlign: "center",
    },
    retry: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    retryText: {
      color: colors.primary,
      fontSize: textSize.sm,
      fontWeight: "700",
    },
  });
}
