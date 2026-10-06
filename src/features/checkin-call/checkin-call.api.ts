import { apiClient } from '../../lib/apiClient';

export type CheckinCallSettings = {
  enabled: boolean;
  checkin_time: string;
  timezone: string;
  grace_hours: number;
  user_timeout_seconds: number;
  family_ring_seconds: number;
  family_confirm_minutes: number;
  max_rounds: number;
};

export type CheckinVoicePreferences = {
  use_name: boolean;
  use_health: boolean;
  address: 'auto' | 'bac' | 'co' | 'chu' | 'anh' | 'chi' | 'ban';
  weather_enabled: boolean;
  region: 'hanoi' | 'hcm' | 'danang' | 'haiphong' | 'cantho' | 'hue' | 'device' | null;
  location: { latitude: number; longitude: number } | null;
};

export type CheckinUserNotice = {
  version: string;
  greeting: string;
  context: string;
  prompts: Record<string, string>;
  weather: { message: string; temperature: number; forecast_at: string; source: string; source_url: string; license_url: string } | null;
};

export type CheckinCallEpisode = {
  id: string;
  state: string;
  severity: string;
  issue_category: CheckinCallIssueCategory | null;
  triage_context: CheckinCallTriageSelection | null;
  triage_display?: CheckinCallTriageDisplay | null;
  user_id: number;
  acknowledged_by: number | null;
  acknowledged_name?: string | null;
  cancellation_reason?: string | null;
  trigger_source?: string;
  resolved_at?: string | null;
  exhausted_at?: string | null;
  updated_at?: string | null;
  next_action_at?: string | null;
  triage_started_at?: string | null;
  triage_completed_at?: string | null;
};

export type CheckinCallTriageSelection = {
  body_location: string;
  symptom: string;
  intensity: 'MILD' | 'MODERATE' | 'URGENT';
};

export type CheckinCallTriageDisplay = {
  body_location: string;
  symptom: string;
  intensity: string;
  summary: string;
};

export type CheckinCallTriageSymptom = {
  key: string;
  label: string;
  urgent: boolean;
  recent: boolean;
  recent_count: number;
  last_reported: string | null;
};

export type CheckinCallTriageLocation = {
  key: string;
  label: string;
  icon: string;
  desc: string;
  recent: boolean;
  recent_count: number;
  last_reported: string | null;
  symptoms: CheckinCallTriageSymptom[];
};

export type CheckinCallTriageContext = {
  timeout_seconds: number;
  has_recent_context: boolean;
  locations: CheckinCallTriageLocation[];
};

export type CheckinCallIssueCategory =
  | 'MILD_FATIGUE'
  | 'MILD_DIZZY'
  | 'MILD_PAIN'
  | 'MILD_UNSPECIFIED'
  | 'URGENT_RED_FLAG'
  | 'URGENT_UNSPECIFIED'
  | 'UNKNOWN';

export type ActiveCheckinCall = CheckinCallEpisode & {
  attempt_id: string;
  target_role: 'USER' | 'FAMILY';
  attempt_state: string;
  local_callkit_simulation: boolean;
};

export type CheckinCallAttempt = {
  id: string;
  episode_id: string;
  target_role: 'USER' | 'FAMILY';
  state: string;
  episode_state: string;
  severity: string;
  issue_category: CheckinCallIssueCategory | null;
  triage_context: CheckinCallTriageSelection | null;
  triage_display: CheckinCallTriageDisplay | null;
  ring_deadline: string | null;
  confirm_deadline: string | null;
  ended_at?: string | null;
  target_user_id?: number;
  acknowledged_by?: number | null;
  resolved_at?: string | null;
  exhausted_at?: string | null;
  trigger_source?: string;
  next_action_at?: string | null;
  cancellation_reason?: string | null;
  subject?: CheckinCallContact | null;
  family_notice?: { message: string; audio_text: string } | null;
  user_notice?: CheckinUserNotice | null;
};

export type CheckinCallContact = {
  name: string;
  relationship: string;
  phone_number: string | null;
};

const BASE = '/api/mobile/checkin-call';

export type CheckinCallAudioResponse = {
  ok: boolean;
  mimeType: string;
  base64: string;
  audioVersion?: string;
};

const audioHeaders = (language?: 'vi' | 'en') =>
  language ? { 'Accept-Language': language } : undefined;

