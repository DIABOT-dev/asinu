import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useGuardedRouter } from "../../hooks/useGuardedRouter";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ivrApi, type IvrSession } from "./ivr.api";
import { radius, spacing } from "../../styles/theme";
export function DoctorIvrEntry({
  tenantId,
  taskId,
}: {
  tenantId: string;
  taskId: string;
}) {
  const { t } = useTranslation("home"),
    router = useGuardedRouter(),
    { colors } = useThemeColors();
  const [session, setSession] = useState<IvrSession | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSession(null);
      const load = async () => {
        try {
          if (!(await ivrApi.enabled())) return;
          const value = await ivrApi.list(tenantId, taskId);
          if (active)
            setSession(
              value.sessions.find(
                (s) =>
                  !["cancelled", "unreachable", "expired", "closed"].includes(
                    s.status
                  )
              ) || null
            );
        } catch {}
      };
      void load();
      const timer = setInterval(() => void load(), 10000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [tenantId, taskId])
  );
  if (!session) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(
        session.doctor_reply ? "ivr.result" : "ivr.invitation"
      )}
      onPress={() =>
        router.push({
          pathname: "/doctor-interview/[sessionId]",
          params: { sessionId: session.id },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.primaryLight : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Image
        source={require("../../../assets/icon.png")}
        style={styles.brandMark}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t(session.doctor_reply ? "ivr.result" : "ivr.invitation")}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t("ivr.entryHint")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.primary} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: radius.xl,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  content: { flex: 1 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  hint: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  brandMark: { width: 44, height: 44, borderRadius: radius.md },
});
