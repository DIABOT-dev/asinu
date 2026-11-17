import { secureStorage } from '../../lib/secureStorage';
import { healthStoreSession } from '../../lib/healthStoreSession';

export type AssistantReadCache = { token: string; key: string; expiresAt: string };
type Storage = typeof secureStorage;
type IndexEntry = { key: string; parts: number; expiresAt: string };
const MAX_ENTRIES = 8;
const CHUNK_SIZE = 1400;
const MAX_PARTS = 16;
const validKey = (key: unknown): key is string => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
export const validReadCache = (value: unknown, now = Date.now()): value is AssistantReadCache => {
  const entry = value as AssistantReadCache | null;
  return !!entry && validKey(entry.key) && typeof entry.token === 'string' && entry.token.length <= CHUNK_SIZE * MAX_PARTS - 200 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(entry.token) &&
    typeof entry.expiresAt === 'string' && Date.parse(entry.expiresAt) > now && Date.parse(entry.expiresAt) <= now + 16 * 60000;
};

/** Bounded, encrypted storage for read capabilities, never old health answers. */
export function createAssistantReadCacheStorage(storage: Storage, now = Date.now) {
  let queue = Promise.resolve();
  const generations = new Map<string, number>();
  const prefix = (owner: string) => `assistant_read_v1_${Array.from(String(owner), c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;
  const indexKey = (owner: string) => `${prefix(owner)}_index`;
  const partKey = (owner: string, key: string, index: number) => `${prefix(owner)}_${key}_${index}`;
  const enqueue = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.then(() => {}, () => {});
    return result;
  };
  const index = async (owner: string): Promise<IndexEntry[]> => {
    try {
      const raw = await storage.getItem(indexKey(owner));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.length > MAX_ENTRIES) {return [];}
      return parsed.filter((entry: IndexEntry) => entry && validKey(entry.key) &&
        Number.isInteger(entry.parts) && entry.parts > 0 && entry.parts <= MAX_PARTS && typeof entry.expiresAt === 'string');
    } catch { return []; }
  };
  const erase = async (owner: string, entry: Pick<IndexEntry, 'key' | 'parts'>) => {
    await Promise.all(Array.from({ length: entry.parts }, (_, i) => storage.removeItem(partKey(owner, entry.key, i)).catch(() => {})));
  };
  const writeIndex = (owner: string, entries: IndexEntry[]) => storage.setItem(indexKey(owner), JSON.stringify(entries));
  return {
    async get(owner: string, key: string, current: () => boolean): Promise<AssistantReadCache | null> {
      const generation = generations.get(owner) || 0;
      if (!owner || !validKey(key) || !current()) {return null;}
      return enqueue(async () => {
        try {
          const entries = await index(owner);
          const entry = entries.find(row => row.key === key);
          if (!entry || !current() || generation !== (generations.get(owner) || 0)) {return null;}
          const parts = await Promise.all(Array.from({ length: entry.parts }, (_, i) => storage.getItem(partKey(owner, key, i))));
          if (!current() || generation !== (generations.get(owner) || 0)) {return null;}
          const value: unknown = parts.every(part => typeof part === 'string') ? JSON.parse(parts.join('')) : null;
          if (validReadCache(value, now()) && value.key === key && value.expiresAt === entry.expiresAt) {return value;}
          await erase(owner, entry);
          await writeIndex(owner, entries.filter(row => row.key !== key));
        } catch { /* Storage failures are cache misses; normal planning remains available. */ }
        return null;
      });
    },
    async set(owner: string, value: AssistantReadCache, current: () => boolean): Promise<void> {
      const generation = generations.get(owner) || 0;
      const active = () => current() && generation === (generations.get(owner) || 0);
      if (!owner || !active() || !validReadCache(value, now())) {return;}
      await enqueue(async () => {
        const raw = JSON.stringify({ token: value.token, key: value.key, expiresAt: value.expiresAt });
        const count = Math.ceil(raw.length / CHUNK_SIZE);
        if (!active() || count > MAX_PARTS) {return;}
        try {
          const entries = await index(owner);
          const retained = entries.filter(entry => entry.key !== value.key && Date.parse(entry.expiresAt) > now());
          const evicted = entries.filter(entry => !retained.includes(entry));
          while (retained.length >= MAX_ENTRIES) {evicted.push(retained.pop()!);}
          for (const entry of evicted) {await erase(owner, entry);}
          if (!active()) {return;}
          for (let i = 0; i < count; i++) {
            if (!active()) { await erase(owner, { key: value.key, parts: count }); return; }
            await storage.setItem(partKey(owner, value.key, i), raw.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
          }
          if (!active()) { await erase(owner, { key: value.key, parts: count }); return; }
          await writeIndex(owner, [{ key: value.key, parts: count, expiresAt: value.expiresAt }, ...retained]);
          if (!active()) {await erase(owner, { key: value.key, parts: count });}
        } catch {
          await erase(owner, { key: value.key, parts: count });
        }
      });
    },
    async remove(owner: string, key: string): Promise<void> {
      if (!owner || !validKey(key)) {return;}
      await enqueue(async () => {
        try {
          const entries = await index(owner);
          const entry = entries.find(row => row.key === key);
          if (entry) {await erase(owner, entry);}
          await writeIndex(owner, entries.filter(row => row.key !== key));
        } catch { /* A failed deletion cannot authorize replay; the server checks expiry. */ }
      });
    },
    async clear(owner: string): Promise<void> {
      if (!owner) {return;}
      generations.set(owner, (generations.get(owner) || 0) + 1);
      await enqueue(async () => {
        for (const entry of await index(owner)) {await erase(owner, entry);}
        await storage.removeItem(indexKey(owner)).catch(() => {});
      });
    },
  };
}

export const assistantReadCacheStorage = createAssistantReadCacheStorage(secureStorage);
let previousOwner = healthStoreSession.capture().owner;
healthStoreSession.subscribe(() => {
  const nextOwner = healthStoreSession.capture().owner;
  if (previousOwner) {void assistantReadCacheStorage.clear(previousOwner);}
  previousOwner = nextOwner;
});
