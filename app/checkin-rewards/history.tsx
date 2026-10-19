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
  return account ? (
    <AccountHistory key={String(account)} account={String(account)} />
  ) : null;
}

function AccountHistory({ account }: { account: string }) {
  const { t, i18n } = useTranslation('home');
  const { colors, isDark = false } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const generation = useRef(0);
  const [items, setItems] = useState<CheckinGift[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const isDarkMode = Boolean(isDark);

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
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom }}
    >
      {/* Header Container */}
      <View style={styles.headerContainer}>
        {/* Floating 3D Treasure Chest Hero Art */}
        <Image
          source={historyChestHeroArt}
          style={styles.headerHeroArt}
          contentFit="contain"
          accessible={false}
        />

        {/* Back button */}
        <ScreenBackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/home')
          }
        />

        {/* Title & Subtitle */}
        <View style={styles.headerTextWrapper}>
          <Text
            accessibilityRole="header"
            style={[styles.headerTitle, { color: colors.textPrimary }]}
          >
            {t('checkinGift.collection')}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {t('checkinGift.collectionSubtitle')}
          </Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        renderItem={({ item, index }) => {
          const dateObj = new Date(item.day + 'T12:00:00+07:00');
          const formattedDate = new Intl.DateTimeFormat(i18n.language, {
            timeZone: 'Asia/Ho_Chi_Minh',
            dateStyle: 'long',
          }).format(dateObj);
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
                  {t('checkinGift.historyDay', { date: formattedDate })}
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
                  cursor && items.length
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
            {!!cursor && !busy && !error && (
              <Pressable
                accessibilityRole="button"
                onPress={loadMore}
                style={styles.footerButton}
              >
                <Text
                  style={[styles.footerButtonText, { color: colors.primaryText }]}
                >
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

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'visible',
  },
  headerHeroArt: {
    position: 'absolute',
    top: -12,
    right: 0,
    width: 155,
    height: 125,
    zIndex: 0,
  },
  headerTextWrapper: {
    marginTop: 16,
    zIndex: 1,
    maxWidth: '68%',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: 6,
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
