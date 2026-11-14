import { secureStorage } from '../../lib/secureStorage';
import type { AssistantAction } from './app-assistant.api';

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; text: string };
export type ConversationDraft = {
  text: string;
  clarification?: { original: string; question: string };
  preview: { actions: AssistantAction[]; requestId: string; recordedAt: string; completed: number[] } | null;
  feedback: string;
  stalePreview: boolean;
};
export type StoredConversation = ConversationDraft & { messages: AssistantMessage[] };
let queue: Promise<unknown> = Promise.resolve();
const keyFor = (owner: string) => `assistant_chat_v1_${Array.from(owner, char => char.charCodeAt(0).toString(16)).join('_')}`;
const message = (value: any): value is AssistantMessage => value && typeof value.id === 'string' &&
  ['user', 'assistant'].includes(value.role) && typeof value.text === 'string';
function action(value: any): value is AssistantAction {
  if (!value || typeof value !== 'object') return false;
  switch (value.type) {
    case 'language': return ['vi', 'en'].includes(value.value);
    case 'font_size': return ['small', 'normal', 'large', 'xlarge'].includes(value.value);
    case 'glucose': return Number.isFinite(value.value) && value.unit === 'mg/dL';
    case 'blood_pressure': return Number.isFinite(value.systolic) && Number.isFinite(value.diastolic);
    case 'water': return Number.isFinite(value.volume_ml);
    case 'meal': return typeof value.meal_text === 'string' && value.meal_text.length <= 1000;
    case 'app_tool': return typeof value.tool === 'string' && typeof value.label === 'string' && value.label.length <= 10000 && typeof value.planToken === 'string' && value.planToken.length <= 24000;
    case 'speech': return typeof value.text === 'string' && value.text.length <= 16000;
    case 'screen': return ['feed_article', 'wallet_topup', 'upgrade', 'member'].includes(value.screen) && value.params && Object.values(value.params).every(field => typeof field === 'string');
    case 'native': return ['device.permission', 'profile.avatar', 'app.share', 'app.support', 'app.update', 'app.guide', 'feed.hide', 'calls.weather_device'].includes(value.kind) && value.parameters && (value.kind !== 'device.permission' || ['camera', 'microphone', 'photos', 'notifications', 'calls'].includes(value.parameters.kind) && typeof value.parameters.enabled === 'boolean');
    case 'navigate': return ['checkin', 'checkin_history', 'medication', 'logs', 'blood_pressure', 'glucose', 'water', 'consultation', 'profile', 'reminders', 'notifications', 'care_circle', 'scan_qr', 'missions', 'coins', 'early_signal', 'health_status', 'health_tree', 'feed', 'daily_gift', 'gift_history', 'call_settings', 'voice_settings', 'app_permissions', 'my_qr', 'subscription', 'subscription_plans', 'wallet', 'terms', 'privacy_policy', 'medical_sources'].includes(value.destination);
    case 'profile': return typeof value.planToken === 'string' && value.planToken.length <= 12000 && !!value.changes && Object.keys(value.changes).length > 0 &&
      Object.entries(value.changes).every(([key, field]) => key === 'chronicDiseases' ? Array.isArray(field) && field.every(item => typeof item === 'string')
        : key === 'heightCm' ? typeof field === 'number' && field >= 50 && field <= 250 : key === 'bloodType' ? field === null || typeof field === 'string' : ['name', 'dateOfBirth', 'gender'].includes(key) && typeof field === 'string');
    case 'medication': return typeof value.planToken === 'string' && value.planToken.length <= 20000 && Array.isArray(value.changes) && value.changes.length > 0 && value.changes.every((change: any) =>
      change && ['create', 'move', 'pause', 'resume', 'delete', 'taken', 'skipped', 'out_of_meds'].includes(change.operation) &&
      typeof change.name === 'string' && Array.isArray(change.times) && change.times.every((time: any) => typeof time === 'string'));
    case 'routine_reminders': return typeof value.planToken === 'string' && value.planToken.length <= 20000 && Array.isArray(value.changes) && value.changes.every((change: any) =>
      change && ['morning', 'afternoon', 'evening'].includes(change.slot) && typeof change.before === 'string' && typeof change.time === 'string');
    default: return false;
  }
}
export async function readAssistantConversation(owner: string, current: () => boolean): Promise<StoredConversation | null> {
  await queue.catch(() => {});
  if (!current()) return null;
  const raw = await secureStorage.getItem(keyFor(owner));
  if (!raw || raw.length > 200000 || !current()) return null;
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value.messages) || typeof value.text !== 'string') return null;
    const p = value.preview;
    const preview = p && Array.isArray(p.actions) && p.actions.length <= 10 && p.actions.every(action) && typeof p.requestId === 'string' &&
      typeof p.recordedAt === 'string' && Number.isFinite(Date.parse(p.recordedAt)) && Array.isArray(p.completed)
      ? { ...p, completed: p.completed.filter((index: unknown) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < p.actions.length) } : null;
    const clarification = value.clarification && typeof value.clarification.original === 'string' && typeof value.clarification.question === 'string'
      ? { original: value.clarification.original.slice(0, 6000), question: value.clarification.question.slice(0, 2000) } : undefined;
    return { text: value.text.slice(0, 3000), clarification, preview, feedback: typeof value.feedback === 'string' ? value.feedback.slice(0, 4000) : '',
      stalePreview: !!value.stalePreview, messages: value.messages.filter(message).slice(-24).map((m: AssistantMessage) => ({ id: m.id, role: m.role, text: m.text.slice(0, 8000) })) };
  } catch { return null; }
}
export function saveAssistantConversation(owner: string, value: StoredConversation, current: () => boolean) {
  const messages = value.messages.slice(-24).map(m => ({ ...m, text: m.text.slice(0, 8000) }));
  while (messages.reduce((sum, item) => sum + item.text.length, 0) > 100000) messages.shift();
  const snapshot = JSON.stringify({ ...value, messages });
  const work = queue.catch(() => {}).then(async () => {
    if (!current()) return;
    await secureStorage.setItem(keyFor(owner), snapshot);
    if (!current()) await secureStorage.removeItem(keyFor(owner));
  });
  queue = work;
  return work;
}
export function clearAssistantConversation(owner: string) {
  const work = queue.catch(() => {}).then(() => secureStorage.removeItem(keyFor(owner)));
  queue = work;
  return work;
}
