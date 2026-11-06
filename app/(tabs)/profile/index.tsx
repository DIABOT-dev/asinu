import { runNativePermission } from '../../../src/lib/native-permissions';
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AppAlertModal,
  useAppAlert,
} from "../../../src/components/AppAlertModal";
import {
  AiDataConsentModal,
  hasAiDataConsent,
  revokeAiDataConsent,
} from "../../../src/components/AiDataConsentModal";
import { ScaledTextInput as TextInput } from "../../../src/components/ScaledTextInput";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { LinearGradient } from "expo-linear-gradient";
import { useAppUpdateStore } from "../../../src/features/app-update/app-update.store";
import { ProfileMascotGreeting } from "../../../src/features/profile/ProfileMascotGreeting";
import { ProfileHealthcareBackground } from "../../../src/features/profile/ProfileHealthcareBackground";
import { useProfileCoins } from "../../../src/features/v21/useProfileCoins";
import { HealthCoinIcon } from "../../../src/features/v21/HealthCoinIcon";
import DeleteAccountModal from "../../../src/components/DeleteAccountModal";
import { FontSizePickerModal } from "../../../src/features/profile/FontSizePickerModal";
import { LanguagePickerModal } from "../../../src/features/profile/LanguagePickerModal";
import { ProfileDevicePermissions } from "../../../src/features/profile/ProfileDevicePermissions";
import { TaskReminderPermission } from "../../../src/features/profile/TaskReminderPermission";
import { SpecialistSharingPermission } from "../../../src/features/profile/SpecialistSharingPermission";
import { ReminderSettingsEntry } from "../../../src/features/profile/ReminderSettingsEntry";

const LOGOUT_ART = require("../../../assets/images/profile/logout_art.png");
const CHECKIN_ACCESS_ART = require("../../../assets/images/subscription/checkin_access_shield.png");

const STORAGE_KEY_NOTIFICATIONS = "@app/notifications_enabled";
const STORAGE_KEY_REMINDERS = "@app/reminders_enabled";
const SHOW_CARE_BANNER = false;

const ChangePasswordModal = React.lazy(
  () => import("../../../src/components/ChangePasswordModal"),
);
import { RippleRefreshScrollView } from "../../../src/components/RippleRefresh";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../../src/components/ScaledText";
import { Screen } from "../../../src/components/Screen";
import { ProfileTabSkeleton } from "../../../src/components/state/MainScreenSkeletons";
import { ModalToastHost } from "../../../src/components/GlobalToastHost";
import { authApi, type UpdateProfilePayload } from "../../../src/features/auth/auth.api";
import { showToast, setPendingToast } from "../../../src/stores/toast.store";
import { useAuthStore, type Profile } from "../../../src/features/auth/auth.store";
import { localizedPlanName } from "../../../src/features/subscription/planName";
import {
  useFontSizeStore,
} from "../../../src/stores/font-size.store";
import {
  useLanguageStore,
} from "../../../src/stores/language.store";
import { useScaledTypography } from "../../../src/hooks/useScaledTypography";
import { useInitialLoadingGate } from "../../../src/hooks/useInitialLoadingGate";
import { ApiError, apiClient, getApiErrorMessage } from "../../../src/lib/apiClient";
import { isDevBuild, isCheckinUiGalleryEnabled, isDoctorFeaturesEnabled } from "../../../src/lib/appEnv";
import {
  brandColors,
  getBottomTabBarHeight,
  categoryColors,
  colors,
  iconColors,
  lightColors,
  radius,
  spacing,
} from "../../../src/styles";
import { useThemeColors } from "../../../src/hooks/useThemeColors";
import {
  getHealthFeedPreference,
  setHealthFeedPreference,
} from "../../../src/stores/health-feed-preference";

type SubStatus = {
  tier: "free" | "antam";
  planCode: "free" | "antam_2" | "antam_4" | "antam_8";
  planName: string;
  isAnTam: boolean;
  callCenterEnabled?: boolean;
  expiresAt: string | null;
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CHRONIC_DISEASE_OPTIONS = [
  { value: "Tiểu đường", labelKey: "diseaseDiabetes" },
  { value: "Cao huyết áp", labelKey: "diseaseHypertension" },
  { value: "Tim mạch", labelKey: "diseaseHeart" },
  { value: "Mỡ máu", labelKey: "diseaseCholesterol" },
  { value: "Gút (Gout)", labelKey: "diseaseGout" },
  { value: "Hen suyễn", labelKey: "diseaseAsthma" },
  { value: "Dạ dày", labelKey: "diseaseStomach" },
  { value: "Gan nhiễm mỡ", labelKey: "diseaseFattyLiver" },
];

type ProfileEditValues = {
  name: string;
  phone: string;
  age: string;
  gender: "Nam" | "Nữ" | "";
  height: string;
  weight: string;
  bloodType: string;
  chronicDiseases: string;
};

type ProfileSection =
  | "personal"
  | "rewards"
  | "health"
  | "account"
  | "settings"
  | "permissions"
  | "system";

function getProfileEditValues(profile: Profile | null): ProfileEditValues {
  return {
    name: profile?.name?.trim() || "",
    phone: profile?.phone?.trim() || "",
    age: profile?.age ? String(Math.round(profile.age)) : "",
    gender: (profile?.gender as ProfileEditValues["gender"]) || "",
    height: profile?.heightCm ? String(Math.round(profile.heightCm)) : "",
    weight: profile?.weightKg ? String(Math.round(profile.weightKg)) : "",
    bloodType: profile?.bloodType || "",
    chronicDiseases: profile?.chronicDiseases?.join(", ") || "",
  };
}

function normalizeBloodType(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/\u2212/g, "-")
    .toUpperCase();
}

function getProfileEditSnapshot(values: ProfileEditValues) {
  const normalizeNumber = (value: string) => {
    const trimmed = value.trim();
    return trimmed && Number.isFinite(Number(trimmed))
      ? String(Number(trimmed))
      : trimmed;
  };

  return JSON.stringify({
    name: values.name.trim(),
    phone: values.phone.trim(),
    age: normalizeNumber(values.age),
    gender: values.gender,
    height: normalizeNumber(values.height),
    weight: normalizeNumber(values.weight),
    bloodType: normalizeBloodType(values.bloodType),
    chronicDiseases: [
      ...new Set(
        values.chronicDiseases
          .split(",")
          .map((disease) => disease.trim())
          .filter(Boolean),
      ),
    ].sort(),
  });
}

