import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { NoInternetModal } from '../../components/NoInternetModal';
import { useAuthStore } from '../auth/auth.store';
import { CheckinGiftModal, type CheckinGiftReceipt } from './CheckinGiftModal';
import { checkinGiftsApi, type CheckinGift } from './checkin-gifts.api';
import { giftPrizeImage } from './gift-prize-assets';
import { canReplayCheckinGift, loadCheckinGiftDay, previewCheckinGift } from './checkin-gift-replay';

type Props = {
  onClose: () => void;
  onUnavailable?: () => void;
  reviewExisting?: boolean;
  status?: string;
  familyAlerted?: boolean;
  onOpened?: (gift: CheckinGift) => void;
};

export function CheckinGiftFlow(props: Props) {
  const userId = useAuthStore((s) => s.profile?.id);
  return userId ? (
    <AccountGiftFlow key={String(userId)} account={String(userId)} {...props} />
  ) : null;
}

function AccountGiftFlow({
  account,
  onClose,
  onUnavailable,
  reviewExisting = false,
  status,
  familyAlerted,
  onOpened,
}: Props & { account: string }) {
  const { t, i18n } = useTranslation('home');
  const router = useGuardedRouter();
  const replayOpening = reviewExisting && canReplayCheckinGift(account);
  const [gift, setGift] = useState<CheckinGift | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [focused, setFocused] = useState(true);
  const mounted = useRef(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  const current = useCallback(
    () =>
      mounted.current &&
      String(useAuthStore.getState().profile?.id) === account,
    [account]
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  useEffect(() => {
    let live = true;
    setState('loading');
    loadCheckinGiftDay(account, reviewExisting)
      .then((result) => {
        if (!live || !current()) return;
        if (
          !result.enabled ||
          !result.gift ||
          (result.gift.openedAt && !reviewExisting)
        ) {
          (unavailableRef.current || closeRef.current)();
          return;
        }
        setGift(result.gift);
        setState('ready');
      })
      .catch(() => {
        if (live && current()) setState('error');
      });
    return () => {
      live = false;
    };
  }, [account, current, reviewExisting, retry, i18n.language]);
  const display = (value: CheckinGift): CheckinGiftReceipt => ({
    id: value.id,
    box: value.box,
    title: value.loc?.text || '',
    kind: value.extra === 'ticket' ? 'ticket' : value.extra === 'coupon' ? 'coupon' : value.loc?.type,
    shortTitle: t(value.extra === 'ticket' ? 'checkinGift.previewTicket' : value.extra === 'coupon' ? 'checkinGift.couponLabel'
      : value.loc?.type === 'proverb' ? 'checkinGift.previewProverb' : value.loc?.type === 'health_tip' ? 'checkinGift.previewTip' : 'checkinGift.previewWish'),
    serif: value.loc?.serif || value.loc?.type === 'proverb',
    description:
      value.extra === 'ticket' && value.ticket
        ? t('checkinGift.ticketDescription', {
            number: value.ticket.number,
            prize: value.ticket.prize,
            date: new Intl.DateTimeFormat(i18n.language, {
              timeZone: 'Asia/Ho_Chi_Minh',
              dateStyle: 'medium',
            }).format(new Date(value.ticket.drawAt)),
          })
        : value.extra === 'coupon'
        ? t('checkinGift.familyCoupon')
        : t('checkinGift.comeBack'),
    rulesPeriod: value.ticket?.periodId,
    drawPrize: value.ticket?.prize,
    prizeImage:
      value.extra === 'ticket'
        ? giftPrizeImage(value.ticket?.prize)
        : undefined,
  });
  if (state === 'loading') return null;
  if (state === 'error')
    return (
      <NoInternetModal
        visible={focused}
        notice={t('checkinGift.savedHealthError')}
        onClose={onClose}
        onRetry={() => {
          if (current()) setRetry((x) => x + 1);
        }}
        retryText={t('checkinGift.retry')}
        laterText={t('checkinGift.later')}
      />
    );
  if (!gift) return null;
  // Stable initialReceipt prevents state resets during a normal parent re-render.
  return (
    <ReadyGift
      key={`${gift.id}:${i18n.language}`}
      gift={gift}
      account={account}
      replayOpening={replayOpening}
      display={display}
      visible={focused}
      onClose={onClose}
      current={current}
      onOpened={onOpened}
      thanks={t(
        familyAlerted ? 'checkinGift.familyThanks' : 'checkinGift.thanks'
      )}
      notice={
        status && status !== 'fine'
          ? t(
              status === 'very_tired'
                ? 'checkinGift.urgentNotice'
                : 'checkinGift.followupNotice'
            )
          : undefined
      }
      onRules={(period) =>
        router.push({ pathname: '/checkin-rewards/rules', params: { period } })
      }
    />
  );
}

function ReadyGift({
  gift,
  account,
  replayOpening,
  display,
  current,
  onOpened,
  ...props
}: {
  gift: CheckinGift;
  account: string;
  replayOpening: boolean;
  display: (value: CheckinGift) => CheckinGiftReceipt;
  current: () => boolean;
  onOpened?: (gift: CheckinGift) => void;
  visible: boolean;
  onClose: () => void;
  thanks: string;
  notice?: string;
  onRules: (period: string) => void;
}) {
  const { t } = useTranslation('home');
  const [initialReceipt] = useState(() =>
    gift.openedAt && !replayOpening ? display(gift) : null
  );
  return (
    <CheckinGiftModal
      {...props}
      initialReceipt={initialReceipt}
      preview={replayOpening && Boolean(gift.openedAt)}
      onOpen={async (box) => {
        if (!current()) throw new Error('Gift account changed');
        if (replayOpening && gift.openedAt) {
          return previewCheckinGift(account, box, t);
        }
        const result = await checkinGiftsApi.open(gift.id, box);
        if (!current()) throw new Error('Gift account changed');
        onOpened?.(result.gift);
        return display(result.gift);
      }}
    />
  );
}
