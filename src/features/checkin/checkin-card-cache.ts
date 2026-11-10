import type { CheckinSession } from "./checkin.api";

// Home remains mounted behind the interview. Cancellation must invalidate its
// last visible session before navigation, including requests started earlier.
let cached: { account: string; session: CheckinSession | null } | undefined;
const revisions = new Map<string, number>();
const listeners = new Set<(account: string) => void>();
const keyOf = (account: string | number | undefined) =>
  account == null ? "" : String(account);

export const checkinCardRevision = (account: string | number | undefined) =>
  revisions.get(keyOf(account)) || 0;

export function readCheckinCardCache(account: string | number | undefined) {
  return cached?.account === keyOf(account) ? cached.session : undefined;
}

export function cacheCheckinCardSession(
  account: string | number | undefined,
  session: CheckinSession | null,
  revision: number
) {
  if (revision !== checkinCardRevision(account)) return false;
  cached = { account: keyOf(account), session };
  return true;
}

export function invalidateCheckinCard(account: string | number | undefined) {
  const key = keyOf(account);
  revisions.set(key, checkinCardRevision(account) + 1);
  if (cached?.account === key) cached = undefined;
  for (const listener of listeners) {
    try {
      listener(key);
    } catch {
      /* A view observer cannot undo cancellation. */
    }
  }
}

export function subscribeCheckinCardInvalidation(
  account: string | number | undefined,
  listener: () => void
) {
  const receive = (key: string) => {
    if (key === keyOf(account)) listener();
  };
  listeners.add(receive);
  return () => {
    listeners.delete(receive);
  };
}
