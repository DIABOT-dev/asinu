import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { QueuedModal } from '../../components/QueuedModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../auth/auth.store';
import { CheckinGiftModal, type CheckinGiftReceipt } from './CheckinGiftModal';
import { checkinGiftsApi, type CheckinGift } from './checkin-gifts.api';
import { giftPrizeImage } from './gift-prize-assets';

type Props = {
  onClose: () => void;
  onUnavailable?: () => void;
  reviewExisting?: boolean;
  status?: string;
  familyAlerted?: boolean;
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
}: Props & { account: string }) {
  const { t, i18n } = useTranslation('home');
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
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
    checkinGiftsApi
      .today()
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
  }, [current, reviewExisting, retry, i18n.language]);
  const display = (value: CheckinGift): CheckinGiftReceipt => ({
    id: value.id,
    title: value.loc?.text || '',
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
      <QueuedModal
        interruptible
        priority={10}
        visible={focused}
        transparent
        onRequestClose={onClose}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(12, 40, 34, 0.6)',
          }}
        >
          <View
            style={{
              padding: 24,
              borderRadius: 24,
              backgroundColor: colors.surface,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 22, color: colors.textPrimary }}>
              {t('checkinGift.savedHealthError')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (current()) setRetry((x) => x + 1);
              }}
              style={{ minHeight: 56, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 20, color: colors.primaryText }}>
                {t('checkinGift.retry')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{ minHeight: 56, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>
                {t('checkinGift.later')}
              </Text>
            </Pressable>
          </View>
        </View>
      </QueuedModal>
    );
  if (!gift) return null;
  // Stable initialReceipt prevents state resets during a normal parent re-render.
  return (
    <ReadyGift
      key={`${gift.id}:${i18n.language}`}
      gift={gift}
      display={display}
      visible={focused}
      onClose={onClose}
      current={current}
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
  display,
  current,
  ...props
}: {
  gift: CheckinGift;
  display: (value: CheckinGift) => CheckinGiftReceipt;
  current: () => boolean;
  visible: boolean;
  onClose: () => void;
  thanks: string;
  notice?: string;
  onRules: (period: string) => void;
}) {
  const [initialReceipt] = useState(() =>
    gift.openedAt ? display(gift) : null
  );
  return (
    <CheckinGiftModal
      {...props}
      identicalBoxes
      initialReceipt={initialReceipt}
      onSkip={async () => {
        /* Leaving a gift never consumes the server's daily receipt. */
      }}
      onOpen={async (box) => {
        if (!current()) throw new Error('Gift account changed');
        const result = await checkinGiftsApi.open(gift.id, box);
        if (!current()) throw new Error('Gift account changed');
        return display(result.gift);
      }}
    />
  );
}
