import { create } from "zustand";

export type FeedDismissals = {
  loaded: boolean;
  hiddenIds: string[];
  pendingIds: string[];
  hasDismissedServerItem: boolean;
};

export const EMPTY_FEED_DISMISSALS: FeedDismissals = {
  loaded: false,
  hiddenIds: [],
  pendingIds: [],
  hasDismissedServerItem: false,
};

type Dependencies = {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
  };
  request(
    id: string,
    token: string,
  ): Promise<{ ok: boolean; enabled?: boolean }>;
  session(): { userId?: string | number; token: string | null };
};

type State = {
  users: Record<string, FeedDismissals>;
  hydrate(userId: string): Promise<void>;
  dismiss(
    userId: string,
    token: string | null,
    itemId: string | number,
  ): Promise<boolean>;
};

export const isCuratedFeedItem = (id: string) => /^curated-[1-5]$/.test(id);

/** Persist only article IDs, never tokens or article/health content. */
export function createFeedDismissals({
  storage,
  request,
  session,
}: Dependencies) {
  const loads = new Map<string, Promise<void>>();
  const writes = new Map<string, Promise<void>>();
  const storageKey = (userId: string) =>
    `@asinu/health-feed-dismissals/${encodeURIComponent(userId)}`;
  const current = (userId: string, token: string | null) => {
    const auth = session();
    return (
      Boolean(token) &&
      String(auth.userId ?? "") === userId &&
      auth.token === token
    );
  };

  return create<State>((set, get) => {
    const update = (userId: string, changes: Partial<FeedDismissals>) =>
      set((state) => ({
        users: {
          ...state.users,
          [userId]: {
            ...(state.users[userId] || EMPTY_FEED_DISMISSALS),
            ...changes,
          },
        },
      }));

    const persist = (userId: string, id: string, curated: boolean) => {
      const previous = writes.get(userId) || Promise.resolve();
      const work = previous
        .catch(() => {})
        .then(async () => {
          const record = get().users[userId] || EMPTY_FEED_DISMISSALS;
          const hiddenIds = [...new Set([...record.hiddenIds, id])];
          const hasDismissedServerItem =
            record.hasDismissedServerItem || !curated;
          try {
            await storage.setItem(
              storageKey(userId),
              JSON.stringify({ version: 1, hiddenIds, hasDismissedServerItem }),
            );
          } catch (error) {
            // A server-confirmed dismissal remains valid even if its local cache fails.
            if (curated) throw error;
          }
          update(userId, { hiddenIds, hasDismissedServerItem });
        });
      writes.set(userId, work);
      void work
        .finally(() => {
          if (writes.get(userId) === work) writes.delete(userId);
        })
        .catch(() => {});
      return work;
    };

    return {
      users: {},
      async hydrate(userId) {
        if (get().users[userId]?.loaded) return;
        if (loads.has(userId)) return loads.get(userId);
        const work = (async () => {
          let hiddenIds: string[] = [];
          let hasDismissedServerItem = false;
          try {
            const saved = JSON.parse(
              (await storage.getItem(storageKey(userId))) || "null",
            );
            if (saved?.version === 1 && Array.isArray(saved.hiddenIds)) {
              hiddenIds = [
                ...new Set(
                  saved.hiddenIds.filter(
                    (id: unknown): id is string => typeof id === "string",
                  ),
                ),
              ] as string[];
              hasDismissedServerItem = saved.hasDismissedServerItem === true;
            }
          } catch {
            // A missing/unreadable cache must not prevent loading the actual server feed.
          }
          update(userId, { loaded: true, hiddenIds, hasDismissedServerItem });
        })();
        loads.set(userId, work);
        try {
          await work;
        } finally {
          if (loads.get(userId) === work) loads.delete(userId);
        }
      },
      async dismiss(userId, token, itemId) {
        const id = String(itemId);
        if (!id || !current(userId, token)) return false;
        const record = get().users[userId] || EMPTY_FEED_DISMISSALS;
        if (record.pendingIds.includes(id) || record.hiddenIds.includes(id))
          return false;
        update(userId, { pendingIds: [...record.pendingIds, id] });
        try {
          await get().hydrate(userId);
          if (!current(userId, token)) return false;
          if (get().users[userId].hiddenIds.includes(id)) return false;
          const curated = isCuratedFeedItem(id);
          if (!curated) {
            const result = await request(id, token!);
            if (!result.ok || result.enabled === false)
              throw new Error("Feed dismissal was not confirmed");
          }
          await persist(userId, id, curated);
          return current(userId, token);
        } catch (error) {
          if (!current(userId, token)) return false;
          throw error;
        } finally {
          update(userId, {
            pendingIds: (get().users[userId]?.pendingIds || []).filter(
              (value) => value !== id,
            ),
          });
        }
      },
    };
  });
}
