import { formatMeasurementValue } from "./measurement-ruler";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AiDataConsentModal,
  hasAiDataConsent,
  revokeAiDataConsent,
} from "../../../src/components/AiDataConsentModal";
import {
  AppAlertModal,
  useAppAlert,
} from "../../../src/components/AppAlertModal";
import DeleteAccountModal from "../../../src/components/DeleteAccountModal";
import { RippleRefreshScrollView } from "../../../src/components/RippleRefresh";
import { ScaledText as Text } from "../../../src/components/ScaledText";
import { Screen } from "../../../src/components/Screen";
import { ScreenBackButton } from "../../../src/components/ScreenHeaderButton";
import { ProfileTabSkeleton } from "../../../src/components/state/MainScreenSkeletons";
import { useAppUpdateStore } from "../../../src/features/app-update/app-update.store";
import { authApi } from "../../../src/features/auth/auth.api";
import { useAuthStore } from "../../../src/features/auth/auth.store";
import { FontSizePickerModal } from "../../../src/features/profile/FontSizePickerModal";
import { LanguagePickerModal } from "../../../src/features/profile/LanguagePickerModal";
import { ProfileHealthcareBackground } from "../../../src/features/profile/ProfileHealthcareBackground";
import { ReminderSettingsEntry } from "../../../src/features/profile/ReminderSettingsEntry";
import { SpecialistSharingPermission } from "../../../src/features/profile/SpecialistSharingPermission";
import { TaskReminderPermission } from "../../../src/features/profile/TaskReminderPermission";
import { PlanDetailsModal } from "../../../src/features/subscription/components/PlanDetailsModal";
import { localizedPlanName } from "../../../src/features/subscription/planName";
import { useInitialLoadingGate } from "../../../src/hooks/useInitialLoadingGate";
import { useScaledTypography } from "../../../src/hooks/useScaledTypography";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import { apiClient, getApiErrorMessage } from "../../../src/lib/apiClient";
import { isDoctorFeaturesEnabled } from "../../../src/lib/appEnv";
import { runNativePermission } from "../../../src/lib/native-permissions";
import { useFontSizeStore } from "../../../src/stores/font-size.store";
import {
  getHealthFeedPreference,
  setHealthFeedPreference,
} from "../../../src/stores/health-feed-preference";
import { useLanguageStore } from "../../../src/stores/language.store";
import { setPendingToast, showToast } from "../../../src/stores/toast.store";
import { colors, getBottomTabBarHeight, spacing } from "../../../src/styles";
import { ProfileFieldSheet } from "./ProfileFieldSheet";
import {
  formatProfileAddress,
  type PersonalProfileField,
} from "./profile-fields";

const LOGOUT_ART = require("../../../assets/images/profile/logout_art.png");

const STORAGE_KEY_NOTIFICATIONS = "@app/notifications_enabled";
const STORAGE_KEY_REMINDERS = "@app/reminders_enabled";
const SHOW_WALLET_ENTRY = false;

const ChangePasswordModal = React.lazy(
  () => import("../../../src/components/ChangePasswordModal")
);

type SubStatus = {
  tier: "free" | "antam";
  planCode: "free" | "antam_2" | "antam_4" | "antam_8";
  planName: string;
  isAnTam: boolean;
  callCenterEnabled?: boolean;
  expiresAt: string | null;
};

type ProfileSection = "account" | "settings" | "preferences" | "system";

