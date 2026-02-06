import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tokenStore } from '../../lib/tokenStore';
import { useNotificationStore } from '../../stores/notification.store';
import { authApi, LoginPayload, UpdateProfilePayload } from './auth.api';
import { authService, SocialProvider } from './auth.service';

export type Profile = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relationship?: string;
  avatarUrl?: string;
  // Health profile fields
  dateOfBirth?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bloodType?: string | null;
  chronicDiseases?: string[];
  // Onboarding fields
  ageRange?: string;
  gender?: string;
  goal?: string;
  bodyType?: string;
  // Care circle
  careCircle?: Array<{
    id: string;
    guardianId: string;
    name: string;
    phone?: string;
    email?: string;
    status: string;
  }>;
};

type AuthState = {
  profile: Profile | null;
  token: string | null;
  loading: boolean;
  error?: string;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  loginWithSocial: (provider: SocialProvider) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      token: null,
      loading: false,
      hydrated: false,
      setHydrated: (value: boolean) => set({ hydrated: value }),

      async bootstrap() {
        console.log('[auth.store] ========== BOOTSTRAP CALLED ==========');
        set({ loading: true, error: undefined });
        console.log('[auth.store] bootstrap started');

        try {
          // Try to restore token from secure storage
          const savedToken = await tokenStore.loadToken();
          console.log('[auth.store] Restored token:', savedToken ? 'YES' : 'NO');

          if (!savedToken) {
            // No token found, user is logged out
            console.log('[auth.store] No token, user is logged out');
            set({ loading: false, profile: null, token: null, hydrated: true });
            return;
          }

          // Token exists, restore it
          set({ token: savedToken });

          // Fetch fresh profile from API
          try {
            console.log('[auth.store] Token found, fetching fresh profile...');
            const profile = await authApi.fetchProfile();
            console.log('[auth.store] Fresh profile fetched:', profile);
            set({ profile, loading: false, hydrated: true });
          } catch (err) {
            console.warn('[auth.store] Failed to fetch profile on bootstrap:', err);
            // If profile fetch fails but we have token, keep the token but clear profile
            set({ profile: null, loading: false, hydrated: true });
          }
        } catch (error) {
          console.error('[auth.store] bootstrap error:', error);
          set({ loading: false, error: (error as Error).message, hydrated: true });
        }
      },

      async login(payload) {
        set({ loading: true, error: undefined });
        console.log('[auth.store] login called - PRODUCTION MODE (no dev bypass)');

        // Always use real API - no dev mode, no bypass
        console.log('[auth.store] login payload:', payload);
        try {
          const response = await authApi.login(payload);
          console.log('[auth.store] login response:', response);
          const token = response.token || null;

          if (token) {
            await tokenStore.setToken(token);
          }

          // Always fetch full profile from /api/mobile/profile endpoint
          // Don't rely on login response for profile data
          let profile: Profile | null = null;
          try {
            console.log('[auth.store] Fetching full profile from API...');
            profile = await authApi.fetchProfile();
            console.log('[auth.store] Fetched profile:', profile);
          } catch (err) {
            console.warn('[auth.store] Failed to fetch full profile:', err);
            // Fallback: build minimal profile from login response
            if (response.user) {
              profile = {
                id: String(response.user.id),
                name: response.user.email?.split('@')[0],
                email: response.user.email
              };
            }
          }

          console.log('[auth.store] Final profile before set:', profile);
          set({ profile, token, loading: false });
        } catch (error) {
          console.log('[auth.store] login failed:', error);
          set({ loading: false, error: (error as Error).message });
          throw error;
        }
      },

      async loginWithPhone(phone) {
        set({ loading: true, error: undefined });
        try {
          const response = await authService.submitPhoneAuth({ phone });
          const token = response.token || null;
          if (token) {
            await tokenStore.setToken(token);
          }

          // Always fetch full profile from API, don't rely on response data
          let profile: Profile | null = null;
          try {
            console.log('[auth.store] Phone login - fetching fresh profile from API...');
            profile = await authApi.fetchProfile();
            console.log('[auth.store] Phone login - Fresh profile fetched:', profile);
          } catch (err) {
            console.warn('[auth.store] Phone login - Failed to fetch profile:', err);
            // Fallback to response profile if available
            profile = response.profile || null;
          }

          set({ profile, token, loading: false });
        } catch (error) {
          console.log('[auth.store] phone login failed:', error);
          set({ loading: false, error: (error as Error).message });
          throw error;
        }
      },

      async loginWithSocial(provider) {
        set({ loading: true, error: undefined });
        try {
          const response = await authService.submitSocialAuth({
            provider,
            token: '',
            rawProfile: {}
          });
          const token = response.token || null;
          if (token) {
            await tokenStore.setToken(token);
          }

          // Always fetch full profile from API, don't rely on response data
          let profile: Profile | null = null;
          try {
            console.log('[auth.store] Social login - fetching fresh profile from API...');
            profile = await authApi.fetchProfile();
            console.log('[auth.store] Social login - Fresh profile fetched:', profile);
          } catch (err) {
            console.warn('[auth.store] Social login - Failed to fetch profile:', err);
            // Fallback to response profile if available
            profile = response.profile || null;
          }

          set({ profile, token, loading: false });
        } catch (error) {
          console.log('[auth.store] social login failed:', error);
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

      async updateProfile(payload) {
        set({ loading: true, error: undefined });
        try {
          const updatedProfile = await authApi.updateProfile(payload);
          set({ profile: updatedProfile, loading: false });
        } catch (error) {
          // Update locally if API fails (for demo mode)
          const currentProfile = get().profile;
          if (currentProfile) {
            set({
              profile: {
                ...currentProfile,
                name: payload.name ?? currentProfile.name,
                phone: payload.phone ?? currentProfile.phone
              },
              loading: false
            });
          } else {
            set({ loading: false, error: (error as Error).message });
            throw error;
          }
        }
      },

      async logout() {
        try {
          await authApi.logout();
        } catch (error) {
          console.warn('logout failed but continuing', error);
        }
        await tokenStore.clearToken();
        
        // Clear notification store
        useNotificationStore.getState().clearAll();
        
        set({ profile: null, token: null });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist token, NOT profile
        // Profile must be fetched fresh from API on each login
        token: state.token
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[auth.store] onRehydrateStorage called - state:', state);
        if (state) {
          state.setHydrated(true);
        }
      }
    }
  )
);