export const checkinCallApi = {
  audioConfig: (language: 'vi' | 'en') =>
    apiClient<{ ok: boolean; version: string; language: 'vi' | 'en' }>(BASE + '/audio-config', {
      headers: { ...audioHeaders(language), 'Cache-Control': 'no-cache' }, timeoutMs: 4000, retry: { attempts: 1 },
    }),
  voicePreferences: () => apiClient<{ ok: boolean; preferences: CheckinVoicePreferences }>(BASE + '/voice-preferences'),
  saveVoicePreferences: (preferences: CheckinVoicePreferences) =>
    apiClient<{ ok: boolean; preferences: CheckinVoicePreferences }>(BASE + '/voice-preferences', { method: 'PUT', body: preferences }),
  userNotice: (attemptId: string) => apiClient<{ ok: boolean; notice: CheckinUserNotice }>(BASE + '/attempts/' + attemptId + '/user-notice', { timeoutMs: 4000 }),
  userAudio: (attemptId: string, key: string, version?: string, language?: 'vi' | 'en') => apiClient<CheckinCallAudioResponse>(BASE + '/attempts/' + attemptId + '/user-audio/' + key, {
    timeoutMs: 30000, headers: { ...audioHeaders(language), ...(version ? { 'X-Checkin-Notice-Version': version } : {}) },
  }),
  settings: () => apiClient<{ ok: boolean; settings: CheckinCallSettings; contacts?: Array<{ id: number; name: string | null }> }>(BASE + '/settings'),
  saveSettings: (settings: CheckinCallSettings) =>
    apiClient<{ ok: boolean; settings: CheckinCallSettings }>(BASE + '/settings', {
      method: 'PUT',
      body: settings,
    }),
  // The backend merges this patch with the latest schedule and timing settings.
  setEnabled: (enabled: boolean) =>
    apiClient<{ ok: boolean; settings: CheckinCallSettings }>(BASE + '/settings', {
      method: 'PUT',
      body: { enabled },
    }),
  active: () => apiClient<{ ok: boolean; active: ActiveCheckinCall | null }>(BASE + '/active'),
  episode: (id: string) =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(BASE + '/episodes/' + id),
  attempt: (id: string) =>
    apiClient<{ ok: boolean; attempt: CheckinCallAttempt }>(BASE + '/attempts/' + id),
  answer: (id: string, choice: 1 | 2 | 3, issueCategory?: CheckinCallIssueCategory) =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(BASE + '/episodes/' + id + '/answer', {
      method: 'POST',
      body: { choice, ...(issueCategory ? { issue_category: issueCategory } : {}) },
    }),
  startTriage: (id: string) =>
    apiClient<{
      ok: boolean;
      episode: CheckinCallEpisode;
      triage: CheckinCallTriageContext;
    }>(BASE + '/episodes/' + id + '/triage/start', { method: 'POST' }),
  completeTriage: (id: string, selection: CheckinCallTriageSelection) =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(
      BASE + '/episodes/' + id + '/triage/complete',
      { method: 'POST', body: selection },
    ),
  seen: (attemptId: string) =>
    apiClient<{ ok: boolean }>(BASE + '/attempts/' + attemptId + '/seen', { method: 'POST' }),
  decline: (attemptId: string) =>
    apiClient<{ ok: boolean }>(BASE + '/attempts/' + attemptId + '/decline', { method: 'POST' }),
  accept: (attemptId: string) =>
    apiClient<{ ok: boolean; state: string; confirm_deadline: string | null }>(
      BASE + '/attempts/' + attemptId + '/accept',
      { method: 'POST' },
    ),
  confirmFamily: (id: string, action: 'ACCEPT_AND_CHECK' | 'ON_MY_WAY' | 'CALLED_USER') =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(BASE + '/episodes/' + id + '/family-confirm', {
      method: 'POST',
      body: { action },
    }),
  token: (attemptId: string) =>
    apiClient<{ ok: boolean; token: string; url: string; room: string }>(BASE + '/attempts/' + attemptId + '/token'),
  audio: (key: string, language?: 'vi' | 'en') =>
    apiClient<CheckinCallAudioResponse>(BASE + '/audio/' + key, { timeoutMs: 30000, headers: audioHeaders(language) }),
  familyAudio: (attemptId: string, language?: 'vi' | 'en') =>
    apiClient<CheckinCallAudioResponse>(
      BASE + '/attempts/' + attemptId + '/family-audio', { timeoutMs: 30000, headers: audioHeaders(language) },
    ),
  conclusionAudio: (text: string, language?: 'vi' | 'en') =>
    apiClient<CheckinCallAudioResponse>(BASE + '/audio/conclusion', {
      method: 'POST',
      body: { text },
      headers: audioHeaders(language),
      timeoutMs: 30000,
    }),
};
