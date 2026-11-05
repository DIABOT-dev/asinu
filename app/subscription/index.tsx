import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useFocusEffect } from "expo-router";
import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { Screen } from "../../src/components/Screen";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { SubscriptionFAQ } from "../../src/components/SubscriptionFAQ";
import { ProfilePreferenceModal } from "../../src/features/profile/ProfilePreferenceModal";
import { localizedPlanName } from "../../src/features/subscription/planName";
import { SubscriptionScenarioComparison } from "../../src/features/subscription/components/SubscriptionScenarioComparison";
import { CarePlanBackground } from "../../src/features/subscription/components/CarePlanBackground";
import type { PlanCode, SubscriptionStatus } from "../../src/features/subscription/subscription.types";
import {
  careCircleApi,
  type CareCircleConnection,
} from "../../src/features/care-circle/care-circle.api";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { useScaledFontSize, useScaledTypography } from "../../src/hooks/useScaledTypography";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { apiClient, getApiErrorMessage } from "../../src/lib/apiClient";
import { showToast } from "../../src/stores/toast.store";
import { colors, radius, spacing } from "../../src/styles";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

const PLAN_FREE_IMG = require("../../assets/images/subscription/plan_free.png");
const PLAN_ANTAM_IMG = require("../../assets/images/subscription/plan_antam.png");
const PLAN_ANTAM_2_IMG = require("../../assets/images/subscription/plan_antam_2.png");
const PLAN_ANTAM_4_IMG = require("../../assets/images/subscription/plan_antam_4.png");
const PLAN_ANTAM_8_IMG = require("../../assets/images/subscription/plan_antam_8.png");
const PROTECTED_HERO_SHIELD = require("../../assets/images/subscription/protected_hero_shield.png");
const PROTECTED_UPSELL_SHIELD = require("../../assets/images/subscription/protected_upsell_shield.png");

const PROTECTED_AVATAR_1 = require("../../assets/images/subscription/protected_avatar_1.png");
const PROTECTED_AVATAR_2 = require("../../assets/images/subscription/protected_avatar_2.png");
const PROTECTED_AVATAR_3 = require("../../assets/images/subscription/protected_avatar_3.png");
const PROTECTED_AVATAR_4 = require("../../assets/images/subscription/protected_avatar_4.png");

const PROTECTED_AVATARS = [
  PROTECTED_AVATAR_1,
  PROTECTED_AVATAR_2,
  PROTECTED_AVATAR_3,
  PROTECTED_AVATAR_4,
];

function getFallbackProtectedAvatar(userId: number, index: number) {
  const safeId = Math.abs(userId || 0);
  const avatarIndex = (safeId + index) % PROTECTED_AVATARS.length;
  return PROTECTED_AVATARS[avatarIndex];
}

function getPlanImageByCode(planCode?: PlanCode, isAnTam?: boolean) {
  switch (planCode) {
    case "antam_2":
      return PLAN_ANTAM_2_IMG;
    case "antam_4":
      return PLAN_ANTAM_4_IMG;
    case "antam_8":
      return PLAN_ANTAM_8_IMG;
    case "free":
      return PLAN_FREE_IMG;
    default:
      return isAnTam ? PLAN_ANTAM_IMG : PLAN_FREE_IMG;
  }
}

type ProtectedMember = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  addedAt: string;
};
type Household = {
  ok: boolean;
  ownerUserId: number;
  planCode: PlanCode;
  planName: string;
  protectedMemberLimit: number;
  protectedMemberCount: number;
  members: ProtectedMember[];
};

const FREE_FEATURES = [
  "v2FreeFeature1",
  "v2FreeFeature2",
  "v2FreeFeature3",
  "v2FreeFeature4",
  "v2FreeFeature5",
  "v2FreeFeature6",
];

const AN_TAM_FEATURES = [
  "v2AnTamFeature1",
  "v2AnTamFeature2",
  "v2AnTamFeature3",
  "v2AnTamFeature4",
  "v2AnTamFeature5",
  "v2AnTamFeature6",
];

const FEATURE_TITLE_FONT_SIZE = 17;
const FEATURE_CHECK_SIZE = 16;

function formatDate(value: string | null, language: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(language === "en" ? "en-US" : "vi-VN");
}

type CurrentPlanCardProps = {
  status: SubscriptionStatus | null;
  loading: boolean;
  language: string;
  userName?: string;
  avatarUrl?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  styles: ReturnType<typeof createStyles>;
};

