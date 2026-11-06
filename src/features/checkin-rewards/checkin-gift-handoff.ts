import { tokenStore } from '../../lib/tokenStore';

type PendingGift = { account: string; checkinId: string; giftId?: string; expiresAt: number };
let pending: PendingGift | null = null;

// A short-lived UI intent, never an award or eligibility decision. Home still
// loads the current gift from the authenticated API after it gains focus.
export function offerCheckinGiftOnHome(account: string | null | undefined, checkinId: number | string, giftId?: string) {
  // PostgreSQL BIGINT IDs arrive as decimal strings. Keep them lossless rather
  // than rejecting the API value or rounding a large ID through Number().
  const validId = typeof checkinId === 'number'
    ? Number.isSafeInteger(checkinId) && checkinId > 0
    : typeof checkinId === 'string' && /^[1-9]\d{0,18}$/.test(checkinId);
  if (!account || !validId) return;
  pending = { account: String(account), checkinId: String(checkinId), giftId, expiresAt: Date.now() + 15 * 60 * 1000 };
}

export function takeCheckinGiftOnHome(account: string, giftId: string) {
  if (!pending || pending.account !== account) return false;
  if (pending.expiresAt <= Date.now()) { pending = null; return false; }
  if (pending.giftId && pending.giftId !== giftId) return false;
  pending = null;
  return true;
}

// Account changes or logout cannot carry an old presentation into a new login.
tokenStore.subscribeSession(() => { pending = null; });
