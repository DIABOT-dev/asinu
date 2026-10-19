import React, { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useAuthStore } from '../auth/auth.store';
import { checkinGiftsApi, type GiftToday } from './checkin-gifts.api';
import { CheckinGiftFlow } from './CheckinGiftFlow';

const cloverArt = require('../../../assets/images/rewards/daily_clover.png');
const heroArt = require('../../../assets/images/rewards/daily_gift_hero.png');
const chestArt = require('../../../assets/images/rewards/daily_chest.png');

export function HomeGiftCard() {
  const account = useAuthStore((s) => s.profile?.id);
  return account ? (
    <AccountCard key={String(account)} account={String(account)} />
  ) : null;
}

function AccountCard({ account }: { account: string }) {
  const { t } = useTranslation('home');
  const { colors, isDark = false } = useThemeColors();
  const router = useGuardedRouter();
  const focused = useRef(false);
  const automaticallyOffered = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const [day, setDay] = useState<GiftToday | null>(null);
  const [open, setOpen] = useState(false);

  const acceptDay = useCallback((result: GiftToday) => {
    setDay((current) =>
      current?.gift?.openedAt && current.gift.id === result.gift?.id && !result.gift.openedAt
        ? { ...result, gift: current.gift, offerOnAppOpen: false }
        : result
    );
  }, []);

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
              acceptDay(result);
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
    }, [account, acceptDay])
  );

  if (!day?.enabled) return null;

  const isDarkMode = Boolean(isDark);
  const containerBg = isDarkMode ? 'rgba(20, 184, 166, 0.12)' : '#e8f7f4';
  const streakBg = isDarkMode ? 'rgba(20, 184, 166, 0.25)' : '#cbf0e8';
  const arrowBg = isDarkMode ? 'rgba(20, 184, 166, 0.18)' : '#e8f7f4';

  // Subtle gradient: gentle luminance step without heavy saturation or waves
  const buttonGradientColors = isDarkMode
    ? (['#14b8a6', '#0f766e'] as const)
    : (['#3bd3be', '#1ca492'] as const);

  return (
    <View style={styles.outerStack}>
      {/* Thẻ Lộc mỗi ngày */}
      <View
        style={[
          styles.mainCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDarkMode ? colors.border : '#edf4f3',
          },
        ]}
      >
        {/* Floating 3D Gift Box Hero Art ở góc trên bên phải */}
        <Image
          source={heroArt}
          style={styles.heroArt}
          contentFit="contain"
          accessible={false}
        />

        {/* Header: Cỏ 4 lá + Tiêu đề + Phụ đề */}
        <View style={styles.headerArea}>
          <View style={styles.titleRow}>
            <Image
              source={cloverArt}
              style={styles.cloverIcon}
              contentFit="contain"
              accessible={false}
            />
            <Text
              style={[
                styles.titleText,
                { color: colors.textPrimary },
              ]}
            >
              {t('checkinGift.dailyTitle')}
            </Text>
          </View>
          <Text
            style={[
              styles.subtitleText,
              { color: colors.textSecondary },
            ]}
          >
            {t('checkinGift.dailySubtitle')}
          </Text>
        </View>

        {/* Thanh tiến trình 7 ngày và Chuỗi điểm danh */}
        <View style={[styles.timelineContainer, { backgroundColor: containerBg }]}>
          <View style={styles.weekDotsRow}>
            {day.week.map((dot, index) => (
              <React.Fragment key={dot.day}>
                <View
                  accessible
                  accessibilityLabel={t(
                    dot.checked ? 'checkinGift.weekChecked' : 'checkinGift.weekEmpty',
                    { day: index + 1 }
                  )}
                  style={styles.dayColumn}
                >
                  <View
                    style={[
                      styles.dayDot,
                      dot.checked
                        ? styles.dayDotChecked
                        : styles.dayDotUnchecked,
                    ]}
                  >
                    {dot.checked ? (
                      <Ionicons name="checkmark" size={15} color="#ffffff" />
                    ) : (
                      <Ionicons name="lock-closed" size={11} color="#94a3b8" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: dot.checked ? '#0d9488' : '#94a3b8' },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                {index < day.week.length - 1 && (
                  <View style={styles.dotConnector} />
                )}
              </React.Fragment>
            ))}
          </View>

          <View style={[styles.streakBadge, { backgroundColor: streakBg }]}>
            <Ionicons name="flame" size={15} color="#0d9488" />
            <Text style={styles.streakText}>
              {t('checkinGift.streak', { count: day.streak })}
            </Text>
          </View>
        </View>

        {/* Nút hành động chính: Gradient nhẹ nhàng */}
        {!!day.gift && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(true)}
            style={styles.actionPressable}
          >
            <LinearGradient
              colors={buttonGradientColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.actionButton}
            >
              <View style={styles.actionButtonLeft}>
                <Ionicons
                  name="sparkles"
                  size={15}
                  color="#fef08a"
                  style={styles.sparkleIcon}
                />
                <Ionicons
                  name="gift"
                  size={22}
                  color="#ffffff"
                  style={styles.giftIcon}
                />
              </View>
              <Text style={styles.actionButtonText}>
                {t(day.gift.openedAt ? 'checkinGift.review' : 'checkinGift.choose')}
              </Text>
              <View style={styles.chevronCircle}>
                <Ionicons name="chevron-forward" size={18} color="#ffffff" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {!day.gift && (
          <View style={[styles.afterCheckinBox, { backgroundColor: containerBg }]}>
            <Ionicons name="information-circle-outline" size={20} color="#0d9488" />
            <Text style={[styles.afterCheckinText, { color: colors.textSecondary }]}>
              {t('checkinGift.afterCheckin')}
            </Text>
          </View>
        )}
      </View>

      {/* Thẻ Kho lộc */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('checkinGift.collection')}
        onPress={() => router.push('/checkin-rewards/history')}
        style={[
          styles.collectionCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDarkMode ? colors.border : '#edf4f3',
          },
        ]}
      >
        <View style={styles.collectionLeft}>
          <Image
            source={chestArt}
            style={styles.chestIcon}
            contentFit="contain"
            accessible={false}
          />
          <Text
            style={[
              styles.collectionText,
              { color: colors.textPrimary },
            ]}
          >
            {t('checkinGift.collection')}
          </Text>
        </View>
        <View style={[styles.collectionArrowCircle, { backgroundColor: arrowBg }]}>
          <Ionicons name="chevron-forward" size={18} color="#0d9488" />
        </View>
      </Pressable>

      {open && (
        <CheckinGiftFlow
          reviewExisting
          status={day.checkinStatus || undefined}
          familyAlerted={day.familyAlerted}
          onOpened={(gift) => {
            if (
              !focused.current ||
              String(useAuthStore.getState().profile?.id) !== account
            ) return;
            // A completed open is newer than any pending Home refresh.
            loadGeneration.current++;
            automaticallyOffered.current = gift.id;
            setDay((current) =>
              current?.gift?.id === gift.id
                ? { ...current, gift, offerOnAppOpen: false }
                : current
            );
          }}
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
                  acceptDay(result);
              })
              .catch(() => {});
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerStack: {
    gap: 12,
  },
  mainCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroArt: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 165,
    height: 134,
    zIndex: 0,
  },
  headerArea: {
    zIndex: 1,
    maxWidth: '66%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloverIcon: {
    width: 32,
    height: 32,
  },
  titleText: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 6,
  },
  timelineContainer: {
    marginTop: 18,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  weekDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 4,
  },
  dayDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotChecked: {
    backgroundColor: '#14b8a6',
  },
  dayDotUnchecked: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  dotConnector: {
    width: 5,
    height: 1.5,
    backgroundColor: '#cbd5e1',
    marginBottom: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakText: {
    color: '#0d9488',
    fontSize: 13,
    fontWeight: '700',
  },
  actionPressable: {
    marginTop: 16,
    borderRadius: 30,
    zIndex: 1,
  },
  actionButton: {
    minHeight: 58,
    borderRadius: 30,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    marginRight: 4,
  },
  giftIcon: {
    marginRight: 10,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'left',
  },
  chevronCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 118, 110, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  afterCheckinBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  afterCheckinText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  collectionCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  collectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chestIcon: {
    width: 44,
    height: 44,
  },
  collectionText: {
    fontSize: 19,
    fontWeight: '800',
  },
  collectionArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
