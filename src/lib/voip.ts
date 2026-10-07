import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type VoipEnvironment = 'sandbox' | 'production';

export type VoipRegistration = {
  token: string;
  environment: VoipEnvironment;
};

export type VoipCallPayload = {
  episodeId: string;
  attemptId: string;
  severity?: string;
  kind?: string;
  lang?: string;
  nativeEnded?: string;
  continuationUntil?: string;
  audioSessionReleased?: string;
};

type NativeVoipModule = {
  getRegistration(): Promise<VoipRegistration | null>;
  consumePendingCall(): Promise<VoipCallPayload | null>;
  getPendingCall?(): Promise<VoipCallPayload | null>;
  getActiveCalls?(): Promise<VoipCallPayload[]>;
  completeAnswer?(attemptId: string, connected: boolean, deadline: string): Promise<boolean>;
  setCallUIActive?(attemptId: string, active: boolean, deadline: string): Promise<boolean>;
  endCall(attemptId: string): Promise<boolean>;
  simulateIncomingCall(payload: Partial<VoipCallPayload>): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const nativeModule = (Platform.OS === 'android' ? NativeModules.AsinuCheckinCallModule : NativeModules.AsinuVoipModule) as NativeVoipModule | undefined;
const emitter = (Platform.OS === 'ios' || Platform.OS === 'android') && nativeModule
  ? new NativeEventEmitter(nativeModule as never)
  : null;

export async function getVoipRegistration(): Promise<VoipRegistration | null> {
  if (Platform.OS !== 'ios' || !nativeModule) return null;
  try {
    const value = await nativeModule.getRegistration();
    if (!value?.token || !['sandbox', 'production'].includes(value.environment)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function consumePendingVoipCall(): Promise<VoipCallPayload | null> {
  if (!nativeModule) return null;
  try {
    const value = await nativeModule.consumePendingCall();
    return value?.episodeId && value?.attemptId ? value : null;
  } catch {
    return null;
  }
}

export async function getPendingVoipCall(): Promise<VoipCallPayload | null> {
  if (!nativeModule) return null;
  try {
    // Older installed builds still have the destructive legacy getter. New
    // builds acknowledge the pending handoff only when its screen owns audio.
    const value = nativeModule.getPendingCall
      ? await nativeModule.getPendingCall()
      : await nativeModule.consumePendingCall();
    return value?.episodeId && value?.attemptId ? value : null;
  } catch { return null; }
}

export async function completeVoipCallAnswer(attemptId: string, connected: boolean, deadline?: string | null): Promise<void> {
  if (!attemptId) return;
  await nativeModule?.completeAnswer?.(attemptId, connected, deadline || '');
}

export async function getActiveVoipCalls(): Promise<VoipCallPayload[]> {
  if (!nativeModule?.getActiveCalls) return [];
  try {
    const calls = await nativeModule.getActiveCalls();
    return Array.isArray(calls) ? calls.filter(call =>
      typeof call?.episodeId === 'string' && Boolean(call.episodeId)
      && typeof call?.attemptId === 'string' && Boolean(call.attemptId)) : [];
  } catch { return []; }
}

export async function setVoipCallUIActive(attemptId: string, active: boolean, deadline?: string | null): Promise<boolean> {
  if (!attemptId) return false;
  return await nativeModule?.setCallUIActive?.(attemptId, active, deadline || '') ?? false;
}

export function addVoipCallEndedListener(callback: (value: VoipCallPayload) => void): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener('onVoipCallEnded', (value: VoipCallPayload) => {
    if (value?.episodeId && value?.attemptId) callback(value);
  });
  return () => subscription.remove();
}

export function addVoipTokenListener(callback: (value: VoipRegistration | null) => void): () => void {
  if (Platform.OS !== 'ios' || !emitter) return () => {};
  const subscription = emitter.addListener('onVoipToken', (value: Partial<VoipRegistration>) => {
    if (value?.token && value.environment && ['sandbox', 'production'].includes(value.environment)) {
      callback(value as VoipRegistration);
    } else {
      callback(null);
    }
  });
  return () => subscription.remove();
}

export function addVoipCallAnsweredListener(callback: (value: VoipCallPayload) => void): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener('onVoipCallAnswered', (value: VoipCallPayload) => {
    if (value?.episodeId && value?.attemptId) callback(value);
  });
  return () => subscription.remove();
}

export async function endVoipCall(attemptId: string): Promise<void> {
  if (!nativeModule || !attemptId) return;
  try {
    await nativeModule.endCall(attemptId);
  } catch {
    // The call may already have ended remotely or timed out.
  }
}

export async function simulateIncomingVoipCall(payload: Partial<VoipCallPayload> = {}): Promise<boolean> {
  if (!__DEV__ || Platform.OS !== 'ios' || !nativeModule) return false;
  try {
    return await nativeModule.simulateIncomingCall(payload);
  } catch {
    return false;
  }
}
