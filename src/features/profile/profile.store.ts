import { create } from 'zustand';
import { profileApi } from './profile.api';
import { Profile } from '../auth/auth.store';

interface ProfileState {
  profile: Profile | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  fetchProfile: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  status: 'idle',
  async fetchProfile() {
    set({ status: 'loading' });
    try {
      const profile = await profileApi.fetchProfile();
      set({ profile, status: 'success' });
    } catch (error) {
      console.warn('Profile fetch failed', error);
      set({ status: 'error' });
    }
  }
}));
