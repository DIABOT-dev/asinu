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
let queue = Promise.resolve();
const keyFor = (owner: string) => `assistant_chat_v1_${Array.from(owner, char => char.charCodeAt(0).toString(16)).join('_')}`;
const draftKey = (owner: string, slot: number) => `${keyFor(owner)}_draft_${slot}`;
const messageKey = (owner: string, index: number) => `${keyFor(owner)}_message_${index}`;
type ConversationIndex = { version: 2; count: number; lastId?: string; draftSlot: 0 | 1 };
const CHUNK_LENGTH = 600; // Up to 1,800 UTF-8 bytes per SecureStore value.
const MAX_PARTS = 1024;
const partKey = (key: string, index: number) => `${key}_part_${index}`;
const parts = (raw: string) => {
  const count = /^parts:(\d+)$/.exec(raw)?.[1];
  if (!count) return 0;
  if (Number(count) < 1 || Number(count) > MAX_PARTS) throw new Error('Invalid assistant conversation record');
  return Number(count);
};
const index = (value: any): value is ConversationIndex => value?.version === 2 &&
  Number.isSafeInteger(value.count) && value.count >= 0 && [0, 1].includes(value.draftSlot) &&
  (value.count === 0 || typeof value.lastId === 'string');
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const work = queue.then(operation);
  queue = work.then(() => {}, () => {});
  return work;
}

async function writeRecord(key: string, raw: string) {
  const previous = await secureStorage.getItem(key);
  const oldParts = previous ? parts(previous) : 0;
  if (raw.length <= CHUNK_LENGTH) {
    await Promise.all(Array.from({ length: oldParts }, (_, i) => secureStorage.removeItem(partKey(key, i))));
    await secureStorage.setItem(key, raw);
    return;
  }
  const chunks: string[] = [];
  for (let start = 0; start < raw.length;) {
    let end = Math.min(start + CHUNK_LENGTH, raw.length);
    // Keep surrogate pairs together across UTF-8 encoding by the native store.
    if (end < raw.length && raw.charCodeAt(end - 1) >= 0xD800 && raw.charCodeAt(end - 1) <= 0xDBFF) end--;
    chunks.push(raw.slice(start, end));
    start = end;
  }
  if (chunks.length > MAX_PARTS) throw new Error('Assistant conversation record too large');
  await Promise.all(Array.from({ length: Math.max(oldParts - chunks.length, 0) }, (_, i) =>
    secureStorage.removeItem(partKey(key, chunks.length + i))));
  await secureStorage.setItem(key, `parts:${chunks.length}`);
  for (const [i, chunk] of chunks.entries()) await secureStorage.setItem(partKey(key, i), chunk);
}

async function readRecord(key: string): Promise<unknown> {
  const raw = await secureStorage.getItem(key);
  if (!raw) throw new Error('Missing assistant conversation record');
  const count = parts(raw);
  if (!count) return JSON.parse(raw);
  const chunks = await Promise.all(Array.from({ length: count }, (_, i) => secureStorage.getItem(partKey(key, i))));
  if (chunks.some(chunk => chunk == null)) throw new Error('Incomplete assistant conversation record');
  return JSON.parse(chunks.join(''));
}

async function removeRecord(key: string): Promise<boolean> {
  const raw = await secureStorage.getItem(key);
  if (!raw) return false;
  await Promise.all(Array.from({ length: parts(raw) }, (_, i) => secureStorage.removeItem(partKey(key, i))));
  await secureStorage.removeItem(key);
  return true;
}

const message = (value: any): value is AssistantMessage => value && typeof value.id === 'string' &&
  ['user', 'assistant'].includes(value.role) && typeof value.text === 'string';
