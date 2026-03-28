import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { showToast, setPendingToast } from '../../src/stores/toast.store';
const DeleteAccountModal = React.lazy(() => import('../../src/components/DeleteAccountModal'));
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { authApi } from '../../src/features/auth/auth.api';
import { apiClient } from '../../src/lib/apiClient';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../src/features/notifications/notifications.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { getExpoPushToken, requestNotificationPermissions, clearAllNotifications } from '../../src/lib/notifications';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { AppLanguage, useLanguageStore } from '../../src/stores/language.store';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { colors, iconColors, spacing } from '../../src/styles';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; iconSize: number }> = [
  { value: 'small',   iconSize: 16 },
  { value: 'normal',  iconSize: 20 },
  { value: 'large',   iconSize: 24 },
  { value: 'xlarge',  iconSize: 28 },
];

const STORAGE_KEY_NOTIFICATIONS = '@app/notifications_enabled';
const STORAGE_KEY_REMINDERS = '@app/reminders_enabled';

export default function SettingsScreen() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const logout = useAuthStore((state) => state.logout);
  const { scale, setScale } = useFontSizeStore();
  const { colors, isDark } = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(), [isDark]);
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [schedulePrefs, setSchedulePrefs] = useState<NotificationPreferences | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const padTop = insets.top + spacing.lg;

  const screenOptions = useMemo(() => ({
    headerShown: true,
    title: t('title'),
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginLeft: 0 }}>
        <Ionicons name="arrow-back" size={26} color={iconColors.primary} />
      </TouchableOpacity>
    ),
  }), [router, t]);

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
    loadSchedulePrefs();
  }, []);

  const loadPreferences = async () => {
    try {
      const [notifPref, reminderPref] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEY_REMINDERS)
      ]);
      
      if (notifPref !== null) setNotifications(notifPref === 'true');
      if (reminderPref !== null) setReminders(reminderPref === 'true');
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedulePrefs = async () => {
    try {
      const prefs = await getNotificationPreferences();
      if (prefs.ok) {
        setSchedulePrefs(prefs);
        // Sync reminders toggle from backend (authoritative source)
        setReminders(prefs.reminders_enabled !== false);
      }
    } catch {}
  };


  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      // Request permission when enabling
      const hasPermission = await requestNotificationPermissions();

      if (!hasPermission) {
        showAlert(
          t('notificationPermRequired'),
          t('notificationPermDesc'),
          [
            { text: t('later'), style: 'cancel' },
            {
              text: t('openSettings'),
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }

      // Get push token and send to backend
      const token = await getExpoPushToken();
      if (token) {
        try {
          await authApi.updatePushToken(token);
        } catch (error) {
          showToast(tc('error'), 'error');
        }
      }
    }

    setNotifications(value);
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, String(value));

    // Update backend: chỉ bật/tắt nhắc nhở log & cập nhật sức khỏe
    try {
      await updateNotificationPreferences({ reminders_enabled: value });
    } catch {
      showToast(tc('error'), 'error');
    }
  };

  const handleRemindersToggle = async (value: boolean) => {
    if (value && !notifications) {
      showAlert(
        t('enableNotificationsFirst'),
        t('enableNotificationsFirstDesc'),
        [{ text: tc('ok') }]
      );
      return;
    }
    
    setReminders(value);
    await AsyncStorage.setItem(STORAGE_KEY_REMINDERS, String(value));

    // Persist to backend so cron jobs respect the setting
    try {
      await updateNotificationPreferences({ reminders_enabled: value });
    } catch {
      showToast(tc('error'), 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    setPendingToast(t('logoutSuccess'), 'success');
    router.replace('/login');
  };

  const getFontSizeLabel = (value: FontSizeScale): string => {
    const labels: Record<FontSizeScale, string> = {
      small: t('fontSmall'),
      normal: t('fontNormal'),
      large: t('fontLarge'),
      xlarge: t('fontXLarge'),
    };
    return labels[value];
  };

  const handleDeleteAccount = async () => {
    try {
      const result = await authApi.deleteAccount();
      if (result.ok) {
        // Xóa tất cả dữ liệu local
        await AsyncStorage.multiRemove([
          STORAGE_KEY_NOTIFICATIONS,
          STORAGE_KEY_REMINDERS,
          '@app/font_size_scale'
        ]);
        // Đăng xuất và điều hướng về login
        await logout();
        setShowDeleteModal(false);
        router.replace('/login');
        
        // Hiển thị thông báo sau khi đã chuyển trang
        setPendingToast(t('accountDeleted'), 'success');
      } else {
        showAlert(tc('error'), t('deleteError'));
      }
    } catch (error) {

      showAlert(tc('error'), t('deleteErrorGeneric'));
    }
  };

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={screenOptions} />
      <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: spacing.sm }]}>
        <H1SectionHeader title={t('title')} />
        
        {/* Font Size Setting */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: scaledTypography.size.md }]}>
            {t('fontSize')}
          </Text>
          <View style={styles.fontSizeOptions}>
            {FONT_SIZE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setScale(option.value)}
                style={[
                  styles.fontSizeButton,
                  scale === option.value && styles.fontSizeButtonActive
                ]}
              >
                <MaterialCommunityIcons
                  name="format-size"
                  size={option.iconSize}
                  color={scale === option.value ? '#ffffff' : iconColors.primary}
                />
                <Text
                  style={[
                    styles.fontSizeButtonText,
                    { fontSize: scaledTypography.size.sm },
                    scale === option.value && styles.fontSizeButtonTextActive
                  ]}
                >
                  {getFontSizeLabel(option.value)}
                </Text>
                {scale === option.value && (
                  <MaterialCommunityIcons name="check-circle" size={18} color="#fff" style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fontSizePreview, { fontSize: scaledTypography.size.md }]}>
            {t('fontPreview')}
          </Text>
        </View>

        {/* Language Setting */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: scaledTypography.size.md }]}>
            {t('language')}
          </Text>
          <View style={styles.fontSizeOptions}>
            {(['vi', 'en'] as AppLanguage[]).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => setLanguage(lang)}
                style={[
                  styles.fontSizeButton,
                  language === lang && styles.fontSizeButtonActive
                ]}
              >
                <Text style={{ fontSize: 22 }}>{lang === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
                <Text
                  style={[
                    styles.fontSizeButtonText,
                    { fontSize: scaledTypography.size.sm },
                    language === lang && styles.fontSizeButtonTextActive
                  ]}
                >
                  {lang === 'vi' ? t('languageVi') : t('languageEn')}
                </Text>
                {language === lang && (
                  <MaterialCommunityIcons name="check-circle" size={18} color="#fff" style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* TODO: Dark mode - tạm ẩn */}
        {/* <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{t('darkMode')}</Text>
            <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>
              {t('darkModeDesc')}
            </Text>
          </View>
          <Switch
            value={themeMode === 'dark' || (themeMode === 'system' && isDark)}
            onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
            trackColor={{ true: colors.primary }}
          />
        </View> */}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{t('notifications')}</Text>
            <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>
              {t('notificationsDesc')}
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={handleNotificationsToggle}
            disabled={isLoading}
          />
        </View>



        {/* Dev Test Button — hidden in production */}

        <Button label={t('logout')} variant="warning" onPress={() => setShowLogoutModal(true)} style={{ marginTop: spacing.xl }} />
        
        <Pressable 
          style={styles.deleteAccountButton}
          onPress={() => setShowDeleteModal(true)}
        >
          <MaterialCommunityIcons name="delete-forever" size={20} color="#ffffff" />
          <Text style={[styles.deleteAccountText, { fontSize: scaledTypography.size.sm }]}>
            {t('deleteAccountForever')}
          </Text>
        </Pressable>

        <Text style={[styles.versionText, { fontSize: scaledTypography.size.xs }]}>
          {t('version')}
        </Text>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color={colors.warning ?? '#F59E0B'} />
            </View>
            <Text style={styles.modalTitle}>{t('logoutConfirmTitle')}</Text>
            <Text style={styles.modalMessage}>{t('logoutConfirmMessage')}</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalBtnCancelText}>{tc('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={() => { setShowLogoutModal(false); handleLogout(); }}>
                <Text style={styles.modalBtnConfirmText}>{t('logout')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showDeleteModal && (
        <Suspense fallback={null}>
          <DeleteAccountModal
            visible={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteAccount}
          />
        </Suspense>
      )}
    </Screen>
    </>
  );
}

function createSettingsStyles() { return StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  section: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs
  },
  fontSizeOptions: {
    gap: spacing.sm,
  },
  fontSizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fontSizeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark
  },
  fontSizeButtonText: {
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  fontSizeButtonTextActive: {
    color: '#ffffff'
  },
  fontSizePreview: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontStyle: 'italic'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  title: {
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  },
  versionText: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textSecondary,
    width: '100%'
  },
  scheduleHint: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  scheduleRow: {
    gap: spacing.xs,
  },
  scheduleLabel: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scheduleChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalBtnConfirm: {
    backgroundColor: '#F59E0B',
  },
  modalBtnCancelText: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalBtnConfirmText: {
    fontWeight: '700',
    color: '#fff',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.danger,
    borderWidth: 0
  },
  deleteAccountText: {
    color: '#ffffff',
    fontWeight: '600'
  }
}); }
