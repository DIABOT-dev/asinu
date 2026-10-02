import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../features/notifications/notifications.api';

export const HEALTH_FEED_ENABLED_KEY = '@asinu/health_feed_enabled';

export async function getHealthFeedPreference(): Promise<boolean> {
  const cachedValue = (await AsyncStorage.getItem(HEALTH_FEED_ENABLED_KEY)) !== 'false';

  try {
    const preferences = await getNotificationPreferences();
    if (!preferences.ok) return cachedValue;

    const enabled = preferences.health_feed_enabled !== false;
    await AsyncStorage.setItem(HEALTH_FEED_ENABLED_KEY, String(enabled));
    return enabled;
  } catch {
    return cachedValue;
  }
}

export async function setHealthFeedPreference(enabled: boolean): Promise<boolean> {
  const preferences = await updateNotificationPreferences({
    health_feed_enabled: enabled,
  });
  if (!preferences.ok) {
    throw new Error(preferences.error || 'Unable to update Health Feed preference');
  }

  const savedValue = preferences.health_feed_enabled !== false;
  await AsyncStorage.setItem(HEALTH_FEED_ENABLED_KEY, String(savedValue));
  return savedValue;
}
