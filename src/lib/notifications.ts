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
    console.warn('[notifications] setNotificationHandler failed (Expo Go?):', e);
  }
}

export interface NotificationData {
  type: 'care_circle_invitation' | 'care_circle_accepted' | 'alert' | 'message';
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
      console.warn('Notification permission not granted');
      return false;
    }

    // For Android, set notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('care-circle', {
        name: 'Care Circle',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get the push notification token (Expo push token)
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Check if running on a physical device
    if (!Constants.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('No project ID found in app config');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    console.log('Expo push token:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
}

/**
 * Schedule a local notification (useful for testing or offline scenarios)
 */
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
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error scheduling local notification:', error);
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
    console.error('Error getting badge count:', error);
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
    console.error('Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}
