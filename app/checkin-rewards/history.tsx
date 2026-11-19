import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter } from '../../src/hooks/useGuardedRouter';
import { appendDistinctPage, SCROLL_PAGE_SIZE, useLoadOnScrollEnd } from '../../src/hooks/useLoadOnScrollEnd';
import { useAuthStore } from '../../src/features/auth/auth.store';
import {
  checkinGiftsApi,
  type CheckinGift,
} from '../../src/features/checkin-rewards/checkin-gifts.api';

const historyChestHeroArt = require('../../assets/images/rewards/history_chest_hero.png');
const fortuneCloverBadgeArt = require('../../assets/images/rewards/fortune_clover_badge.png');
const fortuneHeartBadgeArt = require('../../assets/images/rewards/fortune_heart_badge.png');
const chestArt = require('../../assets/images/rewards/daily_chest.png');

export default function GiftHistoryScreen() {
  const account = useAuthStore((s) => s.profile?.id);
  const token = useAuthStore((s) => s.token);
  return account && token ? (
    <AccountHistory key={String(account)} account={String(account)} token={token} />
  ) : null;
}

function giftPage({ items, nextBefore }: { items: CheckinGift[]; nextBefore: string | null }) {
  const page = items.slice(0, SCROLL_PAGE_SIZE);
  return { items: page, before: items.length > SCROLL_PAGE_SIZE ? page.at(-1)!.day : nextBefore };
}

