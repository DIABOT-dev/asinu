import { useCallback, useState, type ReactNode } from "react";
import { AppState, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useGuardedRouter as useRouter } from "../../hooks/useGuardedRouter";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore } from "../auth/auth.store";
import { subscribeHealthAction } from "../../lib/health-action-events";
import { v21Api, CoinToday, V21Flags } from "./v21.api";
import { ApiError } from "../../lib/apiClient";

export function V21HomeCard({ iconOnly = false, renderShortcuts }: {
  iconOnly?: boolean;
  renderShortcuts?: (access: { medicationEnabled: boolean; coinsEnabled: boolean }) => ReactNode;
} = {}) {
  const { t } = useTranslation("v21"),
    { colors } = useThemeColors(),
    router = useRouter();
  const user = useAuthStore((s) => s.profile?.id);
  const token = useAuthStore((s) => s.token);
  const accessOnly = Boolean(renderShortcuts);
  const [owner, setOwner] = useState<string | null>(null);
  const [flags, setFlags] = useState<V21Flags | null>(null),
    [today, setToday] = useState<CoinToday | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user || !token) return;
      let active = true;
      let inFlight = false;
      let refreshQueued = false;
      const refresh = async (afterAction = false) => {
        if (!active || AppState.currentState !== 'active') return;
        if (inFlight) {
          // An action needs a fresh read after any read already in progress.
          if (afterAction) refreshQueued = true;
          return;
        }
        inFlight = true;
        try {
          const f = await v21Api.flags();
          if (!active || AppState.currentState !== 'active') return;
          setFlags(f);
          setOwner(String(user));
          if (!f.coins || accessOnly) return;
          const data = await v21Api.coins();
          if (!active) return;
          setToday(data);
        } catch (error) {
          if (active && error instanceof ApiError && [401, 403, 404].includes(error.statusCode)) {
            setFlags(null);
            setToday(null);
          }
        } finally {
          inFlight = false;
          if (active && refreshQueued) {
            refreshQueued = false;
            void refresh();
          }
        }
      };
      const unsubscribe = subscribeHealthAction(() => void refresh(true));
      void refresh();
      const timer = setInterval(() => {
        void refresh();
      }, 15000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh(true);
      });
      return () => {
        active = false;
        unsubscribe();
        clearInterval(timer);
        subscription.remove();
      };
    }, [user, token, accessOnly])
  );
  if (renderShortcuts) return renderShortcuts({
    medicationEnabled: owner === String(user) && Boolean(flags?.medication && flags.patients?.length),
    coinsEnabled: owner === String(user) && Boolean(flags?.coins),
  });
  if (owner !== String(user)) return null;
  if (!flags?.coins && !flags?.patients?.length) return null;
  const dailyTasks =
    today?.tasks.filter((task) => task.task_code !== "WEEKLY") ?? [];
  const total = dailyTasks.reduce((sum, task) => sum + task.daily_limit, 0);
  const done = dailyTasks.reduce(
    (sum, task) => sum + Math.min(task.done, task.daily_limit),
    0
  );
  const rowStyle = {
    flex: 1,
    minHeight: 64,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 10,
  };
  const actionStyle = iconOnly ? { width: 48, height: 48, alignItems: 'center' as const, justifyContent: 'center' as const } : rowStyle;
  const titleStyle = {
    fontSize: 18,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  };
  return (
    <View style={{ flexDirection: "row", gap: iconOnly ? 4 : 12 }}>
      {!!flags.patients?.length && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("medicationTitle")}
          onPress={() => router.push("/medication")}
          style={({ pressed }) => [actionStyle, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons
            name="pill"
            size={iconOnly ? 30 : 28}
            color={colors.primaryText}
          />
          {!iconOnly && <Text style={[titleStyle, { flex: 1 }]}>{t("medicationTitle")}</Text>}
        </Pressable>
      )}
      {flags.coins && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            today
              ? `${t("tasksTitle")}. ${t("taskProgress", { done, total })}`
              : t("tasksTitle")
          }
          onPress={() => router.push("/coins")}
          style={({ pressed }) => [actionStyle, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons
            name="checkbox-marked-circle-outline"
            size={iconOnly ? 30 : 28}
            color={colors.primaryText}
          />
          {!iconOnly && <View style={{ flex: 1 }}>
            <Text style={titleStyle}>{t("tasksTitle")}</Text>
            {today && total > 0 && (
              <Text style={{ fontSize: 15, color: colors.textSecondary }}>
                {t("taskProgressShort", { done, total })}
              </Text>
            )}
          </View>}
        </Pressable>
      )}
    </View>
  );
}
