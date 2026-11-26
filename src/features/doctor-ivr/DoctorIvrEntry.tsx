import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useGuardedRouter } from "../../hooks/useGuardedRouter";
import { useThemeColors } from "../../hooks/useThemeColors";
import { hasDoctorIvrReply, ivrApi, type IvrSession } from "./ivr.api";
import { ivrInvitationUnavailable } from "./ivr-state";
import { showToast } from "../../stores/toast.store";
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
                  hasDoctorIvrReply(s) ||
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
    (linkedSessionIds.includes(session.id) && !hasDoctorIvrReply(session))
  )
    return null;
  return (
    <DoctorIvrInvitation
      sessionId={session.id}
      status={session.status}
      hasReply={hasDoctorIvrReply(session)}
    />
  );
}

export function DoctorIvrInvitation({
  sessionId,
  status,
  hasReply = false,
}: {
  sessionId: string;
  status?: string | null;
  hasReply?: boolean;
}) {
  const { t } = useTranslation("home");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const mounted = useRef(false);
  const opening = useRef(false);
  const [checked, setChecked] = useState<{
    id: string;
    reason: NonNullable<ReturnType<typeof ivrInvitationUnavailable>>;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!isExpertConsultationEnabled) return null;
  const unavailable = hasReply
    ? null
    : (checked?.id === sessionId ? checked.reason : ivrInvitationUnavailable(status));
  const title = unavailable
    ? t(`ivr.invitationStatus.${unavailable}`)
    : t(hasReply ? "ivr.result" : "ivr.invitation");
  const open = async () => {
    if (unavailable || opening.current) return;
    opening.current = true;
    try {
      if (!hasReply) {
        const session = await ivrApi.get(sessionId);
        if (!mounted.current) return;
        const expired = session.expires_at && Date.parse(session.expires_at) <= Date.now();
        const reason = ivrInvitationUnavailable(session.status) || (expired ? "expired" : null);
        if (reason) {
          if (reason === "preparing") showToast(t("ivr.preparing"), "info");
          else setChecked({ id: sessionId, reason });
          return;
        }
      }
      router.push({
        pathname: "/doctor-interview/[sessionId]",
        params: { sessionId, ...(hasReply ? {} : { start: "1" }) },
      });
    } catch {
      if (mounted.current) showToast(t("ivr.error"), "error");
    } finally {
      opening.current = false;
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!unavailable }}
      disabled={!!unavailable}
      onPress={unavailable ? undefined : () => void open()}
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
        <Text
          style={[
            styles.title,
            { color: unavailable ? colors.textSecondary : colors.textPrimary },
          ]}
        >
          {title}
        </Text>
        {!unavailable && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t(hasReply ? "ivr.openResult" : "ivr.answerQuestions")}
          </Text>
        )}
      </View>
      {!unavailable && <Ionicons name="chevron-forward" size={24} color={colors.primary} />}
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
