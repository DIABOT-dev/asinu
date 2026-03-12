import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ASINU_AUTH_TOKEN';
let memoryToken: string | null = null;

export const tokenStore = {
  getToken() {
    return memoryToken;
  },
  async loadToken() {
    if (memoryToken !== null) return memoryToken;
    try {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      memoryToken = stored;
    } catch {
      memoryToken = null;
    }
    return memoryToken;
  },
  async setToken(token: string) {
    memoryToken = token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clearToken() {
    memoryToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
};