function medicationPurpose(value: any): boolean {
  if (!value || !['matched', 'not_found', 'ambiguous', 'unavailable', 'not_applicable', 'not_selected'].includes(value.status) ||
    !Array.isArray(value.tags) || value.tags.length > 9 || new Set(value.tags).size !== value.tags.length ||
    !value.tags.every((tag: unknown) => ['fever_reduction', 'pain_relief', 'blood_pressure', 'diabetes', 'lipids', 'antibiotic', 'allergy', 'cough', 'stomach'].includes(String(tag)))) return false;
  if (value.status !== 'matched') return value.tags.length === 0;
  if (!value.tags.length || typeof value.productName !== 'string' || value.productName.length > 120 ||
    typeof value.source?.name !== 'string' || typeof value.source?.url !== 'string') return false;
  try {
    const url = new URL(value.source.url);
    return url.origin === 'https://dhgpharma.com.vn' && !url.username && !url.password &&
      !url.search && !url.hash && /^\/vi\/san-pham\/[a-z0-9-]+\/[a-z0-9-]+$/.test(url.pathname);
  } catch { return false; }
}
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
    case 'screen': return ['feed_article', 'wallet_topup', 'upgrade', 'member', 'medication_draft'].includes(value.screen) && value.params && Object.values(value.params).every(field => typeof field === 'string');
    case 'native': return ['device.permission', 'profile.avatar', 'app.share', 'app.support', 'app.update', 'app.guide', 'feed.hide', 'calls.weather_device'].includes(value.kind) && value.parameters && (value.kind !== 'device.permission' || ['camera', 'microphone', 'photos', 'notifications', 'calls'].includes(value.parameters.kind) && typeof value.parameters.enabled === 'boolean');
    case 'navigate': return ['checkin', 'checkin_history', 'medication', 'logs', 'blood_pressure', 'glucose', 'water', 'consultation', 'profile', 'reminders', 'notifications', 'care_circle', 'scan_qr', 'missions', 'coins', 'early_signal', 'health_status', 'health_tree', 'feed', 'daily_gift', 'gift_history', 'call_settings', 'voice_settings', 'app_permissions', 'my_qr', 'subscription', 'subscription_plans', 'wallet', 'terms', 'privacy_policy', 'medical_sources'].includes(value.destination);
    case 'profile': return typeof value.planToken === 'string' && value.planToken.length <= 12000 && !!value.changes && Object.keys(value.changes).length > 0 &&
      Object.entries(value.changes).every(([key, field]) => key === 'chronicDiseases' ? Array.isArray(field) && field.every(item => typeof item === 'string')
        : key === 'heightCm' ? typeof field === 'number' && field >= 50 && field <= 250 : key === 'bloodType' ? field === null || typeof field === 'string' : ['name', 'dateOfBirth', 'gender'].includes(key) && typeof field === 'string');
    case 'medication': return typeof value.planToken === 'string' && value.planToken.length <= 20000 && Array.isArray(value.changes) && value.changes.length > 0 && value.changes.every((change: any) =>
      change && ['create', 'move', 'pause', 'resume', 'delete', 'taken', 'skipped', 'out_of_meds'].includes(change.operation) &&
      typeof change.name === 'string' && Array.isArray(change.times) && change.times.every((time: any) => typeof time === 'string') &&
      (change.purpose === undefined || medicationPurpose(change.purpose)) &&
      (change.itemKind === undefined || ['MEDICINE', 'SUPPLEMENT'].includes(change.itemKind)));
    case 'routine_reminders': return typeof value.planToken === 'string' && value.planToken.length <= 20000 && Array.isArray(value.changes) && value.changes.every((change: any) =>
      change && ['morning', 'afternoon', 'evening'].includes(change.slot) && typeof change.before === 'string' && typeof change.time === 'string');
    default: return false;
  }
}
function validateDraft(value: any): ConversationDraft {
  if (typeof value?.text !== 'string') throw new Error('Invalid assistant conversation draft');
  const p = value.preview;
  const preview = p && Array.isArray(p.actions) && p.actions.length <= 10 && p.actions.every(action) && typeof p.requestId === 'string' &&
    typeof p.recordedAt === 'string' && Number.isFinite(Date.parse(p.recordedAt)) && Array.isArray(p.completed)
    ? { ...p, completed: p.completed.filter((index: unknown) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < p.actions.length) } : null;
  const clarification = value.clarification && typeof value.clarification.original === 'string' && typeof value.clarification.question === 'string'
    ? { original: value.clarification.original.slice(0, 6000), question: value.clarification.question.slice(0, 2000) } : undefined;
  return { text: value.text.slice(0, 3000), clarification, preview,
    feedback: typeof value.feedback === 'string' ? value.feedback.slice(0, 4000) : '', stalePreview: !!value.stalePreview };
}

