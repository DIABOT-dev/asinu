import { Ionicons } from '@expo/vector-icons';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useAuthStore } from '../features/auth/auth.store';
import { authApi } from '../features/auth/auth.api';
import { ScaledText as Text } from '../components/ScaledText';
import * as Notifications from 'expo-notifications';
import {
  addNotificationResponseReceivedListener,
  checkNotificationPermission,
  getExpoPushToken,
  reNotifyAsLocal,
  requestNotificationPermissions,
  routeFromNotificationData,
  setupNotificationHandler,
} from '../lib/notifications';
import { checkinApi } from '../features/checkin/checkin.api';
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
  const authToken = useAuthStore((state) => state.token);
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  // Initial setup: permissions + bootstrap (runs once when hydrated)
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
        if (token) setExpoPushToken(token);
        else console.warn('[Session] No push token obtained — notifications will not work remotely');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, hydrated]);

  // Save push token to backend whenever token or expoPushToken changes (handles login after app open)
  useEffect(() => {
    if (!authToken || !expoPushToken) return;
    authApi.updatePushToken(expoPushToken)
      .then(() => { if (__DEV__) console.log('[Session] Push token saved to server'); })
      .catch(() => {});
  }, [authToken, expoPushToken]);

  // When a caregiver_alert / emergency push arrives in foreground, re-display it
  // as a local notification so that ACKNOWLEDGE / CALL action buttons appear.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      const type = data?.type as string | undefined;
      if (type === 'caregiver_alert' || type === 'emergency') {
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';
        reNotifyAsLocal(title, body, data);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Notification deep link routing ──
  // Logic dùng chung ở src/lib/notifications.ts (routeFromNotificationData)
  // để in-app NotificationBell và push handler luôn route nhất quán.
  const handleNotificationRoute = useCallback((data: Record<string, unknown>) => {
    const route = routeFromNotificationData(data);
    if (!route) {
      router.push('/(tabs)/home');
      return;
    }
    if (typeof route === 'string') router.push(route as any);
    else router.push(route as any);
  }, []);

  // Handle notification taps: deep link + action buttons (warm start)
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as Record<string, unknown>;

      // Action buttons on caregiver alert push notification
      if (actionIdentifier === 'ACKNOWLEDGE') {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId) checkinApi.confirmAlert(alertId, 'seen').catch(() => {});
        return;
      }
      if (actionIdentifier === 'ON_MY_WAY') {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId) checkinApi.confirmAlert(alertId, 'on_my_way').catch(() => {});
        return;
      }
      if (actionIdentifier === 'CALL') {
        const alertId = data?.alertId ? Number(data.alertId) : null;
        if (alertId) checkinApi.confirmAlert(alertId, 'called').catch(() => {});
        const phone = data?.patientPhone as string;
        if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
        return;
      }

      // Default tap → deep link
      if (actionIdentifier === 'expo.modules.notifications.actions.DEFAULT') {
        handleNotificationRoute(data);
      }
    });
    return () => sub.remove();
  }, [handleNotificationRoute]);

  // Cold-start deep link is handled in app/index.tsx (splash) — splash đã đợi
  // bootstrap xong rồi mới redirect, nên check notification ở đó tránh
  // race-condition với router.replace('/(tabs)/home') của splash.

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

  const profile = useAuthStore((state) => state.profile);
  const value = useMemo(() => ({ ready: !loading && hydrated }), [loading, hydrated]);

  // Block app until permission is granted
  if (hydrated && notificationGranted === false) {
    return (
      <SessionContext.Provider value={value}>
        <NotificationPermissionGate />
      </SessionContext.Provider>
    );
  }

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
