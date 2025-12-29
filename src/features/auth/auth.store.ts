import { create } from 'zustand';
import { authApi, LoginPayload, VerifyPayload } from './auth.api';
import { buildBypassProfile } from './auth.dev-bypass';
import { tokenStore } from '../../lib/tokenStore';
import { featureFlags } from '../../lib/featureFlags';

export type Profile = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship?: string;
  avatarUrl?: string;
};

type AuthState = {
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  error?: string;
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  verifyOtp: (payload: VerifyPayload) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  token: null,
  loading: false,
  async bootstrap() {
    set({ loading: true, error: undefined });
    if (featureFlags.devBypassAuth) {
      set({ profile: buildBypassProfile(), loading: false });
      return;
    }

    await tokenStore.loadToken();
    const token = tokenStore.getToken();
    if (token) {
      try {
        const verified = await authApi.verify();
        const nextToken = verified.token || token;
        if (verified.token) {
          await tokenStore.setToken(nextToken);
        }
        const profile = verified.profile || (await authApi.fetchProfile());
        set({ profile, token: nextToken, loading: false });
        return;
      } catch (error) {
        console.warn('Verify failed, falling back to profile fetch', error);
      }

      try {
        const profile = await authApi.fetchProfile();
        set({ profile, token, loading: false });
        return;
      } catch (error) {
        console.warn('Profile fetch failed', error);
      }
    }
    set({ loading: false, profile: null, token: null });
  },
  async login(payload) {
    set({ loading: true, error: undefined });
    if (__DEV__) {
      const fakeProfile = {
        id: 'dev-user',
        email: payload?.email ?? 'dev@demo.local',
        name: 'Developer Mode User'
      };

      await tokenStore.setToken('dev-bypass');

      set({
        profile: fakeProfile,
        token: 'dev-bypass',
        loading: false,
        error: undefined
      });

      try {
        const { router } = require('expo-router');
        router.replace('/(tabs)/home');
      } catch (err) {
        // Ignore navigation errors in DEV
      }

      return;
    }
    if (featureFlags.devBypassAuth) {
      const fakeProfile = buildBypassProfile();
      await tokenStore.setToken('dev-bypass');
      set({ profile: fakeProfile, token: 'dev-bypass', loading: false });
      return;
    }
    console.log('[auth.store] login payload:', payload);
    try {
      const response = await authApi.login(payload);
      const token = response.token || null;
      const profile = response.profile || (await authApi.fetchProfile());
      if (token) {
        await tokenStore.setToken(token);
      }
      set({ profile, token, loading: false });
    } catch (error) {
      console.log('[auth.store] login failed:', error);
      set({ loading: false, error: (error as Error).message });
      throw error;
    }
  },
  async verifyOtp(payload) {
    set({ loading: true, error: undefined });
    if (featureFlags.devBypassAuth) {
      const fakeProfile = buildBypassProfile();
      await tokenStore.setToken('dev-bypass');
      set({ profile: fakeProfile, token: 'dev-bypass', loading: false });
      return;
    }
    try {
      const response = await authApi.verify(payload);
      const existingToken = tokenStore.getToken();
      const nextToken = response.token || existingToken || null;
      if (response.token) {
        await tokenStore.setToken(response.token);
      }
      const profile = response.profile || (nextToken ? await authApi.fetchProfile() : null);
      set({ profile, token: nextToken, loading: false });
    } catch (error) {
      console.log('[auth.store] verify failed:', error);
      set({ loading: false, error: (error as Error).message });
      throw error;
    }
  },
  async deleteAccount() {
    set({ loading: true, error: undefined });
    try {
      await authApi.deleteAccount();
      await tokenStore.clearToken();
      set({ profile: null, token: null, loading: false });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
      throw error;
    }
  },
  async logout() {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('logout failed but continuing', error);
    }
    await tokenStore.clearToken();
    set({ profile: null, token: null });
  }
}));
