import { create } from 'zustand';
import { authApi, LoginPayload } from './auth.api';
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
