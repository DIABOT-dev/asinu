import { apiClient } from '../../lib/apiClient';

export type FeatureFlags = {
  FEATURE_MOOD_TRACKER: boolean;
  FEATURE_JOURNAL: boolean;
  FEATURE_AUDIO: boolean;
  FEATURE_DAILY_CHECKIN: boolean;
  FEATURE_AI_FEED: boolean;
  FEATURE_AI_CHAT: boolean;
};

export const flagsApi = {
  fetchFlags() {
    return apiClient<FeatureFlags>('/api/mobile/flags');
  }
};