export default function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("settings");
  const { t: tSubscription } = useTranslation("subscription");
  const checkingUpdate = useAppUpdateStore((state) => state.checking);
  const checkForUpdate = async () => {
    const result = await useAppUpdateStore.getState().check(true);
    if (result.status !== 'available') {
      showToast(tc(result.status === 'current' ? 'appUpdate.current' : 'appUpdate.unavailable'), 'info');
    }
  };
  const profile = useAuthStore((state) => state.profile);
  const coinSummary = useProfileCoins();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  // The tab bar is absolute; keep the artwork and scroll footer above it.
  const tabBarHeight = getBottomTabBarHeight(insets.bottom);
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(scaledTypography, isDark),
    [scaledTypography, isDark],
  );

  const logout = useAuthStore((state) => state.logout);
  const { scale: fontScale, setScale: setFontScale } = useFontSizeStore();
  const { language, setLanguage } = useLanguageStore();

  // Modals & Popups
  const [isEditModalVisible, setEditModalVisible] = useState(false);
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
    personal: false,
    rewards: false,
    health: false,
    account: false,
    settings: false,
    permissions: false,
    system: false,
  });

  const renderSectionHeader = (
    section: ProfileSection,
    title: string,
    icon: React.ReactNode,
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
        {icon}
        <Text style={styles.sectionHeading}>{title}</Text>
      </View>
      <Ionicons
        name={expandedSections[section] ? "chevron-up" : "chevron-down"}
        size={20}
        color={isDark ? "#a7f3d0" : "#059669"}
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
    let cancelled = false;
    Promise.all([getHealthFeedPreference(), hasAiDataConsent()]).then(
      ([feedEnabled, consentEnabled]) => {
        if (cancelled) return;
        setHealthFeedEnabled(feedEnabled);
        setAiConsentEnabled(consentEnabled);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const saveHealthFeedPreference = useCallback(
    async (enabled: boolean) => {
      setHealthFeedEnabled(enabled);
      try {
        const savedValue = await setHealthFeedPreference(enabled);
        setHealthFeedEnabled(savedValue);
        showToast(
          ts(savedValue ? "healthFeedEnabled" : "healthFeedDisabled"),
          "success",
        );
      } catch {
        setHealthFeedEnabled(!enabled);
      }
    },
    [ts],
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
        { name: "newspaper-variant-outline", color: colors.primary },
      );
    },
    [saveHealthFeedPreference, showAlert, t, tc, ts],
  );

  const handleToggleAiConsent = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setShowAiConsentModal(true);
        return;
      }
      void revokeAiDataConsent().then(() => {
        setAiConsentEnabled(false);
        showToast(ts("aiDataConsentRevoked"), "success");
      }).catch(() => showToast(tc("saveError"), "error"));
    },
    [ts, tc],
  );

  // Edit form state
  const profileEditValues = getProfileEditValues(profile);
  const [editName, setEditName] = useState(profileEditValues.name);
  const [editPhone, setEditPhone] = useState(profileEditValues.phone);
  const [editAge, setEditAge] = useState(profileEditValues.age);
  const [editGender, setEditGender] = useState<ProfileEditValues["gender"]>(
    profileEditValues.gender,
  );
  const [editHeight, setEditHeight] = useState(profileEditValues.height);
  const [editWeight, setEditWeight] = useState(profileEditValues.weight);
  const [editBloodType, setEditBloodType] = useState(profileEditValues.bloodType);
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);
  const [editChronicDiseases, setEditChronicDiseases] = useState(
    profileEditValues.chronicDiseases,
  );
  const savedProfileEditSnapshotRef = useRef(
    getProfileEditSnapshot(profileEditValues),
  );
  const editSnapshot = getProfileEditSnapshot({
    name: editName,
    phone: editPhone,
    age: editAge,
    gender: editGender,
    height: editHeight,
    weight: editWeight,
    bloodType: editBloodType,
    chronicDiseases: editChronicDiseases,
  });
  const hasProfileChanges = editSnapshot !== savedProfileEditSnapshotRef.current;
  const [showDiseasePicker, setShowDiseasePicker] = useState(false);
  const [customDiseaseInput, setCustomDiseaseInput] = useState("");
  const [customDiseaseOptions, setCustomDiseaseOptions] = useState<string[]>([]);

  useEffect(() => {
    if (isEditModalVisible) return;
    const values = getProfileEditValues(profile);
    setEditName(values.name);
    setEditPhone(values.phone);
    setEditAge(values.age);
    setEditGender(values.gender);
    setEditHeight(values.height);
    setEditWeight(values.weight);
    setEditBloodType(values.bloodType);
    setEditChronicDiseases(values.chronicDiseases);
    savedProfileEditSnapshotRef.current = getProfileEditSnapshot(values);
  }, [profile, isEditModalVisible]);

  const diseaseList = useMemo(() => {
    return editChronicDiseases
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [editChronicDiseases]);
  const diseaseOptions = [
    ...CHRONIC_DISEASE_OPTIONS,
    ...[...new Set([...customDiseaseOptions, ...diseaseList])]
      .filter((disease) =>
        !CHRONIC_DISEASE_OPTIONS.some((option) => option.value === disease),
      )
      .map((value) => ({ value, labelKey: "" })),
  ];
  const selectedBloodType = normalizeBloodType(editBloodType);
  const bloodTypeLabel = BLOOD_TYPES.includes(selectedBloodType)
    ? selectedBloodType
    : selectedBloodType ? tc("select") : t("bloodTypeUnknown");

  const toggleDisease = (disease: string) => {
    let list = [...diseaseList];
    if (list.includes(disease)) {
      list = list.filter((d) => d !== disease);
    } else {
      list.push(disease);
    }
    setEditChronicDiseases(list.join(", "));
  };

  const addCustomDisease = () => {
    const additions = customDiseaseInput
      .split(",")
      .map((disease) => disease.trim())
      .filter(Boolean);
    if (!additions.length) return;
    setEditChronicDiseases([...new Set([...diseaseList, ...additions])].join(", "));
    setCustomDiseaseOptions((options) => [...new Set([...options, ...additions])]);
    setCustomDiseaseInput("");
  };

  const [phoneError, setPhoneError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const isSaveDisabled = isSaving || isUploadingAvatar || !hasProfileChanges;
  const avatarPickerInFlightRef = useRef(false);
  const profileSaveInFlightRef = useRef(false);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const profileReadyRef = useRef(false);
  const [profileReady, setProfileReady] = useState(false);
  const showInitialSkeleton = useInitialLoadingGate(
    profileReady,
    650,
    Boolean(profile),
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
    }, []),
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
      apiClient<SubStatus>("/api/subscriptions/status")
        .then(setSubStatus)
        .catch(() => {}),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = profile?.name?.trim() ?? "";
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

  const handleEditProfile = () => {
    const values = getProfileEditValues(profile);
    setPhoneError("");
    setShowBloodTypePicker(false);
    setShowDiseasePicker(false);
    setCustomDiseaseInput("");
    setCustomDiseaseOptions(profile?.chronicDiseases || []);
    setEditName(values.name);
    setEditPhone(values.phone);
    setEditAge(values.age);
    setEditGender(values.gender);
    setEditHeight(values.height);
    setEditWeight(values.weight);
    setEditBloodType(values.bloodType);
    setEditChronicDiseases(values.chronicDiseases);
    savedProfileEditSnapshotRef.current = getProfileEditSnapshot(values);
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setShowBloodTypePicker(false);
    setShowDiseasePicker(false);
    setCustomDiseaseInput("");
    setCustomDiseaseOptions([]);
    setEditModalVisible(false);
  };

  const handlePickAvatar = async () => {
    if (avatarPickerInFlightRef.current) return;
    avatarPickerInFlightRef.current = true;
    setIsUploadingAvatar(true);

    try {
      const permission =
        await runNativePermission(() => ImagePicker.requestMediaLibraryPermissionsAsync(), { key: 'photo-library' });
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
      showToast(
        getApiErrorMessage(error, t, "avatarUploadFailed"),
        "error",
      );
    } finally {
      avatarPickerInFlightRef.current = false;
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (
      profileSaveInFlightRef.current ||
      avatarPickerInFlightRef.current ||
      editSnapshot === savedProfileEditSnapshotRef.current
    ) {
      return;
    }
    if (!editName.trim()) {
      showToast(t("nameRequired"), "error");
      return;
    }

    if (
      editHeight &&
      (isNaN(parseFloat(editHeight)) || parseFloat(editHeight) <= 0)
    ) {
      showToast(t("heightPositive"), "error");
      return;
    }

    if (
      editWeight &&
      (isNaN(parseFloat(editWeight)) || parseFloat(editWeight) <= 0)
    ) {
      showToast(t("weightPositive"), "error");
      return;
    }

    if (
      editAge &&
      (isNaN(Number(editAge)) || Number(editAge) <= 0 || Number(editAge) > 150)
    ) {
      showToast(t("ageValid"), "error");
      return;
    }

    const normalizedBloodType = normalizeBloodType(editBloodType);
    if (normalizedBloodType && !BLOOD_TYPES.includes(normalizedBloodType)) {
      showToast(t("bloodTypeInvalid"), "error", 5000);
      setShowBloodTypePicker(true);
      return;
    }

    profileSaveInFlightRef.current = true;
    setIsSaving(true);
    try {
      let dateOfBirth = null;
      if (editAge && !isNaN(Number(editAge))) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - Number(editAge);
        dateOfBirth = `${birthYear}-01-01`;
      }

      const updateData: UpdateProfilePayload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        bloodType: normalizedBloodType || null,
      };

      if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
      if (editGender) updateData.gender = editGender;
      if (editHeight) updateData.heightCm = parseFloat(editHeight);
      if (editWeight) updateData.weightKg = parseFloat(editWeight);
      updateData.chronicDiseases = editChronicDiseases.trim()
        ? editChronicDiseases
            .split(",")
            .map((d: string) => d.trim())
            .filter((d: string) => d.length > 0)
        : [];

      const updatedProfile = await authApi.updateProfile(updateData);
      useAuthStore.setState({ profile: updatedProfile });
      savedProfileEditSnapshotRef.current = editSnapshot;

      handleCloseEditModal();
      showToast(t("profileUpdated"), "success");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setPhoneError(t("phoneAlreadyUsed"));
      } else {
        showToast(
          getApiErrorMessage(error, t, "profileUpdateError"),
          "error",
        );
      }
    } finally {
      profileSaveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const planBenefits = useMemo(() => {
    if (subStatus?.isAnTam) {
      return [
        { icon: "check-circle", text: t("antamBenefitCall") },
        { icon: "check-circle", text: t("antamBenefitSignal") },
        { icon: "check-circle", text: t("antamBenefitFamily") },
      ];
    }
    return [
      { icon: "check", text: t("freeBenefitHistory") },
      { icon: "check", text: t("freeBenefitVoice") },
      { icon: "check", text: t("freeBenefitSignal") },
    ];
  }, [subStatus?.isAnTam, t]);

  const hasCheckinCallAccess =
    subStatus?.callCenterEnabled ?? subStatus?.isAnTam ?? false;

  const handleCheckinCallPress = useCallback(() => {
    if (hasCheckinCallAccess) {
      router.push("/checkin-call/settings" as any);
      return;
    }
    showAlert(
      t("premiumFeatureLockedTitle"),
      t("checkinCallLockedDesc"),
      [
        { text: tc("later"), style: "cancel" },
        {
          text: t("chooseAnTam"),
          variant: "primary",
          onPress: () => router.push("/subscription"),
        },
      ],
      { name: "lock-outline", color: colors.premiumDark },
      {
        appearance: "access",
        heroImage: CHECKIN_ACCESS_ART,
        primaryButtonBackground: (
          <LinearGradient
            pointerEvents="none"
            colors={["#00847d", lightColors.primaryText]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ),
      },
    );
  }, [hasCheckinCallAccess, router, showAlert, t, tc]);

  return (
    <Screen>
      <ProfileHealthcareBackground />
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: tabBarHeight + spacing.sm,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showInitialSkeleton ? (
          <ProfileTabSkeleton />
        ) : (
          <>
            {/* ==================== USER PROFILE CARD ==================== */}
            <Animated.View entering={FadeIn.duration(350)}>
              <View style={styles.userCard}>
                {/* Avatar */}
                <View style={styles.avatarWrap}>
                  {profile?.avatarUrl ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Ionicons name="person" size={32} color="#059669" />
                  )}
                  {isUploadingAvatar && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  )}
                </View>

                {/* Name & plan badge */}
                <View style={styles.userInfoCol}>
                  <Text
                    style={styles.userName}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {identityTitle}
                  </Text>
                  {/* Plan Badge Pill */}
                  <TouchableOpacity
                    style={styles.planBadge}
                    onPress={() => setShowPlanInfoModal(true)}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5
                      name="crown"
                      size={11}
                      color="#d97706"
                      style={{ marginRight: 5 }}
                    />
                    <Text style={styles.planBadgeText}>
                      {t("accountPlan", {
                        plan: localizedPlanName(subStatus?.planCode, tSubscription),
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
                {coinSummary.enabled && coinSummary.balance !== null && (
                  <View style={styles.coinSummary}>
                    <HealthCoinIcon />
                    <View style={styles.coinCopy}>
                      <Text style={styles.coinBalance}>{t('healthCoinsBalance', { count: coinSummary.balance })}</Text>
                      {coinSummary.earnedToday !== null && <Text style={styles.coinLabel}>{t('healthCoinsToday', { count: coinSummary.earnedToday })}</Text>}
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* ==================== THÔNG TIN CÁ NHÂN SECTION ==================== */}
            <Animated.View entering={FadeIn.delay(120).duration(350)}>
              <View style={[styles.sectionHeaderRow, styles.personalInfoHeader]}>
                <TouchableOpacity
                  style={styles.personalInfoToggle}
                  onPress={() =>
                    setExpandedSections((previous) => ({
                      ...previous,
                      personal: !previous.personal,
                    }))
                  }
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t("personalInfo")}
                  accessibilityState={{ expanded: expandedSections.personal }}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="person" size={18} color="#059669" />
                    <Text style={styles.sectionHeading}>{t("personalInfo")}</Text>
                  </View>
                  <Ionicons
                    name={expandedSections.personal ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={isDark ? "#a7f3d0" : "#059669"}
                    accessible={false}
                  />
                </TouchableOpacity>
                {expandedSections.personal && (
                  <TouchableOpacity
                    style={styles.personalInfoEditButton}
                    onPress={handleEditProfile}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t("editProfile")}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={isDark ? "#99f6e4" : "#0b5e56"}
                    />
                    <Text style={styles.personalInfoEditText}>{t("edit")}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {expandedSections.personal && (
                <>
                  {/* Profile details sit directly on the page background. */}
                  <View style={styles.infoGrid}>
                    {/* 1. Số điện thoại */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <Ionicons name="call" size={20} color="#059669" />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("phone")}</Text>
                        <Text style={styles.gridCardValue}>
                          {phone || tc("notUpdated")}
                        </Text>
                      </View>
                    </View>

                    {/* 2. Giới tính */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <Ionicons
                          name={profile?.gender === "Nữ" ? "female" : "male"}
                          size={20}
                          color="#2563eb"
                        />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("gender")}</Text>
                        <Text style={styles.gridCardValue}>
                          {profile?.gender
                            ? profile.gender === "Nam"
                              ? tc("male")
                              : tc("female")
                            : tc("notUpdated")}
                        </Text>
                      </View>
                    </View>

                    {/* 3. Tuổi */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#ea580c"
                        />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("age")}</Text>
                        <Text style={styles.gridCardValue}>
                          {profile?.age
                            ? `${Math.round(profile.age)} ${t("ageUnit")}`
                            : tc("notUpdated")}
                        </Text>
                      </View>
                    </View>

                    {/* 4. Chiều cao */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <MaterialCommunityIcons
                          name="human-male-height"
                          size={20}
                          color="#9333ea"
                        />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("height")}</Text>
                        <Text style={styles.gridCardValue}>
                          {profile?.heightCm
                            ? t("heightValue", {
                                value: Math.round(profile.heightCm),
                              })
                            : tc("notUpdated")}
                        </Text>
                      </View>
                    </View>

                    {/* 5. Cân nặng */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <MaterialCommunityIcons
                          name="scale-bathroom"
                          size={20}
                          color="#0d9488"
                        />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("weight")}</Text>
                        <Text style={styles.gridCardValue}>
                          {profile?.weightKg
                            ? t("weightValue", {
                                value: Math.round(profile.weightKg),
                              })
                            : tc("notUpdated")}
                        </Text>
                      </View>
                    </View>

                    {/* 6. Nhóm máu */}
                    <View style={styles.gridCard}>
                      <View style={styles.gridIconWrap}>
                        <Ionicons name="water" size={20} color="#e11d48" />
                      </View>
                      <View style={styles.gridCardContent}>
                        <Text style={styles.gridCardLabel}>{t("bloodType")}</Text>
                        <Text style={styles.gridCardValue}>
                          {profile?.bloodType || tc("notUpdated")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Full-width health information. */}
                  <View style={styles.chronicDiseaseCard}>
                    <View style={styles.gridIconWrap}>
                      <MaterialCommunityIcons
                        name="plus-box"
                        size={22}
                        color="#e11d48"
                      />
                    </View>
                    <View style={styles.gridCardContent}>
                      <Text style={styles.gridCardLabel}>
                        {t("chronicDiseases")}
                      </Text>
                      <Text style={styles.gridCardValue}>
                        {profile?.chronicDiseases &&
                        profile.chronicDiseases.length > 0
                          ? profile.chronicDiseases.join(", ")
                          : t("noChronicDiseases")}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Animated.View>

            {/* ==================== BANNER CHĂM SÓC SỨC KHỎE ==================== */}
            {SHOW_CARE_BANNER && (
              <Animated.View entering={FadeIn.delay(180).duration(350)}>
                <TouchableOpacity
                  style={styles.careBanner}
                  onPress={() => router.push("/subscription")}
                  activeOpacity={0.88}
                >
                  <Image
                    source={require("../../../assets/images/profile/care_banner_art.png")}
                    style={styles.careBannerArt}
                  />
                  <View style={styles.careBannerTextGroup}>
                    <Text style={styles.careBannerTitle} numberOfLines={1}>
                      {t("careBannerTitle")}
                    </Text>
                    <Text style={styles.careBannerSubtitle} numberOfLines={1}>
                      {t("careBannerSubtitle")}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ==================== 02 MIDDLE: SỨC KHỎE ==================== */}
            <Animated.View entering={FadeIn.delay(220).duration(350)}>
              {renderSectionHeader(
                "health",
                t("sectionHealth"),
                <Ionicons name="heart" size={18} color="#10b981" />,
              )}
              {expandedSections.health && (
                <View style={styles.cardsStack}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/logs")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name="journal-outline"
                        size={22}
                        color="#f43f5e"
                      />
                    </View>
                    <Text style={styles.rowLabel}>{t("logEntry")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionCard,
                      !hasCheckinCallAccess && styles.actionCardLocked,
                    ]}
                    onPress={handleCheckinCallPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasCheckinCallAccess
                        ? t("checkinCall")
                        : `${t("checkinCall")}. ${t("requiresAnTam")}`
                    }
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name={hasCheckinCallAccess ? "call-outline" : "lock-closed-outline"}
                        size={22}
                        color={hasCheckinCallAccess ? "#07846d" : "#94a3b8"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.rowLabel,
                        !hasCheckinCallAccess && styles.rowLabelLocked,
                      ]}
                    >
                      {t("checkinCall")}
                    </Text>
                    {!hasCheckinCallAccess && (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>{t("requiresAnTam")}</Text>
                      </View>
                    )}
                    {!hasCheckinCallAccess && (
                      <Ionicons name="lock-closed" size={16} color="#94a3b8" />
                    )}
                  </TouchableOpacity>

                  {__DEV__ && isDevBuild && isCheckinUiGalleryEnabled && (
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => router.push("/checkin-call/ui-gallery" as any)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t("checkinCallGalleryAccessibility")}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons name="eye-outline" size={22} color="#07846d" />
                      </View>
                      <Text style={styles.rowLabel}>{t("checkinCallGallery")}</Text>
                    </TouchableOpacity>
                  )}
                  {isDoctorFeaturesEnabled && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={ts('doctorConsultation')}
                      style={styles.actionCard}
                      onPress={() => router.push('/doctor-consultation')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons
                          name="medical-outline"
                          size={22}
                          color={colors.primary}
                        />
                      </View>
                      <Text style={styles.rowLabel}>
                        {ts('doctorConsultation')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {isDoctorFeaturesEnabled && <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() =>
                      router.push("/doctor-consultation-history" as any)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={22}
                        color="#0d9488"
                      />
                    </View>
                    <Text style={styles.rowLabel}>
                      {ts("doctorConsultationHistory")}
                    </Text>
                  </TouchableOpacity>}

                  {/* Trung tâm quyền dữ liệu chuyên gia */}
                  {isDoctorFeaturesEnabled && <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={ts("privacyCenterTitle")}
                    style={styles.actionCard}
                    onPress={() => router.push("/privacy-center" as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name="finger-print-outline"
                        size={22}
                        color="#06b6d4"
                      />
                    </View>
                    <Text style={styles.rowLabel}>
                      {ts("privacyCenterTitle")}
                    </Text>
                  </TouchableOpacity>}
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(260).duration(350)}>
              {renderSectionHeader(
                "rewards",
                t("sectionRewards"),
                <Ionicons name="gift-outline" size={18} color="#10b981" />,
              )}
              {expandedSections.rewards && (
                <View style={styles.cardsStack}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/(tabs)/missions" as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="flag-outline" size={22} color="#10b981" />
                    </View>
                    <Text style={styles.rowLabel}>{t("missions")}</Text>
                  </TouchableOpacity>

                  {coinSummary.enabled && <TouchableOpacity
                    style={styles.actionCard}
                    accessibilityRole="button"
                    accessibilityLabel={t('healthCoins')}
                    onPress={() => router.push('/coins')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <HealthCoinIcon size={24} />
                    </View>
                    <Text style={styles.rowLabel}>{t('healthCoins')}</Text>
                  </TouchableOpacity>}
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/checkin-rewards")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t("dailyGifts")}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="gift-outline" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.rowLabel}>{t("dailyGifts")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/checkin-rewards/history")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t("giftCollection")}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="archive-outline" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.rowLabel}>{t("giftCollection")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* ==================== 02 MIDDLE: TÀI KHOẢN ==================== */}
            <Animated.View entering={FadeIn.delay(300).duration(350)}>
              {renderSectionHeader(
                "account",
                t("sectionAccount"),
                <Ionicons name="person-circle-outline" size={20} color="#10b981" />,
              )}
              {expandedSections.account && (
                <View style={styles.cardsStack}>
                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/subscription")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="star-outline" size={22} color="#f59e0b" />
                    </View>
                    <Text style={styles.rowLabel}>{t("subscription")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => router.push("/wallet")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      <Ionicons name="wallet-outline" size={22} color="#0d9488" />
                    </View>
                    <Text style={styles.rowLabel}>{t("wallet")}</Text>
                  </TouchableOpacity>

                  {/* Đổi mật khẩu (nếu tài khoản dùng mật khẩu) */}
                  {profile?.hasPassword ? (
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => setShowChangePasswordModal(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons name="key-outline" size={22} color="#6366f1" />
                      </View>
                      <Text style={styles.rowLabel}>{t("changePassword")}</Text>
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
                      <Ionicons name="trash-outline" size={22} color={colors.danger} />
                    </View>
                    <Text style={[styles.rowLabel, styles.deleteAccountText]}>
                      {ts("deleteAccountForever")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            {/* ==================== 02 MIDDLE: CÀI ĐẶT ==================== */}
            <Animated.View entering={FadeIn.delay(340).duration(350)}>
              {renderSectionHeader(
                "settings",
                t("sectionSettings"),
                <Ionicons name="settings-sharp" size={18} color="#10b981" />,
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
                      <Ionicons name="text-outline" size={22} color="#0d9488" />
                    </View>
                    <Text style={styles.rowLabel}>{ts("fontSize")}</Text>
                    <Text style={styles.rowMeta}>{fontLabel}</Text>
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
                        size={22}
                        color="#10b981"
                      />
                    </View>
                    <Text style={styles.rowLabel}>{ts("language")}</Text>
                    <Text style={styles.rowMeta}>{langLabel}</Text>
                  </TouchableOpacity>

                  <ReminderSettingsEntry />
                </View>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(360).duration(350)}>
              {renderSectionHeader(
                "permissions",
                ts("appPermissions"),
                <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />,
              )}
              {/* Preserve permission state between expands; only visibility changes. */}
              <View
                key={profile?.id ?? "signed-out"}
                testID="profile-permission-controls"
                style={[
                  styles.cardsStack,
                  !expandedSections.permissions && styles.collapsedSection,
                ]}
                accessibilityElementsHidden={!expandedSections.permissions}
                importantForAccessibility={
                  expandedSections.permissions ? "auto" : "no-hide-descendants"
                }
                pointerEvents={expandedSections.permissions ? "auto" : "none"}
              >
                  {isDoctorFeaturesEnabled && <SpecialistSharingPermission />}

                  {/* Quyền dùng Asinu AI */}
                  <View style={styles.actionCard}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name="sparkles-outline"
                        size={22}
                        color="#10b981"
                      />
                    </View>
                    <Text style={styles.rowLabel}>
                      {ts("aiDataConsentSettings")}
                    </Text>
                    <Switch
                      accessibilityLabel={ts("aiDataConsentSettings")}
                      accessibilityState={{ checked: aiConsentEnabled }}
                      value={aiConsentEnabled}
                      onValueChange={handleToggleAiConsent}
                      trackColor={{ false: "#d1d5db", true: colors.primary }}
                      thumbColor={colors.surface}
                      ios_backgroundColor="#d1d5db"
                    />
                  </View>

                  <ProfileDevicePermissions />
                  <TaskReminderPermission />
                  <View style={styles.actionCard}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons
                        name="bookmark-outline"
                        size={22}
                        color="#8b5cf6"
                      />
                    </View>
                    <Text style={styles.rowLabel}>{t("healthFeed")}</Text>
                    <Switch
                      accessibilityLabel={t("healthFeed")}
                      accessibilityState={{ checked: healthFeedEnabled }}
                      value={healthFeedEnabled}
                      onValueChange={handleToggleHealthFeed}
                      trackColor={{ false: "#d1d5db", true: colors.primary }}
                      thumbColor={colors.surface}
                      ios_backgroundColor="#d1d5db"
                    />
                  </View>
              </View>
            </Animated.View>

            {/* ==================== 03 BOTTOM: TRỢ GIÚP & THÔNG TIN ==================== */}
            <Animated.View entering={FadeIn.delay(380).duration(350)}>
              {renderSectionHeader(
                "system",
                t("sectionSystem"),
                <Ionicons name="help-circle-outline" size={20} color="#10b981" />,
              )}
              {expandedSections.system && (
                <>
                  <View style={styles.cardsStack}>
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => { void checkForUpdate(); }}
                      disabled={checkingUpdate}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: checkingUpdate, busy: checkingUpdate }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
                      </View>
                      <Text style={styles.rowLabel}>{tc(checkingUpdate ? 'appUpdate.checking' : 'appUpdate.check')}</Text>
                      {checkingUpdate && <ActivityIndicator color={colors.primary} />}
                    </TouchableOpacity>
                    {/* Trợ giúp qua Zalo */}
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => Linking.openURL("https://zalo.me/0898888917")}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={22}
                          color="#0ea5e9"
                        />
                      </View>
                      <Text style={styles.rowLabel}>{ts("helpSupport")}</Text>
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
                          size={22}
                          color="#14b8a6"
                        />
                      </View>
                      <Text style={styles.rowLabel}>{t("shareApp")}</Text>
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
                          size={22}
                          color="#8b5cf6"
                        />
                      </View>
                      <Text style={styles.rowLabel}>{ts("termsOfService")}</Text>
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
                          size={22}
                          color="#14b8a6"
                        />
                      </View>
                      <Text style={styles.rowLabel}>{ts("privacyPolicy")}</Text>
                    </TouchableOpacity>

                    {/* Nguồn tham khảo sức khỏe */}
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() => router.push("/legal/sources" as any)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowIconWrap}>
                        <Ionicons name="book-outline" size={22} color="#0284c7" />
                      </View>
                      <Text style={styles.rowLabel}>{ts("healthSources")}</Text>
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
                        <Ionicons name="globe-outline" size={22} color="#0d9488" />
                      </View>
                      <Text style={styles.rowLabel}>
                        {ts("requestDataDeletion")}
                      </Text>
                    </TouchableOpacity>

                  </View>
                </>
              )}

            </Animated.View>

            <View style={styles.profileFooter}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => setShowLogoutModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={isDark ? "#f87171" : "#e11d48"}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.logoutButtonText}>{t("logout")}</Text>
              </TouchableOpacity>
              <ProfileMascotGreeting />
            </View>
          </>
        )}
      </RippleRefreshScrollView>

      {/* ==================== PLAN INFO MODAL ==================== */}
      <Modal
        visible={showPlanInfoModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowPlanInfoModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPlanInfoModal(false)}
        >
          <Pressable style={styles.planInfoCard} onPress={(event) => event.stopPropagation()}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <View style={styles.planIconBig}>
                <MaterialCommunityIcons
                  name={
                    subStatus?.isAnTam ? "shield-check" : "shield-account-outline"
                  }
                  size={28}
                  color={
                    subStatus?.isAnTam ? colors.premiumDark : colors.primary
                  }
                />
              </View>
              <Text style={styles.planInfoTitle}>
                {localizedPlanName(subStatus?.planCode, tSubscription)}
              </Text>
              <Text style={styles.planInfoSubtitle}>
                {subStatus?.isAnTam
                  ? t("antamActiveDesc")
                  : t("freeHealthDesc")}
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 12 }}>
              {planBenefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <MaterialCommunityIcons
                    name={b.icon as any}
                    size={18}
                    color={
                      subStatus?.isAnTam ? colors.premium : colors.success
                    }
                  />
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.planActionsRow}>
              <Pressable
                style={styles.planCloseBtn}
                onPress={() => setShowPlanInfoModal(false)}
              >
                <Text style={styles.planCloseBtnText}>{tc("close")}</Text>
              </Pressable>
              {!subStatus?.isAnTam && (
                <Pressable
                  style={styles.planUpgradeBtn}
                  onPress={() => {
                    setShowPlanInfoModal(false);
                    router.push("/subscription");
                  }}
                >
                  <Text style={styles.planUpgradeBtnText}>
                    {t("chooseAnTam")}
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ==================== EDIT PROFILE MODAL ==================== */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.sheetOverlay}
        >
          <View
            style={[
              styles.editModalContent,
              { paddingBottom: Math.max(insets.bottom, 16) + spacing.xs },
            ]}
          >
            {/* Sheet Handle Bar & Close Button */}
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetHandleBar} />
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={handleCloseEditModal}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={styles.sheetCloseIcon.color}
                />
              </Pressable>
            </View>

            {/* Sheet Title */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("editProfileTitle")}</Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScrollContent}
            >
              {/* Avatar Section */}
              <View style={styles.editAvatarSection}>
                <View style={styles.avatarLeftRow}>
                  <View style={styles.avatarCircleWrapper}>
                    {profile?.avatarUrl ? (
                      <Image
                        source={{ uri: profile.avatarUrl }}
                        style={styles.avatarCircleImg}
                      />
                    ) : (
                      <View style={styles.avatarCirclePlaceholder}>
                        <MaterialCommunityIcons
                          name="account"
                          size={40}
                          color={colors.primary}
                        />
                      </View>
                    )}
                    {isUploadingAvatar && (
                      <View style={styles.editAvatarLoading}>
                        <ActivityIndicator size="small" color="#ffffff" />
                      </View>
                    )}
                    <Pressable
                      style={styles.avatarCameraBadge}
                      onPress={handlePickAvatar}
                      disabled={isUploadingAvatar}
                    >
                      <Ionicons name="camera" size={12} color={colors.primaryText} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.uploadPhotoPill,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={handlePickAvatar}
                    disabled={isUploadingAvatar}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={15}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.uploadPhotoPillText}>
                      {t("uploadPhoto")}
                    </Text>
                  </Pressable>
                </View>

              </View>

              {/* Section 1: Thông tin cá nhân */}
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitleOnly}>
                  {t("personalInfo")}
                </Text>

                <View style={styles.namePhoneFields}>
                  {/* Họ tên */}
                  <View style={styles.compactInputCard}>
                    <View style={styles.cardHeaderRow}>
                      <Ionicons
                        name="person"
                        size={14}
                        color={iconColors.primary}
                      />
                      <Text style={styles.compactLabel}>{t("fullName")}</Text>
                    </View>
                    <TextInput
                      style={styles.compactInputText}
                      value={editName}
                      accessibilityLabel={t("fullName")}
                      onChangeText={setEditName}
                      placeholder={t("enterName")}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  {/* Số điện thoại */}
                  <View
                    style={[
                      styles.compactInputCard,
                      phoneError ? styles.compactInputError : null,
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <Ionicons
                        name="call"
                        size={14}
                        color={iconColors.emerald}
                      />
                      <Text style={styles.compactLabel}>{t("phone")}</Text>
                    </View>
                    <TextInput
                      style={styles.compactInputText}
                      value={editPhone}
                      accessibilityLabel={t("phone")}
                      onChangeText={(text) => {
                        setEditPhone(text);
                        setPhoneError("");
                      }}
                      placeholder={t("enterPhone")}
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                {phoneError ? (
                  <Text style={styles.fieldErrorPhone}>{phoneError}</Text>
                ) : null}
              </View>

              {/* Section 2: Giới tính */}
              <View style={[styles.sheetSection, styles.editorGenderSection]}>
                <Text style={[styles.sheetSectionTitleOnly, styles.genderLabel]}>{t("gender")}</Text>
                <View style={styles.genderRow} accessibilityRole="radiogroup" accessibilityLabel={t("gender")}>
                  <Pressable
                    style={[
                      styles.genderCard,
                      editGender === "Nam" && styles.genderCardActiveMale,
                    ]}
                    onPress={() => setEditGender("Nam")}
                    accessibilityRole="radio"
                    accessibilityLabel={tc("male")}
                    accessibilityState={{ checked: editGender === "Nam", disabled: isSaving }}
                    disabled={isSaving}
                  >
                    <Ionicons
                      name={editGender === "Nam" ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={
                        editGender === "Nam"
                          ? colors.primaryDark
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.genderCardText,
                        editGender === "Nam" && styles.genderCardTextActiveMale,
                      ]}
                    >
                      {tc("male")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.genderCard,
                      editGender === "Nữ" && styles.genderCardActiveFemale,
                    ]}
                    onPress={() => setEditGender("Nữ")}
                    accessibilityRole="radio"
                    accessibilityLabel={tc("female")}
                    accessibilityState={{ checked: editGender === "Nữ", disabled: isSaving }}
                    disabled={isSaving}
                  >
                    <Ionicons
                      name={editGender === "Nữ" ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={
                        editGender === "Nữ" ? "#E11D48" : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.genderCardText,
                        editGender === "Nữ" &&
                          styles.genderCardTextActiveFemale,
                      ]}
                    >
                      {tc("female")}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Each measurement occupies one compact row. */}
              <View style={styles.sheetSection}>
                <View style={styles.measurementFields}>
                  {/* Tuổi */}
                  <View style={styles.statBox}>
                    <View style={styles.statBoxHeader}>
                      <FontAwesome5
                        name="birthday-cake"
                        size={12}
                        color={iconColors.premium}
                      />
                      <Text style={styles.statBoxLabel}>{t("age")}</Text>
                    </View>
                    <TextInput
                      style={styles.statBoxInput}
                      value={editAge}
                      accessibilityLabel={t("age")}
                      onChangeText={setEditAge}
                      placeholder="--"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.statBoxUnit}>{t("unitAge")}</Text>
                  </View>

                  {/* Chiều cao */}
                  <View style={styles.statBox}>
                    <View style={styles.statBoxHeader}>
                      <MaterialCommunityIcons
                        name="human-male-height"
                        size={15}
                        color={iconColors.cyan}
                      />
                      <Text style={styles.statBoxLabel}>{t("height")}</Text>
                    </View>
                    <TextInput
                      style={styles.statBoxInput}
                      value={editHeight}
                      accessibilityLabel={t("height")}
                      onChangeText={setEditHeight}
                      placeholder="--"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.statBoxUnit}>{t("unitCm")}</Text>
                  </View>

                  {/* Cân nặng */}
                  <View style={styles.statBox}>
                    <View style={styles.statBoxHeader}>
                      <MaterialCommunityIcons
                        name="scale-bathroom"
                        size={15}
                        color={iconColors.weight}
                      />
                      <Text style={styles.statBoxLabel}>{t("weight")}</Text>
                    </View>
                    <TextInput
                      style={styles.statBoxInput}
                      value={editWeight}
                      accessibilityLabel={t("weight")}
                      onChangeText={setEditWeight}
                      placeholder="--"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Text style={styles.statBoxUnit}>{t("unitKg")}</Text>
                  </View>

                  {/* Nhóm máu */}
                  <View style={styles.statBox}>
                    <View style={styles.statBoxHeader}>
                      <FontAwesome5
                        name="tint"
                        size={12}
                        color={iconColors.danger}
                      />
                      <Text style={styles.statBoxLabel}>{t("bloodType")}</Text>
                    </View>
                    <Pressable
                      style={styles.bloodTypeField}
                      onPress={() => setShowBloodTypePicker((visible) => !visible)}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={t("bloodType")}
                      accessibilityValue={{ text: bloodTypeLabel }}
                      accessibilityState={{
                        expanded: showBloodTypePicker,
                        disabled: isSaving,
                      }}
                    >
                      <Text style={styles.bloodTypeValue}>
                        {bloodTypeLabel}
                      </Text>
                      <Ionicons
                        name={showBloodTypePicker ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={colors.primaryDark}
                      />
                    </Pressable>
                  </View>
                </View>
                {showBloodTypePicker && (
                  <View
                    style={styles.bloodTypeOptions}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={t("bloodType")}
                  >
                    {[...BLOOD_TYPES, ""].map((value) => {
                      const selected = selectedBloodType === value;
                      const label = value || t("bloodTypeUnknown");
                      return (
                        <Pressable
                          key={value || "unknown"}
                          style={[
                            styles.bloodTypeOption,
                            selected && styles.diseaseSelectChipActive,
                          ]}
                          accessibilityRole="radio"
                          accessibilityLabel={label}
                          accessibilityState={{
                            checked: selected,
                            disabled: isSaving,
                          }}
                          disabled={isSaving}
                          onPress={() => {
                            setEditBloodType(value);
                            setShowBloodTypePicker(false);
                          }}
                        >
                          <Text style={[
                            styles.diseaseSelectChipText,
                            selected && styles.diseaseSelectChipTextActive,
                          ]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Bệnh nền */}
              <View style={styles.sheetSection}>
                <Pressable
                  style={styles.sheetChronicDiseaseCard}
                  onPress={() => setShowDiseasePicker((visible) => !visible)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t("chronicDiseases")}
                  accessibilityState={{
                    expanded: showDiseasePicker,
                    disabled: isSaving,
                  }}
                >
                  <View style={styles.chronicCardLeft}>
                    <MaterialCommunityIcons
                      name="clipboard-pulse-outline"
                      size={18}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.chronicCardLabel}>
                      {t("chronicDiseases")}
                    </Text>
                  </View>

                  <View style={styles.chronicChipsContainer}>
                    {diseaseList.length > 0 ? (
                      diseaseList.map((disease) => {
                        const option = CHRONIC_DISEASE_OPTIONS.find(
                          (item) => item.value === disease,
                        );
                        return (
                          <View key={disease} style={styles.diseaseChip}>
                            <Text style={styles.diseaseChipText}>
                              {option ? t(option.labelKey) : disease}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.chronicCardEmpty}>
                        {t("noChronicDiseases")}
                      </Text>
                    )}
                  </View>

                  <Ionicons
                    name={showDiseasePicker ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
                {showDiseasePicker && (
                  <View style={styles.diseasePickerInline}>
                    <View style={styles.diseaseChipsGrid}>
                      {diseaseOptions.map((item) => {
                        const selected = diseaseList.includes(item.value);
                        const label = item.labelKey ? t(item.labelKey) : item.value;
                        return (
                          <Pressable
                            key={item.value}
                            style={[
                              styles.diseaseSelectChip,
                              selected && styles.diseaseSelectChipActive,
                            ]}
                            onPress={() => toggleDisease(item.value)}
                            disabled={isSaving}
                            accessibilityRole="checkbox"
                            accessibilityLabel={label}
                            accessibilityState={{
                              checked: selected,
                              disabled: isSaving,
                            }}
                          >
                            {selected && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color={colors.primaryDark}
                              />
                            )}
                            <Text style={[
                              styles.diseaseSelectChipText,
                              selected && styles.diseaseSelectChipTextActive,
                            ]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.customDiseaseRow}>
                      <TextInput
                        style={styles.customDiseaseInput}
                        value={customDiseaseInput}
                        onChangeText={setCustomDiseaseInput}
                        placeholder={t("enterCustomDisease")}
                        placeholderTextColor={colors.textSecondary}
                        accessibilityLabel={t("addCustomDisease")}
                        editable={!isSaving}
                        onSubmitEditing={addCustomDisease}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={[
                          styles.addDiseaseBtn,
                          (!customDiseaseInput.trim() || isSaving) && styles.sheetSaveBtnDisabled,
                        ]}
                        onPress={addCustomDisease}
                        disabled={!customDiseaseInput.trim() || isSaving}
                        accessibilityRole="button"
                        accessibilityLabel={t("addCustomDisease")}
                        accessibilityState={{
                          disabled: !customDiseaseInput.trim() || isSaving,
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={!customDiseaseInput.trim() || isSaving
                            ? styles.sheetSaveBtnTextDisabled.color
                            : styles.addDiseaseBtnText.color}
                        />
                        <Text style={[
                          styles.addDiseaseBtnText,
                          (!customDiseaseInput.trim() || isSaving) && styles.sheetSaveBtnTextDisabled,
                        ]}>
                          {tc("add")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Sheet Footer: Hủy & Lưu */}
            <View style={styles.sheetFooter}>
              <Pressable
                style={styles.sheetCancelBtn}
                onPress={handleCloseEditModal}
              >
                <Text style={styles.sheetCancelBtnText}>{tc("cancel")}</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.sheetSaveBtn,
                  isSaveDisabled && styles.sheetSaveBtnDisabled,
                ]}
                onPress={handleSaveProfile}
                disabled={isSaveDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaveDisabled, busy: isSaving }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={
                        isSaveDisabled
                          ? styles.sheetSaveBtnTextDisabled.color
                          : "#ffffff"
                      }
                    />
                    <Text
                      style={[
                        styles.sheetSaveBtnText,
                        isSaveDisabled && styles.sheetSaveBtnTextDisabled,
                      ]}
                    >
                      {tc("save")}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
          {isEditModalVisible && <ModalToastHost />}
        </KeyboardAvoidingView>
      </Modal>

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
          void revokeAiDataConsent().then(() => {
            setAiConsentEnabled(false);
            setShowAiConsentModal(false);
            showToast(ts("aiDataConsentRevoked"), "success");
          }).catch(() => showToast(tc("saveError"), "error"));
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
          <Pressable style={styles.logoutModalCard} onPress={(event) => event.stopPropagation()}>
            {/* Nút Đóng (x) góc phải */}
            <TouchableOpacity
              style={styles.logoutModalCloseBtn}
              onPress={() => setShowLogoutModal(false)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons
                name="close"
                size={18}
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
  isDark: boolean,
) {
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const borderCol = isDark ? "#334155" : "#f1f5f9";
  const textPrimaryCol = isDark ? "#f8fafc" : "#0f172a";
  const textSecondaryCol = isDark ? "#94a3b8" : "#64748b";

  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: "transparent",
    },
    profileFooter: {
      flexGrow: 1,
      minHeight: 164,
      marginHorizontal: 24,
      marginTop: 8,
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 16,
    },
    personalInfoHeader: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: 0,
    },
    coinSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      gap: 8,
      width: 172,
      paddingVertical: 8,
    },
    coinCopy: { flex: 1, minWidth: 0, gap: 4 },
    coinBalance: { fontSize: 15, fontWeight: '800', color: isDark ? '#f0fdfa' : '#172033' },
    coinLabel: { fontSize: 13, fontWeight: '600', color: isDark ? '#6ee7b7' : '#287f6c' },
    personalInfoToggle: {
      flex: 1,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    personalInfoEditButton: {
      minHeight: 44,
      marginRight: 8,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    personalInfoEditText: {
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#99f6e4" : "#0b5e56",
    },

    // Info Grid
    infoGrid: {
      marginHorizontal: 16,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    gridCard: {
      width: "48.5%",
      backgroundColor: "transparent",
      paddingVertical: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    gridIconWrap: {
      width: 26,
      height: 26,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    },
    gridCardContent: {
      flex: 1,
    },
    gridCardLabel: {
      fontSize: 13,
      color: textSecondaryCol,
    },
    gridCardValue: {
      fontSize: 16,
      fontWeight: "700",
      color: textPrimaryCol,
      marginTop: 2,
    },
    chronicDiseaseCard: {
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: "transparent",
      paddingVertical: 13,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    // Identity sits directly on the healthcare wallpaper.
    userCard: {
      marginHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 12,
      alignItems: "center",
    },
    avatarWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    avatarImg: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatarLoadingOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: 32,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    userInfoCol: {
      flex: 1,
      minWidth: 96,
      marginLeft: 14,
      justifyContent: "center",
    },
    userName: {
      fontSize: 18,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    planBadge: {
      maxWidth: '100%',
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#78350f33" : "#fef3c7",
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 4,
      alignSelf: "flex-start",
      marginTop: 6,
      borderWidth: 1,
      borderColor: isDark ? "#92400e" : "#fde68a",
    },
    planBadgeText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "600",
      color: isDark ? "#fcd34d" : "#b45309",
    },

    sectionHeaderLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionHeading: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    // Care Banner
    careBanner: {
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 8,
      backgroundColor: isDark ? "#064e3b22" : "#e6f7ef",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? "#065f46" : "#a7f3d0",
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
    },
    careBannerArt: {
      width: 50,
      height: 50,
      resizeMode: "contain",
    },
    careBannerTextGroup: {
      flex: 1,
      marginLeft: 12,
      marginRight: 6,
    },
    careBannerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: isDark ? "#a7f3d0" : "#065f46",
    },
    careBannerSubtitle: {
      fontSize: 12,
      color: isDark ? "#6ee7b7" : "#047857",
      marginTop: 2,
    },

    // Grouped Section (Thao tác, Sức khỏe, Tài khoản, Cài đặt, Hệ thống)
    sectionHeaderRow: {
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 4,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardsStack: {
      marginLeft: 36,
      marginRight: 16,
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
    actionCardLocked: {
      backgroundColor: "transparent",
    },
    rowIconWrap: {
      width: 28,
      height: 28,
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
    rowLabelLocked: {
      color: textSecondaryCol,
    },
    lockedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 8,
      borderRadius: 999,
      backgroundColor: isDark ? "#422006" : "#fff7ed",
      borderWidth: 1,
      borderColor: isDark ? "#78350f" : "#fed7aa",
    },
    lockedBadgeText: {
      color: isDark ? "#fdba74" : "#c2410c",
      fontSize: 11,
      fontWeight: "700",
    },
    rowMeta: {
      fontSize: 13,
      color: textSecondaryCol,
      marginRight: 6,
    },
    // Destructive action in the Account section
    deleteAccountText: {
      color: colors.danger,
      fontWeight: "600",
    },

    // Logout Button
    logoutButton: {
      alignSelf: "flex-start",
      flexShrink: 1,
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    logoutButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#f87171" : "#e11d48",
    },

    // Overlay & Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    planInfoCard: {
      backgroundColor: cardBg,
      borderRadius: 22,
      padding: 24,
      width: "100%",
      maxWidth: 360,
    },
    planIconBig: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    planInfoTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: textPrimaryCol,
    },
    planInfoSubtitle: {
      fontSize: 13,
      color: textSecondaryCol,
      textAlign: "center",
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 4,
    },
    benefitText: {
      flex: 1,
      fontSize: 14,
      color: textPrimaryCol,
      fontWeight: "600",
    },
    planActionsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    planCloseBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
    },
    planCloseBtnText: {
      color: textPrimaryCol,
      fontWeight: "600",
      fontSize: 14,
    },
    planUpgradeBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: colors.premiumLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planUpgradeBtnText: {
      color: colors.premiumDark,
      fontWeight: "700",
      fontSize: 14,
    },

    // Redesigned Edit Profile Bottom Sheet
    sheetOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      justifyContent: "flex-end",
    },
    editModalContent: {
      backgroundColor: cardBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 16,
      paddingTop: 10,
      width: "100%",
      maxHeight: "92%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 10,
    },
    sheetHandleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 28,
      position: "relative",
    },
    sheetHandleBar: {
      width: 44,
      height: 4.5,
      borderRadius: 2.5,
      backgroundColor: isDark ? "#475569" : "#CBD5E1",
    },
    sheetCloseBtn: {
      position: "absolute",
      right: 0,
      top: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetCloseIcon: {
      color: textSecondaryCol,
    },
    sheetHeader: {
      alignItems: "center",
      marginTop: 2,
      marginBottom: 12,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: textPrimaryCol,
      letterSpacing: -0.2,
    },
    sheetScrollContent: {
      paddingBottom: 16,
    },

    // Compact avatar row.
    editAvatarSection: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "transparent",
      paddingVertical: 6,
      marginBottom: 8,
    },
    avatarLeftRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      zIndex: 1,
    },
    avatarCircleWrapper: {
      position: "relative",
      width: 48,
      height: 48,
    },
    avatarCircleImg: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryLight,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    avatarCirclePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    editAvatarLoading: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.4)",
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarCameraBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    uploadPhotoPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      minHeight: 44,
      backgroundColor: "transparent",
    },
    uploadPhotoPillText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primaryDark,
    },
    // Sheet Sections
    sheetSection: {
      marginBottom: 12,
    },
    sheetSectionTitleOnly: {
      fontSize: 13.5,
      fontWeight: "700",
      color: textPrimaryCol,
      marginBottom: 6,
      paddingHorizontal: 2,
    },

    // One field per row, with the label and value side by side.
    namePhoneFields: {
      flexDirection: "column",
    },
    compactInputCard: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "transparent",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
    },
    compactInputError: {
      borderBottomColor: "#EF4444",
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      width: "42%",
    },
    compactLabel: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "500",
      color: textSecondaryCol,
    },
    compactInputText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: textPrimaryCol,
      paddingHorizontal: 4,
      paddingVertical: 8,
      minHeight: 44,
      textAlign: "right",
    },
    fieldErrorPhone: {
      fontSize: 11,
      color: "#EF4444",
      marginTop: 4,
      marginLeft: 4,
    },

    // Gender Row
    editorGenderSection: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
    },
    genderLabel: { width: "42%", marginBottom: 0, paddingHorizontal: 0, fontSize: 14, fontWeight: "500", color: textSecondaryCol },
    genderRow: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 8,
    },
    genderCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 4,
      minHeight: 44,
      backgroundColor: "transparent",
    },
    genderCardActiveMale: {
      backgroundColor: "transparent",
    },
    genderCardActiveFemale: {
      backgroundColor: "transparent",
    },
    genderCardText: {
      fontSize: 13.5,
      fontWeight: "600",
      color: textSecondaryCol,
    },
    genderCardTextActiveMale: {
      color: colors.primaryDark,
      fontWeight: "700",
    },
    genderCardTextActiveFemale: {
      color: "#E11D48",
      fontWeight: "700",
    },

    // Compact measurement and blood-type rows.
    bloodTypeField: {
      minHeight: 44,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 2,
    },
    bloodTypeValue: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "500",
      color: textPrimaryCol,
      textAlign: "right",
    },
    bloodTypeOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    bloodTypeOption: {
      flexBasis: "22%",
      flexGrow: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
      borderWidth: 1,
      borderColor: borderCol,
    },
    measurementFields: {
      flexDirection: "column",
    },
    statBox: {
      minHeight: 48,
      flexDirection: "row",
      backgroundColor: "transparent",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
      alignItems: "center",
    },
    statBoxHeader: {
      flexDirection: "row",
      alignItems: "center",
      width: "42%",
      gap: 6,
    },
    statBoxLabel: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "500",
      color: textSecondaryCol,
      textAlign: "left",
    },
    statBoxInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: textPrimaryCol,
      textAlign: "right",
      paddingHorizontal: 4,
      paddingVertical: 8,
      minWidth: 32,
      minHeight: 44,
    },
    statBoxUnit: {
      minWidth: 28,
      fontSize: 12,
      color: textSecondaryCol,
      marginLeft: 8,
      textAlign: "right",
    },

    // Chronic condition row.
    sheetChronicDiseaseCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "transparent",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
      minHeight: 48,
      paddingVertical: 8,
      gap: 8,
    },
    chronicCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    chronicCardLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: textPrimaryCol,
    },
    chronicChipsContainer: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    diseaseChip: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    diseaseChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primaryDark,
    },
    chronicCardEmpty: {
      fontSize: 12,
      color: textSecondaryCol,
      fontStyle: "italic",
    },

    // Sheet Footer Actions
    sheetFooter: {
      flexDirection: "row",
      gap: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: borderCol,
    },
    sheetCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: isDark ? "#334155" : "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
    },
    sheetCancelBtnText: {
      fontSize: 14.5,
      fontWeight: "600",
      color: textSecondaryCol,
    },
    sheetSaveBtn: {
      flex: 1.6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.primaryDark,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    sheetSaveBtnDisabled: {
      backgroundColor: isDark ? "#334155" : "#E2E8F0",
      shadowOpacity: 0,
      elevation: 0,
    },
    sheetSaveBtnText: {
      fontSize: 14.5,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    sheetSaveBtnTextDisabled: {
      color: textSecondaryCol,
    },

    // Inline chronic condition picker
    diseasePickerInline: {
      marginTop: 10,
    },
    diseaseChipsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: spacing.md,
      justifyContent: "center",
    },
    diseaseSelectChip: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      maxWidth: "100%",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
      borderWidth: 1,
      borderColor: borderCol,
    },
    diseaseSelectChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryDark,
    },
    diseaseSelectChipText: {
      flexShrink: 1,
      fontSize: 12.5,
      color: textSecondaryCol,
    },
    diseaseSelectChipTextActive: {
      color: colors.primaryDark,
      fontWeight: "600",
    },
    customDiseaseRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: spacing.lg,
      width: "100%",
    },
    customDiseaseInput: {
      flex: 1,
      minHeight: 44,
      backgroundColor: "transparent",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderCol,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: textPrimaryCol,
    },
    addDiseaseBtn: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.primaryDark,
    },
    addDiseaseBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#FFFFFF",
    },

    // Logout Modal
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
