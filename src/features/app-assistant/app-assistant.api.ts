import { apiClient } from '../../lib/apiClient';
import type { AppLanguage } from '../../stores/language.store';
import type { FontSizeScale } from '../../stores/font-size.store';
import type { UpdateProfilePayload } from '../auth/auth.api';

export type AssistantDestination = 'checkin' | 'checkin_history' | 'medication' | 'logs' | 'blood_pressure' | 'glucose' | 'water'
  | 'consultation' | 'profile' | 'reminders' | 'notifications' | 'care_circle' | 'scan_qr' | 'missions' | 'coins' | 'early_signal'
  | 'health_status' | 'health_tree' | 'feed' | 'daily_gift' | 'gift_history' | 'call_settings' | 'voice_settings' | 'app_permissions'
  | 'my_qr' | 'subscription' | 'subscription_plans' | 'wallet' | 'terms' | 'privacy_policy' | 'medical_sources';
export type AssistantNative = { type: 'native'; kind: 'device.permission' | 'profile.avatar' | 'app.share' | 'app.support' | 'app.update' | 'app.guide' | 'feed.hide' | 'calls.weather_device';
  parameters: { kind?: 'camera' | 'microphone' | 'photos' | 'notifications' | 'calls'; enabled?: boolean; id?: string } };
export type AssistantScreen = { type: 'screen'; screen: 'feed_article' | 'wallet_topup' | 'upgrade' | 'member'; params: Record<string, string> };

