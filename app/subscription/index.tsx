import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
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
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { Screen } from "../../src/components/Screen";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { SubscriptionFAQ } from "../../src/components/SubscriptionFAQ";
import { IapPurchaseCard } from "../../src/features/iap/IapPurchaseCard";
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

type PlanCode = "free" | "antam_2" | "antam_4" | "antam_8";
type SubscriptionStatus = {
  ok: boolean;
  planCode: PlanCode;
  planName: string;
  tier: "free" | "antam";
  isAnTam: boolean;
  isOwner: boolean;
  ownerUserId: number;
  protectedMemberLimit: number;
  protectedMemberCount: number;
  connectionLimit: number;
  billingPeriod: "monthly" | "yearly" | null;
  expiresAt: string | null;
  consultationCredits: number;
};
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
                {status?.planName ?? t("v2FreePlan")}
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
          <Text style={styles.premiumPlanTitle}>
            {t("v2AnTamPlanName")}
          </Text>
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
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <LinearGradient
            colors={["#f97316", "#ea580c"]}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={styles.premiumCTABtn}
          >
            <Text style={styles.premiumCTAText}>{t("iapChooseTitle")}</Text>
          </LinearGradient>
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
  const scrollRef = useRef<ScrollView>(null);
  const purchaseSectionYRef = useRef(0);
  const profile = useAuthStore((state) => state.profile);
  const currentUserId = Number(profile?.id || 0);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [connections, setConnections] = useState<CareCircleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberModal, setMemberModal] = useState(false);
  const [memberBusy, setMemberBusy] = useState<number | null>(null);
  const [showPurchaseSection, setShowPurchaseSection] = useState(false);
  const isFirstRevealRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextHousehold, nextConnections] = await Promise.all([
        apiClient<SubscriptionStatus>("/api/subscriptions/status"),
        apiClient<Household>("/api/subscription-household"),
        careCircleApi.getConnections(),
      ]);
      setStatus(nextStatus);
      setHousehold(nextHousehold);
      setConnections(nextConnections);
    } catch (error) {
      showToast(getApiErrorMessage(error, t, "v2LoadError"), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

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
        setMemberModal(false);
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
    if (!showPurchaseSection) {
      isFirstRevealRef.current = true;
      setShowPurchaseSection(true);
    } else {
      scrollRef.current?.scrollTo({
        y: Math.max(0, purchaseSectionYRef.current - spacing.sm),
        animated: true,
      });
    }
  }, [showPurchaseSection]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
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

          <PlanComparison
            anTamFeatures={anTamFeatures}
            freeFeatures={freeFeatures}
            freeIsCurrent={!status?.isAnTam}
            onChoosePlan={handleChoosePlan}
            styles={styles}
            t={t}
          />

          {(showPurchaseSection || status?.isAnTam) && (
            <Animated.View
              entering={FadeInDown.duration(400).springify()}
              onLayout={(event) => {
                const layoutY = event.nativeEvent.layout.y;
                purchaseSectionYRef.current = layoutY;
                if (isFirstRevealRef.current) {
                  isFirstRevealRef.current = false;
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({
                      y: Math.max(0, layoutY - spacing.sm),
                      animated: true,
                    });
                  }, 80);
                }
              }}
            >
              <IapPurchaseCard
                currentBillingPeriod={status?.billingPeriod}
                currentPlanCode={status?.planCode}
                onPurchased={refresh}
              />

              <View style={styles.householdCard}>
                <View style={styles.householdHeader}>
                  <View style={styles.householdTitleWrap}>
                    <View style={styles.householdIconCircle}>
                      <Ionicons name="people" size={18} color="#059669" />
                    </View>
                    <View style={styles.householdTitleCopy}>
                      <Text style={styles.cardTitle}>
                        {t("v2ProtectedPeople")}
                      </Text>
                      <View style={styles.slotsPill}>
                        <Text style={styles.slotsPillText}>
                          {t("v2SlotsUsed", {
                            used: household?.protectedMemberCount ?? 0,
                            limit: household?.protectedMemberLimit ?? 1,
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {status?.isOwner && status.isAnTam && (
                    <Pressable
                      style={styles.addButton}
                      disabled={
                        (household?.protectedMemberCount ?? 0) >=
                          (household?.protectedMemberLimit ?? 1) &&
                        !(household?.members ?? []).some(
                          (member) => member.userId === household?.ownerUserId
                        )
                      }
                      onPress={() => setMemberModal(true)}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.addText}>{t("v2Add")}</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.membersList}>
                  {(household?.members ?? []).map((member, index) => {
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

                    return (
                      <View key={member.userId} style={styles.memberRow}>
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
                            <Text style={styles.memberRoleText}>
                              {member.userId === household?.ownerUserId
                                ? t("v2Owner")
                                : t("v2Protected")}
                            </Text>
                          </View>
                        </View>
                        {status?.isOwner &&
                          member.userId !== household?.ownerUserId && (
                            <Pressable
                              onPress={() => removeMember(member.userId)}
                              disabled={memberBusy === member.userId}
                              style={styles.removeBtn}
                            >
                              {memberBusy === member.userId ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.textSecondary}
                                />
                              ) : (
                                <Ionicons
                                  name="close-circle-outline"
                                  size={22}
                                  color="#94a3b8"
                                />
                              )}
                            </Pressable>
                          )}
                      </View>
                    );
                  })}
                </View>

                {!status?.isAnTam && (
                  <View style={styles.freeHintCard}>
                    <Ionicons name="leaf-outline" size={18} color="#059669" />
                    <Text style={styles.freeHintText}>{t("v2FreeHint")}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          <View style={styles.faqWrapper}>
            <SubscriptionFAQ />
          </View>

          <Text style={styles.footerNote}>{t("v2EmergencyContactHint")}</Text>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={memberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberModal(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setMemberModal(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t("v2ChooseProtected")}</Text>
          <Text style={styles.sheetBody}>{t("v2ChooseProtectedBody")}</Text>
          {candidates.length === 0 ? (
            <Pressable
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
                  style={styles.candidateRow}
                  onPress={() => addMember(candidate.userId)}
                >
                  <View style={styles.memberAvatar}>
                    <Image
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      source={
                        candAvatar ? { uri: candAvatar } : fallbackCandAvatar
                      }
                      style={styles.memberAvatarImg}
                    />
                  </View>
                  <Text style={styles.candidateName}>{candidate.name}</Text>
                  {memberBusy === candidate.userId ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="add-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })
          )}
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
    crownArtWrap: {
      height: 90,
      position: "absolute",
      right: -4,
      top: 4,
      width: 158,
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
      borderRadius: 12,
      justifyContent: "center",
      marginTop: 6,
      minHeight: 42,
      paddingHorizontal: 6,
      paddingVertical: 8,
    },
    premiumCTAText: {
      color: "#fffaf5",
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: typography.size.md,
      fontWeight: "800",
    },
    householdCard: {
      backgroundColor: isDark ? colors.surface : "#ffffff",
      borderColor: isDark ? colors.border : "#e2e8f0",
      borderRadius: radius.xxl,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    householdHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    householdTitleWrap: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 10,
    },
    householdIconCircle: {
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    householdTitleCopy: {
      flex: 1,
      gap: 4,
    },
    slotsPill: {
      alignSelf: "flex-start",
      backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    slotsPillText: {
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: 11,
      fontWeight: "700",
    },
    addButton: {
      alignItems: "center",
      backgroundColor: "#059669",
      borderRadius: radius.full,
      flexDirection: "row",
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 6,
      shadowColor: "#059669",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    },
    addText: {
      color: "#ffffff",
      fontSize: typography.size.xs,
      fontWeight: "800",
    },
    membersList: {
      gap: 0,
    },
    memberRow: {
      alignItems: "center",
      borderTopColor: isDark ? colors.border : "#f1f5f9",
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 62,
      paddingVertical: 6,
    },
    memberAvatar: {
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b" : "#d1fae5",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      overflow: "hidden",
      width: 40,
    },
    memberAvatarImg: {
      borderRadius: 20,
      height: 40,
      width: 40,
    },
    memberInitial: { color: "#047857", fontSize: 16, fontWeight: "900" },
    memberCopy: { flex: 1, gap: 3 },
    memberName: {
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: typography.size.sm,
      fontWeight: "700",
    },
    memberRoleBadge: {
      alignSelf: "flex-start",
      backgroundColor: isDark ? "#1e293b" : "#ecfdf5",
      borderColor: isDark ? "#334155" : "#a7f3d0",
      borderRadius: 6,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    memberRoleText: { color: "#047857", fontSize: 10.5, fontWeight: "700" },
    removeBtn: {
      padding: 6,
    },
    freeHintCard: {
      alignItems: "center",
      backgroundColor: isDark ? "#064e3b18" : "#f0fdf4",
      borderColor: isDark ? "#064e3b" : "#bbf7d0",
      borderRadius: 14,
      borderWidth: 1,
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
    footerNote: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      marginTop: spacing.md,
      textAlign: "center",
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
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      bottom: 0,
      left: 0,
      padding: spacing.xl,
      paddingBottom: 38,
      position: "absolute",
      right: 0,
    },
    sheetHandle: {
      alignSelf: "center",
      backgroundColor: colors.border,
      borderRadius: 3,
      height: 5,
      marginBottom: spacing.lg,
      width: 42,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontSize: typography.size.lg,
      fontWeight: "900",
    },
    sheetBody: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      marginBottom: spacing.md,
      marginTop: 4,
    },
    candidateRow: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
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
  });
}
