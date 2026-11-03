import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useGuardedRouter as useRouter } from "../../hooks/useGuardedRouter";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore } from "../auth/auth.store";
import { subscribeHealthAction } from "../../lib/health-action-events";
import { v21Api, CoinToday, V21Flags } from "./v21.api";

export function V21HomeCard({ iconOnly = false }: { iconOnly?: boolean } = {}) {
  const { t } = useTranslation("v21"),
    { colors } = useThemeColors(),
    router = useRouter();
  const user = useAuthStore((s) => s.profile?.id);
  const [owner, setOwner] = useState<string | null>(null);
  const [flags, setFlags] = useState<V21Flags | null>(null),
    [today, setToday] = useState<CoinToday | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let timer: ReturnType<typeof setInterval> | undefined;
      const refresh = async () => {
        try {
          const f = await v21Api.flags();
          if (!active) return;
          setFlags(f);
          setOwner(String(user));
          if (!f.coins) return;
          const data = await v21Api.coins();
          if (!active) return;
          setToday(data);
        } catch {
          if (active) setFlags(null);
        }
      };
      const unsubscribe = subscribeHealthAction(() => void refresh());
      void refresh();
      timer = setInterval(() => {
        void refresh();
      }, 15000);
      return () => {
        active = false;
        unsubscribe();
        if (timer) clearInterval(timer);
      };
    }, [user, t])
  );
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
