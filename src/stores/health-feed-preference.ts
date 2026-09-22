import AsyncStorage from '@react-native-async-storage/async-storage';

export const HEALTH_FEED_ENABLED_KEY = '@asinu/health_feed_enabled';

export async function getHealthFeedPreference(): Promise<boolean> {
  return (await AsyncStorage.getItem(HEALTH_FEED_ENABLED_KEY)) !== 'false';
}

export async function setHealthFeedPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(HEALTH_FEED_ENABLED_KEY, String(enabled));
}
