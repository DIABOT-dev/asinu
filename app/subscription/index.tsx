import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useFocusEffect } from "expo-router";
import React, {
  memo,
  useCallback,
  useMemo,
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
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { Screen } from "../../src/components/Screen";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { SubscriptionFAQ } from "../../src/components/SubscriptionFAQ";
import { localizedPlanName } from "../../src/features/subscription/planName";
import type { PlanCode, SubscriptionStatus } from "../../src/features/subscription/subscription.types";
import {
  careCircleApi,
  type CareCircleConnection,
} from "../../src/features/care-circle/care-circle.api";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { useScaledTypography } from "../../src/hooks/useScaledTypography";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { apiClient, getApiErrorMessage } from "../../src/lib/apiClient";
import { showToast } from "../../src/stores/toast.store";
import { colors, radius, spacing } from "../../src/styles";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

const CROWN_HERO = require("../../assets/images/subscription/crown_hero.png");
const LEAVES_LEFT = require("../../assets/images/subscription/header_leaves_left.png");
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
];

const AN_TAM_FEATURES = [
  "v2AnTamFeature1",
  "v2AnTamFeature2",
  "v2AnTamFeature3",
  "v2AnTamFeature4",
  "v2AnTamFeature5",
];

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
          isAnTam && styles.currentAvatarWrapAnTam,
        ]}
      >
        <Image
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
          ) : (
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
          )}
        </View>
        {!loading && (
          <Text style={styles.currentPlanSub}>
            {isAnTam
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
};

type PlanComparisonProps = {
  freeFeatures: FeatureItem[];
  anTamFeatures: FeatureItem[];
  freeIsCurrent: boolean;
  onChoosePlan: () => void;
  t: (key: string) => string;
  styles: ReturnType<typeof createStyles>;
};

const PlanComparison = memo(function PlanComparison({
  freeFeatures,
  anTamFeatures,
  freeIsCurrent,
  onChoosePlan,
  t,
  styles,
}: PlanComparisonProps) {
  return (
    <View style={styles.comparisonRow}>
      <View style={styles.freeCard}>
        <View style={styles.planCardHeader}>
          <View style={styles.freeAvatar}>
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              source={PLAN_FREE_IMG}
              style={styles.planBadgeImg}
            />
          </View>
          <Text style={styles.freePlanTitle}>{t("v2FreePlan")}</Text>
          <View style={styles.planPriceWrap}>
            <Text style={styles.freePrice}>{t("freePrice")}</Text>
            <Text style={styles.perMonthText}>{t("freeForever")}</Text>
          </View>
        </View>
        <View style={styles.featureList}>
          {freeFeatures.map((item) => (
            <View key={item.text} style={styles.comparisonFeatureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
              </View>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.freeCTABox}>
          <Text style={styles.freeCTAText}>
            {freeIsCurrent ? t("currentlyUsing") : t("v2FreeTitle")}
          </Text>
        </View>
      </View>

      <View style={styles.premiumCard}>
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>{t("mostPopular")}</Text>
        </View>
        <View style={styles.planCardHeader}>
          <View style={styles.premiumAvatar}>
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              source={PLAN_ANTAM_IMG}
              style={styles.planBadgeImg}
            />
          </View>
          <Text style={styles.premiumPlanTitle}>{t("v2AnTamPlanName")}</Text>
          <View style={styles.planPriceWrap}>
            <Text style={styles.planPeriodOptions}>
              {t("iapMonthly")} · {t("iapYearly")}
            </Text>
          </View>
        </View>
        <View style={styles.featureList}>
          {anTamFeatures.map((item) => (
            <View key={item.text} style={styles.comparisonFeatureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name="checkmark-circle" size={16} color="#ea580c" />
              </View>
              <Text style={styles.premiumFeatureText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onChoosePlan}
          style={({ pressed }) => [styles.premiumCTABtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.premiumCTAText}>{t("iapChooseTitle")}</Text>
        </Pressable>
      </View>
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
    () => FREE_FEATURES.map((feature) => ({ text: t(feature) })),
    [t]
  );

  const anTamFeatures = useMemo<FeatureItem[]>(
    () => AN_TAM_FEATURES.map((feature) => ({ text: t(feature) })),
    [t]
  );

  const handleChoosePlan = useCallback(() => {
    router.push("/subscription/plans");
  }, [router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(280)}>
          <View style={styles.headerRow}>
            <View pointerEvents="none" style={styles.leavesLeftWrap}>
              <Image
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={LEAVES_LEFT}
                style={styles.leavesLeftImg}
              />
            </View>
            <ScreenBackButton onPress={() => router.back()} />
            <View style={styles.headerTextCol}>
              <Text numberOfLines={2} style={styles.headerTitle}>
                {t("features.premiumTitle")}
              </Text>
              <Text numberOfLines={2} style={styles.headerSubtitle}>
                {t("v2HeroTitle")}
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
                color={isDark ? "#6ee7b7" : "#047857"}
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
            <View pointerEvents="none" style={styles.crownArtWrap}>
              <Image
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={CROWN_HERO}
                style={styles.crownHeroImg}
              />
            </View>
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

          <PlanComparison
            anTamFeatures={anTamFeatures}
            freeFeatures={freeFeatures}
            freeIsCurrent={!status?.isAnTam}
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
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                      )}
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
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
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
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: 112,
      paddingBottom: 8,
      paddingTop: 6,
      position: "relative",
    },
    leavesLeftWrap: {
      height: 85,
      left: -14,
      position: "absolute",
      top: -8,
      width: 140,
      zIndex: 0,
    },
    leavesLeftImg: { height: "100%", width: "100%" },
    headerTextCol: {
      flex: 1,
      justifyContent: "center",
      paddingLeft: 10,
      paddingRight: 142,
      zIndex: 1,
    },
    headerTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    headerSubtitle: {
      color: isDark ? "#94a3b8" : "#047857",
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 17,
      marginTop: 2,
    },
    protectedHeaderButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      position: "absolute",
      right: 0,
      top: 0,
      width: 44,
      zIndex: 4,
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
    crownArtWrap: {
      height: 78,
      position: "absolute",
      right: 5,
      top: 28,
      width: 132,
      zIndex: 1,
    },
    crownHeroImg: { height: "100%", width: "100%" },
    currentPlanCard: {
      alignItems: "center",
      backgroundColor: isDark ? colors.surface : "#fffdfa",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
      padding: 14,
    },
    currentAvatarWrap: {
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      borderColor: isDark ? "#047857" : "#a7f3d0",
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      overflow: "hidden",
      width: 44,
    },
    currentAvatarWrapAnTam: {
      backgroundColor: isDark ? "#451a03" : "#fffbeb",
      borderColor: isDark ? "#b45309" : "#fde68a",
    },
    currentPlanBadgeImg: {
      height: 36,
      width: 36,
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
      color: isDark ? "#f8fafc" : "#0f172a",
      flexShrink: 1,
      fontSize: 14.5,
      fontWeight: "700",
      lineHeight: 20,
    },
    currentPlanBadge: {
      backgroundColor: isDark ? "#1e293b" : "#ecfdf5",
      borderRadius: 12,
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    currentPlanBadgeAnTam: {
      backgroundColor: isDark ? "#451a03" : "#fff7ed",
    },
    currentPlanBadgeText: { color: "#059669", fontSize: 11, fontWeight: "700" },
    currentPlanBadgeTextAnTam: { color: "#ea580c" },
    currentPlanSub: {
      color: isDark ? "#94a3b8" : "#64748b",
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    comparisonRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 12,
      marginTop: 14,
    },
    freeCard: {
      backgroundColor: isDark ? colors.surface : "#fffdfa",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: 20,
      borderWidth: 1,
      flex: 1,
      justifyContent: "space-between",
      padding: 12,
    },
    premiumCard: {
      backgroundColor: isDark ? "#1c1917" : "#fffbf5",
      borderColor: "#f59e0b",
      borderRadius: 20,
      borderWidth: 1.5,
      flex: 1,
      justifyContent: "space-between",
      padding: 12,
      position: "relative",
    },
    popularBadge: {
      backgroundColor: "#ea580c",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      position: "absolute",
      right: 12,
      top: -10,
      zIndex: 2,
    },
    popularBadgeText: { color: "#fffaf5", fontSize: 10, fontWeight: "700" },
    planCardHeader: {
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: 136,
      paddingBottom: 4,
      paddingTop: 4,
    },
    freeAvatar: {
      alignItems: "center",
      height: 60,
      justifyContent: "center",
      marginBottom: 6,
      width: 60,
    },
    premiumAvatar: {
      alignItems: "center",
      height: 60,
      justifyContent: "center",
      marginBottom: 6,
      width: 60,
    },
    planBadgeImg: {
      height: 58,
      width: 58,
    },
    freePlanTitle: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: 14.5,
      fontWeight: "700",
      textAlign: "center",
    },
    premiumPlanTitle: {
      color: "#ea580c",
      fontSize: 14.5,
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
    perMonthText: { color: "#94a3b8", fontSize: 11, marginTop: -2 },
    planPeriodOptions: {
      color: "#ea580c",
      fontSize: 11,
      textAlign: "center",
      opacity: 0.9,
    },
    featureList: { gap: 10, marginVertical: 10 },
    comparisonFeatureRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      minHeight: 38,
    },
    featureIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginRight: 6,
      marginTop: 1,
      width: 18,
    },
    featureText: {
      color: isDark ? "#cbd5e1" : "#475569",
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
    },
    premiumFeatureText: {
      color: isDark ? "#f8fafc" : "#1e293b",
      flex: 1,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
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
      minHeight: 42,
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    premiumCTAText: {
      color: colors.primaryText,
      fontSize: 12,
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
    faqWrapper: { marginTop: 16 },
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
      backgroundColor: isDark ? "rgba(59, 130, 246, 0.16)" : "#eff6ff",
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
