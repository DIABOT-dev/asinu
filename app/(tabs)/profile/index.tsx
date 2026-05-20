import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppAlertModal, useAppAlert } from '../../../src/components/AppAlertModal';

const STORAGE_KEY_NOTIFICATIONS = '@app/notifications_enabled';
const STORAGE_KEY_REMINDERS = '@app/reminders_enabled';

const DeleteAccountModal = React.lazy(() => import('../../../src/components/DeleteAccountModal'));
const ChangePasswordModal = React.lazy(() => import('../../../src/components/ChangePasswordModal'));
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { authApi } from '../../../src/features/auth/auth.api';
import { showToast, setPendingToast } from '../../../src/stores/toast.store';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useLogsStore } from '../../../src/features/logs/logs.store';
import { useMissionsStore } from '../../../src/features/missions/missions.store';
import { FontSizeScale, useFontSizeStore } from '../../../src/stores/font-size.store';
import { AppLanguage, useLanguageStore } from '../../../src/stores/language.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { ApiError, apiClient } from '../../../src/lib/apiClient';
import { brandColors, categoryColors, colors, iconColors, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';

type SubStatus = { tier: 'free' | 'premium'; isPremium: boolean; expiresAt: string | null };

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const padTop = insets.top + spacing.lg;

  // Fetch real data from stores
  const logs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const missions = useMissionsStore((state) => state.missions);
  const fetchMissions = useMissionsStore((state) => state.fetchMissions);

  const logout = useAuthStore((state) => state.logout);
  const { scale: fontScale, setScale: setFontScale } = useFontSizeStore();
  const { language, setLanguage } = useLanguageStore();
  const { t: ts } = useTranslation('settings');

  // Edit profile state
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const fontLabel = fontScale === 'small' ? ts('fontSmall')
    : fontScale === 'normal' ? ts('fontNormal')
    : fontScale === 'large' ? ts('fontLarge')
    : ts('fontXLarge');
  const langLabel = language === 'vi' ? ts('languageVi') : ts('languageEn');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ' | ''>('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editBloodType, setEditBloodType] = useState('');
  const [editChronicDiseases, setEditChronicDiseases] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);

  // Removed dropdown - use direct input instead

  // Fetch subscription status
  useEffect(() => {
    apiClient<SubStatus>('/api/subscriptions/status')
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
      fetchLogs(controller.signal);
      fetchMissions(controller.signal);
      authApi.fetchProfile().then((fullProfile) => {
        if (fullProfile) {
          useAuthStore.setState({ profile: fullProfile });
        }
      }).catch(() => {});
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = 0; // reset throttle so focus effect re-fetches next time
    const controller = new AbortController();
    await Promise.all([
      fetchLogs(controller.signal),
      fetchMissions(controller.signal),
      authApi.fetchProfile().then((p) => { if (p) useAuthStore.setState({ profile: p }); }).catch(() => {}),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute health overview from real data
  const healthOverview = useMemo(() => {
    const latestGlucose = logs.find((log) => log.type === 'glucose');
    const latestBP = logs.find((log) => log.type === 'blood-pressure');
    
    const glucoseText = latestGlucose?.value
      ? `${latestGlucose.value} mg/dL`
      : tc('noData');
    
    const bpText = latestBP?.systolic && latestBP?.diastolic
      ? `${latestBP.systolic}/${latestBP.diastolic} mmHg`
      : tc('noData');
    
    const activeMissions = missions.filter((m) => m.status === 'active');
    const todayTasksText = activeMissions.length > 0
      ? t('activeMissions', { count: activeMissions.length })
      : t('noMissions');
    
    // Check glucose level status
    const glucoseValue = latestGlucose?.value;
    let glucoseStatus: 'normal' | 'warning' | 'danger' = 'normal';
    if (glucoseValue) {
      if (glucoseValue > 180 || glucoseValue < 70) glucoseStatus = 'danger';
      else if (glucoseValue > 140 || glucoseValue < 80) glucoseStatus = 'warning';
    }
    
    return { glucoseText, bpText, todayTasksText, glucoseStatus };
  }, [logs, missions]);

  const name = profile?.name?.trim() ?? '';
  const phone = profile?.phone?.trim() ?? '';
  const hasProfile = Boolean(profile);
  const identityTitle = hasProfile
    ? name || tc('notUpdated')
    : phone
      ? t('newCustomer')
      : t('notLoggedIn');
  const statusText = hasProfile ? t('active') : t('notLoggedIn');

  const handleShareApp = useCallback(async () => {
    try {
      await Share.share({ message: t('shareMessage'), title: 'Asinu' });
    } catch {
      // ignore — user cancelled
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    setShowLogoutModal(false);
    await logout();
    setPendingToast(t('logoutSuccess'), 'success');
    router.replace('/login');
  }, [logout, t, router]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      const result = await authApi.deleteAccount();
      if (result.ok) {
        await AsyncStorage.multiRemove([STORAGE_KEY_NOTIFICATIONS, STORAGE_KEY_REMINDERS, '@app/font_size_scale']);
        await logout();
        setShowDeleteModal(false);
        router.replace('/login');
        setPendingToast(ts('accountDeleted'), 'success');
      } else {
        showAlert(tc('error'), ts('deleteError'));
      }
    } catch {
      showAlert(tc('error'), ts('deleteErrorGeneric'));
    }
  }, [logout, router, showAlert, ts, tc]);

  const handleEditProfile = () => {
    setPhoneError('');
    setEditName(name);
    setEditPhone(phone);
    setEditAge(profile?.age ? String(Math.round(profile.age)) : '');
    setEditGender((profile?.gender as 'Nam' | 'Nữ' | '') || '');
    setEditHeight(profile?.heightCm ? String(Math.round(profile.heightCm)) : '');
    setEditWeight(profile?.weightKg ? String(Math.round(profile.weightKg)) : '');
    setEditBloodType(profile?.bloodType || '');
    setEditChronicDiseases(profile?.chronicDiseases?.join(', ') || '');
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast(t('nameRequired'), 'error');
      return;
    }

    if (editHeight && (isNaN(parseFloat(editHeight)) || parseFloat(editHeight) <= 0)) {
      showToast(t('heightPositive'), 'error');
      return;
    }

    if (editWeight && (isNaN(parseFloat(editWeight)) || parseFloat(editWeight) <= 0)) {
      showToast(t('weightPositive'), 'error');
      return;
    }

    if (editAge && (isNaN(Number(editAge)) || Number(editAge) <= 0 || Number(editAge) > 150)) {
      showToast(t('ageValid'), 'error');
      return;
    }

    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (editBloodType && !validBloodTypes.includes(editBloodType)) {
      showToast(t('bloodTypeInvalid'), 'error');
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
      // Always send chronicDiseases (even empty array) so clearing works
      updateData.chronicDiseases = editChronicDiseases.trim()
        ? editChronicDiseases.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : [];

      const updatedProfile = await authApi.updateProfile(updateData);
      useAuthStore.setState({ profile: updatedProfile });
      
      handleCloseEditModal();
      showToast(t('profileUpdated'), 'success');
    } catch (error) {

      if (error instanceof ApiError && error.statusCode === 409) {
        setPhoneError(t('phoneAlreadyUsed'));
      } else {
        showToast((error as Error).message || t('profileUpdateError'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { glucoseText, bpText, todayTasksText, glucoseStatus } = healthOverview; // (deprecated — health overview section đã bỏ)

  return (
    <Screen>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderCard}
        >
          {/* Decorative blob top-right cho depth */}
          <View pointerEvents="none" style={styles.profileDecorBlob} />

          {/* Top row: avatar + greeting + name + status */}
          <View style={styles.profileTopRow}>
            <View style={styles.profileAvatarBig}>
              <MaterialCommunityIcons name="account-circle" size={62} color="rgba(255,255,255,0.95)" />
              {/* Live status dot ở góc dưới phải avatar */}
              <View style={styles.profileLiveDot} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md, minWidth: 0 }}>
              <Text style={styles.profileGreetingTop}>{t('greeting')}</Text>
              <Text style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{identityTitle}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <View style={styles.profileLiveTextDot} />
                <Text style={styles.profileStatus}>{statusText}</Text>
              </View>
            </View>
          </View>

          {/* Bottom row: plan pill (left) + member-since stat (right) */}
          <View style={styles.profileBottomRow}>
            <TouchableOpacity
              style={[styles.planChipNew, subStatus?.isPremium ? styles.planChipPremium : styles.planChipFree, !subStatus && { opacity: 0 }]}
              onPress={() => setShowPlanInfoModal(true)}
              activeOpacity={0.8}
              disabled={!subStatus}
            >
              <MaterialCommunityIcons
                name={subStatus?.isPremium ? 'crown' : 'shield-account-outline'}
                size={14}
                color={subStatus?.isPremium ? colors.premiumDark : 'rgba(255,255,255,0.95)'}
              />
              <Text style={[styles.planChipText, subStatus?.isPremium ? styles.planChipTextPremium : styles.planChipTextFree]}>
                {(t('accountType') || 'Tài khoản') + ': '}{subStatus?.isPremium ? t('planPremium') : t('planFree')}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={subStatus?.isPremium ? colors.premiumDark : 'rgba(255,255,255,0.85)'}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        </Animated.View>

        {/* Plan Info Modal — quyền lợi free / premium */}
        <Modal
          visible={showPlanInfoModal}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowPlanInfoModal(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
            onPress={() => setShowPlanInfoModal(false)}
          >
            <Pressable
              style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, gap: spacing.md }}
              onPress={() => {}}
            >
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: subStatus?.isPremium ? colors.premiumLight : colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons
                    name={subStatus?.isPremium ? 'crown' : 'shield-account-outline'}
                    size={28}
                    color={subStatus?.isPremium ? colors.premiumDark : colors.primary}
                  />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>
                  {subStatus?.isPremium ? (t('planPremium') || 'Premium') : (t('planFree') || 'Miễn phí')}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  {subStatus?.isPremium
                    ? (t('planPremiumDesc') || 'Bạn đang sử dụng đầy đủ tính năng cao cấp')
                    : (t('planFreeDesc') || 'Bạn đang dùng bản miễn phí với các tính năng cơ bản')}
                </Text>
              </View>

              {/* Benefit list — actual spec từ product team */}
              <View style={{ gap: 8, marginTop: 4 }}>
                {(subStatus?.isPremium
                  ? [
                      { icon: 'check-circle', text: 'Vòng kết nối: tối đa 3 người' },
                      { icon: 'check-circle', text: 'Chat AI Asinu: không giới hạn' },
                      { icon: 'check-circle', text: 'Lịch sử log: lưu toàn bộ' },
                      { icon: 'check-circle', text: 'Check-in sức khoẻ hàng ngày' },
                      { icon: 'check-circle', text: 'Cảnh báo khẩn cấp 115 (SOS)' },
                      { icon: 'check-circle', text: 'Ghi log đường huyết, huyết áp, cân nặng' },
                    ]
                  : [
                      { icon: 'check', text: 'Vòng kết nối: 1 người' },
                      { icon: 'check', text: 'Chat AI Asinu: 1.000 tin nhắn / tháng' },
                      { icon: 'check', text: 'Lịch sử log: 30 ngày' },
                      { icon: 'check', text: 'Check-in sức khoẻ hàng ngày' },
                      { icon: 'check', text: 'Cảnh báo khẩn cấp 115 (SOS)' },
                      { icon: 'check', text: 'Ghi log đường huyết, huyết áp, cân nặng' },
                    ]
                ).map((b, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                    <MaterialCommunityIcons
                      name={b.icon as any}
                      size={18}
                      color={subStatus?.isPremium ? colors.premium : colors.success}
                    />
                    <Text style={{ flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600' }}>
                      {b.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.surfaceMuted }}
                  onPress={() => setShowPlanInfoModal(false)}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>{tc('close') || 'Đóng'}</Text>
                </Pressable>
                {!subStatus?.isPremium && (
                  <Pressable
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.premium }}
                    onPress={() => { setShowPlanInfoModal(false); router.push('/subscription'); }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('upgradePremium') || 'Nâng cấp Premium'}</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* User Info Card */}
        <Animated.View entering={FadeIn.delay(80).duration(350)}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={22} color={iconColors.primary} />
          <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
        </View>
        <View style={styles.infoList}>
          {hasProfile ? (
            <>
              {/* "Họ tên" field bỏ — đã hiển thị to trong hero card phía trên,
                  tránh duplicate. Nếu cần edit tên → vào edit profile screen. */}

              <View style={styles.infoItemCard}>
                <Ionicons name="call-outline" size={22} color={iconColors.emerald} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('phone')}</Text>
                  <Text style={styles.infoValue}>{phone || tc('notUpdated')}</Text>
                </View>
              </View>

              {profile?.gender ? (
                <View style={styles.infoItemCard}>
                  <Ionicons
                    name={profile.gender === 'Nam' ? 'male-outline' : 'female-outline'}
                    size={22}
                    color={profile.gender === 'Nam' ? iconColors.glucose : iconColors.pink}
                    style={styles.infoIcon}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('gender')}</Text>
                    <Text style={styles.infoValue}>{profile.gender === 'Nam' ? tc('male') : tc('female')}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.age ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="cake-variant-outline" size={22} color={iconColors.premium} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('age')}</Text>
                    <Text style={styles.infoValue}>{Math.round(profile.age)} {t('ageUnit')}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.heightCm ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="human-male-height" size={22} color={iconColors.violet} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('height')}</Text>
                    <Text style={styles.infoValue}>{t('heightValue', { value: Math.round(profile.heightCm) })}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.weightKg ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="scale-bathroom" size={22} color={iconColors.cyan} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('weight')}</Text>
                    <Text style={styles.infoValue}>{t('weightValue', { value: Math.round(profile.weightKg) })}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.bloodType ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="water-outline" size={22} color={iconColors.danger} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('bloodType')}</Text>
                    <Text style={styles.infoValue}>{profile.bloodType}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.chronicDiseases && profile.chronicDiseases.length > 0 ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="medical-bag" size={22} color={iconColors.orange} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('chronicDiseases')}</Text>
                    <Text style={styles.infoValue}>{profile.chronicDiseases.join(', ')}</Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : phone ? (
            <View style={styles.infoItemCard}>
              <Ionicons name="call-outline" size={22} color={iconColors.emerald} style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone')}</Text>
                <Text style={styles.infoValue}>{phone}</Text>
              </View>
            </View>
          ) : null}
        </View>
        </Animated.View>

        {/* Quick Actions — grouped by purpose */}
        <Animated.View entering={FadeIn.delay(160).duration(350)}>
        <View style={styles.sectionHeader}>
          <Ionicons name="apps-outline" size={22} color={iconColors.warning} />
          <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        </View>
        {([
          {
            title: t('sectionPersonal'),
            items: [
              { icon: 'create-outline', color: iconColors.indigo, label: t('editProfile'),     onPress: handleEditProfile },
              { icon: 'alarm-outline',  color: iconColors.orange, label: tc('reminderConfig'), onPress: () => router.push('/reminder-config') },
            ],
          },
          {
            title: t('sectionHealth'),
            items: [
              { icon: 'journal-outline',   color: iconColors.pink,    label: t('logEntry'),                       onPress: () => router.push('/logs') },
              { icon: 'bookmark-outline',  color: iconColors.violet,  label: tc('aiNotes'),                       onPress: () => router.push('/chat-notes') },
              { icon: 'flag-outline',      color: iconColors.emerald, label: t('tabMissions', { ns: 'common' }),  onPress: () => router.push('/(tabs)/missions' as any) },
            ],
          },
          {
            title: t('sectionAccount'),
            items: [
              { icon: 'star-outline',      color: iconColors.premium, label: t('subscription'), onPress: () => router.push('/subscription') },
              { icon: 'wallet-outline',    color: iconColors.cyan,    label: t('wallet'),       onPress: () => router.push('/wallet') },
            ],
          },
          {
            title: ts('title'),
            items: [
              { icon: 'text-outline',     color: iconColors.cyan,    label: ts('fontSize'), meta: fontLabel, onPress: () => setShowFontPicker(true) },
              { icon: 'language-outline', color: iconColors.emerald, label: ts('language'), meta: langLabel, onPress: () => setShowLangPicker(true) },
            ],
          },
          {
            title: t('sectionSystem'),
            items: [
              { icon: 'chatbubble-ellipses-outline', color: iconColors.primary, label: ts('helpSupport'),
                onPress: () => Linking.openURL('https://zalo.me/0898888917') },
              ...(profile?.hasPassword ? [{
                icon: 'key-outline', color: iconColors.indigo, label: t('changePassword'),
                onPress: () => setShowChangePasswordModal(true),
              }] : []),
              { icon: 'share-social-outline', color: iconColors.primary, label: t('shareApp'),
                onPress: handleShareApp },
              { icon: 'document-text-outline', color: iconColors.violet,  label: ts('termsPrivacy'),
                onPress: () => router.push({ pathname: '/legal/content', params: { type: 'terms' } } as any) },
              { icon: 'trash-outline',         color: '#dc2626',          label: ts('deleteAccountForever'), destructive: true,
                onPress: () => setShowDeleteModal(true) },
            ],
          },
        ] as Array<{ title: string; items: Array<{ icon: string; color: string; label: string; meta?: string; onPress?: () => void; destructive?: boolean }> }>).map((group) => (
          <View key={group.title} style={styles.actionGroup}>
            <Text style={styles.subSectionTitle}>{group.title}</Text>
            <View style={styles.quickActionsGrid}>
              {group.items.map((item, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.actionCard,
                    item.destructive && styles.actionCardDestructive,
                    pressed && styles.actionCardPressed,
                  ]}
                  onPress={item.onPress}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={item.color}
                    style={styles.actionIcon}
                  />
                  <Text
                    style={[
                      styles.actionLabel,
                      item.destructive && { color: '#dc2626', fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {item.label}
                  </Text>
                  {item.meta ? <Text style={styles.actionMeta} numberOfLines={1}>{item.meta}</Text> : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.actionChevron} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        </Animated.View>

        {/* Đăng xuất — destructive action ở cuối Profile (pattern Facebook/Zalo) */}
        <Animated.View entering={FadeIn.delay(220).duration(350)}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowLogoutModal(true)}
          >
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={styles.logoutBtnText}>{t('logout')}</Text>
          </Pressable>
        </Animated.View>
      </RippleRefreshScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingTop: insets.top + spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('editProfileTitle')}</Text>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="person-outline" size={16} color={iconColors.primary} />
                  <Text style={styles.inputLabel}>{t('fullName')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('enterName')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="call-outline" size={16} color={iconColors.emerald} />
                  <Text style={styles.inputLabel}>{t('phone')}</Text>
                </View>
                <TextInput
                  style={[styles.input, phoneError ? styles.inputError : null]}
                  value={editPhone}
                  onChangeText={(text) => { setEditPhone(text); setPhoneError(''); }}
                  placeholder={t('enterPhone')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
                {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <FontAwesome5 name="birthday-cake" size={14} color={iconColors.premium} />
                  <Text style={styles.inputLabel}>{t('age')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editAge}
                  onChangeText={setEditAge}
                  placeholder={t('enterAge')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="male-female" size={16} color={iconColors.violet} />
                  <Text style={styles.inputLabel}>{t('gender')}</Text>
                </View>
                <View style={styles.genderButtonsRow}>
                  <Pressable
                    style={[styles.genderButton, editGender === 'Nam' && styles.genderButtonActive]}
                    onPress={() => setEditGender('Nam')}
                  >
                    <Ionicons 
                      name="male" 
                      size={20} 
                      color={editGender === 'Nam' ? '#fff' : categoryColors.glucose}
                    />
                    <Text style={[styles.genderButtonText, editGender === 'Nam' && styles.genderButtonTextActive]}>{tc('male')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.genderButton, editGender === 'Nữ' && styles.genderButtonActive]}
                    onPress={() => setEditGender('Nữ')}
                  >
                    <Ionicons 
                      name="female" 
                      size={20} 
                      color={editGender === 'Nữ' ? '#fff' : brandColors.pink} 
                    />
                    <Text style={[styles.genderButtonText, editGender === 'Nữ' && styles.genderButtonTextActive]}>{tc('female')}</Text>
                  </Pressable>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="human-male-height" size={16} color={iconColors.cyan} />
                  <Text style={styles.inputLabel}>{t('heightCm')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editHeight}
                  onChangeText={setEditHeight}
                  placeholder={t('enterHeight')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="scale-bathroom" size={16} color={iconColors.weight} />
                  <Text style={styles.inputLabel}>{t('weightKg')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  placeholder={t('enterWeight')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <FontAwesome5 name="tint" size={14} color={iconColors.danger} />
                  <Text style={styles.inputLabel}>{t('bloodType')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editBloodType}
                  onChangeText={setEditBloodType}
                  placeholder={t('bloodTypeExample')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="medical-bag" size={16} color={iconColors.medication} />
                  <Text style={styles.inputLabel}>{t('chronicDiseases')}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  value={editChronicDiseases}
                  onChangeText={setEditChronicDiseases}
                  placeholder={t('chronicDiseasesExample')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={handleCloseEditModal}>
                <Text style={styles.cancelButtonText}>{tc('cancel')}</Text>
              </Pressable>
              <Pressable 
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={isSaving ? ['#9ca3af', '#9ca3af'] : [colors.primary, colors.primaryDark]}
                  style={styles.saveButtonGradient}
                >
                  {isSaving ? (
                    <Text style={styles.saveButtonText}>{tc('saving')}</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>{tc('save')}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Font Size Picker */}
      <Modal visible={showFontPicker} transparent animationType="fade" onRequestClose={() => setShowFontPicker(false)}>
        <Pressable style={styles.logoutModalOverlay} onPress={() => setShowFontPicker(false)}>
          <Pressable style={styles.logoutModalCard} onPress={() => {}}>
            <Text style={styles.logoutModalTitle}>{ts('fontSize')}</Text>
            <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.md }}>
              {(['small', 'normal', 'large', 'xlarge'] as FontSizeScale[]).map((size) => {
                const label = size === 'small' ? ts('fontSmall') : size === 'normal' ? ts('fontNormal') : size === 'large' ? ts('fontLarge') : ts('fontXLarge');
                const active = fontScale === size;
                return (
                  <Pressable
                    key={size}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => { setFontScale(size); setShowFontPicker(false); }}
                  >
                    <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>{label}</Text>
                    {active ? <Ionicons name="checkmark" size={20} color="#ffffff" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Language Picker */}
      <Modal visible={showLangPicker} transparent animationType="fade" onRequestClose={() => setShowLangPicker(false)}>
        <Pressable style={styles.logoutModalOverlay} onPress={() => setShowLangPicker(false)}>
          <Pressable style={styles.logoutModalCard} onPress={() => {}}>
            <Text style={styles.logoutModalTitle}>{ts('language')}</Text>
            <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.md }}>
              {(['vi', 'en'] as AppLanguage[]).map((lang) => {
                const active = language === lang;
                return (
                  <Pressable
                    key={lang}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => { setLanguage(lang); setShowLangPicker(false); }}
                  >
                    <Text style={{ fontSize: 18, marginRight: 6 }}>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
                    <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive, { flex: 1 }]}>
                      {lang === 'vi' ? ts('languageVi') : ts('languageEn')}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={20} color="#ffffff" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Account Modal — lazy load, only renders when user opens it */}
      {showDeleteModal && (
        <Suspense fallback={null}>
          <DeleteAccountModal
            visible={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteAccount}
          />
        </Suspense>
      )}

      {/* Change Password Modal — lazy load */}
      {showChangePasswordModal && (
        <Suspense fallback={null}>
          <ChangePasswordModal
            visible={showChangePasswordModal}
            onClose={() => setShowChangePasswordModal(false)}
          />
        </Suspense>
      )}

      <AppAlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onDismiss={dismissAlert}
      />

      {/* Logout Confirm Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={styles.logoutModalOverlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={styles.logoutModalCard} onPress={() => {}}>
            <View style={styles.logoutModalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color="#dc2626" />
            </View>
            <Text style={styles.logoutModalTitle}>{t('logoutConfirmTitle')}</Text>
            <Text style={styles.logoutModalMessage}>{t('logoutConfirmMessage')}</Text>
            <View style={styles.logoutModalActions}>
              <Pressable
                style={[styles.logoutModalBtn, styles.logoutModalBtnCancel]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutModalBtnCancelText}>{tc('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.logoutModalBtn, styles.logoutModalBtnConfirm]}
                onPress={handleLogout}
              >
                <Text style={styles.logoutModalBtnConfirmText}>{t('logout')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  // Profile Header
  profileHeaderCard: {
    borderRadius: 28,
    padding: spacing.lg,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  profileDecorBlob: {
    position: 'absolute',
    top: -40,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatarBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileLiveDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  profileLiveTextDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  profileGreetingTop: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500' as const,
  },
  profileBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: spacing.md,
  },
  planChipNew: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 2
  },
  profileName: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  profileStatus: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500' as const,
  },
  planChip: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planChipFree: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  planChipPremium: {
    backgroundColor: colors.premiumLight,
    borderWidth: 1.5,
    borderColor: colors.premium,
  },
  planChipText: {
    fontSize: typography.size.xs,
    fontWeight: '700',
  },
  planChipTextFree: {
    color: 'rgba(255,255,255,0.95)',
  },
  planChipTextPremium: {
    color: colors.premiumDark,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Info Card
  infoList: {
    gap: spacing.sm,
  },
  infoItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoIcon: {
    flexShrink: 0,
    width: 28,
    textAlign: 'center',
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: 2
  },
  infoValue: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Action meta (current value next to chevron)
  actionMeta: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  // Picker rows (inside font/lang modal)
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickerRowActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerRowText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  pickerRowTextActive: {
    color: '#ffffff',
  },
  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#dc2626',
  },
  logoutBtnText: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: '#dc2626',
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoutModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  logoutModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoutModalTitle: {
    fontSize: typography.size.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  logoutModalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutModalBtnCancel: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutModalBtnConfirm: {
    backgroundColor: '#dc2626',
  },
  logoutModalBtnCancelText: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  logoutModalBtnConfirmText: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Quick Actions
  actionGroup: {
    marginBottom: spacing.lg,
  },
  subSectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  quickActionsGrid: {
    gap: spacing.sm
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  actionCardPressed: {
    opacity: 0.75,
  },
  actionCardDestructive: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  actionIcon: {
    flexShrink: 0,
    width: 26,
    textAlign: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary
  },
  actionChevron: {
    flexShrink: 0,
  },
  // Health Cards
  healthCardsGrid: {
    gap: spacing.md
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  healthCardGlucose: {
    borderColor: categoryColors.glucose + '40',
    backgroundColor: categoryColors.glucoseBg,
  },
  healthCardBP: {
    borderColor: categoryColors.bloodPressure + '30',
    backgroundColor: categoryColors.bloodPressureBg,
  },
  healthCardMissions: {
    borderColor: colors.emerald + '40',
    backgroundColor: colors.emeraldLight,
  },
  healthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  healthCardTitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  healthCardValue: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary
  },
  healthValueWarning: {
    color: colors.premium
  },
  healthValueDanger: {
    color: colors.danger
  },
  healthAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  healthAlertText: {
    fontSize: typography.size.xs,
    fontWeight: '600'
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.textPrimary
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  inputLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  genderButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  genderButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  genderButtonTextActive: {
    color: '#fff'
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.background
  },
  inputError: {
    borderColor: colors.danger
  },
  fieldError: {
    fontSize: typography.size.sm,
    color: colors.danger,
    marginTop: spacing.xs
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center'
  },
  cancelButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textSecondary
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden'
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md
  },
  saveButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff'
  },
  textAreaInput: {
    minHeight: 80,
    paddingTop: spacing.md
  },
});
}
