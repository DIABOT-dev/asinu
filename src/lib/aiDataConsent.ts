import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../features/auth/auth.store';
import { apiClient } from './apiClient';

// A new provider disclosure needs fresh consent. Never migrate the old global
// OpenAI-only grant to this account-scoped provider revision.
export const AI_DATA_CONSENT_KEY = '@asinu/ai_data_consent_v3';
export const AI_CONSENT_VERSION = '2026-10-16.v3';

function identity() {
  const { profile, token } = useAuthStore.getState();
  return profile?.id && token
    ? { key: `${AI_DATA_CONSENT_KEY}.${encodeURIComponent(String(profile.id))}`, token }
    : null;
}

export async function hasAiDataConsent(): Promise<boolean> {
  const owner = identity();
  if (!owner) return false;
  try {
    const receipt = await apiClient<{ granted: boolean; version: string }>('/api/mobile/ai-consent', {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const current = identity();
    return receipt.granted === true && receipt.version === AI_CONSENT_VERSION &&
      current?.key === owner.key && current.token === owner.token;
  } catch { return false; }
}

export async function saveAiDataConsent(): Promise<boolean> {
  const owner = identity();
  if (!owner) return false;
  await apiClient('/api/mobile/ai-consent', {
    method: 'PUT', headers: { Authorization: `Bearer ${owner.token}` },
    body: { version: AI_CONSENT_VERSION, granted: true },
  });
  if (identity()?.token !== owner.token || identity()?.key !== owner.key) return false;
  await AsyncStorage.setItem(owner.key, 'true');
  const current = identity();
  if (current?.key !== owner.key || current.token !== owner.token) {
    await AsyncStorage.removeItem(owner.key);
    return false;
  }
  return true;
}

export async function revokeAiDataConsent(): Promise<void> {
  const owner = identity();
  if (owner) {
    await apiClient('/api/mobile/ai-consent', { method: 'DELETE', headers: { Authorization: `Bearer ${owner.token}` } });
    await AsyncStorage.removeItem(owner.key);
  }
  await AsyncStorage.removeItem('@asinu/ai_data_consent_v1');
}
