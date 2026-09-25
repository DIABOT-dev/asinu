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
};

type NativeVoipModule = {
  getRegistration(): Promise<VoipRegistration | null>;
  consumePendingCall(): Promise<VoipCallPayload | null>;
  endCall(attemptId: string): Promise<boolean>;
  simulateIncomingCall(payload: Partial<VoipCallPayload>): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const nativeModule = NativeModules.AsinuVoipModule as NativeVoipModule | undefined;
const emitter = Platform.OS === 'ios' && nativeModule
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
  if (Platform.OS !== 'ios' || !nativeModule) return null;
  try {
    const value = await nativeModule.consumePendingCall();
    return value?.episodeId && value?.attemptId ? value : null;
  } catch {
    return null;
  }
}

export function addVoipTokenListener(callback: (value: VoipRegistration | null) => void): () => void {
  if (!emitter) return () => {};
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
  if (Platform.OS !== 'ios' || !nativeModule || !attemptId) return;
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
