import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
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
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AppAlertModal,
  useAppAlert,
} from "../../../src/components/AppAlertModal";
import {
  AiDataConsentModal,
  revokeAiDataConsent,
} from "../../../src/components/AiDataConsentModal";
import { ScaledTextInput as TextInput } from "../../../src/components/ScaledTextInput";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { LinearGradient } from "expo-linear-gradient";

const LOGOUT_ART = require("../../../assets/images/profile/logout_art.png");

const STORAGE_KEY_NOTIFICATIONS = "@app/notifications_enabled";
const STORAGE_KEY_REMINDERS = "@app/reminders_enabled";

const DeleteAccountModal = React.lazy(
  () => import("../../../src/components/DeleteAccountModal")
);
const ChangePasswordModal = React.lazy(
  () => import("../../../src/components/ChangePasswordModal")
);
import { RippleRefreshScrollView } from "../../../src/components/RippleRefresh";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../../src/components/ScaledText";
import { Screen } from "../../../src/components/Screen";
import { ProfileTabSkeleton } from "../../../src/components/state/MainScreenSkeletons";
import { authApi } from "../../../src/features/auth/auth.api";
import { showToast, setPendingToast } from "../../../src/stores/toast.store";
import { useAuthStore } from "../../../src/features/auth/auth.store";
import { useLogsStore } from "../../../src/features/logs/logs.store";
import { useMissionsStore } from "../../../src/features/missions/missions.store";
import {
  FontSizeScale,
  useFontSizeStore,
} from "../../../src/stores/font-size.store";
import {
  AppLanguage,
  useLanguageStore,
} from "../../../src/stores/language.store";
import { useScaledTypography } from "../../../src/hooks/useScaledTypography";
import { useInitialLoadingGate } from "../../../src/hooks/useInitialLoadingGate";
import { ApiError, apiClient } from "../../../src/lib/apiClient";
import {
  brandColors,
  categoryColors,
  colors,
  iconColors,
  radius,
  spacing,
} from "../../../src/styles";
import { useThemeColors } from "../../../src/hooks/useThemeColors";

