import { isDevBuild, isCheckinGiftReplayEnabled } from '../../lib/appEnv';
import { env } from '../../lib/env';
import { checkinGiftsApi, type GiftToday } from './checkin-gifts.api';
import type { CheckinGiftReceipt } from './CheckinGiftModal';
import { getRandomBytes } from 'expo-crypto';

const previewKinds = ['wish', 'proverb', 'health_tip', 'ticket', 'coupon'] as const;

/** UI samples are explicitly local and never replace a saved server receipt. */
export function previewCheckinGift(
  account: string,
  box: number,
  t: (key: string) => string,
): CheckinGiftReceipt {
  if (!canReplayCheckinGift(account) || !Number.isInteger(box) || box < 0 || box > 5) {
    throw new Error('Gift preview is unavailable');
  }
  // The box position never determines the prize. Rejection avoids modulo bias;
  // phone is deliberately absent, so its probability is exactly zero.
  const limit = 256 - (256 % previewKinds.length);
  let value: number;
  do { value = getRandomBytes(1)[0]; } while (value >= limit);
  const kind = previewKinds[value % previewKinds.length];
  const label = kind === 'proverb' ? 'previewProverb' : kind === 'health_tip' ? 'previewTip' : kind === 'ticket' ? 'previewTicket' : kind === 'coupon' ? 'couponLabel' : 'previewWish';
  return {
    id: `local-preview:${kind}`,
    box,
    kind,
    title: t(`checkinGift.previewContent.${kind}`),
    shortTitle: t(`checkinGift.${label}`),
    serif: kind === 'proverb',
    description: kind === 'coupon' ? t('checkinGift.previewCouponDescription') : kind === 'ticket' ? t('checkinGift.previewTicketDescription') : null,
  };
}

/** Explicit local opt-in. Release builds always keep the normal daily limit. */
export function canReplayCheckinGift(account: string): boolean {
  return (
    isCheckinGiftReplayEnabled && typeof __DEV__ !== 'undefined' && __DEV__ && isDevBuild &&
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