export default function ProfileScreen({
  personalInformation = false,
  standalone = false,
}: { personalInformation?: boolean; standalone?: boolean } = {}) {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("settings");
  const { t: tSubscription } = useTranslation("subscription");
  const checkingUpdate = useAppUpdateStore((state) => state.checking);
  const checkForUpdate = async () => {
    const result = await useAppUpdateStore.getState().check(true);
    if (result.status !== "available") {
      showToast(
        tc(
          result.status === "current"
            ? "appUpdate.current"
            : "appUpdate.unavailable"
        ),
        "info"
      );
    }
  };
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  // The tab bar is absolute; keep the artwork and scroll footer above it.
  const tabBarHeight = getBottomTabBarHeight(insets.bottom);
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(scaledTypography, isDark),
    [scaledTypography, isDark]
  );

  const logout = useAuthStore((state) => state.logout);
  const { scale: fontScale, setScale: setFontScale } = useFontSizeStore();
  const { language, setLanguage } = useLanguageStore();

  // Modals & Popups
  const [showPlanInfoModal, setShowPlanInfoModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showAiConsentModal, setShowAiConsentModal] = useState(false);
  const [healthFeedEnabled, setHealthFeedEnabled] = useState(true);
  const [aiConsentEnabled, setAiConsentEnabled] = useState(false);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [expandedSections, setExpandedSections] = useState<
    Record<ProfileSection, boolean>
  >({
    account: false,
    settings: false,
    preferences: false,
    system: false,
  });

  const renderSectionHeader = (
    section: ProfileSection,
    title: string,
    icon: React.ReactNode
  ) => (
    <TouchableOpacity
      style={styles.sectionHeaderRow}
      onPress={() =>
        setExpandedSections((previous) => ({
          ...previous,
          [section]: !previous[section],
        }))
      }
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded: expandedSections[section] }}
    >
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text
          allowFontScaling
          style={[
            styles.sectionHeading,
            expandedSections[section] && styles.sectionHeadingExpanded,
          ]}
        >
          {title}
        </Text>
      </View>
      <Ionicons
        name={expandedSections[section] ? "chevron-up" : "chevron-forward"}
        size={26}
        color={
          expandedSections[section] ? colors.primaryText : colors.textSecondary
        }
        accessible={false}
      />
    </TouchableOpacity>
  );

  const fontLabel =
    fontScale === "small"
      ? ts("fontSmall")
      : fontScale === "normal"
      ? ts("fontNormal")
      : fontScale === "large"
      ? ts("fontLarge")
      : ts("fontXLarge");
  const langLabel = language === "vi" ? ts("languageVi") : ts("languageEn");

  useEffect(() => {
    if (personalInformation) return;
    let cancelled = false;
    Promise.all([getHealthFeedPreference(), hasAiDataConsent()]).then(
      ([feedEnabled, consentEnabled]) => {
        if (cancelled) return;
        setHealthFeedEnabled(feedEnabled);
        setAiConsentEnabled(consentEnabled);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [personalInformation]);

  const saveHealthFeedPreference = useCallback(
    async (enabled: boolean) => {
      setHealthFeedEnabled(enabled);
      try {
        const savedValue = await setHealthFeedPreference(enabled);
        setHealthFeedEnabled(savedValue);
        showToast(
          ts(savedValue ? "healthFeedEnabled" : "healthFeedDisabled"),
          "success"
        );
      } catch {
        setHealthFeedEnabled(!enabled);
      }
    },
    [ts]
  );

  const handleToggleHealthFeed = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        void saveHealthFeedPreference(false);
        return;
      }

      showAlert(
        t("healthFeed"),
        ts("healthFeedToggleDesc"),
        [
          { text: tc("cancel"), style: "cancel" },
          {
            text: ts("healthFeedEnableAction"),
            onPress: () => void saveHealthFeedPreference(true),
          },
        ],
        { name: "newspaper-variant-outline", color: colors.primary }
      );
    },
    [saveHealthFeedPreference, showAlert, t, tc, ts]
  );

  const handleToggleAiConsent = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setShowAiConsentModal(true);
        return;
      }
      void revokeAiDataConsent()
        .then(() => {
          setAiConsentEnabled(false);
          showToast(ts("aiDataConsentRevoked"), "success");
        })
        .catch(() => showToast(tc("saveError"), "error"));
    },
    [ts, tc]
  );

  // Edit form state
  const [selectedField, setSelectedField] =
    useState<PersonalProfileField | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarPickerInFlightRef = useRef(false);
  useEffect(() => {
    setSelectedField(null);
  }, [profile?.id]);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const profileReadyRef = useRef(false);
  const [profileReady, setProfileReady] = useState(false);
  const showInitialSkeleton = useInitialLoadingGate(
    profileReady,
    650,
    Boolean(profile)
  );

  // Refresh the profile and plan actually displayed on this screen.
  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) return;
      lastFetchRef.current = now;
      let cancelled = false;
      if (!profileReadyRef.current) setProfileReady(false);
      if (!personalInformation)
        apiClient<SubStatus>("/api/subscriptions/status")
          .then((status) => {
            if (!cancelled) setSubStatus(status);
          })
          .catch(() => {});
      authApi
        .fetchProfile()
        .then((fullProfile) => {
          if (cancelled) return;
          if (fullProfile) {
            useAuthStore.setState({ profile: fullProfile });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (cancelled) return;
          profileReadyRef.current = true;
          setProfileReady(true);
        });
      return () => {
        cancelled = true;
        if (!profileReadyRef.current) {
          profileReadyRef.current = true;
          setProfileReady(true);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personalInformation])
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = 0;
    await Promise.all([
      authApi
        .fetchProfile()
        .then((p) => {
          if (p) useAuthStore.setState({ profile: p });
        })
        .catch(() => {}),
      !personalInformation &&
        apiClient<SubStatus>("/api/subscriptions/status")
          .then(setSubStatus)
          .catch(() => {}),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalInformation]);

  const name = profile?.name?.trim() ?? "";
  const avatarInitial =
    Array.from(name.split(/\s+/).pop() ?? "")[0]?.toLocaleUpperCase() ?? "";
  const phone = profile?.phone?.trim() ?? "";
  const hasProfile = Boolean(profile);
  const identityTitle = hasProfile
    ? name || tc("notUpdated")
    : phone
    ? t("newCustomer")
    : t("notLoggedIn");
  const handleShareApp = useCallback(async () => {
    try {
      await Share.share({ message: t("shareMessage"), title: "Asinu" });
    } catch {
      // ignore
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    setShowLogoutModal(false);
    await logout();
    // Login can already be mounted by the auth guard when logout finishes.
    showToast(t("logoutSuccess"), "success");
    router.replace("/login");
  }, [logout, t, router]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      const result = await authApi.deleteAccount();
      if (result.ok) {
        await AsyncStorage.multiRemove([
          STORAGE_KEY_NOTIFICATIONS,
          STORAGE_KEY_REMINDERS,
          "@app/font_size_scale",
        ]);
        await logout();
        setShowDeleteModal(false);
        router.replace("/login");
        setPendingToast(ts("accountDeleted"), "success");
      } else {
        throw new Error(ts("deleteError"));
      }
    } catch {
      throw new Error(ts("deleteErrorGeneric"));
    }
  }, [logout, router, ts]);

  const handlePickAvatar = async () => {
    if (avatarPickerInFlightRef.current) return;
    avatarPickerInFlightRef.current = true;
    setIsUploadingAvatar(true);

    try {
      const permission = await runNativePermission(
        () => ImagePicker.requestMediaLibraryPermissionsAsync(),
        { key: "photo-library" }
      );
      if (!permission.granted) {
        showToast(t("avatarUploadPermission"), "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        presentationStyle:
          ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const updatedProfile = await authApi.uploadAvatar(asset.uri);
      useAuthStore.setState({ profile: updatedProfile });
      showToast(t("avatarUpdated"), "success");
    } catch (error) {
      console.error("[Profile] avatar upload failed", error);
      showToast(getApiErrorMessage(error, t, "avatarUploadFailed"), "error");
    } finally {
      avatarPickerInFlightRef.current = false;
      setIsUploadingAvatar(false);
    }
  };

  const openPersonalInformation = () => router.push("/personal-information");
  const renderAvatar = () => (
    <View style={styles.avatarStage}>
      <LinearGradient
        colors={
          isDark
            ? ["#19463F", "#0DD4BC", "#237A6C"]
            : ["#D7F5EF", "#08B8A2", "#A8E5DC"]
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.avatarFrame}
      >
        <View style={styles.avatarWrap}>
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatarImg}
            />
          ) : avatarInitial ? (
            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
          ) : (
            <Ionicons name="person" size={54} color={colors.primaryText} />
          )}
          {isUploadingAvatar && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>
      </LinearGradient>
      <TouchableOpacity
        style={styles.avatarCameraButton}
        onPress={handlePickAvatar}
        disabled={isUploadingAvatar || !hasProfile}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("uploadPhoto")}
        accessibilityState={{
          disabled: isUploadingAvatar || !hasProfile,
          busy: isUploadingAvatar,
        }}
      >
        <Ionicons
          name="camera"
          size={24}
          color={isDark ? "#D9E8E5" : "#536763"}
          accessible={false}
        />
      </TouchableOpacity>
    </View>
  );
  const personalFields: {
    key: PersonalProfileField;
    label: string;
    value: string;
  }[] = [
    { key: "name", label: t("fullName"), value: name || tc("notUpdated") },
    { key: "phone", label: t("phone"), value: phone || tc("notUpdated") },
    {
      key: "gender",
      label: t("gender"),
      value:
        profile?.gender === "Nam"
          ? tc("male")
          : profile?.gender === "Nữ"
          ? tc("female")
          : profile?.gender === "Khác"
          ? t("genderOther")
          : tc("notUpdated"),
    },
    {
      key: "dateOfBirth",
      label: t("dateOfBirth"),
      value: profile?.dateOfBirth
        ? profile.dateOfBirth.slice(0, 10).split("-").reverse().join("/")
        : tc("notUpdated"),
    },
    {
      key: "address",
      label: t("address"),
      value: formatProfileAddress(profile?.address) || tc("notUpdated"),
    },
  ];
  const healthFields: typeof personalFields = [
    {
      key: "heightCm",
      label: t("height"),
      value: profile?.heightCm
        ? t("heightValue", { value: formatMeasurementValue(profile.heightCm) })
        : tc("notUpdated"),
    },
    {
      key: "weightKg",
      label: t("weight"),
      value: profile?.weightKg
        ? t("weightValue", { value: formatMeasurementValue(profile.weightKg) })
        : tc("notUpdated"),
    },
    {
      key: "bloodType",
      label: t("bloodType"),
      value: profile?.bloodType || tc("notUpdated"),
    },
    {
      key: "chronicDiseases",
      label: t("chronicDiseases"),
      value: profile?.chronicDiseases?.length
        ? profile.chronicDiseases.join(", ")
        : t("noChronicDiseases"),
    },
  ];
  const renderInformationRows = (fields: typeof personalFields) => (
    <View style={styles.personalDetailsSurface}>
      {fields.map((field, index) => (
        <TouchableOpacity
          key={field.key}
          style={[
            styles.personalDetailRow,
            index < fields.length - 1 && styles.personalDetailRowDivider,
          ]}
          onPress={
            field.key === "phone"
              ? undefined
              : () => setSelectedField(field.key)
          }
          disabled={field.key === "phone"}
          activeOpacity={0.7}
          accessibilityRole={field.key === "phone" ? "text" : "button"}
          accessibilityLabel={field.label}
          accessibilityHint={
            field.key === "phone" ? undefined : t("editProfile")
          }
        >
          <Text style={styles.personalDetailLabel}>{field.label}</Text>
          <Text style={styles.personalDetailValue}>{field.value}</Text>
          {field.key !== "phone" && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
              accessible={false}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Screen>
      <ProfileHealthcareBackground />
      {(personalInformation || standalone) && (
        <View
          style={[
            styles.personalPageHeader,
            { paddingTop: insets.top + spacing.sm },
          ]}
        >
          <ScreenBackButton
            accessibilityLabel={tc("back")}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace(
                    personalInformation ? "/account" : "/(tabs)/home"
                  )
            }
          />
          <Text accessibilityRole="header" style={styles.personalPageTitle}>
            {t(personalInformation ? "personalInfo" : "headerTitle")}
          </Text>
          <View style={styles.personalHeaderSpacer} />
        </View>
      )}
      {!personalInformation && !showInitialSkeleton && (
        <View
          testID="profile-identity"
          style={[
            styles.userCard,
            { paddingTop: standalone ? spacing.sm : insets.top + spacing.md },
          ]}
        >
          {renderAvatar()}
          <TouchableOpacity
            style={styles.userNameButton}
            onPress={openPersonalInformation}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={identityTitle}
            accessibilityHint={t("personalInfo")}
            accessibilityState={{ disabled: !hasProfile }}
            disabled={!hasProfile}
          >
            <Text allowFontScaling style={styles.userName}>
              {identityTitle}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.planCard}
            onPress={() => setShowPlanInfoModal(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${tSubscription(
              "v2CurrentPlan"
            )}: ${localizedPlanName(subStatus?.planCode, tSubscription)}`}
            accessibilityHint={tSubscription("v2ViewBenefits")}
            accessibilityState={{ disabled: !subStatus }}
            disabled={!subStatus}
          >
            <LinearGradient
              colors={isDark ? ["#153D36", "#206658"] : ["#DFF6F1", "#B9E9E0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.4 }}
              style={styles.planCardContent}
            >
              <View pointerEvents="none" style={styles.planCardArc} />
              <LinearGradient
                colors={["#FFE79D", "#E9AD2B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.planCrown}
              >
                <FontAwesome5
                  name="crown"
                  size={20}
                  color="#704409"
                  accessible={false}
                />
              </LinearGradient>
              <Text allowFontScaling style={styles.planCardText}>
                {localizedPlanName(subStatus?.planCode, tSubscription)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={23}
                color={colors.primaryText}
                accessible={false}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      <RippleRefreshScrollView
        style={styles.menuScroll}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop:
              showInitialSkeleton && !personalInformation && !standalone
                ? insets.top + spacing.md
                : 4,
            paddingBottom:
              personalInformation || standalone
                ? insets.bottom + spacing.lg
                : tabBarHeight + spacing.sm,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showInitialSkeleton ? (
          <ProfileTabSkeleton />
        ) : personalInformation ? (
          <View style={styles.personalPageContent}>
            <View style={styles.personalPageAvatar}>{renderAvatar()}</View>
            <Text
              accessibilityRole="header"
              style={styles.personalSectionTitle}
            >
              {t("personalInfo")}
            </Text>
            {renderInformationRows(personalFields)}
            <Text
              accessibilityRole="header"
              style={styles.personalSectionTitle}
            >
              {t("healthInfo")}
            </Text>
            {renderInformationRows(healthFields)}
          </View>
        ) : (
          <>
            <View style={styles.dropdownPanel}>
              <View style={styles.profileGroup} testID="profile-group-personal">
                <View style={styles.profileGroupSurface}>
                  <TouchableOpacity
                    style={[styles.sectionHeaderRow, styles.menuSection]}
                    onPress={openPersonalInformation}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t("personalInfo")}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionIcon}>
                        <Ionicons
                          name="person-outline"
                          size={26}
                          color={colors.primaryText}
                        />
                      </View>
                      <Text style={styles.sectionHeading}>
                        {t("personalInfo")}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={26}
                      color={colors.textSecondary}
                      accessible={false}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.profileGroup} testID="profile-group-benefits">
                <View style={styles.profileGroupSurface}>
                  {/* ==================== 02 MIDDLE: TÀI KHOẢN ==================== */}
                  <View style={styles.menuSection}>
                    {renderSectionHeader(
                      "account",
                      t("sectionAccount"),
                      <Ionicons
                        name="person-circle-outline"
                        size={26}
                        color={colors.primaryText}
                      />
                    )}
                    {expandedSections.account && (
                      <View style={styles.cardsStack}>
                        <TouchableOpacity
                          style={styles.actionCard}
                          onPress={() => router.push("/subscription")}
                          activeOpacity={0.7}
                        >
                          <View style={styles.rowIconWrap}>
                            <Ionicons
                              name="star-outline"
                              size={24}
                              color="#f59e0b"
                            />
                          </View>
                          <Text allowFontScaling style={styles.rowLabel}>
                            {t("subscription")}
                          </Text>
                        </TouchableOpacity>

                        {SHOW_WALLET_ENTRY && (
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push("/wallet")}
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="wallet-outline"
                                size={24}
                                color="#0d9488"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {t("wallet")}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Đổi mật khẩu (nếu tài khoản dùng mật khẩu) */}
                        {profile?.hasPassword ? (
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => setShowChangePasswordModal(true)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="key-outline"
                                size={24}
                                color="#6366f1"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {t("changePassword")}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={styles.actionCard}
                          onPress={() => setShowDeleteModal(true)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={ts("deleteAccountForever")}
                        >
                          <View style={styles.rowIconWrap}>
                            <Ionicons
                              name="trash-outline"
                              size={24}
                              color={colors.danger}
                            />
                          </View>
                          <Text
                            allowFontScaling
                            style={[styles.rowLabel, styles.deleteAccountText]}
                          >
                            {ts("deleteAccountForever")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.profileGroup} testID="profile-group-app">
                <View style={styles.profileGroupSurface}>
                  {/* ==================== 02 MIDDLE: CÀI ĐẶT ==================== */}
                  <View style={styles.menuSection}>
                    {renderSectionHeader(
                      "settings",
                      t("sectionSettings"),
                      <Ionicons
                        name="settings-outline"
                        size={26}
                        color={colors.primaryText}
                      />
                    )}
                    {expandedSections.settings && (
                      <View style={styles.cardsStack}>
                        <TouchableOpacity
                          style={styles.actionCard}
                          onPress={() => {
                            setShowFontPicker(true);
                            setShowLangPicker(false);
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={ts("fontSize")}
                        >
                          <View style={styles.rowIconWrap}>
                            <Ionicons
                              name="text-outline"
                              size={24}
                              color="#0d9488"
                            />
                          </View>
                          <Text allowFontScaling style={styles.rowLabel}>
                            {ts("fontSize")}
                          </Text>
                          <Text allowFontScaling style={styles.rowMeta}>
                            {fontLabel}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionCard}
                          onPress={() => {
                            setShowLangPicker(true);
                            setShowFontPicker(false);
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={ts("language")}
                        >
                          <View style={styles.rowIconWrap}>
                            <Ionicons
                              name="language-outline"
                              size={24}
                              color="#10b981"
                            />
                          </View>
                          <Text allowFontScaling style={styles.rowLabel}>
                            {ts("language")}
                          </Text>
                          <Text allowFontScaling style={styles.rowMeta}>
                            {langLabel}
                          </Text>
                        </TouchableOpacity>

                        <ReminderSettingsEntry />
                      </View>
                    )}
                  </View>

                  <View style={styles.menuSection}>
                    {renderSectionHeader(
                      "preferences",
                      t("sectionData"),
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={26}
                        color={colors.primaryText}
                      />
                    )}
                    {/* Keep data preferences mounted while the dropdown is collapsed. */}
                    <View
                      key={profile?.id ?? "signed-out"}
                      testID="profile-data-controls"
                      style={[
                        styles.cardsStack,
                        !expandedSections.preferences &&
                          styles.collapsedSection,
                      ]}
                      accessibilityElementsHidden={
                        !expandedSections.preferences
                      }
                      importantForAccessibility={
                        expandedSections.preferences
                          ? "auto"
                          : "no-hide-descendants"
                      }
                      pointerEvents={
                        expandedSections.preferences ? "auto" : "none"
                      }
                    >
                      {isDoctorFeaturesEnabled && (
                        <SpecialistSharingPermission />
                      )}

                      {/* Quyền dùng Asinu AI */}
                      <View style={styles.actionCard}>
                        <View style={styles.rowIconWrap}>
                          <Ionicons
                            name="sparkles-outline"
                            size={24}
                            color="#10b981"
                          />
                        </View>
                        <Text allowFontScaling style={styles.rowLabel}>
                          {ts("aiDataConsentSettings")}
                        </Text>
                        <Switch
                          accessibilityLabel={ts("aiDataConsentSettings")}
                          accessibilityState={{ checked: aiConsentEnabled }}
                          value={aiConsentEnabled}
                          onValueChange={handleToggleAiConsent}
                          trackColor={{
                            false: "#d1d5db",
                            true: colors.primary,
                          }}
                          thumbColor={colors.surface}
                          ios_backgroundColor="#d1d5db"
                        />
                      </View>

                      <TaskReminderPermission />
                      <View style={styles.actionCard}>
                        <View style={styles.rowIconWrap}>
                          <Ionicons
                            name="bookmark-outline"
                            size={24}
                            color="#8b5cf6"
                          />
                        </View>
                        <Text allowFontScaling style={styles.rowLabel}>
                          {t("healthFeed")}
                        </Text>
                        <Switch
                          accessibilityLabel={t("healthFeed")}
                          accessibilityState={{ checked: healthFeedEnabled }}
                          value={healthFeedEnabled}
                          onValueChange={handleToggleHealthFeed}
                          trackColor={{
                            false: "#d1d5db",
                            true: colors.primary,
                          }}
                          thumbColor={colors.surface}
                          ios_backgroundColor="#d1d5db"
                        />
                      </View>
                    </View>
                  </View>

                  {/* ==================== 03 BOTTOM: TRỢ GIÚP & THÔNG TIN ==================== */}
                  <View style={styles.menuSection}>
                    {renderSectionHeader(
                      "system",
                      t("sectionSystem"),
                      <Ionicons
                        name="help-circle-outline"
                        size={26}
                        color={colors.primaryText}
                      />
                    )}
                    {expandedSections.system && (
                      <>
                        <View style={styles.cardsStack}>
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => {
                              void checkForUpdate();
                            }}
                            disabled={checkingUpdate}
                            accessibilityRole="button"
                            accessibilityState={{
                              disabled: checkingUpdate,
                              busy: checkingUpdate,
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="cloud-download-outline"
                                size={24}
                                color={colors.primary}
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {tc(
                                checkingUpdate
                                  ? "appUpdate.checking"
                                  : "appUpdate.check"
                              )}
                            </Text>
                            {checkingUpdate && (
                              <ActivityIndicator color={colors.primary} />
                            )}
                          </TouchableOpacity>
                          {/* Trợ giúp qua Zalo */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() =>
                              Linking.openURL("https://zalo.me/0898888917")
                            }
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={24}
                                color="#0ea5e9"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {ts("helpSupport")}
                            </Text>
                          </TouchableOpacity>

                          {/* Chia sẻ Asinu */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={handleShareApp}
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="share-social-outline"
                                size={24}
                                color="#14b8a6"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {t("shareApp")}
                            </Text>
                          </TouchableOpacity>

                          {/* Điều khoản dịch vụ */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() =>
                              router.push({
                                pathname: "/legal/content",
                                params: { type: "terms" },
                              } as any)
                            }
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="document-text-outline"
                                size={24}
                                color="#8b5cf6"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {ts("termsOfService")}
                            </Text>
                          </TouchableOpacity>

                          {/* Chính sách bảo mật */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() =>
                              router.push({
                                pathname: "/legal/content",
                                params: { type: "privacy" },
                              } as any)
                            }
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="shield-checkmark-outline"
                                size={24}
                                color="#14b8a6"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {ts("privacyPolicy")}
                            </Text>
                          </TouchableOpacity>

                          {/* Nguồn tham khảo sức khỏe */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push("/legal/sources" as any)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="book-outline"
                                size={24}
                                color="#0284c7"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {ts("healthSources")}
                            </Text>
                          </TouchableOpacity>

                          {/* Yêu cầu xóa dữ liệu */}
                          <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() =>
                              router.push({
                                pathname: "/legal/content",
                                params: { type: "dataDeletion" },
                              } as any)
                            }
                            activeOpacity={0.7}
                          >
                            <View style={styles.rowIconWrap}>
                              <Ionicons
                                name="globe-outline"
                                size={24}
                                color="#0d9488"
                              />
                            </View>
                            <Text allowFontScaling style={styles.rowLabel}>
                              {ts("requestDataDeletion")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.profileFooter}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => setShowLogoutModal(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t("logout")}
              >
                <Ionicons
                  name="log-out-outline"
                  size={24}
                  color={colors.primaryText}
                  style={{ marginRight: 12 }}
                />
                <Text allowFontScaling style={styles.logoutButtonText}>
                  {t("logout")}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </RippleRefreshScrollView>

      {showPlanInfoModal && subStatus && (
        <PlanDetailsModal
          visible
          premium={subStatus.isAnTam}
          currentPlanCode={subStatus.planCode}
          expiresAt={subStatus.expiresAt}
          onClose={() => setShowPlanInfoModal(false)}
          onChoosePlan={() => {
            setShowPlanInfoModal(false);
            router.push("/subscription/plans");
          }}
        />
      )}

      {selectedField && profile && (
        <ProfileFieldSheet
          key={String(profile.id) + ":" + selectedField}
          field={selectedField}
          profile={profile}
          onClose={() => setSelectedField(null)}
        />
      )}

      <FontSizePickerModal
        visible={showFontPicker}
        value={fontScale}
        onSelect={(size) => {
          setFontScale(size);
          setShowFontPicker(false);
        }}
        onClose={() => setShowFontPicker(false)}
      />

      <LanguagePickerModal
        visible={showLangPicker}
        value={language}
        onSelect={(lang) => {
          setLanguage(lang);
          setShowLangPicker(false);
        }}
        onClose={() => setShowLangPicker(false)}
      />

      {showDeleteModal && (
        <DeleteAccountModal
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}

      {showChangePasswordModal && (
        <Suspense fallback={null}>
          <ChangePasswordModal
            visible={showChangePasswordModal}
            onClose={() => setShowChangePasswordModal(false)}
          />
        </Suspense>
      )}

      <AiDataConsentModal
        visible={showAiConsentModal}
        onAgree={() => {
          setAiConsentEnabled(true);
          setShowAiConsentModal(false);
          showToast(ts("aiDataConsentGranted"), "success");
        }}
        onDecline={() => {
          void revokeAiDataConsent()
            .then(() => {
              setAiConsentEnabled(false);
              setShowAiConsentModal(false);
              showToast(ts("aiDataConsentRevoked"), "success");
            })
            .catch(() => showToast(tc("saveError"), "error"));
        }}
      />

      <AppAlertModal queued {...alertState} onDismiss={dismissAlert} />

      {/* ==================== LOGOUT CONFIRM MODAL ==================== */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLogoutModal(false)}
        >
          <Pressable
            style={styles.logoutModalCard}
            onPress={(event) => event.stopPropagation()}
          >
            {/* Nút Đóng (x) góc phải */}
            <TouchableOpacity
              style={styles.logoutModalCloseBtn}
              onPress={() => setShowLogoutModal(false)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons
                name="close"
                size={20}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
            </TouchableOpacity>

            {/* Custom 3D Illustration Badge */}
            <View style={styles.logoutArtWrap}>
              <Image
                source={LOGOUT_ART}
                style={styles.logoutArtImage}
                resizeMode="contain"
              />
            </View>

            {/* Title */}
            <Text style={styles.logoutModalTitle}>
              {t("logoutConfirmTitle")}
            </Text>

            {/* Message */}
            <Text style={styles.logoutModalMessage}>
              {t("logoutConfirmMessage")}
            </Text>

            {/* Actions */}
            <View style={styles.logoutModalActions}>
              <TouchableOpacity
                style={[styles.logoutModalBtn, styles.logoutModalBtnCancel]}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutModalBtnCancelText}>
                  {tc("cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logoutModalBtn, styles.logoutModalBtnConfirm]}
                onPress={handleLogout}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#f43f5e", "#e11d48"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoutModalBtnConfirmGradient}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={19}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.logoutModalBtnConfirmText}>
                    {t("logout")}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  isDark: boolean
) {
  const cardBg = isDark ? "#1A1D27" : "#FDFFFE";
  const borderCol = isDark ? "#2D3140" : "#E0EAE4";
  const textPrimaryCol = isDark ? "#f3faf7" : "#102C27";
  const textSecondaryCol = isDark ? "#94a3b8" : "#64748b";

  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: "transparent",
    },
    menuScroll: { flex: 1 },
    personalPageHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
    },
    personalHeaderSpacer: { width: 44 },
    personalPageTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
      color: textPrimaryCol,
      textAlign: "center",
    },
    personalPageContent: { paddingHorizontal: 16 },
    personalPageAvatar: { alignItems: "center", paddingVertical: 24 },
    personalSectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: textSecondaryCol,
      textTransform: "uppercase",
      marginHorizontal: 4,
      marginTop: 8,
      marginBottom: 10,
    },
    personalDetailsSurface: {
      backgroundColor: cardBg,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 16,
    },
    personalDetailRow: {
      minHeight: 60,
      paddingHorizontal: 18,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    personalDetailRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
    },
    personalDetailLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: textPrimaryCol,
    },
    personalDetailValue: {
      maxWidth: "52%",
      flexShrink: 1,
      fontSize: 16,
      color: textSecondaryCol,
      textAlign: "right",
    },
    dropdownPanel: { marginHorizontal: 16 },
    profileFooter: { marginHorizontal: 16, paddingBottom: 16 },
    profileGroup: { marginBottom: 12 },
    profileGroupSurface: { gap: 12 },
    menuSection: {
      backgroundColor: cardBg,
      borderRadius: 20,
      overflow: "hidden",
    },
    userCard: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingBottom: 12,
      alignItems: "center",
    },
    avatarStage: {
      width: 124,
      height: 120,
      alignItems: "center",
    },
    avatarFrame: {
      width: 112,
      height: 112,
      borderRadius: 56,
      padding: 4,
    },
    avatarWrap: {
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 2,
      borderColor: isDark ? "#55CDBA" : "#BDE9DF",
      backgroundColor: isDark ? "#166B60" : "#0EA18F",
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    avatarImg: {
      width: "100%",
      height: "100%",
      borderRadius: 52,
    },
    avatarInitial: {
      fontSize: 36,
      fontWeight: "500",
      color: "#F2FFFC",
      textAlign: "center",
    },
    avatarCameraButton: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: cardBg,
      backgroundColor: isDark ? "#334A4C" : "#E8EEEC",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarLoadingOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: 52,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    userNameButton: {
      maxWidth: "100%",
      minHeight: 44,
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    userName: {
      flexShrink: 1,
      fontSize: 24,
      fontWeight: "700",
      color: textPrimaryCol,
      textAlign: "center",
    },
    planCard: {
      alignSelf: "stretch",
      marginTop: 16,
      borderRadius: 20,
      shadowColor: "#124A40",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.12 : 0.07,
      shadowRadius: 12,
      elevation: 2,
    },
    planCardContent: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 20,
      overflow: "hidden",
    },
    planCardArc: {
      position: "absolute",
      right: -20,
      top: -48,
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1,
      borderColor: isDark ? "#3E7F70" : "#D3F0E9",
    },
    planCrown: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    planCardText: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: isDark ? "#DFFFF7" : "#0C5147",
    },
    sectionHeaderLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sectionHeading: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: "600",
      color: textPrimaryCol,
    },
    sectionHeaderRow: {
      minHeight: 64,
      paddingHorizontal: 18,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionHeadingExpanded: { color: colors.primaryText },
    sectionIcon: {
      width: 32,
      height: 32,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    cardsStack: {
      marginLeft: 14,
      marginRight: 14,
      paddingBottom: 8,
      backgroundColor: "transparent",
    },
    collapsedSection: { display: "none" },
    actionCard: {
      minHeight: 56,
      paddingVertical: 13,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    rowIconWrap: {
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: textPrimaryCol,
    },
    rowMeta: {
      fontSize: 13,
      color: textSecondaryCol,
      marginRight: 6,
    },
    deleteAccountText: {
      color: colors.danger,
      fontWeight: "600",
    },
    logoutButton: {
      minHeight: 64,
      borderRadius: 20,
      backgroundColor: cardBg,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    logoutButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: textPrimaryCol,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    logoutModalCard: {
      backgroundColor: cardBg,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
      paddingTop: 28,
      paddingBottom: 22,
      paddingHorizontal: 22,
      width: "100%",
      maxWidth: 345,
      alignItems: "center",
      position: "relative",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 24,
      elevation: 10,
    },
    logoutModalCloseBtn: {
      position: "absolute",
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },
    logoutArtWrap: {
      width: 140,
      height: 96,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
      marginBottom: 8,
    },
    logoutArtImage: {
      width: "100%",
      height: "100%",
    },
    logoutModalTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: textPrimaryCol,
      letterSpacing: -0.3,
      textAlign: "center",
      marginBottom: 8,
    },
    logoutModalMessage: {
      fontSize: 14,
      color: textSecondaryCol,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: 22,
      paddingHorizontal: 4,
    },
    logoutModalActions: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    logoutModalBtn: {
      minHeight: 48,
      borderRadius: 16,
      overflow: "hidden",
    },
    logoutModalBtnCancel: {
      flex: 1,
      backgroundColor: isDark ? "#334155" : "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    logoutModalBtnCancelText: {
      fontSize: 15,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    logoutModalBtnConfirm: {
      flex: 1.25,
      shadowColor: "#e11d48",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    logoutModalBtnConfirmGradient: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    logoutModalBtnConfirmText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#ffffff",
    },
  });
}
