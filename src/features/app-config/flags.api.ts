import { apiClient } from '../../lib/apiClient';

export type ChatbotFlags = {
  enabled: boolean;
  premium_only: boolean;
  available: boolean;       // pre-computed: enabled AND tier-allowed AND daily_limit > 0
  daily_limit: number;
};

export type CareCircleFlags = {
  enabled: boolean;
  free_limit: number;
  premium_limit: number;
  caregiver_alert_enabled: boolean;
  caregiver_view_logs_enabled: boolean;
  caregiver_ack_enabled: boolean;
};

export type FeatureFlags = {
  // Legacy flat booleans — keep so existing call sites don't break.
  FEATURE_MOOD_TRACKER: boolean;
  FEATURE_JOURNAL: boolean;
  FEATURE_AUDIO: boolean;
  FEATURE_DAILY_CHECKIN: boolean;
  FEATURE_AI_FEED: boolean;
  FEATURE_AI_CHAT: boolean;

  // Structured payload (added with backend MVP audit FIX #1 + #6).
  // Marked optional so older backend builds without these fields still load.
  chatbot?: ChatbotFlags;
  care_circle?: CareCircleFlags;
  // Check-in flow selector (audit lỗi 7). 'ai' = today's /checkin/start +
  // /checkin/triage flow; 'script' = the cached script-driven flow under
  // /checkin/script/*. Default to 'ai' if missing so older backends behave.
  checkin?: { mode: 'ai' | 'script' };
  tier?: 'free' | 'premium';
};

export const flagsApi = {
  fetchFlags() {
    return apiClient<FeatureFlags>('/api/mobile/flags');
  }
};
