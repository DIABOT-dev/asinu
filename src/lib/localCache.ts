import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { CACHE_KEYS } from './cacheKeys';

type CacheEnvelope<T> = {
  version: string;
  value: T;
};

let _userId: string | null = null;

const ALL_CACHE_KEYS = Object.values(CACHE_KEYS);

function secureKey(key: string): string {
  return `asinu_cache_${encodeURIComponent(key)}`;
}

/** Remove sensitive cache values written by older app versions. */
async function clearLegacyPlaintextCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sensitiveKeys = keys.filter(
      (key) =>
        key === 'auth-storage' ||
        key === 'wellness-store' ||
        key === 'care_pulse_v1' ||
        ALL_CACHE_KEYS.some((cacheKey) => key === cacheKey || key.endsWith(`:${cacheKey}`))
    );
    if (sensitiveKeys.length) await AsyncStorage.multiRemove(sensitiveKeys);
  } catch {
    // A failed cleanup must not make the app write new plaintext data.
  }
}

export const localCache = {
  clearLegacyPlaintextCache,
  setUserId(userId: string | null) {
    if (_userId && _userId !== userId) {
      // Remove cached data for the previous user
      const oldId = _userId;
      const keysToRemove = ALL_CACHE_KEYS.map((k) => `${oldId}:${k}`);
      Promise.all(keysToRemove.map((key) => SecureStore.deleteItemAsync(secureKey(key)))).catch(() => {});
    }
    _userId = userId;
  },
  async getCached<T>(key: string, version: string): Promise<T | null> {
    try {
      const scopedKey = _userId ? `${_userId}:${key}` : key;
      const raw = await SecureStore.getItemAsync(secureKey(scopedKey));
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
      await SecureStore.setItemAsync(secureKey(scopedKey), JSON.stringify(envelope));
    } catch {
      // ignore
    }
  },
  async removeCached(key: string) {
    try {
      const scopedKey = _userId ? `${_userId}:${key}` : key;
      await SecureStore.deleteItemAsync(secureKey(scopedKey));
    } catch {
      // ignore
    }
  }
};
