import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useScaledTypography } from "../../hooks/useScaledTypography";
import { colors, radius, spacing, typography } from "../../styles";
import { FALLBACK_IAP_PRODUCTS } from "./iap.catalog";
import {
  fetchAvailableProducts,
  purchaseSubscription,
  type LocalProduct,
} from "./iap.service";
import { SubscriptionFeedbackModal, type SubscriptionFeedback } from "./SubscriptionFeedbackModal";
import { localizedPlanName } from "../subscription/planName";
import { RestoreLink } from "./RestoreLink";

const PLAN_ANTAM_2_IMG = require("../../../assets/images/subscription/plan_antam_2.png");
const PLAN_ANTAM_4_IMG = require("../../../assets/images/subscription/plan_antam_4.png");
const PLAN_ANTAM_8_IMG = require("../../../assets/images/subscription/plan_antam_8.png");

const PLAN_ORDER = ["antam_4", "antam_2", "antam_8"] as const;
const SUPPORTED_PLAN_CODES = new Set<string>(PLAN_ORDER);

type Props = {
  currentPlanCode?: string;
  currentBillingPeriod?: "monthly" | "yearly" | null;
  onPurchased?: () => void;
};

const formatVnd = (value: number, language: string) =>
  new Intl.NumberFormat(language.startsWith("en") ? "en-US" : "vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export function IapPurchaseCard({
  currentPlanCode = "free",
  currentBillingPeriod,
  onPurchased,
}: Props) {
  const { t, i18n } = useTranslation("subscription");
  const { isDark } = useThemeColors();
  const { width } = useWindowDimensions();
  const { size, scaledSize } = useScaledTypography();
  const stackActions = width < 390 || scaledSize.sm > size.sm * 1.1;
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [feedback, setFeedback] = useState<SubscriptionFeedback | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>(() => [
    ...FALLBACK_IAP_PRODUCTS,
  ]);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState("antam_4");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const actionBusy = busy || restoring;

  useEffect(() => {
    let active = true;
    fetchAvailableProducts()
      .then((items) => {
        if (!active) return;
        const supported = (items ?? [])
          .filter((item) => SUPPORTED_PLAN_CODES.has(item.plan_code))
          .sort((a, b) => {
            const planDiff = PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code);
            if (planDiff !== 0) return planDiff;
            return a.billing_period === "yearly" ? -1 : 1;
          });
        setProducts(supported);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const choices = useMemo(
    () => products.filter((product) => product.billing_period === period),
    [period, products]
  );
  const selected =
    choices.find((product) => product.plan_code === selectedPlan) ?? choices[0];
  const selectedIsCurrent =
    selected?.plan_code === currentPlanCode &&
    selected?.billing_period === currentBillingPeriod;

  const planRows = useMemo(() => {
    const rows: LocalProduct[][] = [];
    for (let index = 0; index < choices.length; index += 2) {
      rows.push(choices.slice(index, index + 2));
    }
    return rows;
  }, [choices]);

  const yearlySavings = useMemo(() => {
    const percentages = PLAN_ORDER.map((planCode) => {
      const monthly = products.find(
        (product) => product.plan_code === planCode && product.billing_period === "monthly"
      );
      const yearly = products.find(
        (product) => product.plan_code === planCode && product.billing_period === "yearly"
      );
      if (!monthly || !yearly || monthly.display_price_vnd <= 0) return null;
      return Math.round((1 - yearly.display_price_vnd / (monthly.display_price_vnd * 12)) * 100);
    }).filter((value): value is number => value !== null && value > 0);

    if (percentages.length === 0) return null;
    return { min: Math.min(...percentages), max: Math.max(...percentages) };
  }, [products]);

  const buy = useCallback(async () => {
    if (!selected) {
      return;
    }
    if (!selected.nativeProduct) {
      setFeedback({
        kind: "info",
        title: t("iapStorePendingTitle"),
        message: t("iapStorePendingBody", { plan: localizedPlanName(selected.plan_code, t) }),
      });
      return;
    }
    setBusy(true);
    try {
      const result = await purchaseSubscription(selected.id, selected);
      if (result.kind === "success") {
        onPurchased?.();
        setFeedback({
          kind: "success",
          title: t("iapActivatedTitle"),
          message: t("iapActivatedBody", { plan: localizedPlanName(selected.plan_code, t) }),
        });
      } else if (result.kind === "failed") {
        setFeedback({
          kind: "error",
          title: t("iapPaymentFailed"),
          message: t("iapPaymentFailedBody"),
        });
      }
    } catch (error) {
      console.warn("[iap] purchase action failed", error);
      setFeedback({
        kind: "error",
        title: t("iapPaymentFailed"),
        message: t("iapPaymentFailedBody"),
      });
    } finally {
      setBusy(false);
    }
  }, [onPurchased, selected, t]);

  const renderCard = (product?: LocalProduct) => {
    if (!product) return null;
    const active = product.plan_code === (selected?.plan_code ?? selectedPlan);
    const current =
      currentPlanCode === product.plan_code &&
      currentBillingPeriod === product.billing_period;
    const isPopular = product.plan_code === "antam_4";

    const getPlanAvatar = () => {
      let source = PLAN_ANTAM_4_IMG;
      switch (product.plan_code) {
        case "antam_2":
          source = PLAN_ANTAM_2_IMG;
          break;
        case "antam_4":
          source = PLAN_ANTAM_4_IMG;
          break;
        case "antam_8":
          source = PLAN_ANTAM_8_IMG;
          break;
      }

      return (
        <View style={styles.cardAvatarWrap}>
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            source={source}
            style={styles.cardAvatarImg}
          />
        </View>
      );
    };

    const features = [
      t("iapProtectMembersShort", { count: product.protected_members }),
      period === "yearly" && product.consultation_credits > 0
        ? t("iapConsultationCount", { count: product.consultation_credits })
        : t("iapNoConsultation"),
      t("iapAiCallcenterShort"),
      t("iapEarlySignalsShort"),
    ];

    return (
      <Pressable
        key={product.id}
        style={[
          styles.planCard,
          active && styles.planCardActive,
          isPopular && !active && styles.planCardPopularBorder,
        ]}
        onPress={() => setSelectedPlan(product.plan_code)}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgePlus}>+</Text>
            <Text style={styles.popularBadgeText}>{t("mostPopular")}</Text>
          </View>
        )}

        <View style={styles.planCardMainRow}>
          {getPlanAvatar()}

          <View style={styles.planInfoCol}>
            <Text
              style={[styles.planTitle, active && styles.planTitleActive]}
            >
              {localizedPlanName(product.plan_code, t)}
            </Text>
            <View style={styles.planPriceRow}>
              <Text
                style={[
                  styles.planPriceText,
                  active && styles.planPriceTextActive,
                ]}
              >
                {product.localizedPrice ??
                  formatVnd(product.display_price_vnd, i18n.language)}
              </Text>
              <Text style={styles.planPricePeriod}>
                {period === "yearly" ? ` ${t("iapPerYear")}` : ` ${t("iapPerMonth")}`}
              </Text>
            </View>
          </View>

          <View style={styles.planFeatureCol}>
            {features.map((item, idx) => (
              <View key={idx} style={styles.featureBulletRow}>
                <Text style={styles.featureBulletDot}>•</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.featureBulletText,
                    active && styles.featureBulletTextActive,
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.planCardFooter}>
          <View style={active ? styles.cardActivePill : styles.cardInactivePill}>
            {active ? (
              <View style={styles.pillRow}>
                <Ionicons name="checkmark" size={13} color="#fff" />
                <Text style={styles.cardActivePillText}>
                  {current ? t("iapCurrent") : t("iapSelected")}
                </Text>
              </View>
            ) : (
              <Text style={styles.cardInactivePillText}>
                {current ? t("iapCurrent") : t("iapSelectPlan")}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headingRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{t("iapPackageSectionTitle")}</Text>
          <Text style={styles.subtitle}>{t("iapPackageSectionSubtitle")}</Text>
        </View>
      </View>

      {/* Period switch */}
      <View style={styles.periodSwitch}>
        <Pressable
          style={[
            styles.periodButton,
            period === "yearly" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod("yearly")}
        >
          <Text
            style={[
              styles.periodText,
              period === "yearly" && styles.periodTextActive,
            ]}
          >
            {t("iapYearly")}
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>
              {yearlySavings
                ? t("iapYearlyDiscountBadge", yearlySavings)
                : t("iapYearlyValueBadge")}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.periodButton,
            period === "monthly" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod("monthly")}
        >
          <Text
            style={[
              styles.periodText,
              period === "monthly" && styles.periodTextActive,
            ]}
          >
            {t("iapMonthly")}
          </Text>
        </Pressable>
      </View>

      {/* Plans list */}
      {choices.length === 0 ? (
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <Text style={styles.noProducts}>{t("iapNoProducts")}</Text>
        )
      ) : (
        <View style={styles.planListWrap}>
          {choices.map((product) => renderCard(product))}
        </View>
      )}

      {/* Purchase and restore remain together, with room for large text. */}
      <View style={[styles.purchaseActions, stackActions && styles.purchaseActionsStacked]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !selected || actionBusy || selectedIsCurrent, busy }}
          style={[
            styles.buyButtonWrap,
            !stackActions && styles.buyButtonInline,
            (!selected || actionBusy || selectedIsCurrent) && styles.disabled,
          ]}
          onPress={buy}
          disabled={!selected || actionBusy || selectedIsCurrent}
        >
          <LinearGradient
            colors={
              selected?.plan_code === "antam_4"
                ? ["#f97316", "#ea580c"]
                : ["#059669", "#047857"]
            }
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={styles.buyButtonGradient}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.buyText}>
                  {selectedIsCurrent
                    ? t("iapCurrentExact")
                    : `${t("iapContinue", {
                        plan: selected ? localizedPlanName(selected.plan_code, t) : t("premium"),
                      })}`}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
        <RestoreLink compact disabled={busy} onBusyChange={setRestoring} onRestored={onPurchased} />
      </View>

      <SubscriptionFeedbackModal feedback={feedback} onDismiss={() => setFeedback(null)} />
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? colors.surface : "#ffffff",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: radius.xxl,
      borderWidth: 1,
      gap: spacing.md,
      marginTop: spacing.lg,
      padding: spacing.lg,
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    headingRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    headerInfo: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    eyebrowBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      borderColor: isDark ? "#059669" : "#a7f3d0",
      borderRadius: radius.full,
      borderWidth: 1,
      flexDirection: "row",
      gap: 5,
      marginBottom: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    eyebrow: {
      color: "#059669",
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    title: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: typography.size.md + 2,
      fontWeight: "800",
      lineHeight: 24,
    },
    subtitle: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: typography.size.xs,
      lineHeight: 18,
      marginTop: 3,
    },
    headerIconWrap: {
      alignItems: "center",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    periodSwitch: {
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      borderRadius: radius.xl,
      flexDirection: "row",
      padding: 4,
    },
    periodButton: {
      alignItems: "center",
      borderRadius: radius.lg,
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    periodButtonActive: {
      backgroundColor: isDark ? "#334155" : "#ffffff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    periodText: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: typography.size.xs + 1,
      fontWeight: "700",
    },
    periodTextActive: {
      color: isDark ? "#f8fafc" : "#0f172a",
    },
    savingsBadge: {
      backgroundColor: "#fef3c7",
      borderColor: "#f59e0b",
      borderRadius: 8,
      borderWidth: 1,
      marginLeft: 6,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    savingsBadgeText: {
      color: "#b45309",
      fontSize: 10,
      fontWeight: "800",
    },
    loading: {
      paddingVertical: spacing.xl,
    },
    noProducts: {
      color: isDark ? "#cbd5e1" : "#475569",
      fontSize: typography.size.sm,
      lineHeight: 21,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.lg,
      textAlign: "center",
    },
    planListWrap: {
      gap: 12,
    },
    planCard: {
      backgroundColor: isDark ? colors.surface : "#ffffff",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 14,
      position: "relative",
    },
    planCardActive: {
      backgroundColor: isDark ? "#1c1917" : "#fffdfa",
      borderColor: "#ea580c",
      shadowColor: "#ea580c",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    planCardPopularBorder: {
      borderColor: "#fed7aa",
    },
    popularBadge: {
      alignItems: "center",
      backgroundColor: "#fff7ed",
      borderColor: "#fdba74",
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 2.5,
      position: "absolute",
      right: 12,
      top: 10,
      zIndex: 2,
    },
    popularBadgePlus: {
      color: "#ea580c",
      fontSize: 11,
      fontWeight: "800",
    },
    popularBadgeText: {
      color: "#ea580c",
      fontSize: 10.5,
      fontWeight: "800",
    },
    planCardMainRow: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 6,
    },
    cardAvatarWrap: {
      alignItems: "center",
      height: 64,
      justifyContent: "center",
      width: 64,
    },
    cardAvatarImg: {
      height: 64,
      width: 64,
    },
    planInfoCol: {
      flex: 1.1,
      justifyContent: "center",
      marginLeft: 10,
    },
    planTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
    },
    planTitleActive: {
      color: "#0f172a",
    },
    planPriceRow: {
      alignItems: "baseline",
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 4,
    },
    planPriceText: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    planPriceTextActive: {
      color: "#0f172a",
    },
    planPricePeriod: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 12,
      fontWeight: "500",
    },
    planFeatureCol: {
      flex: 1.4,
      justifyContent: "center",
      marginLeft: 8,
    },
    featureBulletRow: {
      alignItems: "center",
      flexDirection: "row",
      marginVertical: 1.5,
    },
    featureBulletDot: {
      color: "#059669",
      fontSize: 13,
      fontWeight: "700",
      marginRight: 5,
    },
    featureBulletText: {
      color: isDark ? "#94a3b8" : "#475569",
      fontSize: 11.5,
      lineHeight: 16,
    },
    featureBulletTextActive: {
      color: isDark ? "#e2e8f0" : "#1e293b",
      fontWeight: "500",
    },
    planCardFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
    },
    cardActivePill: {
      alignItems: "center",
      backgroundColor: "#ea580c",
      borderRadius: 14,
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    cardActivePillText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "700",
    },
    cardInactivePill: {
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      borderColor: isDark ? "#334155" : "#cbd5e1",
      borderRadius: 14,
      borderWidth: 1,
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    cardInactivePillText: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 12,
      fontWeight: "600",
    },
    pillRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    purchaseActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.sm,
    },
    purchaseActionsStacked: {
      flexDirection: "column",
    },
    buyButtonInline: {
      flex: 1,
      minWidth: 0,
    },
    buyButtonWrap: {
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#ea580c",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    buyButtonGradient: {
      flex: 1,
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    buyText: {
      flex: 1,
      minWidth: 0,
      color: "#ffffff",
      fontSize: typography.size.sm,
      fontWeight: "800",
      textAlign: "center",
    },
    disabled: {
      elevation: 0,
      opacity: 0.55,
      shadowOpacity: 0,
    },
  });
}
