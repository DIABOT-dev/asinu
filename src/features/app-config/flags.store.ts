import { create } from 'zustand';
import { flagsApi, FeatureFlags } from './flags.api';

type LockedFlags = {
  ENABLE_REWARDS_WALLET: boolean;
  ENABLE_FAMILY_MODE: boolean;
  ENABLE_ADVANCED_AI: boolean;
};

const defaultFlags: FeatureFlags & LockedFlags = {
  FEATURE_MOOD_TRACKER: false,
  FEATURE_JOURNAL: false,
  FEATURE_AUDIO: false,
  FEATURE_DAILY_CHECKIN: false,
  FEATURE_AI_FEED: false,
  FEATURE_AI_CHAT: false,
  ENABLE_REWARDS_WALLET: false,
  ENABLE_FAMILY_MODE: false,
  ENABLE_ADVANCED_AI: false
};

const hardDisabledFlags: LockedFlags = {
  // MVP v1.0.0: Intentionally hard-disabled by Tech Lead
  ENABLE_REWARDS_WALLET: false,
  // MVP v1.0.0: Intentionally hard-disabled by Tech Lead
  ENABLE_FAMILY_MODE: false,
  // MVP v1.0.0: Intentionally hard-disabled by Tech Lead
  ENABLE_ADVANCED_AI: false
};

type FlagState = FeatureFlags & LockedFlags & {
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
      set({ ...flags, ...hardDisabledFlags, status: 'success' });
    } catch (error) {
      console.warn('Using default feature flags', error);
      set({ ...defaultFlags, status: 'error' });
    }
  }
}));
