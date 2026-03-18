import { apiClient } from '../../lib/apiClient';

export type CheckinStatus = 'fine' | 'tired' | 'very_tired';
export type FlowState = 'monitoring' | 'follow_up' | 'high_alert' | 'resolved';

export interface CheckinSession {
  id: number;
  user_id: number;
  session_date: string;
  initial_status: CheckinStatus;
  current_status: CheckinStatus;
  flow_state: FlowState;
  triage_messages: Array<{ question: string; answer: string; options?: string[] }>;
  triage_summary: string | null;
  triage_severity: 'low' | 'medium' | 'high' | null;
  triage_completed_at: string | null;
  next_checkin_at: string | null;
  no_response_count: number;
  family_alerted: boolean;
  emergency_triggered: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface TriageResult {
  ok: boolean;
  isDone: boolean;
  // when not done
  question?: string;
  options?: string[];
  multiSelect?: boolean;
  // when done
  summary?: string;
  severity?: 'low' | 'medium' | 'high';
  recommendation?: string;
  needsDoctor?: boolean;
  needsFamilyAlert?: boolean;
}

export interface HealthReportData {
  period: 'week' | 'month';
  totalDays: number;
  checkinDays: number;
  sessions: Array<{
    date: string;
    status: string;
    severity: 'low' | 'medium' | 'high' | null;
    summary: string | null;
    flowState: string;
    resolved: boolean;
  }>;
  severityDistribution: { low: number; medium: number; high: number };
  statusDistribution: { fine: number; tired: number; very_tired: number; specific_concern: number };
  commonSymptoms: Array<{ symptom: string; count: number }>;
  alerts: { familyAlerted: number; emergencyTriggered: number };
  trend: 'improving' | 'stable' | 'worsening';
  highlights: Array<{ type: string; value: string | number }>;
}

export const checkinApi = {
  getToday: () =>
    apiClient<{ ok: boolean; session: CheckinSession | null }>('/api/mobile/checkin/today'),

  start: (status: CheckinStatus) =>
    apiClient<{ ok: boolean; session: CheckinSession }>('/api/mobile/checkin/start', {
      method: 'POST',
      body: { status },
    }),

  followUp: (checkin_id: number, status: CheckinStatus) =>
    apiClient<{ ok: boolean; session: CheckinSession }>('/api/mobile/checkin/followup', {
      method: 'POST',
      body: { checkin_id, status },
    }),

  triage: (checkin_id: number, previous_answers: Array<{ question: string; answer: string }>) =>
    apiClient<TriageResult>('/api/mobile/checkin/triage', {
      method: 'POST',
      body: { checkin_id, previous_answers },
    }),

  emergency: (location?: { lat: number; lng: number; accuracy?: number }) =>
    apiClient<{ ok: boolean; caregiversAlerted: number; message: string }>(
      '/api/mobile/checkin/emergency',
      { method: 'POST', body: { location } }
    ),

  confirmAlert: (alert_id: number, action: 'seen' | 'on_my_way' | 'called') =>
    apiClient<{ ok: boolean }>('/api/mobile/checkin/confirm-alert', {
      method: 'POST',
      body: { alert_id, action },
    }),

  getReport: (period: 'week' | 'month' = 'week') =>
    apiClient<{ ok: boolean } & HealthReportData>(`/api/mobile/checkin/report?period=${period}`),

  resetToday: () =>
    apiClient<{ ok: boolean; message: string }>('/api/mobile/checkin/reset-today', { method: 'POST' }),

  // DEV: simulate time passing — set next_checkin_at to past so follow-up triggers immediately
  simulateTime: () =>
    apiClient<{ ok: boolean; session?: any; message: string }>('/api/mobile/checkin/simulate-time', { method: 'POST' }),
};
