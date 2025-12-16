import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'ASINU_AUTH_TOKEN';
let memoryToken: string | null = null;

const isWeb = Platform.OS === 'web';

export const tokenStore = {
  getToken() {
    return memoryToken;
  },
  async loadToken() {
    if (memoryToken !== null) return memoryToken;
    const stored = isWeb
      ? await AsyncStorage.getItem(TOKEN_KEY)
      : await SecureStore.getItemAsync(TOKEN_KEY);
    memoryToken = stored;
    return memoryToken;
  },
  async setToken(token: string) {
    memoryToken = token;
    if (isWeb) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  },
  async clearToken() {
    memoryToken = null;
    if (isWeb) {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }
};
