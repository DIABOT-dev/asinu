import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ScreenBackButton } from '../../components/ScreenHeaderButton';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { env } from '../../lib/env';
import { showToast } from '../../stores/toast.store';
import { useAuthStore } from '../auth/auth.store';
import { checkinGiftsApi } from './checkin-gifts.api';
import { Image } from 'expo-image';
import { giftPrizeImage } from './gift-prize-assets';

type Document = {
  viewer: string;
  paragraphs: string[];
  serif?: boolean;
  period?: string;
  disclaimer?: boolean;
  prizeImage?: number;
  prizeName?: string;
};
export function GiftDetailScreen({
  kind,
  id,
}: {
  kind: 'receipt' | 'rules' | 'results';
  id: string;
}) {
  const account = useAuthStore((s) => s.profile?.id),
    router = useGuardedRouter();
  const { t, i18n } = useTranslation('home'),
    { colors } = useThemeColors(),
    insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<Document | null>(null),
    [busy, setBusy] = useState(true),
    [reload, setReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setBusy(true);
      setDoc(null);
      if (!account)
        return () => {
          live = false;
        };
      const load = async (): Promise<Document> => {
        if (kind === 'rules') {
          const result = await checkinGiftsApi.rules(id);
          return {
            viewer: String(account),
            paragraphs: [result.rules],
            period: id,
            disclaimer: true,
            prizeImage: giftPrizeImage(result.prize),
            prizeName: result.prize,
          };
        }
        if (kind === 'results') {
          const result = await checkinGiftsApi.results(id);
          return {
            viewer: String(account),
            paragraphs: [
              result.prize,
              ...result.winners.map((winner) =>
                t('checkinGift.winningTicket', { number: winner.ticket_no })
              ),
              ...(result.winners.length
                ? []
                : [t('checkinGift.resultsPending')]),
            ],
            disclaimer: true,
            prizeImage: giftPrizeImage(result.prize),
            prizeName: result.prize,
          };
        }
        const { gift } = await checkinGiftsApi.receipt(id);
        return {
          viewer: String(account),
          paragraphs: [
            gift.loc?.text || '',
            ...(gift.ticket
              ? [t('checkinGift.ticketNumber', { number: gift.ticket.number })]
              : []),
          ],
          serif: gift.loc?.serif || gift.loc?.type === 'proverb',
          period: gift.ticket?.periodId,
          prizeImage: giftPrizeImage(gift.ticket?.prize),
          prizeName: gift.ticket?.prize,
        };
      };
      load()
        .then((result) => {
          if (
            live &&
            String(useAuthStore.getState().profile?.id) === result.viewer
          )
            setDoc(result);
        })
        .catch(() => {})
        .finally(() => {
          if (live) setBusy(false);
        });
      return () => {
        live = false;
      };
    }, [account, id, kind, reload, i18n.language, t])
  );
  const visible = doc?.viewer === String(account) ? doc : null;
  return (
    <Screen
      style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom }}
    >
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ScreenBackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/home')
          }
        />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 26, fontWeight: '700', color: colors.textPrimary }}
        >
          {t(
            kind === 'rules'
              ? 'checkinGift.rules'
              : kind === 'results'
              ? 'checkinGift.results'
              : 'checkinGift.dailyTitle'
          )}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : visible ? (
          <>
            {!!visible.prizeImage && (
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Image
                  source={visible.prizeImage}
                  contentFit="contain"
                  style={{ width: 160, height: 160 }}
                  accessible={false}
                />
                <Text
                  style={{
                    fontSize: 20,
                    lineHeight: 30,
                    color: colors.textSecondary,
                  }}
                >
                  {t('checkinGift.drawPrize', { prize: visible.prizeName })}
                </Text>
              </View>
            )}
            {visible.paragraphs.map((paragraph, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 22,
                  lineHeight: 33,
                  color: colors.textPrimary,
                  fontStyle: visible.serif && index === 0 ? 'italic' : 'normal',
                }}
              >
                {paragraph}
              </Text>
            ))}
            {!!visible.disclaimer && (
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 27,
                  color: colors.textSecondary,
                }}
              >
                {t('checkinGift.appleDisclaimer')}
              </Text>
            )}
            {!!visible.period && (
              <Pressable
                accessibilityRole="button"
                style={{ minHeight: 56, justifyContent: 'center' }}
                onPress={() =>
                  router.push({
                    pathname:
                      kind === 'rules'
                        ? '/checkin-rewards/results'
                        : '/checkin-rewards/rules',
                    params: { period: visible.period! },
                  })
                }
              >
                <Text style={{ fontSize: 20, color: colors.primaryText }}>
                  {t(
                    kind === 'rules'
                      ? 'checkinGift.results'
                      : 'checkinGift.rules'
                  )}
                </Text>
              </Pressable>
            )}
            {kind === 'results' && (
              <Pressable
                accessibilityRole="link"
                style={{ minHeight: 56, justifyContent: 'center' }}
                onPress={() => {
                  if (/^\d{1,18}$/.test(id))
                    Linking.openURL(
                      `${env.apiBaseUrl.replace(/\/$/, '')}/draw-results/${id}`
                    ).catch(() => showToast(t('checkinGift.error'), 'error'));
                }}
              >
                <Text style={{ fontSize: 20, color: colors.primaryText }}>
                  {t('checkinGift.publicResults')}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 20, color: colors.textSecondary }}>
              {t(
                kind === 'receipt'
                  ? 'checkinGift.receiptUnavailable'
                  : 'checkinGift.drawUnavailable'
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReload((x) => x + 1)}
              style={{ minHeight: 56, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 20, color: colors.primaryText }}>
                {t('checkinGift.retry')}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