function AccountHistory({ account, token }: { account: string; token: string }) {
  const { t, i18n } = useTranslation('home');
  const { colors, isDark = false } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const generation = useRef(0);
  const nextBefore = useRef<string | null>(null);
  const requestPending = useRef(false);
  const [page, setPage] = useState<{ token: string; items: CheckinGift[] } | null>(null);
  const items = page?.token === token ? page.items : [];
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<'initial' | 'next' | null>(null);
  const [reload, setReload] = useState(0);

  const isDarkMode = Boolean(isDark);
  const sameSession = useCallback(() => {
    const auth = useAuthStore.getState();
    return String(auth.profile?.id) === account && auth.token === token;
  }, [account, token]);

  useFocusEffect(
    useCallback(() => {
      const version = ++generation.current;
      const current = () => version === generation.current && sameSession();
      requestPending.current = true;
      nextBefore.current = null;
      setBusy(true);
      setError(null);
      checkinGiftsApi
        .history(undefined, SCROLL_PAGE_SIZE)
        .then((result) => {
          if (current()) {
            const first = giftPage(result);
            setPage({ token, items: first.items });
            nextBefore.current = first.before;
          }
        })
        .catch(() => {
          if (current()) setError('initial');
        })
        .finally(() => {
          if (current()) {
            requestPending.current = false;
            setBusy(false);
          }
        });
      return () => {
        generation.current++;
        nextBefore.current = null;
        requestPending.current = false;
      };
    }, [sameSession, token, reload, i18n.language])
  );

  const loadMore = async () => {
    const before = nextBefore.current;
    if (!before || requestPending.current || page?.token !== token || !sameSession()) return;
    const requestGeneration = generation.current;
    const current = () =>
      requestGeneration === generation.current && sameSession();
    requestPending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = giftPage(await checkinGiftsApi.history(before, SCROLL_PAGE_SIZE));
      if (!current()) return;
      setPage((previous) => ({
        token,
        items: appendDistinctPage(previous?.items ?? [], result.items),
      }));
      nextBefore.current = result.before === before ? null : result.before;
    } catch {
      if (current()) setError('next');
    } finally {
      if (current()) {
        requestPending.current = false;
        setBusy(false);
      }
    }
  };
  const pagingScroll = useLoadOnScrollEnd(() => {
    if (!error) {
      void loadMore();
    }
  }, `${reload}:${i18n.language}`, page?.token === token && nextBefore.current !== null);

  return (
    <Screen
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom }}
    >
      <View style={styles.headerContainer}>
        <ScreenBackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/home')
          }
        />

        <Text
          accessibilityRole="header"
          style={[styles.headerTitle, { color: colors.textPrimary }]}
        >
          {t('checkinGift.collection')}
        </Text>
        <Image
          source={historyChestHeroArt}
          style={styles.headerHeroArt}
          contentFit="contain"
          accessible={false}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        {...pagingScroll.scrollProps}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
          pagingScroll.minimumContentSize,
        ]}
        renderItem={({ item, index }) => {
          const dateObj = new Date(item.day + 'T12:00:00+07:00');
          const formattedDate = new Intl.DateTimeFormat(i18n.language, {
            timeZone: 'Asia/Ho_Chi_Minh',
            dateStyle: 'long',
          }).format(dateObj);
          const displayDate =
            formattedDate.charAt(0).toLocaleUpperCase(i18n.language) +
            formattedDate.slice(1);
          const badgeImage =
            index % 2 === 0 ? fortuneCloverBadgeArt : fortuneHeartBadgeArt;

          return (
            <View
              style={[
                styles.fortuneCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDarkMode ? colors.border : '#edf4f3',
                },
              ]}
            >
              {/* Floating decorative badge on top right */}
              <Image
                source={badgeImage}
                style={styles.cardBadgeArt}
                contentFit="contain"
                accessible={false}
              />

              {/* Date pill badge */}
              <View
                style={[
                  styles.datePill,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(20, 184, 166, 0.15)'
                      : '#e8f7f4',
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={15} color="#14b8a6" />
                <Text style={styles.dateText}>
                  {t('checkinGift.historyDay', { date: displayDate })}
                </Text>
              </View>

              {/* Message text */}
              <Text
                style={[
                  styles.fortuneText,
                  {
                    color: colors.textPrimary,
                    fontStyle:
                      item.loc?.serif || item.loc?.type === 'proverb'
                        ? 'italic'
                        : 'normal',
                  },
                ]}
              >
                {item.loc?.text}
              </Text>

              {/* Draw ticket details if present */}
              {!!item.ticket && (
                <View
                  style={[
                    styles.ticketBox,
                    {
                      backgroundColor: isDarkMode
                        ? 'rgba(20, 184, 166, 0.12)'
                        : '#f0fdfa',
                    },
                  ]}
                >
                  <View style={styles.ticketInfo}>
                    <Ionicons name="ticket-outline" size={16} color="#0d9488" />
                    <Text
                      style={[
                        styles.ticketNumberText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {t('checkinGift.ticketNumber', {
                        number: item.ticket.number,
                      })}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/checkin-rewards/rules',
                        params: { period: item.ticket!.periodId },
                      })
                    }
                    style={styles.ticketRulesButton}
                  >
                    <Text
                      style={[
                        styles.ticketRulesText,
                        { color: colors.primary },
                      ]}
                    >
                      {t('checkinGift.rules')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          !busy && !error ? (
            <View style={styles.emptyContainer}>
              <Image
                source={chestArt}
                style={styles.emptyChestIcon}
                contentFit="contain"
                accessible={false}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('checkinGift.emptyCollection')}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footerArea}>
            {busy && <ActivityIndicator color={colors.primary} />}
            {error && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  error === 'next'
                    ? void loadMore()
                    : setReload((x) => x + 1)
                }
                style={styles.footerButton}
              >
                <Text
                  style={[styles.footerButtonText, { color: colors.primaryText }]}
                >
                  {t('checkinGift.retry')}
                </Text>
              </Pressable>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerHeroArt: {
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  fortuneCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardBadgeArt: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 76,
    height: 76,
    zIndex: 0,
  },
  datePill: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    zIndex: 1,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  fortuneText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    marginTop: 14,
    maxWidth: '76%',
    zIndex: 1,
  },
  ticketBox: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  ticketRulesButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ticketRulesText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyChestIcon: {
    width: 84,
    height: 84,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  footerArea: {
    paddingVertical: 16,
    gap: 12,
  },
  footerButton: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
