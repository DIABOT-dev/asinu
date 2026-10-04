import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { colors, radius, spacing, typography } from "../../styles";
import { FALLBACK_IAP_PRODUCTS } from "./iap.catalog";
import {
  fetchAvailableProducts,
  purchaseSubscription,
  type LocalProduct,
} from "./iap.service";
import { SubscriptionFeedbackModal, type SubscriptionFeedback } from "./SubscriptionFeedbackModal";
import { localizedPlanName } from "../subscription/planName";

const PLAN_ANTAM_2_IMG = require("../../../assets/images/subscription/plan_antam_2.png");
const PLAN_ANTAM_4_IMG = require("../../../assets/images/subscription/plan_antam_4.png");
const PLAN_ANTAM_8_IMG = require("../../../assets/images/subscription/plan_antam_8.png");

const PLAN_ORDER = ["antam_2", "antam_4", "antam_8"] as const;
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
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [feedback, setFeedback] = useState<SubscriptionFeedback | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>(() => [
    ...FALLBACK_IAP_PRODUCTS,
  ]);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState("antam_4");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
        <View style={styles.gridCardAvatar}>
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            source={source}
            style={styles.gridCardBadgeImg}
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
          styles.gridCard,
          active && styles.gridCardActive,
          isPopular && !active && styles.gridCardPopularBorder,
        ]}
        onPress={() => setSelectedPlan(product.plan_code)}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>{t("mostPopular")}</Text>
          </View>
        )}

        <View style={styles.gridCardHeader}>
          {getPlanAvatar()}
          <Text
            style={[styles.gridCardTitle, active && styles.gridCardTitleActive]}
          >
            {localizedPlanName(product.plan_code, t)}
          </Text>
          <View style={styles.gridPriceWrap}>
            <Text
              style={[
                styles.gridPriceText,
                active && styles.gridPriceTextActive,
              ]}
            >
              {product.localizedPrice ??
                formatVnd(product.display_price_vnd, i18n.language)}
            </Text>
            <Text style={styles.gridPricePeriod}>
              {period === "yearly" ? t("iapPerYear") : t("iapPerMonth")}
            </Text>
          </View>
        </View>

        <View style={styles.gridFeatureList}>
          {features.map((item, idx) => (
            <View key={idx} style={styles.gridFeatureRow}>
              <View style={styles.gridFeatureIconWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={
                    active ? (isPopular ? "#ea580c" : "#059669") : "#059669"
                  }
                />
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.gridFeatureText,
                  active && styles.gridFeatureTextActive,
                ]}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>

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
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headingRow}>
        <View style={styles.headerInfo}>
          <View style={styles.eyebrowBadge}>
            <Ionicons name="sparkles" size={12} color="#059669" />
            <Text style={styles.eyebrow}>{t("iapEyebrow")}</Text>
          </View>
          <Text style={styles.title}>{t("iapPackageSectionTitle")}</Text>
          <Text style={styles.subtitle}>{t("iapPackageSectionSubtitle")}</Text>
        </View>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons
            name="shield-check"
            size={26}
            color="#059669"
          />
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

      {/* Plans grid */}
      {planRows.length === 0 ? (
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <Text style={styles.noProducts}>{t("iapNoProducts")}</Text>
        )
      ) : (
        <View style={styles.gridWrap}>
          {planRows.map((row) => (
            <View key={row.map((product) => product.id).join(":")} style={styles.gridRow}>
              {row.map((product) => renderCard(product))}
            </View>
          ))}
        </View>
      )}

      {/* Primary CTA */}
      <Pressable
        style={[
          styles.buyButtonWrap,
          (!selected || busy || selectedIsCurrent) && styles.disabled,
        ]}
        onPress={buy}
        disabled={!selected || busy || selectedIsCurrent}
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
                    })} · ${
                      selected?.localizedPrice ??
                      formatVnd(selected?.display_price_vnd ?? 0, i18n.language)
                    }`}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </>
          )}
        </LinearGradient>
      </Pressable>

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
    gridWrap: {
      gap: 12,
    },
    gridRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 10,
    },
    gridCard: {
      backgroundColor: isDark ? colors.surface : "#fffdfa",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: 20,
      borderWidth: 1.5,
      flex: 1,
      justifyContent: "space-between",
      padding: 12,
      position: "relative",
    },
    gridCardActive: {
      backgroundColor: isDark ? "#1c1917" : "#fffbf5",
      borderColor: "#ea580c",
      shadowColor: "#ea580c",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    gridCardPopularBorder: {
      borderColor: "#fed7aa",
    },
    popularBadge: {
      backgroundColor: "#ea580c",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      position: "absolute",
      right: 10,
      top: -10,
      zIndex: 2,
    },
    popularBadgeText: {
      color: "#fffaf5",
      fontSize: 9.5,
      fontWeight: "800",
    },
    gridCardHeader: {
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: 116,
      paddingBottom: 4,
      paddingTop: 4,
    },
    gridCardAvatar: {
      alignItems: "center",
      height: 48,
      justifyContent: "center",
      marginBottom: 6,
      width: 48,
    },
    gridCardBadgeImg: {
      height: 48,
      width: 48,
    },
    gridCardTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    gridCardTitleActive: {
      color: "#ea580c",
    },
    gridPriceWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      minHeight: 38,
      paddingVertical: 2,
    },
    gridPriceText: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
    gridPriceTextActive: {
      color: "#ea580c",
    },
    gridPricePeriod: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 10.5,
      marginTop: -2,
    },
    gridFeatureList: {
      gap: 8,
      marginVertical: 10,
    },
    gridFeatureRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      minHeight: 28,
    },
    gridFeatureIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginRight: 5,
      marginTop: 1,
      width: 16,
    },
    gridFeatureText: {
      color: isDark ? "#cbd5e1" : "#475569",
      flex: 1,
      fontSize: 10.5,
      lineHeight: 14.5,
    },
    gridFeatureTextActive: {
      color: isDark ? "#f8fafc" : "#1e293b",
      fontWeight: "600",
    },
    cardActivePill: {
      alignItems: "center",
      backgroundColor: "#ea580c",
      borderRadius: 10,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 34,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    cardActivePillText: {
      color: "#fffaf5",
      fontSize: 11,
      fontWeight: "700",
    },
    cardInactivePill: {
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      borderRadius: 10,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 34,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    cardInactivePillText: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 11,
      fontWeight: "600",
    },
    pillRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
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
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 50,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    buyText: {
      color: "#ffffff",
      fontSize: typography.size.sm,
      fontWeight: "800",
    },
    disabled: {
      elevation: 0,
      opacity: 0.55,
      shadowOpacity: 0,
    },
  });
}