type SubStatus = {
  tier: "free" | "premium";
  isPremium: boolean;
  expiresAt: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2;

export default function ProfileScreen() {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("settings");
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(scaledTypography, isDark),
    [scaledTypography, isDark]
  );

  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const fetchMissions = useMissionsStore((state) => state.fetchMissions);

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
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const fontLabel =
    fontScale === "small"
      ? ts("fontSmall")
      : fontScale === "normal"
      ? ts("fontNormal")
      : fontScale === "large"
      ? ts("fontLarge")
      : ts("fontXLarge");
  const langLabel = language === "vi" ? ts("languageVi") : ts("languageEn");

  // Edit form state
  const [editName, setEditName] = useState(profile?.name || "");
  const [editPhone, setEditPhone] = useState(profile?.phone || "");
  const [editAge, setEditAge] = useState(
    profile?.age ? String(Math.round(profile.age)) : ""
  );
  const [editGender, setEditGender] = useState<"Nam" | "Nữ" | "">(
    (profile?.gender as "Nam" | "Nữ") || ""
  );
  const [editHeight, setEditHeight] = useState(
    profile?.heightCm ? String(Math.round(profile.heightCm)) : ""
  );
  const [editWeight, setEditWeight] = useState(
    profile?.weightKg ? String(Math.round(profile.weightKg)) : ""
  );
  const [editBloodType, setEditBloodType] = useState(profile?.bloodType || "");
  const [editChronicDiseases, setEditChronicDiseases] = useState(
    profile?.chronicDiseases?.join(", ") || ""
  );
  const [showDiseasePicker, setShowDiseasePicker] = useState(false);
  const [customDiseaseInput, setCustomDiseaseInput] = useState("");

  useEffect(() => {
    if (profile) {
      if (profile.name) setEditName(profile.name);
      if (profile.phone) setEditPhone(profile.phone);
      if (profile.age) setEditAge(String(Math.round(profile.age)));
      if (profile.gender) setEditGender(profile.gender as "Nam" | "Nữ");
      if (profile.heightCm) setEditHeight(String(Math.round(profile.heightCm)));
      if (profile.weightKg) setEditWeight(String(Math.round(profile.weightKg)));
      if (profile.bloodType) setEditBloodType(profile.bloodType);
      if (profile.chronicDiseases) setEditChronicDiseases(profile.chronicDiseases.join(", "));
    }
  }, [profile]);

  const diseaseList = useMemo(() => {
    return editChronicDiseases
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [editChronicDiseases]);

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
    const trimmed = customDiseaseInput.trim();
    if (!trimmed) return;
    if (!diseaseList.includes(trimmed)) {
      const list = [...diseaseList, trimmed];
      setEditChronicDiseases(list.join(", "));
    }
    setCustomDiseaseInput("");
  };

  const [phoneError, setPhoneError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarPickerInFlightRef = useRef(false);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const profileReadyRef = useRef(false);
  const [profileReady, setProfileReady] = useState(false);
  const showInitialSkeleton = useInitialLoadingGate(profileReady, 650, Boolean(profile));

  // Fetch subscription status
  useEffect(() => {
    apiClient<SubStatus>("/api/subscriptions/status")
      .then(setSubStatus)
      .catch(() => {});
  }, []);

  // Fetch full profile + data on focus (throttled)
  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) return;
      lastFetchRef.current = now;
      const controller = new AbortController();
      let cancelled = false;
      if (!profileReadyRef.current) setProfileReady(false);
      fetchLogs(controller.signal);
      fetchMissions(controller.signal);
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
        controller.abort();
        if (!profileReadyRef.current) {
          profileReadyRef.current = true;
          setProfileReady(true);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = 0;
    const controller = new AbortController();
    await Promise.all([
      fetchLogs(controller.signal),
      fetchMissions(controller.signal),
      authApi
        .fetchProfile()
        .then((p) => {
          if (p) useAuthStore.setState({ profile: p });
        })
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
  const statusText = hasProfile ? t("active") : t("notLoggedIn");

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
    setPendingToast(t("logoutSuccess"), "success");
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
        showAlert(tc("error"), ts("deleteError"));
      }
    } catch {
      showAlert(tc("error"), ts("deleteErrorGeneric"));
    }
  }, [logout, router, showAlert, ts, tc]);

  const handleEditProfile = () => {
    setPhoneError("");
    setEditName(name);
    setEditPhone(phone);
    setEditAge(profile?.age ? String(Math.round(profile.age)) : "");
    setEditGender((profile?.gender as "Nam" | "Nữ" | "") || "");
    setEditHeight(
      profile?.heightCm ? String(Math.round(profile.heightCm)) : ""
    );
    setEditWeight(
      profile?.weightKg ? String(Math.round(profile.weightKg)) : ""
    );
    setEditBloodType(profile?.bloodType || "");
    setEditChronicDiseases(profile?.chronicDiseases?.join(", ") || "");
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
  };

  const handlePickAvatar = async () => {
    if (avatarPickerInFlightRef.current) return;
    avatarPickerInFlightRef.current = true;
    setIsUploadingAvatar(true);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      const mimeType =
        asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
      const updatedProfile = await authApi.uploadAvatar(
        asset.uri,
        mimeType,
        asset.fileName || "avatar.jpg"
      );
      useAuthStore.setState({ profile: updatedProfile });
      showToast(t("avatarUpdated"), "success");
    } catch (error) {
      console.error("[Profile] avatar upload failed", error);
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "";
      showToast(message || t("avatarUploadFailed"), "error");
    } finally {
      avatarPickerInFlightRef.current = false;
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
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

    const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    if (editBloodType && !validBloodTypes.includes(editBloodType)) {
      showToast(t("bloodTypeInvalid"), "error");
      return;
    }

    setIsSaving(true);
    try {
      let dateOfBirth = null;
      if (editAge && !isNaN(Number(editAge))) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - Number(editAge);
        dateOfBirth = `${birthYear}-01-01`;
      }

      const updateData: any = {
        name: editName.trim(),
        phone: editPhone.trim(),
      };

      if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
      if (editGender) updateData.gender = editGender;
      if (editHeight) updateData.heightCm = parseFloat(editHeight);
      if (editWeight) updateData.weightKg = parseFloat(editWeight);
      if (editBloodType) updateData.bloodType = editBloodType;
      updateData.chronicDiseases = editChronicDiseases.trim()
        ? editChronicDiseases
            .split(",")
            .map((d: string) => d.trim())
            .filter((d: string) => d.length > 0)
        : [];

      const updatedProfile = await authApi.updateProfile(updateData);
      useAuthStore.setState({ profile: updatedProfile });

      handleCloseEditModal();
      showToast(t("profileUpdated"), "success");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setPhoneError(t("phoneAlreadyUsed"));
      } else {
        showToast((error as Error).message || t("profileUpdateError"), "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const planBenefits = useMemo(() => {
    if (subStatus?.isPremium) {
      return [
        { icon: "check-circle", text: t("benefitCircle3") },
        { icon: "check-circle", text: t("benefitChatUnlimited") },
        { icon: "check-circle", text: t("benefitLogUnlimited") },
        { icon: "check-circle", text: t("benefitCheckinDaily") },
        { icon: "check-circle", text: t("benefitSosAlert") },
        { icon: "check-circle", text: t("benefitMetricsLog") },
      ];
    }
    return [
      { icon: "check", text: t("benefitCircle1") },
      { icon: "check", text: t("benefitChat1000") },
      { icon: "check", text: t("benefitLog30Days") },
      { icon: "check", text: t("benefitCheckinDaily") },
      { icon: "check", text: t("benefitSosAlert") },
      { icon: "check", text: t("benefitMetricsLog") },
    ];
  }, [subStatus?.isPremium, t]);

  return (
    <Screen>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: Math.max(insets.bottom, 16) + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showInitialSkeleton ? (
          <ProfileTabSkeleton />
        ) : (
          <>
            {/* ==================== 01 TOP: HEADER ==================== */}
            <Animated.View
              entering={FadeIn.delay(0).duration(350)}
              style={styles.headerRow}
            >
              <View style={styles.headerTextGroup}>
                <Text style={styles.headerTitle}>{t("headerTitle")}</Text>
                <Text style={styles.headerSubtitle}>
                  {t("headerSubtitle")}
                </Text>
              </View>
              <View style={styles.headerArtGroup}>
                <Image
                  source={
                    language === "en"
                      ? require("../../../assets/images/profile/profile_header_art_en.png")
                      : require("../../../assets/images/profile/profile_header_art_vi.png")
                  }
                  style={styles.headerArtImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* ==================== USER PROFILE CARD ==================== */}
            <Animated.View entering={FadeIn.delay(60).duration(350)}>
              <View style={styles.userCard}>
                {/* Avatar with active green dot */}
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
                  {/* Status badge green dot */}
                  <View style={styles.avatarOnlineDot} />
                </View>

                {/* Name & status & plan badge */}
                <View style={styles.userInfoCol}>
                  <Text
                    style={styles.userName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {identityTitle}
                  </Text>
                  <View style={styles.statusLine}>
                    <Text style={styles.statusDot}>●</Text>
                    <Text style={styles.statusText}>{statusText}</Text>
                  </View>

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
                        plan: subStatus?.isPremium
                          ? t("planPremium")
                          : t("planFree"),
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

              </View>
            </Animated.View>

            {/* ==================== THÔNG TIN CÁ NHÂN SECTION ==================== */}
            <Animated.View entering={FadeIn.delay(120).duration(350)}>
              <View style={styles.sectionHeaderBetween}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="person" size={18} color="#059669" />
                  <Text style={styles.sectionHeading}>
                    {t("personalInfo")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={handleEditProfile}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={t("edit")}
                >
                  <Ionicons name="pencil" size={14} color="#059669" />
                  <Text style={styles.editBtnText}>{t("edit")}</Text>
                </TouchableOpacity>
              </View>

              {/* 2-Column Info Grid */}
              <View style={styles.infoGrid}>
                {/* 1. Số điện thoại */}
                <View style={styles.gridCard}>
                  <View style={styles.gridIconWrap}>
                    <Ionicons name="call" size={20} color="#059669" />
                  </View>
                  <View style={styles.gridCardContent}>
                    <Text style={styles.gridCardLabel}>{t("phone")}</Text>
                    <Text style={styles.gridCardValue} numberOfLines={1}>
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
                    <Text style={styles.gridCardValue} numberOfLines={1}>
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
                    <Ionicons name="calendar-outline" size={20} color="#ea580c" />
                  </View>
                  <View style={styles.gridCardContent}>
                    <Text style={styles.gridCardLabel}>{t("age")}</Text>
                    <Text style={styles.gridCardValue} numberOfLines={1}>
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
                    <Text style={styles.gridCardValue} numberOfLines={1}>
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
                    <Text style={styles.gridCardValue} numberOfLines={1}>
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
                    <Text style={styles.gridCardValue} numberOfLines={1}>
                      {profile?.bloodType || tc("notUpdated")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Full Width Card: Bệnh nền */}
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
                  <Text style={styles.gridCardValue} numberOfLines={1}>
                    {profile?.chronicDiseases &&
                    profile.chronicDiseases.length > 0
                      ? profile.chronicDiseases.join(", ")
                      : t("noChronicDiseases")}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* ==================== BANNER CHĂM SÓC SỨC KHỎE ==================== */}
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
                <Ionicons name="chevron-forward" size={18} color="#059669" />
              </TouchableOpacity>
            </Animated.View>

            {/* ==================== 02 MIDDLE: THAO TÁC ==================== */}
            <Animated.View entering={FadeIn.delay(220).duration(350)}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flash" size={18} color="#10b981" />
                <Text style={styles.sectionHeading}>
                  {t("sectionActions")}
                </Text>
              </View>
              <View style={styles.cardsStack}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleEditProfile}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="create-outline" size={22} color="#0284c7" />
                  </View>
                  <Text style={styles.rowLabel}>{t("editProfile")}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/reminder-config")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="alarm-outline" size={22} color="#f97316" />
                  </View>
                  <Text style={styles.rowLabel}>{t("reminderSchedule")}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ==================== 02 MIDDLE: SỨC KHỎE ==================== */}
            <Animated.View entering={FadeIn.delay(260).duration(350)}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="heart" size={18} color="#10b981" />
                <Text style={styles.sectionHeading}>{t("sectionHealth")}</Text>
              </View>
              <View style={styles.cardsStack}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/logs")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="journal-outline" size={22} color="#f43f5e" />
                  </View>
                  <Text style={styles.rowLabel}>{t("logEntry")}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/feed" as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="bookmark-outline" size={22} color="#8b5cf6" />
                  </View>
                  <Text style={styles.rowLabel}>{t("healthFeed")}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/(tabs)/missions" as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="flag-outline" size={22} color="#10b981" />
                  </View>
                  <Text style={styles.rowLabel}>{t("missions")}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ==================== 02 MIDDLE: TÀI KHOẢN ==================== */}
            <Animated.View entering={FadeIn.delay(300).duration(350)}>
              <View style={styles.sectionHeaderRow}>
                <FontAwesome5 name="crown" size={15} color="#f59e0b" />
                <Text style={styles.sectionHeading}>{t("sectionAccount")}</Text>
              </View>
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ==================== 02 MIDDLE: CÀI ĐẶT ==================== */}
            <Animated.View entering={FadeIn.delay(340).duration(350)}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="settings-sharp" size={18} color="#10b981" />
                <Text style={styles.sectionHeading}>{ts("title")}</Text>
              </View>
              <View style={styles.cardsStack}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setShowFontPicker(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="text-outline" size={22} color="#0d9488" />
                  </View>
                  <Text style={styles.rowLabel}>{ts("fontSize")}</Text>
                  <Text style={styles.rowMeta}>{fontLabel}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setShowLangPicker(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="language-outline" size={22} color="#10b981" />
                  </View>
                  <Text style={styles.rowLabel}>{ts("language")}</Text>
                  <Text style={styles.rowMeta}>{langLabel}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ==================== 03 BOTTOM: HỆ THỐNG ==================== */}
            <Animated.View entering={FadeIn.delay(380).duration(350)}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="cube" size={18} color="#10b981" />
                <Text style={styles.sectionHeading}>{t("sectionSystem")}</Text>
              </View>
              <View style={styles.cardsStack}>
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                {/* Quyền dùng Asinu AI */}
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setShowAiConsentModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="sparkles-outline" size={22} color="#10b981" />
                  </View>
                  <Text style={styles.rowLabel}>
                    {ts("aiDataConsentSettings")}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>

                {/* Trung tâm quyền dữ liệu Doctor */}
                <TouchableOpacity
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Xóa tài khoản vĩnh viễn (Destructive Card) */}
              <TouchableOpacity
                style={styles.deleteAccountCard}
                onPress={() => setShowDeleteModal(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color="#ef4444"
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.deleteAccountText}>
                  {ts("deleteAccountForever")}
                </Text>
              </TouchableOpacity>

              {/* Nút Đăng xuất */}
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

              {/* Footer illustration banner matching design */}
              <View style={styles.footerBannerWrap}>
                <Image
                  source={
                    language === "en"
                      ? require("../../../assets/images/profile/footer_quote_banner_en.png")
                      : require("../../../assets/images/profile/footer_quote_banner_vi.png")
                  }
                  style={styles.footerBannerImage}
                  resizeMode="cover"
                />
              </View>
            </Animated.View>
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
          <Pressable style={styles.planInfoCard} onPress={() => {}}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <View
                style={[
                  styles.planIconBig,
                  {
                    backgroundColor: subStatus?.isPremium
                      ? colors.premiumLight
                      : colors.primaryLight,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    subStatus?.isPremium ? "crown" : "shield-account-outline"
                  }
                  size={28}
                  color={
                    subStatus?.isPremium ? colors.premiumDark : colors.primary
                  }
                />
              </View>
              <Text style={styles.planInfoTitle}>
                {subStatus?.isPremium ? t("planPremium") : t("planFree")}
              </Text>
              <Text style={styles.planInfoSubtitle}>
                {subStatus?.isPremium
                  ? t("planPremiumDesc")
                  : t("planFreeDesc")}
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 12 }}>
              {planBenefits.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <MaterialCommunityIcons
                    name={b.icon as any}
                    size={18}
                    color={
                      subStatus?.isPremium ? colors.premium : colors.success
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
              {!subStatus?.isPremium && (
                <Pressable
                  style={styles.planUpgradeBtn}
                  onPress={() => {
                    setShowPlanInfoModal(false);
                    router.push("/subscription");
                  }}
                >
                  <Text style={styles.planUpgradeBtnText}>
                    {t("upgradePremium")}
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
                <Ionicons name="close" size={18} color={styles.sheetCloseIcon.color} />
              </Pressable>
            </View>

            {/* Sheet Title & Subtitle */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("editProfileTitle")}</Text>
              <Text style={styles.sheetSubtitle}>{t("editProfileSubtitle")}</Text>
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
                      <Ionicons name="camera" size={12} color="#ffffff" />
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

                {/* Subtle decorative heart pulse watermark on the right */}
                <View style={styles.avatarWatermark}>
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={68}
                    color={colors.primary}
                    style={{ opacity: 0.12 }}
                  />
                </View>
              </View>

              {/* Section 1: Thông tin cá nhân */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeaderRow}>
                  <Text style={styles.sheetSectionTitle}>{t("personalInfo")}</Text>
                  <Text style={styles.sheetSectionSubtitle}>
                    {t("basicInfoSubtitle")}
                  </Text>
                </View>

                <View style={styles.twoColumnRow}>
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
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitleOnly}>{t("gender")}</Text>
                <View style={styles.genderRow}>
                  <Pressable
                    style={[
                      styles.genderCard,
                      editGender === "Nam" && styles.genderCardActiveMale,
                    ]}
                    onPress={() => setEditGender("Nam")}
                  >
                    <Ionicons
                      name="male"
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
                  >
                    <Ionicons
                      name="female"
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

              {/* Section 3: 4 Stats Row (Tuổi, Chiều cao, Cân nặng, Nhóm máu) */}
              <View style={styles.sheetSection}>
                <View style={styles.fourStatsRow}>
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
                    <TextInput
                      style={styles.statBoxInput}
                      value={editBloodType}
                      onChangeText={setEditBloodType}
                      placeholder="O+"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                      maxLength={4}
                    />
                    <Text style={styles.statBoxUnit}> </Text>
                  </View>
                </View>
              </View>

              {/* Section 4: Sức khỏe / Bệnh nền */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeaderRow}>
                  <Text style={styles.sheetSectionTitle}>{t("healthInfo")}</Text>
                  <Text style={styles.sheetSectionSubtitle}>
                    {t("healthInfoSubtitle")}
                  </Text>
                </View>

                <Pressable
                  style={styles.sheetChronicDiseaseCard}
                  onPress={() => setShowDiseasePicker(true)}
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
                      diseaseList.map((disease, idx) => (
                        <View key={idx} style={styles.diseaseChip}>
                          <Text style={styles.diseaseChipText}>{disease}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.chronicCardEmpty}>
                        {t("noChronicDiseases")}
                      </Text>
                    )}
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
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
                  isSaving && styles.sheetSaveBtnDisabled,
                ]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#ffffff" />
                    <Text style={styles.sheetSaveBtnText}>{tc("save")}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== DISEASE PICKER MODAL ==================== */}
      <Modal
        visible={showDiseasePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiseasePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDiseasePicker(false)}
        >
          <Pressable style={styles.pickerModalCard} onPress={() => {}}>
            <View style={styles.diseaseModalHeader}>
              <Text style={styles.pickerModalTitle}>{t("selectDiseases")}</Text>
              <Text style={styles.diseaseModalSubtitle}>
                {t("selectDiseasesDesc")}
              </Text>
            </View>

            <View style={styles.diseaseChipsGrid}>
              {[
                "Tiểu đường",
                "Cao huyết áp",
                "Tim mạch",
                "Mỡ máu",
                "Gút (Gout)",
                "Hen suyễn",
                "Dạ dày",
                "Gan nhiễm mỡ",
              ].map((item) => {
                const selected = diseaseList.includes(item);
                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.diseaseSelectChip,
                      selected && styles.diseaseSelectChipActive,
                    ]}
                    onPress={() => toggleDisease(item)}
                  >
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.primaryDark}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.diseaseSelectChipText,
                        selected && styles.diseaseSelectChipTextActive,
                      ]}
                    >
                      {item}
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
              />
              <Pressable
                style={styles.addDiseaseBtn}
                onPress={addCustomDisease}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.addDiseaseBtnText}>
                  {tc("add") || "Thêm"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.diseaseDoneBtn}
              onPress={() => setShowDiseasePicker(false)}
            >
              <Text style={styles.diseaseDoneBtnText}>
                {tc("save") || "Xong"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ==================== FONT SIZE PICKER ==================== */}
      <Modal
        visible={showFontPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFontPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFontPicker(false)}
        >
          <Pressable style={styles.pickerModalCard} onPress={() => {}}>
            <Text style={styles.pickerModalTitle}>{ts("fontSize")}</Text>
            <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.md }}>
              {(["small", "normal", "large", "xlarge"] as FontSizeScale[]).map(
                (size) => {
                  const label =
                    size === "small"
                      ? ts("fontSmall")
                      : size === "normal"
                      ? ts("fontNormal")
                      : size === "large"
                      ? ts("fontLarge")
                      : ts("fontXLarge");
                  const active = fontScale === size;
                  return (
                    <Pressable
                      key={size}
                      style={[
                        styles.pickerRow,
                        active && styles.pickerRowActive,
                      ]}
                      onPress={() => {
                        setFontScale(size);
                        setShowFontPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerRowText,
                          active && styles.pickerRowTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={20} color="#ffffff" />
                      ) : null}
                    </Pressable>
                  );
                }
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ==================== LANGUAGE PICKER ==================== */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLangPicker(false)}
        >
          <Pressable style={styles.pickerModalCard} onPress={() => {}}>
            <Text style={styles.pickerModalTitle}>{ts("language")}</Text>
            <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.md }}>
              {(["vi", "en"] as AppLanguage[]).map((lang) => {
                const active = language === lang;
                return (
                  <Pressable
                    key={lang}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => {
                      setLanguage(lang);
                      setShowLangPicker(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="translate"
                      size={20}
                      color={active ? "#ffffff" : colors.textSecondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.pickerRowText,
                        active && styles.pickerRowTextActive,
                        { flex: 1 },
                      ]}
                    >
                      {lang === "vi" ? ts("languageVi") : ts("languageEn")}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark" size={20} color="#ffffff" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ==================== LAZY MODALS ==================== */}
      {showDeleteModal && (
        <Suspense fallback={null}>
          <DeleteAccountModal
            visible={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteAccount}
          />
        </Suspense>
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
          setShowAiConsentModal(false);
          showToast(ts("aiDataConsentGranted"), "success");
        }}
        onDecline={() => {
          void revokeAiDataConsent().then(() => {
            setShowAiConsentModal(false);
            showToast(ts("aiDataConsentRevoked"), "success");
          });
        }}
      />

      <AppAlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={dismissAlert}
      />

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
          <Pressable style={styles.logoutModalCard} onPress={() => {}}>
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
  isDark: boolean
) {
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const borderCol = isDark ? "#334155" : "#f1f5f9";
  const textPrimaryCol = isDark ? "#f8fafc" : "#0f172a";
  const textSecondaryCol = isDark ? "#94a3b8" : "#64748b";

  return StyleSheet.create({
    container: {
      paddingBottom: 40,
      backgroundColor: isDark ? "#0f172a" : "#f4fbf9",
    },

    // Header (Top of screen)
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
    },
    headerTextGroup: {
      flex: 1,
      paddingRight: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: textPrimaryCol,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 13,
      color: textSecondaryCol,
      marginTop: 3,
      fontWeight: "400",
    },
    headerArtGroup: {
      alignItems: "center",
      justifyContent: "center",
    },
    headerArtImage: {
      width: 105,
      height: 90,
      resizeMode: "contain",
      opacity: isDark ? 0.85 : 1,
    },

    // User Profile Card
    userCard: {
      marginHorizontal: 16,
      backgroundColor: cardBg,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: borderCol,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    avatarWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? "#064e3b" : "#d1fae5",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    avatarImg: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 32,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarOnlineDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 15,
      height: 15,
      borderRadius: 7.5,
      backgroundColor: "#10b981",
      borderWidth: 2.5,
      borderColor: cardBg,
    },
    userInfoCol: {
      flex: 1,
      marginLeft: 14,
      justifyContent: "center",
    },
    userName: {
      fontSize: 18,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    statusLine: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 5,
    },
    statusDot: {
      fontSize: 10,
      color: "#10b981",
    },
    statusText: {
      fontSize: 13,
      color: "#059669",
      fontWeight: "500",
    },
    planBadge: {
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
      fontSize: 12,
      fontWeight: "600",
      color: isDark ? "#fcd34d" : "#b45309",
    },

    // Section Header (Title + Edit button)
    sectionHeaderBetween: {
      marginHorizontal: 20,
      marginTop: 18,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    editBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#059669",
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
      width: GRID_ITEM_WIDTH,
      backgroundColor: cardBg,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: borderCol,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.15 : 0.03,
      shadowRadius: 3,
      elevation: 1,
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
      fontSize: 11,
      color: textSecondaryCol,
    },
    gridCardValue: {
      fontSize: 14,
      fontWeight: "700",
      color: textPrimaryCol,
      marginTop: 2,
    },
    chronicDiseaseCard: {
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: cardBg,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: borderCol,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.15 : 0.03,
      shadowRadius: 3,
      elevation: 1,
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
      marginHorizontal: 20,
      marginTop: 18,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    cardsStack: {
      marginHorizontal: 16,
      gap: 8,
    },
    actionCard: {
      backgroundColor: cardBg,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: borderCol,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.15 : 0.03,
      shadowRadius: 3,
      elevation: 1,
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
    rowMeta: {
      fontSize: 13,
      color: textSecondaryCol,
      marginRight: 6,
    },

    // Delete Account Card (Destructive in System Section)
    deleteAccountCard: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: borderCol,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    deleteAccountText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: textPrimaryCol,
    },

    // Logout Button
    logoutButton: {
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 16,
      backgroundColor: isDark ? "#451a1a33" : "#fff5f5",
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: isDark ? "#7f1d1d" : "#fca5a5",
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    logoutButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#f87171" : "#e11d48",
    },

    // Footer illustration banner
    footerBannerWrap: {
      width: SCREEN_WIDTH,
      marginTop: 14,
      marginBottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    footerBannerImage: {
      width: SCREEN_WIDTH,
      height: Math.round(SCREEN_WIDTH * (210 / 774)),
      resizeMode: "contain",
      opacity: isDark ? 0.85 : 1,
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
      backgroundColor: isDark ? "#334155" : "#F1F5F9",
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
    sheetSubtitle: {
      fontSize: 12,
      color: textSecondaryCol,
      marginTop: 2,
      textAlign: "center",
    },
    sheetScrollContent: {
      paddingBottom: 16,
    },

    // Avatar Row Card
    editAvatarSection: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "rgba(13, 148, 136, 0.12)" : "#E8F7F6",
      borderWidth: 1,
      borderColor: isDark ? "rgba(13, 148, 136, 0.25)" : "rgba(13, 148, 136, 0.15)",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
      overflow: "hidden",
      position: "relative",
    },
    avatarLeftRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      zIndex: 1,
    },
    avatarCircleWrapper: {
      position: "relative",
      width: 58,
      height: 58,
    },
    avatarCircleImg: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primaryLight,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    avatarCirclePlaceholder: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    editAvatarLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
      borderRadius: 29,
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
      backgroundColor: colors.primaryDark,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "#FFFFFF",
    },
    uploadPhotoPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(13, 148, 136, 0.25)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    uploadPhotoPillText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: colors.primaryDark,
    },
    avatarWatermark: {
      position: "absolute",
      right: 4,
      top: -6,
      bottom: 0,
      justifyContent: "center",
      pointerEvents: "none",
    },

    // Sheet Sections
    sheetSection: {
      marginBottom: 12,
    },
    sheetSectionHeaderRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 6,
      paddingHorizontal: 2,
    },
    sheetSectionTitle: {
      fontSize: 13.5,
      fontWeight: "700",
      color: textPrimaryCol,
    },
    sheetSectionSubtitle: {
      fontSize: 11,
      color: textSecondaryCol,
    },
    sheetSectionTitleOnly: {
      fontSize: 13.5,
      fontWeight: "700",
      color: textPrimaryCol,
      marginBottom: 6,
      paddingHorizontal: 2,
    },

    // Two Column Row (Họ tên & Phone)
    twoColumnRow: {
      flexDirection: "row",
      gap: 10,
    },
    compactInputCard: {
      flex: 1,
      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    compactInputError: {
      borderColor: "#EF4444",
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 3,
    },
    compactLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: textSecondaryCol,
    },
    compactInputText: {
      fontSize: 13.5,
      fontWeight: "600",
      color: textPrimaryCol,
      padding: 0,
      height: 22,
    },
    fieldErrorPhone: {
      fontSize: 11,
      color: "#EF4444",
      marginTop: 4,
      marginLeft: 4,
    },

    // Gender Row
    genderRow: {
      flexDirection: "row",
      gap: 10,
    },
    genderCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
      borderWidth: 1.5,
      borderColor: borderCol,
    },
    genderCardActiveMale: {
      backgroundColor: isDark ? "#064E3B20" : "#E6F7F5",
      borderColor: colors.primaryDark,
    },
    genderCardActiveFemale: {
      backgroundColor: isDark ? "#4C051920" : "#FFF1F2",
      borderColor: "#E11D48",
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

    // 4 Stats Row (Tuổi, Chiều cao, Cân nặng, Nhóm máu)
    fourStatsRow: {
      flexDirection: "row",
      gap: 8,
    },
    statBox: {
      flex: 1,
      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 12,
      paddingHorizontal: 4,
      paddingVertical: 8,
      alignItems: "center",
    },
    statBoxHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 4,
    },
    statBoxLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: textSecondaryCol,
      textAlign: "center",
    },
    statBoxInput: {
      fontSize: 15,
      fontWeight: "700",
      color: textPrimaryCol,
      textAlign: "center",
      padding: 0,
      minWidth: 32,
      height: 22,
    },
    statBoxUnit: {
      fontSize: 10.5,
      color: textSecondaryCol,
      marginTop: 2,
    },

    // Chronic Diseases Card
    sheetChronicDiseaseCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    chronicCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    chronicCardLabel: {
      fontSize: 12.5,
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
      opacity: 0.6,
    },
    sheetSaveBtnText: {
      fontSize: 14.5,
      fontWeight: "700",
      color: "#FFFFFF",
    },

    // Disease Picker Modal
    diseaseModalHeader: {
      marginBottom: spacing.md,
      alignItems: "center",
    },
    diseaseModalSubtitle: {
      fontSize: 12,
      color: textSecondaryCol,
      marginTop: 3,
      textAlign: "center",
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
      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: textPrimaryCol,
    },
    addDiseaseBtn: {
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
    diseaseDoneBtn: {
      width: "100%",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primaryDark,
      alignItems: "center",
    },
    diseaseDoneBtnText: {
      fontSize: 14.5,
      fontWeight: "700",
      color: "#FFFFFF",
    },

    // Pickers (Font size, Language)
    pickerModalCard: {
      backgroundColor: cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: borderCol,
      padding: spacing.xl,
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
    },
    pickerModalTitle: {
      fontSize: typography.size.lg,
      fontWeight: "800",
      color: textPrimaryCol,
      textAlign: "center",
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: borderCol,
    },
    pickerRowActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pickerRowText: {
      fontSize: 15,
      fontWeight: "600",
      color: textPrimaryCol,
      flex: 1,
    },
    pickerRowTextActive: {
      color: "#ffffff",
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
      backgroundColor: isDark ? "#334155" : "#f1f5f9",
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
      height: 48,
      borderRadius: 16,
      overflow: "hidden",
    },
    logoutModalBtnCancel: {
      flex: 1,
      backgroundColor: isDark ? "#334155" : "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
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
    },
    logoutModalBtnConfirmText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#ffffff",
    },
  });
}