const CurrentPlanCard = memo(function CurrentPlanCard({
  status,
  loading,
  language,
  t,
  styles,
}: CurrentPlanCardProps) {
  const isAnTam = !!status?.isAnTam;
  const currentPlanImage = getPlanImageByCode(status?.planCode, isAnTam);

  return (
    <View style={styles.currentPlanCard}>
      <View
        style={[
          styles.currentAvatarWrap,
        ]}
      >
        <Image
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="contain"
          source={currentPlanImage}
          style={styles.currentPlanBadgeImg}
        />
      </View>
      <View style={styles.currentPlanInfo}>
        <View style={styles.currentPlanTitleRow}>
          <Text style={styles.currentPlanLabel}>{t("v2CurrentPlan")}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : status ? (
            <View
              style={[
                styles.currentPlanBadge,
                isAnTam && styles.currentPlanBadgeAnTam,
              ]}
            >
              <Text
                style={[
                  styles.currentPlanBadgeText,
                  isAnTam && styles.currentPlanBadgeTextAnTam,
                ]}
              >
                {localizedPlanName(status?.planCode, t)}
              </Text>
            </View>
          ) : null}
        </View>
        {!loading && (
          <Text style={styles.currentPlanSub}>
            {!status ? t("v2LoadError") : isAnTam
              ? t("v2PaidMeta", {
                  used: status.protectedMemberCount,
                  limit: status.protectedMemberLimit,
                  expiry: status.expiresAt
                    ? t("v2PaidExpiry", {
                        date: formatDate(status.expiresAt, language),
                      })
                    : "",
                })
              : t("v2FreeMeta")}
          </Text>
        )}
      </View>
    </View>
  );
});

type FeatureItem = {
  icon?: React.ReactNode;
  text: string;
  description: string;
};

type PlanComparisonProps = {
  freeFeatures: FeatureItem[];
  anTamFeatures: FeatureItem[];
  freeIsCurrent: boolean;
  purchaseDisabled?: boolean;
  onChoosePlan: () => void;
  t: (key: string) => string;
  styles: ReturnType<typeof createStyles>;
};

