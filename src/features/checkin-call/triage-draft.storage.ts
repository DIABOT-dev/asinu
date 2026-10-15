import * as SecureStore from 'expo-secure-store';

// Encode each UTF-16 code unit, including separators, to avoid collisions and
// keep keys within SecureStore's [A-Za-z0-9_.-] alphabet.
function encodePart(value: string) {
  return Array.from({ length: value.length }, (_, i) =>
    value.charCodeAt(i).toString(16).padStart(4, '0')
  ).join('');
}

export function triageDraftKey(accountId: string | number | null | undefined, episodeId: string) {
  if (accountId == null || String(accountId).length === 0 || !episodeId) return null;
  return `asinu_triage_v2_${encodePart(String(accountId))}.${encodePart(episodeId)}`;
}

// The draft contains symptoms. Never fall back to plaintext storage when the
// OS keystore is unavailable. Serialize writes/deletes so a pending save
// cannot recreate a completed call's draft after it has been cleared.
const pending = new Map<string, Promise<unknown>>();
function enqueue<T>(key: string | null, operation: (key: string) => Promise<T>, fallback: T): Promise<T> {
  if (!key) return Promise.resolve(fallback);
  const next = (pending.get(key) || Promise.resolve())
    .then(() => operation(key)).catch(() => fallback);
  pending.set(key, next);
  void next.then(() => { if (pending.get(key) === next) pending.delete(key); });
  return next;
}

export const triageDraftStorage = {
  getItem: (key: string | null) => enqueue(key, async k => {
    const raw = await SecureStore.getItemAsync(k);
    if (!raw) return null;
    let expiresAt: unknown;
    try { expiresAt = JSON.parse(raw)?.expiresAt; } catch { /* remove malformed draft below */ }
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await SecureStore.deleteItemAsync(k);
      return null;
    }
    return raw;
  }, null),
  setItem: (key: string | null, value: string) => enqueue(key, k => SecureStore.setItemAsync(k, value), undefined),
  removeItem: (key: string | null) => enqueue(key, k => SecureStore.deleteItemAsync(k), undefined),
};
