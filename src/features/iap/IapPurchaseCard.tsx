import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PLAN_ORDER = ["antam_2", "antam_4", "antam_8"] as const;
const SUPPORTED_PLAN_CODES = new Set<string>(PLAN_ORDER);

type Props = {
  currentPlanCode?: string;
  currentBillingPeriod?: "monthly" | "yearly" | null;
  disabled?: boolean;
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
  disabled = false,
  onPurchased,
}: Props) {
  const { t, i18n } = useTranslation("subscription");
  const { isDark } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const { size, scaledSize } = useScaledTypography();
  const textScale = (fontScale || 1) * scaledSize.sm / size.sm;
  const stackPlans = width < 360 || textScale > 1.15;
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [feedback, setFeedback] = useState<SubscriptionFeedback | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>(() => [
    ...FALLBACK_IAP_PRODUCTS,
  ]);
  const [period, setPeriod] = useState<"monthly" | "yearly">(() => currentBillingPeriod ?? "yearly");
  const [selectedPlan, setSelectedPlan] = useState(() =>
    SUPPORTED_PLAN_CODES.has(currentPlanCode) ? currentPlanCode : "antam_4"
  );
  const selectionTouched = useRef(false);
  const purchaseInFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const actionBusy = busy || restoring || disabled;

  useEffect(() => {
    // Status may arrive after mounting. Match it until the user explicitly
    // chooses another plan or period; refreshes must not reset that choice.
    if (selectionTouched.current || !SUPPORTED_PLAN_CODES.has(currentPlanCode)) return;
    setSelectedPlan(currentPlanCode);
    if (currentBillingPeriod) setPeriod(currentBillingPeriod);
  }, [currentBillingPeriod, currentPlanCode]);

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
  const changingPeriod = selected?.plan_code === currentPlanCode && !!currentBillingPeriod && !selectedIsCurrent;

  const planRows = useMemo(() => {
    const rows: LocalProduct[][] = [];
    const columns = stackPlans ? 1 : 2;
    for (let index = 0; index < choices.length; index += columns) {
      rows.push(choices.slice(index, index + columns));
    }
    return rows;
  }, [choices, stackPlans]);

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
    if (!selected || selectedIsCurrent || actionBusy || purchaseInFlight.current) {
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
    purchaseInFlight.current = true;
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
      purchaseInFlight.current = false;
      setBusy(false);
    }
  }, [actionBusy, onPurchased, selected, selectedIsCurrent, t]);

  const renderCard = (product?: LocalProduct, wide = false) => {
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

    // Plan comparison uses the V2 VND catalogue; Store billing keeps its native price.
    const displayPrice = formatVnd(product.display_price_vnd, i18n.language);
    const features = [
      t("iapProtectMembersShort", { count: product.protected_members }),
      ...(period === "yearly" ? [product.consultation_credits > 0
        ? t("iapConsultationCount", { count: product.consultation_credits })
        : t("iapNoConsultation")] : [t("iapNoConsultation")]),
      t("iapAiCallcenterShort"),
      t("iapFamilyCallsShort"),
      t("iapHealthHistoryShort"),
      t("iapFamilyCareShort"),
      t("iapSummaryShort"),
      t("iapEarlySignalsShort"),
    ];

    return (
      <Pressable
        accessibilityLabel={[
          localizedPlanName(product.plan_code, t),
          period === "yearly" ? t("iapYearly") : t("iapMonthly"),
          displayPrice,
          ...features,
          ...(current ? [t("iapCurrent")] : []),
        ].join(". ")}
        accessibilityRole="radio"
        accessibilityState={{ checked: active, disabled: actionBusy }}
        disabled={actionBusy}
        key={product.id}
        style={[
          styles.planCard,
          active && styles.planCardActive,
          isPopular && !active && styles.planCardPopularBorder,
        ]}
        onPress={() => {
          selectionTouched.current = true;
          setSelectedPlan(product.plan_code);
        }}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Ionicons name="sparkles" size={12} color="#ffffff" />
            <Text allowFontScaling style={styles.popularBadgeText}>
              {t("mostPopular").replace(/^[★*✦\s+]+/, "")}
            </Text>
          </View>
        )}

        <View style={[styles.planCardContent, wide && styles.planCardContentWide]}>
          <View style={[styles.planSummary, wide && styles.planSummaryWide]}>
            <View style={styles.planIdentity}>
              {getPlanAvatar()}
              <Text
                allowFontScaling
                style={[styles.planTitle, active && styles.planTitleActive]}
              >
                {localizedPlanName(product.plan_code, t)}
              </Text>
            </View>
            <View style={styles.planPriceRow}>
              <Text
                allowFontScaling
                style={[
                  styles.planPriceText,
                  active && styles.planPriceTextActive,
                ]}
              >
                {displayPrice}
              </Text>
              <Text allowFontScaling style={styles.planPricePeriod}>
                {period === "yearly" ? t("iapPerYear") : t("iapPerMonth")}
              </Text>
            </View>
          </View>

          <View style={[styles.planDetails, wide && styles.planDetailsWide]}>
            <View style={styles.planFeatureList}>
              {features.map((item, idx) => (
                <View key={idx} style={styles.featureItemRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.primaryText}
                    style={styles.featureCheckIcon}
                  />
                  <Text allowFontScaling style={styles.featureItemText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={active ? styles.cardActivePill : styles.cardInactivePill}>
              {active ? (
                <View style={styles.pillRow}>
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                  <Text allowFontScaling style={styles.cardActivePillText}>
                    {current ? t("iapCurrent") : t("iapSelected")}
                  </Text>
                </View>
              ) : (
                <Text allowFontScaling style={styles.cardInactivePillText}>
                  {current ? t("iapCurrent") : t("iapSelectPlan")}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {/* Period switch */}
      <View style={styles.periodSwitch}>
        <Pressable
          disabled={actionBusy}
          style={[
            styles.periodButton,
            period === "yearly" && styles.periodButtonActive,
          ]}
          onPress={() => {
            selectionTouched.current = true;
            setPeriod("yearly");
          }}
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
          disabled={actionBusy}
          style={[
            styles.periodButton,
            period === "monthly" && styles.periodButtonActive,
          ]}
          onPress={() => {
            selectionTouched.current = true;
            setPeriod("monthly");
          }}
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
          {planRows.map((row) => (
            <View key={`row-${row[0].id}`} style={styles.planRow}>
              {row.map((product) => renderCard(product, row.length === 1 && !stackPlans))}
            </View>
          ))}
        </View>
      )}

      {period === "yearly" && choices.some(product => product.consultation_credits > 0) ? (
        <Text allowFontScaling style={styles.benefitNote}>{t("iapAnnualGiftAvailability")}</Text>
      ) : null}

      {/* The selected plan determines the single available action. */}
      <View style={styles.purchaseActions}>
        {selectedIsCurrent ? (
          <RestoreLink compact disabled={busy || disabled} onBusyChange={setRestoring} onRestored={onPurchased} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !selected || actionBusy, busy }}
            style={({ pressed }) => [
              styles.buyButtonWrap,
              (!selected || actionBusy) && styles.disabled,
              pressed && styles.buyButtonPressed,
            ]}
            onPress={buy}
            disabled={!selected || actionBusy}
          >
            <View style={styles.buyButtonContent}>
              {busy ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={20}
                    color={colors.primaryText}
                  />
                  <Text allowFontScaling style={styles.buyText}>
                    {changingPeriod
                      ? t(period === "yearly" ? "iapChangeToYearly" : "iapChangeToMonthly")
                      : t("iapBuy", {
                          plan: selected ? localizedPlanName(selected.plan_code, t) : t("premium"),
                        })}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        )}
      </View>

      <SubscriptionFeedbackModal feedback={feedback} onDismiss={() => setFeedback(null)} />
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    card: {
      gap: spacing.md,
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
      backgroundColor: "#dcfce7",
      borderColor: "#86efac",
      borderRadius: 12,
      borderWidth: 1,
      marginLeft: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    savingsBadgeText: {
      color: "#15803d",
      fontSize: 10.5,
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
    benefitNote: {
      color: colors.textSecondary,
      fontSize: 15,
    },
    planListWrap: {
      gap: 14,
      paddingTop: 8,
    },
    planRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 12,
    },
    planCard: {
      backgroundColor: isDark ? colors.surface : "#ffffff",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: 20,
      borderWidth: 1.5,
      flex: 1,
      minWidth: 0,
      padding: 12,
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
      backgroundColor: "#ea580c",
      borderRadius: 999,
      elevation: 4,
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4.5,
      position: "absolute",
      right: 8,
      shadowColor: "#ea580c",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      top: -12,
      zIndex: 10,
    },
    popularBadgeText: {
      color: "#ffffff",
      fontSize: 10.5,
      fontWeight: "800",
    },
    planCardContent: {
      flex: 1,
      gap: 10,
      marginTop: 6,
    },
    planCardContentWide: {
      flexDirection: "row",
      gap: 16,
    },
    planSummary: {
      minWidth: 0,
    },
    planSummaryWide: {
      flex: 1,
    },
    planIdentity: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minWidth: 0,
    },
    cardAvatarWrap: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    cardAvatarImg: {
      height: 44,
      width: 44,
    },
    planTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
      flex: 1,
      minWidth: 0,
    },
    planTitleActive: {
      color: colors.textPrimary,
    },
    planPriceRow: {
      alignItems: "center",
      alignSelf: "stretch",
      flexDirection: "column",
      marginTop: 6,
    },
    planPriceText: {
      alignSelf: "stretch",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.3,
      textAlign: "center",
    },
    planPriceTextActive: {
      color: "#ea580c",
    },
    planPricePeriod: {
      alignSelf: "stretch",
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 12,
      fontWeight: "500",
      textAlign: "center",
    },
    planDetails: {
      flex: 1,
      justifyContent: "space-between",
      minWidth: 0,
    },
    planDetailsWide: {
      flex: 1,
    },
    planFeatureList: {
      gap: 6,
    },
    featureItemRow: {
      alignItems: "flex-start",
      flexDirection: "row",
    },
    featureCheckIcon: {
      marginRight: 6,
      marginTop: 2,
    },
    featureItemText: {
      color: isDark ? "#cbd5e1" : "#334155",
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 17,
    },
    cardActivePill: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: "#ea580c",
      borderRadius: 18,
      justifyContent: "center",
      marginTop: 10,
      minHeight: 48,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    cardActivePillText: {
      color: "#ffffff",
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    cardInactivePill: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: isDark ? "rgba(45,212,191,0.1)" : "#f0fdf9",
      borderColor: isDark ? "#2dd4bf" : "#5eead4",
      borderRadius: 18,
      borderWidth: 1.2,
      justifyContent: "center",
      marginTop: 10,
      minHeight: 48,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    cardInactivePillText: {
      color: isDark ? "#5eead4" : "#0d9488",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    pillRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "center",
    },
    purchaseActions: {
      alignItems: "stretch",
      flexDirection: "column",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    buyButtonWrap: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      minHeight: 56,
      overflow: "hidden",
    },
    buyButtonPressed: {
      opacity: 0.8,
    },
    buyButtonContent: {
      alignItems: "center",
      borderRadius: radius.lg,
      flex: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    buyText: {
      color: colors.primaryText,
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "700",
      minWidth: 0,
      textAlign: "center",
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
