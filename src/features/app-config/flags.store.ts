import { create } from 'zustand';
import { flagsApi, FeatureFlags, ChatbotFlags, CareCircleFlags } from './flags.api';

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
  ENABLE_ADVANCED_AI: false,
  chatbot: undefined,
  care_circle: undefined,
  tier: undefined,
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

      set({ ...defaultFlags, status: 'error' });
    }
  }
}));

/**
 * Convenience selector: returns true when the chatbot entry point should
 * be rendered. Backed by the precomputed `chatbot.available` from the
 * server; falls back to the legacy FEATURE_AI_CHAT boolean when the
 * structured payload is missing (older backend build).
 */
export const selectIsChatbotAvailable = (s: FlagState): boolean =>
  s.chatbot?.available ?? s.FEATURE_AI_CHAT;

export type { ChatbotFlags, CareCircleFlags };
