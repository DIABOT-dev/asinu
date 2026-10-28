import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useGuardedRouter } from "../../src/hooks/useGuardedRouter";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { isDoctorFeaturesEnabled } from "../../src/lib/appEnv";
import {
  acceptDoctorIvrCallOnce,
  endDoctorIvrCall,
} from "../../src/features/doctor-ivr/ivr-call";
import { finishVoipCallHandoff, endVoipCall } from "../../src/lib/voip";
import { ivrApi } from "../../src/features/doctor-ivr/ivr.api";
import { DoctorIvrBackdrop } from "../../src/features/doctor-ivr/DoctorIvrBackdrop";

export default function DoctorCallRoute() {
  if (!isDoctorFeaturesEnabled) return <Redirect href="/(tabs)/home" />;
  return <DoctorCallHandoff />;
}
function DoctorCallHandoff() {
  const { sessionId, attemptId } = useLocalSearchParams<{
    sessionId: string;
    attemptId: string;
  }>();
  const { t } = useTranslation("home"),
    { colors } = useThemeColors(),
    router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const hydrated = useAuthStore((s) => s.hydrated),
    token = useAuthStore((s) => s.token);
  const [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!hydrated || !token) return;
    let live = true;
    setFailed(false);
    void (async () => {
      if (
        !/^[\da-f-]{36}$/i.test(sessionId || "") ||
        !/^[\da-f-]{36}$/i.test(attemptId || "")
      )
        throw new Error("Invalid call");
      const call = await acceptDoctorIvrCallOnce(attemptId);
      if (!live || call.session_id !== sessionId)
        throw new Error("Call changed");
      if (!(await finishVoipCallHandoff(attemptId)))
        throw new Error("Audio handoff pending");
      if (!live) return;
      const current = await ivrApi.get(sessionId);
      if (current.status === "sent")
        await ivrApi.act(sessionId, { action: "start" });
      if (live)
        router.replace({
          pathname: "/doctor-interview/[sessionId]",
          params: { sessionId, callAttempt: attemptId },
        } as never);
    })().catch(() => {
      if (live) setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [hydrated, token, sessionId, attemptId, retry, router]);
  if (hydrated && !token) return <Redirect href="/login" />;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <DoctorIvrBackdrop />
      <ScreenBackButton
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          backgroundColor: colors.surface,
        }}
        onPress={() => {
          void endVoipCall(attemptId);
          if (token) void endDoctorIvrCall(attemptId).catch(() => {});
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/home");
        }}
      />
      {!failed && <ActivityIndicator color={colors.primary} size="large" />}
      <Text
        style={{
          fontSize: 24,
          lineHeight: 34,
          color: colors.textPrimary,
          textAlign: "center",
        }}
      >
        {t(failed ? "ivr.callConnectError" : "ivr.callConnecting")}
      </Text>
      {failed && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetry((v) => v + 1)}
            style={{
              minHeight: 56,
              backgroundColor: colors.primary,
              borderRadius: 28,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 22 }}>
              {t("ivr.retry")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: "/doctor-interview/[sessionId]",
                params: { sessionId },
              } as never)
            }
            style={{
              minHeight: 56,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontSize: 22 }}>
              {t("ivr.continueInApp")}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
