import { isDevBuild } from '../../lib/appEnv';
import { env } from '../../lib/env';
import { checkinGiftsApi, type GiftToday } from './checkin-gifts.api';

/** Explicit local opt-in. Release builds always keep the normal daily limit. */
export function canReplayCheckinGift(account: string): boolean {
  return (
    typeof __DEV__ !== 'undefined' && __DEV__ && isDevBuild &&
    process.env.EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_ACCOUNT_ID === account &&
    !!process.env.EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_API_BASE_URL &&
    process.env.EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_API_BASE_URL.replace(/\/$/, '') ===
      env.apiBaseUrl.replace(/\/$/, '')
  );
}

export async function loadCheckinGiftDay(account: string, reviewExisting = false): Promise<GiftToday> {
  const day = await checkinGiftsApi.today();
  if (!reviewExisting || !day.enabled || day.gift || !canReplayCheckinGift(account)) {
    return day;
  }

  // An existing receipt lets the local tester replay without inventing a check-in
  // or creating another daily gift, draw ticket or family notification.
  const history = await checkinGiftsApi.history();
  const gift = history.items.find((item) => !!item.openedAt) || null;
  return { ...day, gift, offerOnAppOpen: false };
}
