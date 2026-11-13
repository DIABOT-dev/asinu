import { apiClient } from '../../lib/apiClient';
import type { AppLanguage } from '../../stores/language.store';
import type { FontSizeScale } from '../../stores/font-size.store';

export type AssistantAction =
  | { type: 'language'; value: AppLanguage }
  | { type: 'font_size'; value: FontSizeScale }
  | { type: 'glucose'; value: number; unit: 'mg/dL'; context?: 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random' }
  | { type: 'blood_pressure'; systolic: number; diastolic: number; pulse?: number }
  | { type: 'water'; volume_ml: number };
export type AssistantPlan = { status: 'ready' | 'clarify' | 'unsupported'; question: string; actions: AssistantAction[] };
export type AssistantRequest = {
  text: string;
  current: { language: AppLanguage; fontSize: FontSizeScale };
  clarification?: { original: string; question: string };
};

export const planAssistantActions = (request: AssistantRequest, signal: AbortSignal) =>
  apiClient<AssistantPlan>('/api/mobile/assistant/plan', {
    method: 'POST', body: request, signal, timeoutMs: 150000,
  });

// Reuse journal ingestion, including its validation, alerts, missions and coins.
// A stable key + timestamp lets a retry recover a lost response without another log.
export async function saveAssistantReading(action: AssistantAction, requestId: string, index: number, recordedAt: string) {
  let log_type: string;
  let data: Record<string, unknown>;
  switch (action.type) {
    case 'glucose': log_type = 'glucose'; data = { value: action.value, unit: action.unit, ...(action.context ? { context: action.context } : {}) }; break;
    case 'blood_pressure': log_type = 'bp'; data = { systolic: action.systolic, diastolic: action.diastolic, unit: 'mmHg', ...(action.pulse === undefined ? {} : { pulse: action.pulse }) }; break;
    case 'water': log_type = 'water'; data = { volume_ml: action.volume_ml }; break;
    default: throw new Error('Not a journal action');
  }
  return apiClient<{ ok: boolean; log_id: string; log_type: string }>('/api/mobile/logs', {
    method: 'POST', headers: { 'Idempotency-Key': `assistant:${requestId}:${index}` },
    body: { log_type, occurred_at: recordedAt, source: 'manual', data },
  });
}

export async function executeAssistantActions({ actions, requestId, recordedAt, completed, isCurrent, saveReading,
  setLanguage, setFontSize }: {
  actions: AssistantAction[]; requestId: string; recordedAt: string; completed: Set<number>;
  isCurrent: () => boolean;
  saveReading: typeof saveAssistantReading;
  setLanguage: (language: AppLanguage) => void;
  setFontSize: (size: FontSizeScale) => void;
}) {
  // Save records before switching language, preserving a stable review/error screen.
  const order = actions.map((action, index) => ({ action, index })).sort((a, b) =>
    Number(['language', 'font_size'].includes(a.action.type)) - Number(['language', 'font_size'].includes(b.action.type)));
  for (const { action, index } of order) {
    if (!isCurrent()) return false;
    if (completed.has(index)) continue;
    if (action.type === 'language') setLanguage(action.value);
    else if (action.type === 'font_size') setFontSize(action.value);
    else await saveReading(action, requestId, index, recordedAt);
    if (!isCurrent()) return false;
    completed.add(index);
  }
  return isCurrent();
}
