import * as SecureStore from 'expo-secure-store';

/**
 * Zustand-compatible storage backed by the OS keychain/keystore.
 * Sensitive stores deliberately fail closed when secure storage is unavailable;
 * they must never fall back to plaintext AsyncStorage.
 */
export const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(`asinu_secure_${name}`),
  setItem: (name: string, value: string) =>
    SecureStore.setItemAsync(`asinu_secure_${name}`, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(`asinu_secure_${name}`),
};
