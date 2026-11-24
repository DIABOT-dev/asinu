import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
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
import {
  isFollowUpOpen,
  listConsultationTasks,
  type ConsultationTask,
} from "../src/features/doctor-consultation/consultation-tasks";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../src/hooks/useGuardedRouter";
import { env } from "../src/lib/env";
import { radius, shadows, spacing, typography } from "../src/styles";

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
  attachmentLabel: string,
  voiceLabel: string
) => {
  const message = task.latest_message?.trim();
  if (message?.startsWith("[ASINU_ATTACHMENT]")) return attachmentLabel;
  if (message?.startsWith("[ASINU_VOICE]")) return voiceLabel;
  return message;
};

const formatDate = (value: string, language: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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
      setTasks(await listConsultationTasks());
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
      const followup = isFollowUpOpen(item)
        ? tSettings("doctorConsultationHistoryFollowup")
        : null;
      const active = !TERMINAL_STATUSES.has(status) || Boolean(followup);
      const urgent = status === "emergency_referred";
      const [subject, ...summary] = (item.summary ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const title = subject || tHome("doctorConsultationHeaderTitle");
      const statusLabel = tHome(statusKey(item.status), {
        defaultValue: tHome("doctorConsultationStatusUnknown"),
      });
      const date = formatDate(
        item.created_at,
        i18n.resolvedLanguage ?? i18n.language
      );
      const preview =
        previewText(
          item,
          tHome("doctorConsultationAttachPhoto"),
          tHome("doctorConsultationVoiceMessage")
        ) || summary.join(" ");
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[title, preview, statusLabel, date, followup]
            .filter(Boolean)
            .join(", ")}
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
          <View style={styles.taskContent}>
            <View style={[styles.taskIcon, active && styles.taskIconActive]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={21}
                color={active ? colors.primaryText : colors.textSecondary}
                accessible={false}
              />
            </View>
            <View style={styles.taskBody}>
              <Text numberOfLines={2} style={styles.taskTitle}>
                {title}
              </Text>
              {preview ? (
                <Text numberOfLines={2} style={styles.taskPreview}>
                  {preview}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
              accessible={false}
            />
          </View>
          <View style={styles.taskMetaRow}>
            {date ? (
              <View style={styles.taskDateGroup}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.textSecondary}
                  accessible={false}
                />
                <Text style={styles.taskDate}>{date}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.status,
                active && styles.statusActive,
                urgent && styles.statusUrgent,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  active && styles.statusTextActive,
                  urgent && styles.statusTextUrgent,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
          {followup ? <Text style={styles.followup}>{followup}</Text> : null}
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
            style={styles.backButton}
            iconColor={colors.primaryText}
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
                <View style={styles.stateIcon}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={26}
                    color={colors.primaryText}
                    accessible={false}
                  />
                </View>
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
                <View style={styles.stateIcon}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={26}
                    color={colors.primaryText}
                    accessible={false}
                  />
                </View>
                <Text style={styles.stateTitle}>
                  {tSettings("doctorConsultationHistoryEmpty")}
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
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    backButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    headerSpacer: { width: 44 },
    headerTitle: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: textSize.lg,
      fontWeight: "700",
      textAlign: "center",
    },
    listContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    taskCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      gap: spacing.md,
      padding: spacing.lg,
      ...shadows.sm,
    },
    taskContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    taskIcon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    taskIconActive: {
      backgroundColor: colors.primaryLight,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: textSize.sm,
      fontWeight: "600",
      paddingTop: spacing.md,
    },
    followup: {
      color: colors.primaryText,
      fontSize: textSize.xs,
      fontWeight: "600",
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
      marginTop: spacing.xs,
    },
    taskMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    taskDateGroup: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      gap: spacing.xs,
    },
    taskDate: {
      color: colors.textSecondary,
      flexShrink: 1,
      fontSize: textSize.xs,
    },
    status: {
      flexShrink: 1,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    statusActive: {
      backgroundColor: colors.primaryLight,
    },
    statusUrgent: {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: textSize.xs,
      fontWeight: "600",
    },
    statusTextActive: {
      color: colors.primaryText,
    },
    statusTextUrgent: {
      color: colors.danger,
    },
    pressed: { backgroundColor: colors.surfaceMuted },
    state: {
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.xl,
      padding: spacing.xxl,
      borderRadius: radius.xl,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surface,
    },
    stateIcon: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
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
      borderRadius: radius.md,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    retryText: {
      color: colors.primaryText,
      fontSize: textSize.sm,
      fontWeight: "700",
    },
  });
}