export type AssistantAction =
  | { type: 'language'; value: AppLanguage }
  | { type: 'font_size'; value: FontSizeScale }
  | { type: 'glucose'; value: number; unit: 'mg/dL'; context?: 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random' }
  | { type: 'blood_pressure'; systolic: number; diastolic: number; pulse?: number }
  | { type: 'water'; volume_ml: number }
  | { type: 'meal'; meal_text: string; calories_kcal?: number; carbs_g?: number; protein_g?: number; fat_g?: number }
  | { type: 'app_tool'; tool: string; label: string; planToken: string; requirements?: ('notifications' | 'calls')[] }
  | AssistantNative
  | AssistantScreen
  | { type: 'speech'; text: string }
  | { type: 'medication'; planToken: string; changes: {
    operation: 'create' | 'move' | 'pause' | 'resume' | 'delete' | 'taken' | 'skipped' | 'out_of_meds'; name: string; times: string[]; previousTime?: string;
  }[] }
  | { type: 'navigate'; destination: AssistantDestination }
  | { type: 'profile'; planToken: string; changes: Pick<UpdateProfilePayload, 'name' | 'dateOfBirth' | 'gender' | 'chronicDiseases' | 'heightCm' | 'bloodType'> }
  | { type: 'routine_reminders'; planToken: string; changes: { slot: 'morning' | 'afternoon' | 'evening'; before: string; time: string }[] };
export type AssistantPlan = { status: 'ready' | 'clarify' | 'unsupported' | 'answer'; question: string; answer?: string; actions: AssistantAction[] };
export type AssistantRequest = {
  text: string;
  current: { language: AppLanguage; fontSize: FontSizeScale };
  clarification?: { original: string; question: string };
  conversation?: { role: 'user' | 'assistant'; text: string }[];
  hiddenArticles?: string[];
  allowCuratedArticles?: boolean;
};

export const planAssistantActions = (request: AssistantRequest, signal: AbortSignal) =>
  apiClient<AssistantPlan>('/api/mobile/assistant/plan', {
    method: 'POST', body: request, signal, timeoutMs: 300000,
  });

export const applyAssistantMedication = (planToken: string) =>
  apiClient<{ ok: boolean; status: 'applied'; count: number; replay?: boolean }>('/api/mobile/assistant/medication/apply', {
    method: 'POST', body: { planToken }, timeoutMs: 45000,
  });
export const applyAssistantProfile = (planToken: string) =>
  apiClient<{ profile: import('../auth/auth.store').Profile }>('/api/mobile/assistant/profile/apply', { method: 'POST', body: { planToken } });
export const applyAssistantReminders = (token: string) =>
  apiClient('/api/notifications/reminder-assistant/apply', { method: 'POST', body: { token } });
export const applyAssistantTool = (planToken: string) =>
  apiClient<{ ok: boolean; status: 'applied'; answer?: string }>('/api/mobile/assistant/tool/apply', { method: 'POST', body: { planToken }, timeoutMs: 60000 });

// Reuse journal ingestion, including its validation, alerts, missions and coins.
// A stable key + timestamp lets a retry recover a lost response without another log.
export async function saveAssistantReading(action: AssistantAction, requestId: string, index: number, recordedAt: string) {
  let log_type: string;
  let data: Record<string, unknown>;
  switch (action.type) {
    case 'glucose': log_type = 'glucose'; data = { value: action.value, unit: action.unit, ...(action.context ? { context: action.context } : {}) }; break;
    case 'blood_pressure': log_type = 'bp'; data = { systolic: action.systolic, diastolic: action.diastolic, unit: 'mmHg', ...(action.pulse === undefined ? {} : { pulse: action.pulse }) }; break;
    case 'water': log_type = 'water'; data = { volume_ml: action.volume_ml }; break;
    case 'meal': {
      log_type = 'meal';
      data = { meal_text: action.meal_text, ...(action.calories_kcal === undefined ? {} : { calories_kcal: action.calories_kcal }),
        ...(action.carbs_g === undefined ? {} : { carbs_g: action.carbs_g }), ...(action.protein_g === undefined ? {} : { protein_g: action.protein_g }), ...(action.fat_g === undefined ? {} : { fat_g: action.fat_g }) };
      break;
    }
    default: throw new Error('Not a journal action');
  }
  return apiClient<{ ok: boolean; log_id: string; log_type: string }>('/api/mobile/logs', {
    method: 'POST', headers: { 'Idempotency-Key': `assistant:${requestId}:${index}` },
    body: { log_type, occurred_at: recordedAt, source: 'manual', data },
  });
}

export async function executeAssistantActions({ actions, requestId, recordedAt, completed, isCurrent, saveReading,
  setLanguage, setFontSize, applyMedication = applyAssistantMedication, updateProfile = applyAssistantProfile,
  applyReminders = applyAssistantReminders, applyTool = applyAssistantTool, onProfile, navigate, openScreen, performNative, speak, onReply, onToolApplied }: {
  actions: AssistantAction[]; requestId: string; recordedAt: string; completed: Set<number>;
  isCurrent: () => boolean;
  saveReading: typeof saveAssistantReading;
  setLanguage: (language: AppLanguage) => void;
  setFontSize: (size: FontSizeScale) => void;
  applyMedication?: typeof applyAssistantMedication;
  updateProfile?: typeof applyAssistantProfile;
  applyReminders?: typeof applyAssistantReminders;
  onProfile?: (profile: import('../auth/auth.store').Profile) => void;
  navigate?: (destination: AssistantDestination) => void;
  applyTool?: typeof applyAssistantTool;
  openScreen?: (action: AssistantScreen) => void;
  performNative?: (action: AssistantNative) => Promise<string | void>;
  speak?: (text: string) => Promise<unknown>;
  onReply?: (text: string) => void;
  onToolApplied?: (tool: string) => void;
}) {
  // Save records before switching language, preserving a stable review/error screen.
  const rank = (action: AssistantAction) => ['navigate', 'screen'].includes(action.type) ? 3 : ['native', 'speech'].includes(action.type) ? 2 : Number(['language', 'font_size'].includes(action.type));
  const order = actions.map((action, index) => ({ action, index })).sort((a, b) => rank(a.action) - rank(b.action));
  for (const { action, index } of order) {
    if (!isCurrent()) return false;
    if (completed.has(index)) continue;
    if (action.type === 'language') setLanguage(action.value);
    else if (action.type === 'font_size') setFontSize(action.value);
    else if (action.type === 'medication') await applyMedication(action.planToken);
    else if (action.type === 'routine_reminders') await applyReminders(action.planToken);
    else if (action.type === 'app_tool') {
      const result = await applyTool(action.planToken);
      if (isCurrent()) { if (result.answer) onReply?.(result.answer); onToolApplied?.(action.tool); }
    } else if (action.type === 'screen') {
      if (!openScreen) throw new Error('Screen unavailable');
      openScreen(action);
    } else if (action.type === 'native') {
      if (!performNative) throw new Error('Native action unavailable');
      const answer = await performNative(action);
      if (answer && isCurrent()) onReply?.(answer);
    } else if (action.type === 'speech') {
      if (!speak) throw new Error('Speech unavailable');
      await speak(action.text);
    }
    else if (action.type === 'profile') {
      const result = await updateProfile(action.planToken);
      if (isCurrent()) onProfile?.(result.profile);
    } else if (action.type === 'navigate') {
      if (!navigate) throw new Error('Navigation unavailable');
      navigate(action.destination);
    }
    else await saveReading(action, requestId, index, recordedAt);
    if (!isCurrent()) return false;
    completed.add(index);
  }
  return isCurrent();
}
