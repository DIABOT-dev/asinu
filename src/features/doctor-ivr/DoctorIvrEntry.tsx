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
import { isExpertConsultationEnabled } from "../../lib/appEnv";
export function DoctorIvrEntry({
  tenantId,
  taskId,
  linkedSessionIds,
}: {
  tenantId: string;
  taskId: string;
  linkedSessionIds: (string | null | undefined)[];
}) {
  const [session, setSession] = useState<IvrSession | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSession(null);
      if (!isExpertConsultationEnabled) return;
      const load = async () => {
        try {
          if (!(await ivrApi.enabled())) return;
          const value = await ivrApi.list(tenantId, taskId);
          if (active)
            setSession(
              value.sessions.find(
                (s) =>
                  !["draft", "cancelled", "unreachable", "expired", "closed"].includes(s.status)
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
  if (
    !isExpertConsultationEnabled ||
    !session ||
    (linkedSessionIds.includes(session.id) && !session.doctor_reply)
  )
    return null;
  return (
    <DoctorIvrInvitation
      sessionId={session.id}
      hasReply={!!session.doctor_reply}
    />
  );
}

export function DoctorIvrInvitation({
  sessionId,
  hasReply = false,
}: {
  sessionId: string;
  hasReply?: boolean;
}) {
  const { t } = useTranslation("home");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  if (!isExpertConsultationEnabled) return null;
  const title = t(hasReply ? "ivr.result" : "ivr.invitation");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() =>
        router.push({
          pathname: "/doctor-interview/[sessionId]",
          params: { sessionId, ...(hasReply ? {} : { start: "1" }) },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.primaryLight : "transparent",
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
          {title}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t(hasReply ? "ivr.openResult" : "ivr.answerQuestions")}
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
    paddingVertical: spacing.lg,
    minHeight: 80,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  content: { flex: 1 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  hint: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  brandMark: { width: 44, height: 44, borderRadius: radius.md },
});