const PlanComparison = memo(function PlanComparison({
  freeFeatures,
  anTamFeatures,
  freeIsCurrent,
  purchaseDisabled = false,
  onChoosePlan,
  t,
  styles,
}: PlanComparisonProps) {
  const { width, fontScale } = useWindowDimensions();
  const { isDark } = useThemeColors();
  const [selectedPlan, setSelectedPlan] = useState<"free" | "anTam" | null>(null);
  const activePlan = useRef<"free" | "anTam" | null>(null);
  const premium = selectedPlan === "anTam";
  const closeDetails = useCallback(() => {
    activePlan.current = null;
    setSelectedPlan(null);
  }, []);
  useFocusEffect(useCallback(() => closeDetails, [closeDetails]));
  const titleFontSize = useScaledFontSize(FEATURE_TITLE_FONT_SIZE);
  const checkFontSize = useScaledFontSize(FEATURE_CHECK_SIZE);
  const stacked = width < 350 || (fontScale || 1) * titleFontSize / FEATURE_TITLE_FONT_SIZE > 1.2;
  // Match ScaledText's first line, not the height of the entire title/description.
  const titleLineHeight = Math.round(titleFontSize * (Platform.OS === "android" ? 1.6 : 1.5)) * (fontScale || 1);
  const checkSize = Math.round(checkFontSize * (fontScale || 1));
  const featureIconStyle = { height: titleLineHeight, width: checkSize + 2 };
  const checkStyle = { lineHeight: checkSize, includeFontPadding: false };
  const renderFeatures = (items: FeatureItem[], premium: boolean) => (
    <View style={styles.featureList}>
      {items.map((item) => (
        <View key={item.text} style={styles.comparisonFeatureRow}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.featureIconWrap, featureIconStyle]}>
            <Ionicons allowFontScaling={false} name="checkmark-circle" size={checkSize} color={premium ? "#ea580c" : "#059669"} style={checkStyle} />
          </View>
          <View style={styles.featureCopy}>
            <Text allowFontScaling style={premium ? styles.premiumFeatureText : styles.featureText}>{item.text}</Text>
            <Text allowFontScaling style={styles.featureDescription}>{item.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.comparisonRow, stacked && styles.comparisonStacked]}>
      {(["free", "anTam"] as const).map((plan) => (
        <View
          key={plan}
          style={[
            styles.planChoice,
            plan === "free" ? styles.freeChoice : styles.premiumChoice,
            stacked && styles.planChoiceStacked,
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={plan === "free"
              ? isDark ? ["#1b2d45", "#16263b"] : ["#f8fbff", "#edf4ff"]
              : isDark ? ["#173b44", "#162c3a"] : ["#eefbfc", "#ddf4f7"]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(plan === "free" ? "v2FreePlan" : "v2AnTamPlanName")}
            accessibilityHint={t("v2ViewBenefits")}
            onPress={() => { activePlan.current = plan; setSelectedPlan(plan); }}
            style={({ pressed }) => [styles.planChoiceDetails, pressed && styles.planChoicePressed]}
          >
            <View style={styles.planArtwork}>
              <Image
                accessible={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                source={plan === "free" ? PLAN_FREE_IMG : PLAN_ANTAM_IMG}
                style={[styles.planChoiceImage, plan === "anTam" && styles.premiumChoiceImage]}
              />
            </View>
            <Text allowFontScaling style={[
              styles.planChoiceTitle,
              plan === "free" ? styles.freePlanTitle : styles.premiumPlanTitle,
            ]}>
              {t(plan === "free" ? "v2FreePlan" : "v2AnTamPlanName")}
            </Text>
            <Text allowFontScaling style={styles.planChoiceDescription}>
              {t(plan === "free" ? "v2FreeOverview" : "v2AnTamOverview")}
            </Text>
          </Pressable>
          {plan === "anTam" && freeIsCurrent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("upgradeNow")}
              accessibilityState={{ disabled: purchaseDisabled }}
              disabled={purchaseDisabled}
              onPress={onChoosePlan}
              style={({ pressed }) => [styles.upgradeButton, pressed && styles.planChoicePressed, purchaseDisabled && styles.protectedHeaderButtonDisabled]}
            >
              <LinearGradient pointerEvents="none" colors={["#35a5b4", "#247a8d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text allowFontScaling style={styles.upgradeButtonText}>{t("upgradeNow")}</Text>
            </Pressable>
          ) : (
            <View style={styles.planStatusPill}>
              {!purchaseDisabled && (plan === "free" ? freeIsCurrent : !freeIsCurrent) && <Ionicons accessible={false} name="checkmark-circle" size={16} color={plan === "free" ? "#3674ce" : "#287d88"} />}
              <Text allowFontScaling style={[styles.planStatusText, plan === "anTam" && styles.premiumPlanStatusText]}>
                {t(purchaseDisabled || (plan === "free" && !freeIsCurrent) ? "v2ViewBenefits" : "currentlyUsing")}
              </Text>
            </View>
          )}
        </View>
      ))}
      {selectedPlan && (
        <ProfilePreferenceModal
          visible
          title={t(premium ? "v2AnTamPlanName" : "v2FreePlan")}
          onClose={closeDetails}
        >
          <View>
            {premium && <View style={styles.popularBadge}>
              <Text allowFontScaling style={styles.popularBadgeText}>{t("comparison.anTamBadge")}</Text>
            </View>}
            <View style={styles.planPriceWrap}>
              {premium ? <Text allowFontScaling style={styles.planPeriodOptions}>
                {t("iapMonthly")} · {t("iapYearly")}
              </Text> : <>
                <Text allowFontScaling style={styles.freePrice}>{t("freePrice")}</Text>
                <Text allowFontScaling style={styles.perMonthText}>{t("freeForever")}</Text>
              </>}
            </View>
            <Text allowFontScaling style={styles.planIntroduction}>
              {t(premium ? "comparison.anTamIntroduction" : "comparison.freeIntroduction")}
            </Text>
            {renderFeatures(premium ? anTamFeatures : freeFeatures, premium)}
            {premium ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("iapChooseTitle")}
              accessibilityState={{ disabled: purchaseDisabled }}
              disabled={purchaseDisabled}
              onPress={() => {
                if (activePlan.current !== "anTam") return;
                closeDetails();
                onChoosePlan();
              }}
              style={({ pressed }) => [styles.premiumCTABtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text allowFontScaling style={styles.premiumCTAText}>{t("iapChooseTitle")}</Text>
            </Pressable> : <View style={styles.freeCTABox}>
              <Text allowFontScaling style={styles.freeCTAText}>
                {freeIsCurrent ? t("currentlyUsing") : t("v2FreeTitle")}
              </Text>
            </View>}
          </View>
        </ProfilePreferenceModal>
      )}
    </View>
  );
});

function memberFromConnection(
  connection: CareCircleConnection,
  currentUserId: number,
  fallbackName: string
) {
  const currentIsRequester = Number(connection.requester_id) === currentUserId;
  return {
    userId: Number(
      currentIsRequester ? connection.addressee_id : connection.requester_id
    ),
    name:
      (currentIsRequester
        ? connection.addressee_full_name
        : connection.requester_full_name) ||
      (currentIsRequester
        ? connection.addressee_name
        : connection.requester_name) ||
      fallbackName,
    avatarUrl:
      (currentIsRequester
        ? connection.addressee_avatar_url
        : connection.requester_avatar_url) || null,
  };
}

export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation("subscription");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(scaledTypography, isDark),
    [isDark, scaledTypography]
  );
  const profile = useAuthStore((state) => state.profile);
  const currentUserId = Number(profile?.id || 0);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [connections, setConnections] = useState<CareCircleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberModal, setMemberModal] = useState(false);
  const [memberBusy, setMemberBusy] = useState<number | null>(null);

  const refresh = useCallback(async (isCurrent: () => boolean = () => true) => {
    try {
      const [nextStatus, nextHousehold, nextConnections] = await Promise.all([
        apiClient<SubscriptionStatus>("/api/subscriptions/status"),
        apiClient<Household>("/api/subscription-household"),
        careCircleApi.getConnections(),
      ]);
      if (!isCurrent()) return;
      setStatus(nextStatus);
      setHousehold(nextHousehold);
      setConnections(nextConnections);
    } catch (error) {
      if (isCurrent()) showToast(getApiErrorMessage(error, t, "v2LoadError"), "error");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void refresh(() => active);
    return () => { active = false; };
  }, [currentUserId, refresh]));

  const connectionAvatarMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of connections) {
      const isReq = Number(c.requester_id) === currentUserId;
      const otherId = Number(isReq ? c.addressee_id : c.requester_id);
      const otherAvatar = isReq
        ? c.addressee_avatar_url
        : c.requester_avatar_url;
      if (otherId && otherAvatar) {
        map.set(otherId, otherAvatar);
      }
    }
    return map;
  }, [connections, currentUserId]);

  const candidates = useMemo(() => {
    const activeIds = new Set(
      household?.members.map((member) => member.userId) ?? []
    );
    return connections
      .map((connection) =>
        memberFromConnection(connection, currentUserId, t("v2Relative"))
      )
      .filter((member) => member.userId > 0 && !activeIds.has(member.userId));
  }, [connections, currentUserId, household?.members, t]);

  const protectedMemberCount =
    household?.protectedMemberCount ?? status?.protectedMemberCount ?? (status?.isAnTam ? 1 : 1);
  const protectedMemberLimit =
    household?.protectedMemberLimit ?? status?.protectedMemberLimit ?? 1;
  const canManageProtectedMembers = !!status?.isOwner && !!status?.isAnTam;
  const protectedSlotsFull = protectedMemberCount >= protectedMemberLimit;

  const displayMembers = useMemo(() => {
    if (household?.members && household.members.length > 0) {
      return household.members;
    }
    if (profile?.name) {
      return [
        {
          userId: currentUserId,
          name: profile.name,
          avatarUrl: profile.avatarUrl || null,
          role: "owner" as const,
        },
      ];
    }
    return [];
  }, [household?.members, profile?.avatarUrl, profile?.name, currentUserId]);

  const addMember = useCallback(
    async (userId: number) => {
      setMemberBusy(userId);
      try {
        const next = await apiClient<Household>(
          "/api/subscription-household/members",
          {
            method: "POST",
            body: { user_id: userId },
          }
        );
        setHousehold(next);
        await refresh();
      } catch (error) {
        showToast(getApiErrorMessage(error, t, "v2MemberUpdateError"), "error");
      } finally {
        setMemberBusy(null);
      }
    },
    [refresh, t]
  );

  const removeMember = useCallback(
    async (userId: number) => {
      setMemberBusy(userId);
      try {
        const next = await apiClient<Household>(
          `/api/subscription-household/members/${userId}`,
          {
            method: "DELETE",
          }
        );
        setHousehold(next);
        await refresh();
      } catch (error) {
        showToast(getApiErrorMessage(error, t, "v2MemberUpdateError"), "error");
      } finally {
        setMemberBusy(null);
      }
    },
    [refresh, t]
  );

  const freeFeatures = useMemo<FeatureItem[]>(
    () => FREE_FEATURES.map((feature) => ({ text: t(feature), description: t(`${feature}Description`) })),
    [t]
  );

  const anTamFeatures = useMemo<FeatureItem[]>(
    () => AN_TAM_FEATURES.map((feature) => ({ text: t(feature), description: t(`${feature}Description`) })),
    [t]
  );

  const handleChoosePlan = useCallback(() => {
    router.push("/subscription/plans");
  }, [router]);

  return (
    <Screen>
      <CarePlanBackground />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(280)}>
          <View style={styles.headerRow}>
            <ScreenBackButton style={styles.backButton} iconColor={isDark ? "#dbeafe" : "#19325e"} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")} />
            <View style={styles.headerTextCol}>
              <Text numberOfLines={2} style={styles.headerTitle}>
                {t("features.premiumTitle")}
              </Text>
            </View>
            <Pressable
              accessibilityHint={t("v2ProtectedIconHint")}
              accessibilityLabel={`${t("v2ProtectedPeople")}. ${t(
                "v2SlotsUsed",
                {
                  used: protectedMemberCount,
                  limit: protectedMemberLimit,
                }
              )}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              hitSlop={8}
              onPress={() => setMemberModal(true)}
              style={({ pressed }) => [
                styles.protectedHeaderButton,
                pressed && styles.protectedHeaderButtonPressed,
                loading && styles.protectedHeaderButtonDisabled,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={27}
                color={isDark ? "#8bdce3" : "#398ea5"}
              />
              {loading ? (
                <ActivityIndicator
                  color={colors.primary}
                  size="small"
                  style={styles.protectedHeaderLoading}
                />
              ) : (
                <View style={styles.protectedCountBadge}>
                  <Text style={styles.protectedCountBadgeText}>
                    {protectedMemberCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <CurrentPlanCard
            avatarUrl={profile?.avatarUrl}
            language={i18n.language}
            loading={loading}
            status={status}
            styles={styles}
            t={t}
            userName={profile?.name}
          />

          <View style={styles.faqWrapper}>
            <SubscriptionFAQ />
          </View>

          <SubscriptionScenarioComparison />

          <PlanComparison
            anTamFeatures={anTamFeatures}
            freeFeatures={freeFeatures}
            freeIsCurrent={status?.planCode === "free"}
            purchaseDisabled={loading || !status}
            onChoosePlan={handleChoosePlan}
            styles={styles}
            t={t}
          />

        </Animated.View>
      </ScrollView>

      <Modal
        visible={memberModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setMemberModal(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setMemberModal(false)}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Pressable
            accessibilityLabel={t("v2CloseProtected")}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => setMemberModal(false)}
            style={({ pressed }) => [
              styles.sheetCloseButton,
              pressed && styles.protectedHeaderButtonPressed,
            ]}
          >
            <Ionicons
              name="close"
              size={24}
              color={isDark ? "#94a3b8" : "#64748b"}
            />
          </Pressable>

          {/* Top-Right Ethereal 3D Shield Hero Art */}
          <View pointerEvents="none" style={styles.sheetHeroArtWrap}>
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              source={PROTECTED_HERO_SHIELD}
              style={styles.sheetHeroArtImg}
            />
          </View>

          <View style={styles.sheetHeaderCopy}>
            <View style={styles.sheetHeaderTitleRow}>
              <View style={styles.sheetIconCircle}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color="#2563eb"
                />
              </View>
              <Text style={styles.sheetTitle}>{t("v2ProtectedPeople")}</Text>
            </View>

            <Text style={styles.sheetHeaderSubtitle}>
              {t("v2ProtectedHeaderSubtitle")}
            </Text>

            <View style={styles.sheetSlotsBadge}>
              <Ionicons
                name="shield-checkmark"
                size={15}
                color={isDark ? "#34d399" : "#059669"}
              />
              <Text style={styles.sheetSlotsText}>
                {t("v2SlotsUsed", {
                  used: protectedMemberCount,
                  limit: protectedMemberLimit,
                })}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetSectionHeaderWrap}>
              <Text style={styles.sheetSectionTitle}>
                {t("v2CurrentProtected")}
              </Text>
              <View style={styles.sheetSectionDivider} />
            </View>

            {displayMembers.length === 0 ? (
              <Text style={styles.sheetEmptyText}>{t("v2NoProtectedYet")}</Text>
            ) : (
              <View style={styles.modalMembersList}>
                {displayMembers.map((member, index) => {
                  const memberAvatar =
                    (member.userId === currentUserId
                      ? profile?.avatarUrl
                      : null) ||
                    member.avatarUrl ||
                    connectionAvatarMap.get(member.userId) ||
                    null;
                  const fallbackAvatar = getFallbackProtectedAvatar(
                    member.userId,
                    index
                  );
                  const isOwner =
                    member.userId === household?.ownerUserId ||
                    member.userId === currentUserId;

                  return (
                    <Pressable
                      key={member.userId}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.memberRow,
                        pressed && styles.memberRowPressed,
                      ]}
                      onPress={() => {
                        setMemberModal(false);
                        if (member.userId === currentUserId) {
                          router.push("/(tabs)/profile" as any);
                        } else {
                          router.push({
                            pathname: "/care-circle/member/[id]",
                            params: { id: member.userId, name: member.name },
                          } as any);
                        }
                      }}
                    >
                      <View style={styles.memberAvatar}>
                        <Image
                          cachePolicy="memory-disk"
                          contentFit="cover"
                          source={
                            memberAvatar
                              ? { uri: memberAvatar }
                              : fallbackAvatar
                          }
                          style={styles.memberAvatarImg}
                        />
                      </View>
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <View style={styles.memberRoleBadge}>
                          <Text style={styles.memberRoleDot}>●</Text>
                          <Text style={styles.memberRoleText}>
                            {isOwner ? t("v2Owner") : t("v2Protected")}
                          </Text>
                        </View>
                      </View>
                      {status?.isOwner && !isOwner ? (
                        <Pressable
                          accessibilityLabel={t("v2RemoveProtected", {
                            name: member.name,
                          })}
                          accessibilityRole="button"
                          disabled={memberBusy === member.userId}
                          hitSlop={6}
                          onPress={() => removeMember(member.userId)}
                          style={styles.removeBtn}
                        >
                          {memberBusy === member.userId ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.textSecondary}
                            />
                          ) : (
                            <Ionicons
                              name="person-remove-outline"
                              size={20}
                              color="#94a3b8"
                            />
                          )}
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!status?.isAnTam ? (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.upsellCard,
                  pressed && styles.upsellCardPressed,
                ]}
                onPress={() => {
                  setMemberModal(false);
                  handleChoosePlan();
                }}
              >
                <View style={styles.upsellIconWrap}>
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="contain"
                    source={PROTECTED_UPSELL_SHIELD}
                    style={styles.upsellShieldImg}
                  />
                </View>
                <View style={styles.upsellDivider} />
                <View style={styles.upsellCopy}>
                  <Text style={styles.upsellTitle}>{t("v2FreeHint")}</Text>
                  <Text style={styles.upsellSubtitle}>
                    {t("v2FreeHintSubtitle")}
                  </Text>
                </View>
              </Pressable>
            ) : canManageProtectedMembers ? (
              <View style={styles.addProtectedSection}>
                <Text style={styles.sheetSectionTitle}>
                  {t("v2AddProtected")}
                </Text>
                {protectedSlotsFull ? (
                  <Text style={styles.sheetEmptyText}>{t("v2SlotsFull")}</Text>
                ) : (
                  <>
                    <Text style={styles.sheetBody}>
                      {t("v2ChooseProtectedBody")}
                    </Text>
                    {candidates.length === 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.emptyCandidate}
                        onPress={() => {
                          setMemberModal(false);
                          router.push("/care-circle/invite" as any);
                        }}
                      >
                        <Ionicons
                          name="person-add-outline"
                          size={23}
                          color={colors.primary}
                        />
                        <Text style={styles.emptyCandidateText}>
                          {t("v2InviteToCircle")}
                        </Text>
                      </Pressable>
                    ) : (
                      candidates.map((candidate, idx) => {
                        const candAvatar =
                          candidate.avatarUrl ||
                          connectionAvatarMap.get(candidate.userId) ||
                          null;
                        const fallbackCandAvatar = getFallbackProtectedAvatar(
                          candidate.userId,
                          idx
                        );

                        return (
                          <Pressable
                            key={candidate.userId}
                            accessibilityLabel={t("v2AddProtectedPerson", {
                              name: candidate.name,
                            })}
                            accessibilityRole="button"
                            disabled={memberBusy !== null}
                            style={styles.candidateRow}
                            onPress={() => addMember(candidate.userId)}
                          >
                            <View style={styles.memberAvatar}>
                              <Image
                                cachePolicy="memory-disk"
                                contentFit="cover"
                                source={
                                  candAvatar
                                    ? { uri: candAvatar }
                                    : fallbackCandAvatar
                                }
                                style={styles.memberAvatarImg}
                              />
                            </View>
                            <Text style={styles.candidateName}>
                              {candidate.name}
                            </Text>
                            {memberBusy === candidate.userId ? (
                              <ActivityIndicator color={colors.primary} />
                            ) : (
                              <Ionicons
                                name="add-circle-outline"
                                size={24}
                                color={colors.primary}
                              />
                            )}
                          </Pressable>
                        );
                      })
                    )}
                  </>
                )}
              </View>
            ) : null}

          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  isDark: boolean
) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 90,
      paddingHorizontal: 16,
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: 56,
      paddingBottom: 8,
      paddingTop: 6,
      marginBottom: 38,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? "#1a3046" : "#f7fcff",
    },
    headerTextCol: {
      flex: 1,
      justifyContent: "center",
      paddingLeft: 10,
      paddingRight: 12,
    },
    headerTitle: {
      color: isDark ? "#edf5ff" : "#19325e",
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    protectedHeaderButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
      flexShrink: 0,
      borderRadius: 22,
      backgroundColor: isDark ? "#1a3947" : "#eafaff",
    },
    protectedHeaderButtonPressed: { opacity: 0.58 },
    protectedHeaderButtonDisabled: { opacity: 0.62 },
    protectedHeaderLoading: {
      position: "absolute",
      right: -1,
      top: -1,
      transform: [{ scale: 0.65 }],
    },
    protectedCountBadge: {
      alignItems: "center",
      backgroundColor: isDark ? "#fb923c" : "#ea580c",
      borderRadius: 9,
      height: 18,
      justifyContent: "center",
      minWidth: 18,
      paddingHorizontal: 4,
      position: "absolute",
      right: 0,
      top: 0,
    },
    protectedCountBadgeText: {
      color: "#fffaf5",
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
    },
    currentPlanCard: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      padding: 16,
      minHeight: 94,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDark ? "#2b4761" : "#d9eaff",
      backgroundColor: isDark ? "#1b3048" : "#e5f1ff",
      shadowColor: "#6b95c6",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 14,
    },
    currentAvatarWrap: {
      alignItems: "center",
      borderRadius: 28,
      backgroundColor: isDark ? "#233d51" : "#f4fdff",
      height: 56,
      justifyContent: "center",
      overflow: "hidden",
      width: 56,
    },
    currentPlanBadgeImg: {
      height: 48,
      width: 48,
    },
    currentPlanInfo: { flex: 1, minWidth: 0 },
    currentPlanTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      minWidth: 0,
    },
    currentPlanLabel: {
      color: isDark ? "#edf5ff" : "#19325e",
      flexShrink: 1,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 20,
    },
    currentPlanBadge: {
      backgroundColor: isDark ? "#244e3d" : "#d3f4df",
      borderRadius: 12,
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    currentPlanBadgeAnTam: {
      backgroundColor: isDark ? "#184a54" : "#d2f0f0",
    },
    currentPlanBadgeText: { color: isDark ? "#a7e3b9" : "#33734b", fontSize: 12, fontWeight: "700" },
    currentPlanBadgeTextAnTam: { color: isDark ? "#a1e4e6" : "#267b85" },
    currentPlanSub: {
      color: isDark ? "#94a3b8" : "#64748b",
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 2,
    },
    comparisonRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
      marginTop: 24,
    },
    comparisonStacked: { flexDirection: "column" },
    planChoice: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      borderWidth: 1.2,
      padding: 14,
      borderRadius: 22,
      gap: 12,
    },
    planChoiceDetails: {
      flexGrow: 1,
      flexShrink: 0,
      minWidth: 0,
      minHeight: 190,
      alignItems: "center",
      paddingTop: 4,
      gap: 6,
    },
    planChoiceStacked: { flex: 0, width: "100%" },
    freeChoice: { borderColor: isDark ? "#365471" : "#ccdefb" },
    premiumChoice: { borderColor: isDark ? "#4e95a0" : "#57b6c8" },
    planArtwork: { width: "100%", height: 112, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    planChoiceImage: { width: 108, height: 96, maxWidth: "100%", flexShrink: 0 },
    premiumChoiceImage: { width: 132, height: 112 },
    planChoiceTitle: { flexShrink: 1, minWidth: 0, textAlign: "center" },
    planChoiceDescription: { color: isDark ? "#b6c9df" : "#52698c", fontSize: 14, textAlign: "center", lineHeight: 21 },
    planStatusPill: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: isDark ? "#46678d" : "#abc9f6", flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
    planStatusText: { color: isDark ? "#b1d1ff" : "#346fc2", fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
    premiumPlanStatusText: { color: isDark ? "#9cdddf" : "#287b86" },
    upgradeButton: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    upgradeButtonText: { color: "#f5fcff", fontWeight: "700", fontSize: 13, textAlign: "center" },
    planChoicePressed: { opacity: 0.65 },
    popularBadge: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryDark,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
      maxWidth: "100%",
      marginBottom: 8,
    },
    popularBadgeText: { color: colors.primaryText, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    freePlanTitle: {
      color: isDark ? "#edf5ff" : "#19325e",
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
    },
    premiumPlanTitle: {
      color: isDark ? "#8bd4dc" : "#2c7e8b",
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
    },
    planPriceWrap: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
      paddingVertical: 2,
    },
    freePrice: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    perMonthText: { color: colors.textSecondary, fontSize: 15 },
    planPeriodOptions: {
      color: "#ea580c",
      fontSize: 15,
      textAlign: "center",
      opacity: 0.9,
    },
    planIntroduction: { color: colors.textPrimary, fontSize: 16, marginBottom: 8 },
    featureList: { gap: 18, marginVertical: 14 },
    featureCopy: { flex: 1, minWidth: 0, gap: 4 },
    featureDescription: { color: colors.textPrimary, fontSize: 16 },
    comparisonFeatureRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      minHeight: 38,
    },
    featureIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginRight: 8,
    },
    featureText: {
      color: colors.textPrimary,
      fontSize: FEATURE_TITLE_FONT_SIZE,
      fontWeight: "700",
    },
    premiumFeatureText: {
      color: isDark ? "#f8fafc" : "#1e293b",
      fontSize: FEATURE_TITLE_FONT_SIZE,
      fontWeight: "700",
    },
    freeCTABox: {
      alignItems: "center",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      borderRadius: 12,
      marginTop: 6,
      minHeight: 42,
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    freeCTAText: {
      color: "#64748b",
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
    premiumCTABtn: {
      alignItems: "center",
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryDark,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 56,
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    premiumCTAText: {
      color: colors.primaryText,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    memberRow: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: 72,
      paddingVertical: 8,
    },
    memberRowPressed: {
      opacity: 0.7,
    },
    memberAvatar: {
      borderColor: isDark ? "#334155" : "#e2e8f0",
      borderRadius: 29,
      borderWidth: 1,
      height: 58,
      overflow: "hidden",
      width: 58,
    },
    memberAvatarImg: {
      height: "100%",
      width: "100%",
    },
    memberCopy: {
      flex: 1,
      justifyContent: "center",
      marginLeft: 14,
    },
    memberName: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: typography.size.md,
      fontWeight: "700",
    },
    memberRoleBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: isDark ? "rgba(13, 148, 136, 0.15)" : "#e6f7f4",
      borderRadius: 12,
      flexDirection: "row",
      gap: 5,
      marginTop: 5,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    memberRoleDot: {
      color: isDark ? "#2dd4bf" : "#0d9488",
      fontSize: 8,
    },
    memberRoleText: {
      color: isDark ? "#2dd4bf" : "#0d9488",
      fontSize: 11.5,
      fontWeight: "700",
    },
    removeBtn: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    freeHintCard: {
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b18" : "#f0fdf4",
      borderRadius: 14,
      flexDirection: "row",
      gap: 10,
      marginTop: spacing.md,
      padding: 12,
    },
    freeHintText: {
      color: isDark ? "#a7f3d0" : "#065f46",
      flex: 1,
      fontSize: typography.size.xs,
      fontWeight: "600",
      lineHeight: 18,
    },
    faqWrapper: {
      marginTop: 18,
      paddingHorizontal: 16,
      paddingVertical: 2,
      borderRadius: 20,
      backgroundColor: isDark ? "#1a2b40" : "#fbfdff",
      borderWidth: 1,
      borderColor: isDark ? "#273e58" : "#edf3fc",
      shadowColor: "#7295ba",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 12,
    },
    backdrop: {
      backgroundColor: "rgba(15,23,42,0.45)",
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    sheet: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      bottom: 0,
      left: 0,
      maxHeight: "90%",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      position: "absolute",
      right: 0,
      overflow: "hidden",
    },
    sheetCloseButton: {
      alignItems: "center",
      height: 38,
      justifyContent: "center",
      position: "absolute",
      right: 12,
      top: 12,
      width: 38,
      zIndex: 10,
    },
    sheetHeroArtWrap: {
      height: 165,
      opacity: 1,
      position: "absolute",
      right: -10,
      top: 0,
      width: 165,
      zIndex: 0,
    },
    sheetHeroArtImg: {
      height: "100%",
      width: "100%",
    },
    sheetHeaderCopy: {
      paddingRight: 64,
      position: "relative",
      zIndex: 1,
    },
    sheetHeaderTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    sheetIconCircle: {
      alignItems: "center",
      borderRadius: 22,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    sheetTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: typography.size.xl,
      fontWeight: "800",
    },
    sheetHeaderSubtitle: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: typography.size.xs,
      lineHeight: 19,
      marginTop: 8,
      maxWidth: "85%",
    },
    sheetSlotsBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
      borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "#d1fae5",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 4.5,
    },
    sheetSlotsText: {
      color: isDark ? "#34d399" : "#059669",
      fontSize: typography.size.xs,
      fontWeight: "700",
    },
    sheetScrollContent: {
      paddingBottom: 36,
      paddingTop: spacing.xs,
    },
    sheetSectionHeaderWrap: {
      marginTop: spacing.xl,
    },
    sheetSectionTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: typography.size.md,
      fontWeight: "800",
      lineHeight: 22,
    },
    sheetSectionDivider: {
      backgroundColor: isDark ? "#334155" : "#f1f5f9",
      height: 1,
      marginTop: 10,
    },
    sheetEmptyText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    modalMembersList: {
      marginTop: 2,
    },
    addProtectedSection: {
      marginTop: spacing.xl,
    },
    sheetBody: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      marginBottom: spacing.md,
      marginTop: 4,
    },
    candidateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 60,
    },
    candidateName: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: typography.size.sm,
      fontWeight: "700",
    },
    emptyCandidate: {
      alignItems: "center",
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 52,
      padding: spacing.lg,
    },
    emptyCandidateText: {
      color: colors.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: "800",
    },
    upsellCard: {
      alignItems: "center",
      backgroundColor: isDark ? "rgba(8, 184, 162, 0.12)" : "#f0fbf8",
      borderColor: isDark ? "rgba(45, 212, 191, 0.25)" : "#ccfbf1",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: spacing.md,
      padding: 14,
    },
    upsellCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.99 }],
    },
    upsellIconWrap: {
      alignItems: "center",
      height: 50,
      justifyContent: "center",
      width: 50,
    },
    upsellShieldImg: {
      height: 48,
      width: 48,
    },
    upsellDivider: {
      backgroundColor: isDark ? "rgba(45, 212, 191, 0.25)" : "#ccfbf1",
      height: 44,
      marginHorizontal: 12,
      width: 1,
    },
    upsellCopy: {
      flex: 1,
      paddingRight: 4,
    },
    upsellTitle: {
      color: isDark ? "#5eead4" : "#0f766e",
      fontSize: typography.size.xs + 1,
      fontWeight: "700",
      lineHeight: 20,
    },
    upsellSubtitle: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: typography.size.xs - 0.5,
      lineHeight: 18,
      marginTop: 4,
    },
  });
}
