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
  user_id: number;
  acknowledged_by: number | null;
};

export type ActiveCheckinCall = CheckinCallEpisode & {
  attempt_id: string;
  target_role: 'USER' | 'FAMILY';
  attempt_state: string;
};

export type CheckinCallAttempt = {
  id: string;
  episode_id: string;
  target_role: 'USER' | 'FAMILY';
  state: string;
  episode_state: string;
  severity: string;
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
  answer: (id: string, choice: 1 | 2 | 3) =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(BASE + '/episodes/' + id + '/answer', {
      method: 'POST',
      body: { choice },
    }),
  seen: (attemptId: string) =>
    apiClient<{ ok: boolean }>(BASE + '/attempts/' + attemptId + '/seen', { method: 'POST' }),
  accept: (attemptId: string) =>
    apiClient<{ ok: boolean; state: string }>(BASE + '/attempts/' + attemptId + '/accept', { method: 'POST' }),
  confirmFamily: (id: string, action: 'ACCEPT_AND_CHECK' | 'ON_MY_WAY' | 'CALLED_USER') =>
    apiClient<{ ok: boolean; episode: CheckinCallEpisode }>(BASE + '/episodes/' + id + '/family-confirm', {
      method: 'POST',
      body: { action },
    }),
  token: (attemptId: string) =>
    apiClient<{ ok: boolean; token: string; url: string; room: string }>(BASE + '/attempts/' + attemptId + '/token'),
  audio: (key: string) =>
    apiClient<{ ok: boolean; mimeType: string; base64: string }>(BASE + '/audio/' + key, { timeoutMs: 30000 }),
};
