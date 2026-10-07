import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ASINU_AUTH_TOKEN';
let memoryToken: string | null = null;
let tokenRotations = 0;

export const tokenStore = {
  beginTokenRotation() {
    tokenRotations++;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      tokenRotations--;
    };
  },
  isRotatingToken() {
    return tokenRotations > 0;
  },
  getToken() {
    return memoryToken;
  },
  async loadToken() {
    if (memoryToken !== null) return memoryToken;
    // A locked iPhone can temporarily reject Keychain reads. Only a
    // successful null result means logged out; let startup retry read errors.
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    memoryToken = stored;
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
