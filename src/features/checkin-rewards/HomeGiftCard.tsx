import React, { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useAuthStore } from '../auth/auth.store';
import { checkinGiftsApi, type GiftToday } from './checkin-gifts.api';
import { CheckinGiftFlow } from './CheckinGiftFlow';

export function HomeGiftCard() {
  const account = useAuthStore((s) => s.profile?.id);
  return account ? (
    <AccountCard key={String(account)} account={String(account)} />
  ) : null;
}
function AccountCard({ account }: { account: string }) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const focused = useRef(false);
  const automaticallyOffered = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const [day, setDay] = useState<GiftToday | null>(null),
    [open, setOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      focused.current = true;
      const load = () => {
        const request = ++loadGeneration.current;
        return checkinGiftsApi
          .today()
          .then((result) => {
            if (
              live &&
              request === loadGeneration.current &&
              String(useAuthStore.getState().profile?.id) === account
            ) {
              setDay(result);
              if (
                result.offerOnAppOpen &&
                result.gift &&
                automaticallyOffered.current !== result.gift.id
              ) {
                automaticallyOffered.current = result.gift.id;
                setOpen(true);
              }
            }
          })
          .catch(() => {});
      };
      void load();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        live = false;
        focused.current = false;
        loadGeneration.current++;
        subscription.remove();
        setOpen(false);
      };
    }, [account])
  );
  if (!day?.enabled) return null;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        padding: 20,
        borderRadius: 20,
        gap: 14,
      }}
    >
      <Text
        style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}
      >
        {t('checkinGift.dailyTitle')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {day.week.map((dot, index) => (
          <View
            key={dot.day}
            accessible
            accessibilityLabel={t(
              dot.checked ? 'checkinGift.weekChecked' : 'checkinGift.weekEmpty',
              { day: index + 1 }
            )}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: dot.checked ? colors.primary : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {dot.checked && (
              <Ionicons name="checkmark" size={18} color={colors.surface} />
            )}
          </View>
        ))}
        <Text style={{ fontSize: 18, color: colors.textPrimary }}>
          {t('checkinGift.streak', { count: day.streak })}
        </Text>
      </View>
      {!!day.gift && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={{
            minHeight: 56,
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.primary,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              textAlign: 'center',
              color: colors.surface,
            }}
          >
            {t(day.gift.openedAt ? 'checkinGift.review' : 'checkinGift.choose')}
          </Text>
        </Pressable>
      )}
      {!day.gift && (
        <Text style={{ fontSize: 18, color: colors.textSecondary }}>
          {t('checkinGift.afterCheckin')}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/checkin-rewards/history')}
        style={{ minHeight: 56, justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 20, color: colors.primaryText }}>
          {t('checkinGift.collection')}
        </Text>
      </Pressable>
      {open && (
        <CheckinGiftFlow
          reviewExisting
          status={day.checkinStatus || undefined}
          familyAlerted={day.familyAlerted}
          onClose={() => {
            setOpen(false);
            const request = ++loadGeneration.current;
            checkinGiftsApi
              .today()
              .then((result) => {
                if (
                  focused.current &&
                  request === loadGeneration.current &&
                  String(useAuthStore.getState().profile?.id) === account
                )
                  setDay(result);
              })
              .catch(() => {});
          }}
        />
      )}
    </View>
  );
}
