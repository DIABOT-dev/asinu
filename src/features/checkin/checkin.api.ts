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

export interface TriageOptionGroup {
  key: string;
  label: string;
  icon: string;        // backend trả emoji, FE map sang vector icon nếu cần
  items: string[];
}

export interface TriageResult {
  ok: boolean;
  isDone: boolean;
  // when not done
  question?: string;
  options?: string[];
  optionsGrouped?: TriageOptionGroup[] | null; // T3 group theo body location
  multiSelect?: boolean;
  // when done
  summary?: string;
  severity?: 'low' | 'medium' | 'high';
  recommendation?: string;
  needsDoctor?: boolean;
  needsFamilyAlert?: boolean;
  // Server actually attempted to alert family (severity=high). Used by FE
  // to render banner: notified vs no-caregiver.
  familyAlertResult?: {
    attempted: boolean;
    caregiversNotified: number;
    alreadyAlerted?: boolean;
  };
  // Backend FIX #4 — surfaces care-circle status alongside the verdict.
  caregiver_status?: 'connected' | 'no_caregiver_connected';
  needs_caregiver_cta?: boolean;
  show_urgent_caregiver_warning?: boolean;
  allowFreeText?: boolean;
  // set when AI was unavailable and fallback questions were used
  _fallback?: boolean;
  // Illusion Layer fields (Phase 3+4)
  _empathy?: { text: string; templateId: string };
  _continuity?: { text: string; templateId: string };
  _progress?: { text: string; templateId: string };
  _greeting?: { displayText: string; templateId: string };
}

/**
 * UI-side type cho summary view sau khi triage hoàn tất (isDone=true).
 * Các field core (summary, severity, recommendation, needsDoctor) được BE
 * đảm bảo có khi isDone=true → required ở UI để TS không cần optional check.
 * Dùng ở app/checkin/index.tsx (state + props).
 */
export type TriageSummaryView = {
  summary: string;
  severity: 'low' | 'medium' | 'high' | string;
  recommendation: string;
  needsDoctor: boolean;
  _progress?: { text: string; templateId: string };
  familyAlertResult?: TriageResult['familyAlertResult'];
  // Pass-through of the backend FIX #4 caregiver fields so the done screen
  // can decide whether to render the "invite a caregiver" CTA/banner.
  caregiver_status?: 'connected' | 'no_caregiver_connected';
  needs_caregiver_cta?: boolean;
  show_urgent_caregiver_warning?: boolean;
};

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
  responseRate?: number;
  avgCheckinHour?: number;
}

export const checkinApi = {
  getToday: () =>
    apiClient<{ ok: boolean; session: CheckinSession | null }>('/api/mobile/checkin/today'),

  start: (
    status: CheckinStatus,
    bodyLocations?: string[] | null,
    bodyLocationOther?: string | null
  ) =>
    apiClient<{ ok: boolean; session: CheckinSession }>('/api/mobile/checkin/start', {
      method: 'POST',
      body: {
        status,
        body_locations: bodyLocations && bodyLocations.length > 0 ? bodyLocations : null,
        body_location_other: bodyLocationOther || null,
      },
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
      timeoutMs: 30000,
    }),

  emergency: (location?: { lat: number; lng: number; accuracy?: number }) =>
    apiClient<{
      ok: boolean;
      caregiversAlerted: number;
      message: string;
      caregiver_status?: 'connected' | 'no_caregiver_connected';
      needs_caregiver_cta?: boolean;
      show_urgent_caregiver_warning?: boolean;
    }>(
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

  getHealthScore: () =>
    apiClient<{ ok: boolean; level: 'ok' | 'monitor' | 'danger'; factors: string[]; checkinDone: boolean }>('/api/mobile/health-score'),

};
