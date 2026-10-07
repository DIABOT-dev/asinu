import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { Screen } from "../../src/components/Screen";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { IapPurchaseCard } from "../../src/features/iap/IapPurchaseCard";
import { localizedPlanName } from "../../src/features/subscription/planName";
import type { SubscriptionStatus } from "../../src/features/subscription/subscription.types";
import { useGuardedRouter } from "../../src/hooks/useGuardedRouter";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { apiClient } from "../../src/lib/apiClient";
import { radius, spacing } from "../../src/styles";

export default function SubscriptionPlansScreen() {
  const router = useGuardedRouter();
  const { t } = useTranslation("subscription");
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accountId = useAuthStore((state) => state.profile?.id);
  const requestGeneration = useRef(0);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError(false);
    try {
      // Never open a purchase using a guessed/free entitlement while loading.
      if (!accountId) throw new Error("Subscription account is unavailable");
      const next = await apiClient<SubscriptionStatus>("/api/subscriptions/status");
      if (!next.ok) throw new Error("Subscription status is unavailable");
      if (requestGeneration.current === generation) setStatus(next);
    } catch {
      if (requestGeneration.current === generation) setLoadError(true);
    } finally {
      if (requestGeneration.current === generation) setLoading(false);
    }
  }, [accountId]);

  useFocusEffect(useCallback(() => {
    setStatus(null);
    void refresh();
    return () => { requestGeneration.current++; };
  }, [refresh]));

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.lg,
        }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ScreenBackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/subscription")} />
          <Text allowFontScaling accessibilityRole="header" style={styles.title}>{t("iapChooseTitle")}</Text>
        </View>
        {loading && !status ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
            <Text allowFontScaling style={styles.stateText}>{t("loadingPrices")}</Text>
          </View>
        ) : !status ? (
          <View style={styles.state}>
            <Text allowFontScaling style={styles.stateText}>{t("v2LoadError")}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
              <Text allowFontScaling style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {loadError ? <View style={styles.state}>
              <Text allowFontScaling style={styles.stateText}>{t("v2LoadError")}</Text>
              <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
                <Text allowFontScaling style={styles.retryText}>{t("retry")}</Text>
              </Pressable>
            </View> : null}
            {status.isAnTam ? <Text allowFontScaling style={styles.currentPlan}>
              {status.billingPeriod
                ? t("iapCurrentPlanPeriod", { plan: localizedPlanName(status.planCode, t), period: t(status.billingPeriod === "yearly" ? "iapYearly" : "iapMonthly") })
                : t("iapCurrentPlanName", { plan: localizedPlanName(status.planCode, t) })}
            </Text> : null}
            <IapPurchaseCard
              currentPlanCode={status.planCode}
              currentBillingPeriod={status.billingPeriod}
              disabled={loading || loadError}
              onPurchased={() => void refresh()}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>["colors"]) {
  return StyleSheet.create({
    content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    title: { flex: 1, color: colors.textPrimary, fontSize: 26, fontWeight: "800" },
    currentPlan: { color: colors.primaryText, fontSize: 15, fontWeight: "600" },
    state: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
    stateText: { color: colors.textPrimary, fontSize: 16, textAlign: "center" },
    retry: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, minHeight: 48, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, justifyContent: "center" },
    retryText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  });
}
