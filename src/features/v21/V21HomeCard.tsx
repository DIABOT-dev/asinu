import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore } from "../auth/auth.store";
import { subscribeHealthAction } from "../../lib/health-action-events";
import { v21Api, CoinToday, V21Flags } from "./v21.api";

export function V21HomeCard() {
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
    }, [user, t]),
  );
  if (owner !== String(user)) return null;
  if (!flags?.coins && !flags?.patients?.length) return null;
  return (
    <View
      style={{
        gap: 14,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 18,
      }}
    >
      {flags.coins && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/coins" as any)}
          style={{ minHeight: 64, gap: 8 }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <MaterialCommunityIcons
              name="checkbox-marked-circle-outline"
              size={30}
              color={colors.primaryText}
            />
            <Text
              style={{
                fontSize: 23,
                fontWeight: "700",
                color: colors.textPrimary,
                flex: 1,
              }}
            >
              {t("tasksTitle")}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={28}
              color={colors.textSecondary}
            />
          </View>
          <Text style={{ fontSize: 18, color: colors.primaryText }}>
            {today ? t("balance", { count: today.balance }) : t("loading")}
          </Text>
          {today?.tasks
            .filter((x) => x.task_code !== "WEEKLY")
            .map((x) => (
              <View
                key={x.task_code}
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <MaterialCommunityIcons
                  name={
                    x.done >= x.daily_limit ? "check-circle" : "circle-outline"
                  }
                  size={23}
                  color={colors.primaryText}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 17,
                    lineHeight: 25,
                    color: colors.textPrimary,
                  }}
                >
                  {t(x.task_code)}
                </Text>
                <Text style={{ fontSize: 16, color: colors.primaryText }}>
                  {t("taskCoins", { count: x.coins })}
                </Text>
              </View>
            ))}
        </Pressable>
      )}
      {!!flags.patients?.length && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/medication" as any)}
          style={{
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderTopWidth: flags.coins ? 1 : 0,
            borderTopColor: colors.border,
            paddingTop: flags.coins ? 14 : 0,
          }}
        >
          <MaterialCommunityIcons
            name="pill"
            size={30}
            color={colors.primaryText}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              {t("medicationTitle")}
            </Text>
            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: colors.textSecondary,
              }}
            >
              {t("medicationSubtitle")}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}
