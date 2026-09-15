import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../src/components/ScaledText";
import { Screen } from "../src/components/Screen";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { useScaledTypography } from "../src/hooks/useScaledTypography";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../src/hooks/useGuardedRouter";
import { apiClient } from "../src/lib/apiClient";
import { env } from "../src/lib/env";

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
  voiceLabel: string,
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
    new Date(task.follow_up_until).getTime() > Date.now(),
  );

const formatDate = (value: string, language: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(language === "en" ? "en-US" : "vi-VN", {
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
  const { colors, isDark } = useThemeColors();
  const scaledTypography = useScaledTypography();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<ConsultationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const styles = useMemo(
    () => createStyles(colors, scaledTypography.scaledSize, isDark),
    [colors, isDark, scaledTypography.scaledSize],
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const clinicResponse = await apiClient<ClinicListResponse>(
        "/api/doctor/clinics",
        { method: "POST", body: {} },
      ).catch(() => null);
      const tenantIds = Array.from(
        new Set(
          [
            env.doctorTenantId,
            ...(clinicResponse?.data?.items ?? []).map(
              (item) => item.tenant_id,
            ),
          ].filter(Boolean),
        ),
      );
      const responses = await Promise.allSettled(
        tenantIds.map((tenantId) =>
          apiClient<TaskListResponse>(
            `/api/doctor/tasks?tenant_id=${encodeURIComponent(tenantId)}`,
          ),
        ),
      );
      const merged = responses.flatMap((response) =>
        response.status === "fulfilled"
          ? (response.value.data?.tasks ?? [])
          : [],
      );
      const unique = Array.from(
        new Map(merged.map((task) => [task.task_id, task])).values(),
      ).sort(
        (left, right) =>
          new Date(right.latest_message_at || right.created_at).getTime() -
          new Date(left.latest_message_at || left.created_at).getTime(),
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
    }, [loadHistory]),
  );

  const renderTask = useCallback(
    ({ item }: { item: ConsultationTask }) => {
      const status = item.status || "queued";
      const active = !TERMINAL_STATUSES.has(status) || isFollowUpOpen(item);
      const preview = previewText(
        item,
        tHome("doctorConsultationWaiting"),
        tHome("doctorConsultationAttachPhoto"),
        tHome("doctorConsultationVoiceMessage"),
      );
      return (
        <Pressable
          accessibilityRole="button"
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
          <View style={styles.taskIcon}>
            <Ionicons
              name={
                active
                  ? "chatbubble-ellipses-outline"
                  : "checkmark-done-outline"
              }
              size={22}
              color={active ? colors.primary : colors.textSecondary}
            />
          </View>
          <View style={styles.taskBody}>
            <Text numberOfLines={1} style={styles.taskTitle}>
              {item.summary}
            </Text>
            <Text numberOfLines={2} style={styles.taskPreview}>
              {preview}
            </Text>
            <View style={styles.taskMetaRow}>
              <Text style={styles.taskDate}>
                {formatDate(
                  item.latest_message_at || item.created_at,
                  i18n.language,
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
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
      );
    },
    [colors, i18n.language, router, styles, tHome],
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <ScreenBackButton
            onPress={() => router.back()}
            accessibilityLabel={tCommon("back")}
          />
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>
              {tSettings("doctorConsultationHistory")}
            </Text>
            <Text style={styles.headerHint}>
              {tSettings("doctorConsultationHistoryDescription")}
            </Text>
          </View>
        </View>

        <FlatList
          data={tasks}
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

function createStyles(
  colors: ReturnType<typeof useThemeColors>["colors"],
  scaledSize: ReturnType<typeof useScaledTypography>["scaledSize"],
  isDark: boolean,
) {
  return StyleSheet.create({
    page: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    headerCopy: { flex: 1 },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: scaledSize.xl,
      fontWeight: "800",
    },
    headerHint: {
      color: colors.textSecondary,
      fontSize: scaledSize.sm,
      lineHeight: scaledSize.sm + 6,
      marginTop: 3,
    },
    listContent: { paddingHorizontal: 16, gap: 10 },
    taskCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      padding: 14,
    },
    taskIcon: {
      alignItems: "center",
      backgroundColor: isDark ? "#103b38" : "#E6FAF7",
      borderRadius: 14,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    taskBody: { flex: 1 },
    taskTitle: {
      color: colors.textPrimary,
      fontSize: scaledSize.md,
      fontWeight: "700",
    },
    taskPreview: {
      color: colors.textSecondary,
      fontSize: scaledSize.sm,
      lineHeight: scaledSize.sm + 5,
      marginTop: 4,
    },
    taskMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    taskDate: { color: colors.textSecondary, fontSize: scaledSize.xs, flex: 1 },
    status: {
      borderRadius: 999,
      fontSize: scaledSize.xs,
      fontWeight: "700",
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusActive: { backgroundColor: "#E6F6EC", color: "#3F8F59" },
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
      fontSize: scaledSize.md,
      fontWeight: "700",
      textAlign: "center",
    },
    stateText: {
      color: colors.textSecondary,
      fontSize: scaledSize.sm,
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
      fontSize: scaledSize.sm,
      fontWeight: "700",
    },
  });
}
