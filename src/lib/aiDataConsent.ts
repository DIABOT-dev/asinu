import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../features/auth/auth.store';

// A new provider disclosure needs fresh consent. Never migrate the old global
// OpenAI-only grant to this account-scoped provider revision.
export const AI_DATA_CONSENT_KEY = '@asinu/ai_data_consent_v2';

function identity() {
  const { profile, token } = useAuthStore.getState();
  return profile?.id && token
    ? { key: `${AI_DATA_CONSENT_KEY}.${encodeURIComponent(String(profile.id))}`, token }
    : null;
}

export async function hasAiDataConsent(): Promise<boolean> {
  const owner = identity();
  if (!owner) return false;
  const allowed = await AsyncStorage.getItem(owner.key);
  const current = identity();
  return allowed === 'true' && current?.key === owner.key && current.token === owner.token;
}

export async function saveAiDataConsent(): Promise<boolean> {
  const owner = identity();
  if (!owner) return false;
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
  if (owner) await AsyncStorage.removeItem(owner.key);
  await AsyncStorage.removeItem('@asinu/ai_data_consent_v1');
}
