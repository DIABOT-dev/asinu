import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_KEYS } from './cacheKeys';

type CacheEnvelope<T> = {
  version: string;
  value: T;
};

let _userId: string | null = null;

const ALL_CACHE_KEYS = Object.values(CACHE_KEYS);

export const localCache = {
  setUserId(userId: string | null) {
    if (_userId && _userId !== userId) {
      // Remove cached data for the previous user
      const oldId = _userId;
      const keysToRemove = ALL_CACHE_KEYS.map((k) => `${oldId}:${k}`);
      AsyncStorage.multiRemove(keysToRemove).catch(() => {});
    }
    _userId = userId;
  },
  async getCached<T>(key: string, version: string): Promise<T | null> {
    try {
      const scopedKey = _userId ? `${_userId}:${key}` : key;
      const raw = await AsyncStorage.getItem(scopedKey);
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
      const scopedKey = _userId ? `${_userId}:${key}` : key;
      const envelope: CacheEnvelope<T> = { version, value };
      await AsyncStorage.setItem(scopedKey, JSON.stringify(envelope));
    } catch {
      // ignore
    }
  },
  async removeCached(key: string) {
    try {
      const scopedKey = _userId ? `${_userId}:${key}` : key;
      await AsyncStorage.removeItem(scopedKey);
    } catch {
      // ignore
    }
  }
};
