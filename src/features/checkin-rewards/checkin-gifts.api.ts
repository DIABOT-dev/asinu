import { apiClient } from '../../lib/apiClient';

export type CheckinGift = {
  id: string;
  day: string;
  openedAt: string | null;
  box: number | null;
  loc: {
    type: 'wish' | 'proverb' | 'health_tip';
    text: string;
    serif: boolean;
  } | null;
  extra: 'none' | 'ticket' | 'coupon' | null;
  ticket: {
    number: string;
    periodId: string;
    period: string;
    prize: string;
    drawAt: string;
  } | null;
};
export type GiftToday = {
  enabled: boolean;
  gift: CheckinGift | null;
  streak: number;
  offerOnAppOpen?: boolean;
  checkinStatus?: string | null;
  familyAlerted?: boolean;
  week: Array<{ day: string; checked: boolean }>;
};
export const checkinGiftsApi = {
  today: () => apiClient<{ ok: true } & GiftToday>('/api/mobile/gift/today'),
  open: (giftId: string, box: number) =>
    apiClient<{ ok: true; gift: CheckinGift }>('/api/mobile/gift/open', {
      method: 'POST',
      body: { gift_id: giftId, box },
    }),
  history: (before?: string) =>
    apiClient<{ ok: true; items: CheckinGift[]; nextBefore: string | null }>(
      `/api/mobile/gift/history?before=${encodeURIComponent(before || '')}`
    ),
  rules: (periodId: string) =>
    apiClient<{
      ok: true;
      period: string;
      prize: string;
      drawAt: string;
      rules: string;
    }>(`/api/mobile/gift/draw/${encodeURIComponent(periodId)}/rules`),
  results: (periodId: string) =>
    apiClient<{
      ok: true;
      period: string;
      prize: string;
      drawAt: string;
      winners: Array<{ ticket_no: string; published_at: string }>;
    }>(`/api/mobile/gift/draw/${encodeURIComponent(periodId)}/results`),
  receipt: (giftId: string) =>
    apiClient<{ ok: true; gift: CheckinGift }>(
      `/api/mobile/gift/${encodeURIComponent(giftId)}`
    ),
};