export function readAssistantConversation(owner: string, current: () => boolean): Promise<StoredConversation | null> {
  return enqueue(async () => {
    if (!current()) return null;
    const raw = await secureStorage.getItem(keyFor(owner));
    if (!raw || !current()) return null;
    const value = JSON.parse(raw);
    if (Array.isArray(value?.messages)) return { ...validateDraft(value), messages: value.messages.filter(message) };
    if (!index(value)) throw new Error('Invalid assistant conversation index');
    const draft = validateDraft(await readRecord(draftKey(owner, value.draftSlot)));
    const messages: AssistantMessage[] = [];
    for (let start = 0; start < value.count; start += 16) {
      if (!current()) return null;
      const batch = await Promise.all(Array.from({ length: Math.min(16, value.count - start) }, (_, i) =>
        readRecord(messageKey(owner, start + i))));
      if (!batch.every(message)) throw new Error('Invalid assistant conversation message');
      messages.push(...batch);
    }
    return current() ? { ...draft, messages } : null;
  });
}

export function saveAssistantConversation(owner: string, value: StoredConversation, current: () => boolean) {
  const { messages, ...draft } = value;
  return enqueue(async () => {
    if (!current()) return;
    const raw = await secureStorage.getItem(keyFor(owner));
    const previous = raw ? JSON.parse(raw) : null;
    if (!current()) return;
    if (previous && !index(previous) && !Array.isArray(previous.messages)) throw new Error('Invalid assistant conversation index');
    const count = index(previous) ? previous.count : 0;
    if (count > messages.length || (count > 0 && previous.lastId !== messages[count - 1].id))
      throw new Error('Assistant conversation changed while saving');
    if (Array.isArray(previous?.messages) && previous.messages.filter(message).some((old: AssistantMessage, i: number) =>
      old.id !== messages[i]?.id)) throw new Error('Assistant conversation changed while migrating');
    // Append new records before publishing the index. Existing message records
    // are immutable, and a failed draft write leaves the previous slot readable.
    const draftSlot = previous?.draftSlot === 0 ? 1 : 0;
    for (let i = count; i < messages.length; i++) {
      if (!current()) return;
      await writeRecord(messageKey(owner, i), JSON.stringify(messages[i]));
    }
    if (!current()) return;
    await writeRecord(draftKey(owner, draftSlot), JSON.stringify(draft));
    if (!current()) return;
    const next: ConversationIndex = { version: 2, count: messages.length, lastId: messages.at(-1)?.id, draftSlot };
    await secureStorage.setItem(keyFor(owner), JSON.stringify(next));
  });
}
export function clearAssistantConversation(owner: string) {
  return enqueue(async () => {
    const raw = await secureStorage.getItem(keyFor(owner));
    let prior;
    try { prior = raw ? JSON.parse(raw) : null; } catch { /* Erase even if the index cannot be decoded. */ }
    const count = index(prior) ? prior.count : 0;
    await removeRecord(draftKey(owner, 0));
    await removeRecord(draftKey(owner, 1));
    // Include any contiguous records staged by an interrupted save.
    for (let i = 0; i < count || await secureStorage.getItem(messageKey(owner, i)); i++) {
      await removeRecord(messageKey(owner, i));
    }
    await secureStorage.removeItem(keyFor(owner));
  });
}
