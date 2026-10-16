import { secureStorage } from './secureStorage';
import { tokenStore } from './tokenStore';

let owner: string | null = null;
let generation = 0;
const listeners = new Set<() => void>();
type SessionSnapshot = { owner: string | null; generation: number; token: string | null };

export const healthStoreSession = {
  setOwner(value: string | null) {
    if (owner === value) return;
    owner = value;
    generation++;
    listeners.forEach(listener => listener());
  },
  capture(): SessionSnapshot {
    return { owner, generation, token: tokenStore.getToken() };
  },
  isCurrent(snapshot: SessionSnapshot) {
    return Boolean(snapshot.owner && snapshot.token) && snapshot.owner === owner &&
      snapshot.generation === generation && snapshot.token === tokenStore.getToken();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

// A new credential must not inherit the previous account's health state.
tokenStore.subscribeSession(() => {
  // A password change rotates the token within the same authenticated owner.
  // Invalidate pending responses while preserving that account binding.
  if (!tokenStore.isRotatingToken() || !tokenStore.getToken()) owner = null;
  generation++;
  listeners.forEach(listener => listener());
});

/** Secure, owner-scoped storage with serialized writes and stale-read guards. */
export function createHealthStoreStorage(namespace: string) {
  let queue = Promise.resolve();
  const keyFor = (id: string) => `${namespace}_${Array.from(id, char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
  const enqueue = (operation: () => Promise<void>) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  return {
    async getItem(_name: string) {
      const snapshot = healthStoreSession.capture();
      if (!healthStoreSession.isCurrent(snapshot)) return null;
      await queue;
      const value = await secureStorage.getItem(keyFor(snapshot.owner!));
      return healthStoreSession.isCurrent(snapshot) ? value : null;
    },
    setItem(_name: string, value: string) {
      const snapshot = healthStoreSession.capture();
      return enqueue(async () => {
        if (!healthStoreSession.isCurrent(snapshot)) return;
        const key = keyFor(snapshot.owner!);
        await secureStorage.setItem(key, value);
        if (!healthStoreSession.isCurrent(snapshot)) await secureStorage.removeItem(key);
      });
    },
    removeItem(_name: string) {
      const snapshot = healthStoreSession.capture();
      return enqueue(async () => {
        if (snapshot.owner) await secureStorage.removeItem(keyFor(snapshot.owner));
      });
    },
  };
}
