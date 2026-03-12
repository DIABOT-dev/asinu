import { apiClient } from '../src/lib/apiClient';

export type BrainQuestion = {
  id: string; // Dynamic - có thể là 'mood', 'symptom_severity', 'q_1', 'q_2'...
  type: 'single_choice' | 'symptom_severity';
  text: string;
  options?: Array<{ value: string; label: string }>;
  symptoms?: Array<{ value: string; label: string }>;
  severity_options?: Array<{ value: string; label: string }>;
};

export type BrainQuestionFlow = {
  step: number;
  total: number;
  mode?: 'dynamic' | 'legacy';
};

export type BrainOutcome = {
  risk_tier: string;
  notify_caregiver: boolean;
  recommended_action?: string | null;
  outcome_text?: string | null;
  metadata?: Record<string, unknown>;
};

export type BrainExplainability = {
  trigger: string[];
  context: string[];
  action: string[];
  confidence: {
    level: string;
    reasons: string[];
  };
};

export type BrainDecision = {
  level: string;
  code: number;
};

export type BrainNextResponse = {
  ok: boolean;
  session_id: string;
  should_ask?: boolean;
  requires_logs?: boolean;
  message?: string;
  missing_log_types?: string[];
  question?: BrainQuestion;
  question_flow?: BrainQuestionFlow;
  outcome?: BrainOutcome;
  decision?: BrainDecision;
  explainability?: BrainExplainability;
};

export type BrainTimelineResponse = {
  ok: boolean;
  timeline: Array<{
    type: string;
    session_id: string;
    question_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
};

export const fetchBrainNext = async () => {
  return apiClient<BrainNextResponse>('/api/asinu-brain/next');
};

export const sendBrainAnswer = async (payload: {
  session_id: string;
  question_id: string;
  answer: {
    option_id: string | string[];
    value?: string;
    label?: string;
    free_text?: string;
  };
}) => {
  return apiClient<BrainNextResponse>('/api/asinu-brain/answer', {
    method: 'POST',
    body: payload
  });
};

export const fetchBrainTimeline = async () => {
  return apiClient<BrainTimelineResponse>('/api/asinu-brain/timeline');
};

export const postBrainEmergency = async (payload: {
  type: 'SUDDEN_TIRED' | 'VERY_UNWELL' | 'ALERT_CAREGIVER';
  free_text?: string;
}) => {
  return apiClient<{ ok: boolean; status: string; message: string }>('/api/asinu-brain/emergency', {
    method: 'POST',
    body: payload
  });
};
