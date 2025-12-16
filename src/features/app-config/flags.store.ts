import { create } from 'zustand';
import { flagsApi, FeatureFlags } from './flags.api';

const defaultFlags: FeatureFlags = {
  FEATURE_MOOD_TRACKER: false,
  FEATURE_JOURNAL: false,
  FEATURE_AUDIO: false,
  FEATURE_DAILY_CHECKIN: false,
  FEATURE_AI_FEED: false,
  FEATURE_AI_CHAT: false
};

type FlagState = FeatureFlags & {
  status: 'idle' | 'loading' | 'success' | 'error';
  fetchFlags: () => Promise<void>;
};

export const useFlagsStore = create<FlagState>((set) => ({
  ...defaultFlags,
  status: 'idle',
  async fetchFlags() {
    set({ status: 'loading' });
    try {
      const flags = await flagsApi.fetchFlags();
      set({ ...flags, status: 'success' });
    } catch (error) {
      console.warn('Using default feature flags', error);
      set({ ...defaultFlags, status: 'error' });
    }
  }
}));
