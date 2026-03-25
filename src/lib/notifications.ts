// Push notification service for care circle invitations
// Note: This requires expo-notifications to be installed
// Run: npx expo install expo-notifications

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { useNotificationStore } from '../stores/notification.store';

/**
 * Initialize the notification handler. Must be called explicitly (e.g. inside
 * a useEffect or app bootstrap) — NOT at module level — so that the native
 * module is only accessed after the runtime is ready. On runtimes that don't
 * support expo-notifications (e.g. Expo Go without the native module) the call
 * is silently skipped to prevent an Invariant Violation crash.
 */
export function setupNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {

  }
}

/**
 * Đăng ký notification categories với action buttons.
 * - health_alert: nút "Đã xem" hiện ngay trên notification để xác nhận cảnh báo
 * Phải gọi sau khi đã được cấp quyền notification.
 */
export async function registerNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('health_alert', [
      {
        identifier: 'ACKNOWLEDGE',
        buttonTitle: '✓ Đã xem',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'CALL',
        buttonTitle: '📞 Gọi ngay',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false,
          opensAppToForeground: true,
        },
      },
    ]);
  } catch (e) {
    // Silently ignore on platforms that don't support categories
  }
}

export interface NotificationData {
  type: 'care_circle_invitation' | 'care_circle_accepted' | 'alert' | 'message' | 'engagement';
  invitationId?: string;
  senderId?: string;
  senderName?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {

      return false;
    }

    // For Android, set notification channels — each with its own sound
    if (Platform.OS === 'android') {
      // Nhắc nhở hàng ngày: log sáng/tối, uống nước, thuốc
      await Notifications.setNotificationChannelAsync('reminder', {
        name: 'Nhắc nhở sức khoẻ',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#08b8a2',
        sound: 'asinu_reminder.wav',
      });

      // Cảnh báo sức khoẻ: chỉ số bất thường, leo thang
      await Notifications.setNotificationChannelAsync('alert', {
        name: 'Cảnh báo sức khoẻ',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#FF6B6B',
        sound: 'asinu_alert.wav',
      });

      // Vòng kết nối: mời / chấp nhận kết nối
      await Notifications.setNotificationChannelAsync('care-circle', {
        name: 'Vòng kết nối',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 100, 250],
        lightColor: '#6B8FFF',
        sound: 'asinu_care.wav',
      });

      // Daily health check-in
      await Notifications.setNotificationChannelAsync('checkin', {
        name: 'Check-in sức khoẻ',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 100, 300],
        lightColor: '#08b8a2',
        sound: 'asinu_reminder.wav',
      });

      // Milestone / weekly recap
      await Notifications.setNotificationChannelAsync('milestone', {
        name: 'Thành tích',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100, 50, 100, 50, 200],
        lightColor: '#FFD700',
        sound: 'asinu_milestone.wav',
      });
    }

    // Đăng ký action buttons trên notification
    await registerNotificationCategories();

    return true;
  } catch (error) {

    return false;
  }
}

/**
 * Get the push notification token (Expo push token)
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Skip the Constants.isDevice check — it's unreliable in dev builds.
    // Instead just attempt to get the token; it will fail naturally on web/unsupported.
    if (Platform.OS === 'web') {
      console.warn('[PushToken] Web platform — skipping');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[PushToken] No projectId found in expoConfig.extra.eas');
      return null;
    }

    if (__DEV__) console.log('[PushToken] Requesting token with projectId:', projectId);
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    if (__DEV__) console.log('[PushToken] Got token:', token.data);
    return token.data;
  } catch (error) {
    console.error('[PushToken] Error getting push token:', error);
    return null;
  }
}

/**
 * Schedule a local notification (useful for testing or offline scenarios)
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'asinu_reminder.wav',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (error) {

  }
}

/**
 * Add a listener for when notifications are received while app is in foreground
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    // Add to notification store
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      title: notification.request.content.title || i18n.t('notification'),
      body: notification.request.content.body || '',
      data: notification.request.content.data,
    });
    
    // Call custom callback
    callback(notification);
  });
  
  return subscription;
}

/**
 * Add a listener for when user taps on a notification
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the number of pending notifications
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {

    return 0;
  }
}

/**
 * Set the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {

  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {

  }
}
