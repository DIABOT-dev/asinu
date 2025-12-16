import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  version: string;
  value: T;
};

export const localCache = {
  async getCached<T>(key: string, version: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      if (parsed.version !== version) return null;
      return parsed.value;
    } catch {
      return null;
    }
  },
  async setCached<T>(key: string, version: string, value: T) {
    try {
      const envelope: CacheEnvelope<T> = { version, value };
      await AsyncStorage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
      console.warn('[localCache] setCached failed', error);
    }
  }
};
