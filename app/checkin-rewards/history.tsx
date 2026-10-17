import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter } from '../../src/hooks/useGuardedRouter';
import { useAuthStore } from '../../src/features/auth/auth.store';
import {
  checkinGiftsApi,
  type CheckinGift,
} from '../../src/features/checkin-rewards/checkin-gifts.api';

export default function GiftHistoryScreen() {
  const account = useAuthStore((s) => s.profile?.id);
  return account ? (
    <AccountHistory key={String(account)} account={String(account)} />
  ) : null;
}
function AccountHistory({ account }: { account: string }) {
  const { t, i18n } = useTranslation('home');
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const generation = useRef(0);
  const [items, setItems] = useState<CheckinGift[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false),
    [cursor, setCursor] = useState<string | null>(null),
    [reload, setReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      generation.current++;
      setBusy(true);
      setError(false);
      checkinGiftsApi
        .history()
        .then((result) => {
          if (live && String(useAuthStore.getState().profile?.id) === account) {
            setItems(result.items);
            setCursor(result.nextBefore);
          }
        })
        .catch(() => {
          if (live) setError(true);
        })
        .finally(() => {
          if (live) setBusy(false);
        });
      return () => {
        live = false;
        generation.current++;
      };
    }, [account, reload, i18n.language])
  );
  const loadMore = async () => {
    if (!cursor || busy) return;
    const requestGeneration = generation.current;
    const current = () =>
      requestGeneration === generation.current &&
      String(useAuthStore.getState().profile?.id) === account;
    setBusy(true);
    setError(false);
    try {
      const result = await checkinGiftsApi.history(cursor);
      if (!current()) return;
      setItems((previous) => [
        ...previous,
        ...result.items.filter(
          (item) => !previous.some((old) => old.id === item.id)
        ),
      ]);
      setCursor(result.nextBefore);
    } catch {
      if (current()) setError(true);
    } finally {
      if (current()) setBusy(false);
    }
  };
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
          {t('checkinGift.collection')}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 24, gap: 24 }}
        renderItem={({ item }) => (
          <View
            style={{
              gap: 12,
              paddingBottom: 24,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, color: colors.textSecondary }}>
              {new Intl.DateTimeFormat(i18n.language, {
                timeZone: 'Asia/Ho_Chi_Minh',
                dateStyle: 'long',
              }).format(new Date(item.day + 'T12:00:00+07:00'))}
            </Text>
            <Text
              style={{
                fontSize: 24,
                lineHeight: 34,
                color: colors.textPrimary,
                fontStyle:
                  item.loc?.serif || item.loc?.type === 'proverb'
                    ? 'italic'
                    : 'normal',
              }}
            >
              {item.loc?.text}
            </Text>
            {!!item.ticket && (
              <>
                <Text style={{ fontSize: 20, color: colors.textPrimary }}>
                  {t('checkinGift.ticketNumber', {
                    number: item.ticket.number,
                  })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/checkin-rewards/rules',
                      params: { period: item.ticket!.periodId },
                    })
                  }
                  style={{ minHeight: 56, justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 20, color: colors.primaryText }}>
                    {t('checkinGift.rules')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
        ListEmptyComponent={
          !busy && !error ? (
            <Text
              style={{
                fontSize: 20,
                lineHeight: 30,
                color: colors.textSecondary,
              }}
            >
              {t('checkinGift.emptyCollection')}
            </Text>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {busy && <ActivityIndicator color={colors.primary} />}
            {error && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  cursor && items.length
                    ? void loadMore()
                    : setReload((x) => x + 1)
                }
                style={{ minHeight: 56, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 20, color: colors.primaryText }}>
                  {t('checkinGift.retry')}
                </Text>
              </Pressable>
            )}
            {!!cursor && !busy && !error && (
              <Pressable
                accessibilityRole="button"
                onPress={loadMore}
                style={{ minHeight: 56, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 20, color: colors.primaryText }}>
                  {t('checkinGift.loadMore')}
                </Text>
              </Pressable>
            )}
          </View>
        }
      />
    </Screen>
  );
}
