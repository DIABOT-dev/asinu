import { Ionicons } from '@expo/vector-icons';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../features/auth/auth.store';
import { authApi } from '../features/auth/auth.api';
import { ScaledText as Text } from '../components/ScaledText';
import {
  checkNotificationPermission,
  getExpoPushToken,
  requestNotificationPermissions,
  setupNotificationHandler,
} from '../lib/notifications';
import * as Location from 'expo-location';
import { CaregiverAlertModal } from '../components/CaregiverAlertModal';
import { colors, radius, spacing } from '../styles';

// ─── Notification Gate Screen ────────────────────────────────────────────────

function NotificationPermissionGate() {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';
  const styles = useMemo(() => createGateStyles(), []);

  return (
    <SafeAreaView style={styles.gate}>
      <View style={styles.gateContent}>
        <View style={styles.gateIconWrap}>
          <Ionicons name="notifications" size={48} color={colors.primary} />
        </View>
        <Text style={styles.gateTitle}>
          {isVi ? 'Cần bật thông báo' : 'Notifications Required'}
        </Text>
        <Text style={styles.gateDesc}>
          {isVi
            ? 'Asinu cần quyền thông báo để nhắc bạn đo chỉ số sức khoẻ và theo dõi hàng ngày. Vui lòng mở Cài đặt và bật thông báo cho ứng dụng.'
            : 'Asinu needs notification permission to remind you to log health metrics and stay on track daily. Please open Settings and enable notifications for this app.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.82 }]}
          onPress={() => Linking.openSettings()}
        >
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <Text style={styles.gateBtnText}>
            {isVi ? 'Mở Cài đặt' : 'Open Settings'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Session Context ──────────────────────────────────────────────────────────

const SessionContext = createContext<{ ready: boolean }>({ ready: false });

export const useSession = () => useContext(SessionContext);

type Props = { children: ReactNode };

export const SessionProvider = ({ children }: Props) => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);

  // Initial permission request
  useEffect(() => {
    if (!hydrated) return;

    bootstrap();
    setupNotificationHandler();

    (async () => {
      const granted = await requestNotificationPermissions();
      if (__DEV__) console.log('[Session] Notification permission granted:', granted);
      setNotificationGranted(granted);
      if (granted) {
        const token = await getExpoPushToken();
        if (__DEV__) console.log('[Session] Push token result:', token ? token.substring(0, 30) + '...' : 'NULL');
        const authToken = useAuthStore.getState().token;
        if (token && authToken) {
          authApi.updatePushToken(token)
            .then(() => { if (__DEV__) console.log('[Session] Push token saved to server'); })
            .catch((err) => console.error('[Session] Failed to save push token:', err));
        } else if (!authToken) {
          if (__DEV__) console.log('[Session] Skipping push token save — user not logged in');
        } else {
          console.warn('[Session] No push token obtained — notifications will not work remotely');
        }
      }
      // Request location permission (for emergency button)
      await Location.requestForegroundPermissionsAsync().catch(() => {});
    })();
  }, [bootstrap, hydrated]);

  // Re-check when user returns from Settings
  useEffect(() => {
    if (notificationGranted !== false) return;

    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const granted = await checkNotificationPermission();
        if (granted) setNotificationGranted(true);
      }
    });
    return () => sub.remove();
  }, [notificationGranted]);

  const value = useMemo(() => ({ ready: !loading && hydrated }), [loading, hydrated]);

  // Block app until permission is granted
  if (hydrated && notificationGranted === false) {
    return (
      <SessionContext.Provider value={value}>
        <NotificationPermissionGate />
      </SessionContext.Provider>
    );
  }

  const profile = useAuthStore((state) => state.profile);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {/* Hiện modal xác nhận alert cho người thân (chỉ khi đã đăng nhập) */}
      {profile && <CaregiverAlertModal />}
    </SessionContext.Provider>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function createGateStyles() { return StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  gateIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gateDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  gateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
}); }
