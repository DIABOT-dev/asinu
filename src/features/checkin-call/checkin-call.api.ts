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

export type CheckinCallEpisode = {
  id: string;
  state: string;
  severity: string;
  issue_category: CheckinCallIssueCategory | null;
  triage_context: CheckinCallTriageSelection | null;
  triage_display?: CheckinCallTriageDisplay | null;
  user_id: number;
  acknowledged_by: number | null;
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
  subject?: CheckinCallContact | null;
  family_notice?: { message: string; audio_text: string } | null;
};

export type CheckinCallContact = {
  name: string;
  relationship: string;
  phone_number: string | null;
};

const BASE = '/api/mobile/checkin-call';

export const checkinCallApi = {
  settings: () => apiClient<{ ok: boolean; settings: CheckinCallSettings }>(BASE + '/settings'),
  saveSettings: (settings: CheckinCallSettings) =>
    apiClient<{ ok: boolean; settings: CheckinCallSettings }>(BASE + '/settings', {
      method: 'PUT',
      body: settings,
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
  audio: (key: string) =>
    apiClient<{ ok: boolean; mimeType: string; base64: string }>(BASE + '/audio/' + key, { timeoutMs: 30000 }),
  familyAudio: (attemptId: string) =>
    apiClient<{ ok: boolean; mimeType: string; base64: string }>(
      BASE + '/attempts/' + attemptId + '/family-audio', { timeoutMs: 30000 },
    ),
  conclusionAudio: (text: string) =>
    apiClient<{ ok: boolean; mimeType: string; base64: string }>(BASE + '/audio/conclusion', {
      method: 'POST',
      body: { text },
      timeoutMs: 30000,
    }),
};
