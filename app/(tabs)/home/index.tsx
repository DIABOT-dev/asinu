import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, G, Rect } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, FadeInUp, interpolate, SharedValue, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsinuChatSticker from '../../../src/components/AsinuChatSticker';
import { DailyCheckinCard } from '../../../src/components/DailyCheckinCard';
import { HealthScoreCard } from '../../../src/components/HealthScoreCard';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { checkinApi } from '../../../src/features/checkin/checkin.api';
import { apiClient } from '../../../src/lib/apiClient';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
const ChatModal = React.lazy(() => import('../../../src/components/ChatModal'));
import { NotificationBell } from '../../../src/components/NotificationBell';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateError } from '../../../src/components/state/StateError';
import { HomeTabSkeleton } from '../../../src/components/state/MainScreenSkeletons';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useFlagsStore, selectIsChatbotAvailable } from '../../../src/features/app-config/flags.store';
import { useHomeViewModel } from '../../../src/features/home/home.vm';
import { LogEntry } from '../../../src/features/logs/logs.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { useInitialLoadingGate } from '../../../src/hooks/useInitialLoadingGate';
import { useNotificationStore } from '../../../src/stores/notification.store';
import { showToast, useToastStore } from '../../../src/stores/toast.store';
import { brandColors, categoryColors, colors, iconColors, radius, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import type { Mission } from '../../../src/features/missions/missions.store';
import React from 'react';
const GlucoseTrendChart = React.lazy(() => import('../../../src/ui-kit/GlucoseTrendChart').then(m => ({ default: m.GlucoseTrendChart })));
const T1ProgressRing = React.lazy(() => import('../../../src/ui-kit/T1ProgressRing').then(m => ({ default: m.T1ProgressRing })));


function InfoButton({ text, styles }: { text: string; styles: any }) {
  const [open, setOpen] = useState(false);
  const { t: tc } = useTranslation('common');
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.infoBtn}>
        <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.infoModalOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.infoModalBox} onPress={() => {}}>
            <View style={styles.infoModalHeader}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.infoModalTitle}>{tc('info')}</Text>
            </View>
            <Text style={styles.infoModalText}>{text}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function AnimatedBorderLight({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 20 }]}>
      <Animated.View style={[{ width: '200%', height: '200%', position: 'absolute', top: '-50%', left: '-50%' }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', color, 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: 18 }} />
    </View>
  );
}

function AnimatedHeartbeatPulse() {
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, right: 0, width: 240, height: 200 }, animatedStyle]} pointerEvents="none">
      <Svg height="200" width="240" style={{ position: 'absolute', top: 0, right: 0 }}>
        {/* EKG / Pulse line — Positioned on the RIGHT of the (+) cross */}
        <Path
          d="M 135 78 L 155 78 L 163 60 L 173 96 L 181 68 L 189 78 L 235 78"
          stroke="rgba(45, 212, 191, 0.65)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

type HomeMissionCarouselProps = {
  missions: Mission[];
  styles: ReturnType<typeof createStyles>;
  onOpen: (mission: Mission) => void;
};

function HomeMissionCarousel({ missions, styles, onOpen }: HomeMissionCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(240, Math.min(width - spacing.lg * 3 - spacing.md, 360));
  const snapInterval = cardWidth + spacing.md;
  const scrollX = useSharedValue(0);
  const listRef = useRef<Animated.FlatList<Mission>>(null);
  const activePositionRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselData = missions.length > 1 ? [...missions, ...missions] : missions;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    activePositionRef.current = 0;
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [missions.length, snapInterval]);

  useEffect(() => {
    if (missions.length < 2) return;
    const timer = setInterval(() => {
      const nextPosition = activePositionRef.current + 1;
      activePositionRef.current = nextPosition;
      setActiveIndex(nextPosition % missions.length);
      listRef.current?.scrollToOffset({ offset: nextPosition * snapInterval, animated: true });
    }, 4500);
    return () => clearInterval(timer);
  }, [missions.length, snapInterval]);

  const handleMomentumEnd = (offset: number) => {
    const position = Math.round(offset / snapInterval);
    const normalizedIndex = position % missions.length;
    activePositionRef.current = position;
    setActiveIndex(normalizedIndex);

    // The duplicated first card makes the loop move forward continuously.
    // Reset to the real first item after it settles without a visible jump.
    if (missions.length > 1 && position >= missions.length) {
      activePositionRef.current = 0;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      scrollX.value = 0;
    }
  };

  if (missions.length === 0) return null;

  return (
    <View style={styles.homeMissionCarousel}>
      <Animated.FlatList
        ref={listRef}
        data={carouselData}
        horizontal
        keyExtractor={(mission, index) => `${mission.id}-${index}`}
        renderItem={({ item, index }) => (
          <HomeMissionSlide
            mission={item}
            index={index}
            displayIndex={index % missions.length}
            cardWidth={cardWidth}
            snapInterval={snapInterval}
            scrollX={scrollX}
            styles={styles}
            onOpen={onOpen}
          />
        )}
        contentContainerStyle={styles.homeMissionCarouselContent}
        ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        onScroll={onScroll}
        onMomentumScrollEnd={(event) => handleMomentumEnd(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      />
      <View style={styles.homeMissionPagination}>
        {missions.map((mission, index) => (
          <View
            key={mission.id}
            style={[styles.homeMissionDot, index === activeIndex && styles.homeMissionDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

type HomeMissionSlideProps = {
  mission: Mission;
  index: number;
  displayIndex: number;
  cardWidth: number;
  snapInterval: number;
  scrollX: SharedValue<number>;
  styles: ReturnType<typeof createStyles>;
  onOpen: (mission: Mission) => void;
};

function HomeMissionSlide({ mission, index, displayIndex, cardWidth, snapInterval, scrollX, styles, onOpen }: HomeMissionSlideProps) {
  const ratio = mission.goal > 0 ? mission.progress / mission.goal : 0;
  const isCompleted = mission.status === 'completed';
  const slideStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval,
    ];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.78, 1, 0.78], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(scrollX.value, inputRange, [0.96, 1, 0.96], Extrapolation.CLAMP) }],
    };
  }, [index, snapInterval]);

  return (
    <Animated.View style={[styles.homeMissionSlide, { width: cardWidth }, slideStyle]}>
      <Pressable
        style={({ pressed }) => [styles.missionCard, isCompleted && styles.missionCardCompleted, pressed && { opacity: 0.85 }]}
        onPress={() => onOpen(mission)}
      >
        <View style={styles.missionTitleRow}>
          <View style={[styles.missionBadge, isCompleted && styles.missionBadgeCompleted]}>
            {isCompleted ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
            ) : (
              <Text style={styles.missionBadgeText}>{displayIndex + 1}</Text>
            )}
          </View>
          <Text style={[styles.missionTitle, isCompleted && styles.missionTitleCompleted, { flex: 1 }]}>{mission.title}</Text>
        </View>
        {mission.description ? <Text style={styles.missionDesc}>{mission.description}</Text> : null}
        <View style={styles.missionProgressRow}>
          <View style={styles.missionProgressTrack}>
            <LinearGradient
              colors={isCompleted ? [colors.emerald, colors.emeraldDark] : [colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.missionProgressFill, { width: `${Math.min(ratio * 100, 100)}%` }]}
            />
          </View>
          <Text style={styles.missionProgressText}>{mission.progress}/{mission.goal}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const flushPending = useToastStore((s) => s.flushPending);
  useEffect(() => { flushPending(); }, []);

  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const { t: tt } = useTranslation('tree');
  const [isChatOpen, setChatOpen] = useState(false);
  const isChatbotAvailable = useFlagsStore(selectIsChatbotAvailable);
  const fetchFlags = useFlagsStore((s) => s.fetchFlags);
  // Pull the latest flags whenever home screen is focused so a server-side
  // change to CHATBOT_ENABLED reaches users without an app restart.
  useFocusEffect(useCallback(() => { fetchFlags().catch(() => {}); }, [fetchFlags]));
  const router = useRouter();
  const {
    quickMetrics,
    missions,
    treeSummary,
    treeHistory,
    glucoseTrendData,
    logs,
    healthScore,
    logsStatus,
    missionsStatus,
    treeStatus,
    logsError,
    missionsError,
    treeError,
    isOffline,
    refreshAll
  } = useHomeViewModel();
  const profile = useAuthStore((state) => state.profile);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const fetchFromBackend = useNotificationStore(s => s.fetchFromBackend);
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const padTop = insets.top + spacing.lg;

  // Re-fetch when screen focuses, but throttle to avoid jank on quick tab switches
  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) return; // Skip if fetched within 3s
      lastFetchRef.current = now;
      refreshAll();
    }, [refreshAll])
  );

  // Fetch notifications on mount and periodically - only when logged in
  useEffect(() => {
    if (!profile) return;

    fetchFromBackend();
    const interval = setInterval(fetchFromBackend, 30000);
    // Re-fetch immediately when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchFromBackend();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [fetchFromBackend, profile]);

  // Check if user has checked in today — re-check every time screen focuses
  const [showCheckinBanner, setShowCheckinBanner] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      checkinApi.getToday()
        .then(res => {
          setTodaySession(res.session || null);
          setShowCheckinBanner(!res.session);
        })
        .catch(() => {});
    }, [profile])
  );

  // Navigate to checkin — check session trước, hiện modal nếu đã done
  const [showAlreadyDoneModal, setShowAlreadyDoneModal] = useState(false);
  const goToCheckin = useCallback(async () => {
    try {
      const res = await checkinApi.getToday();
      if (res.session) {
        const s = res.session;
        if (s.initial_status === 'fine' || s.flow_state === 'resolved') {
          setShowAlreadyDoneModal(true);
          return;
        }
      }
    } catch {}
    router.push('/checkin');
  }, []);

  const handleMissionOpen = useCallback((mission: Mission) => {
    if (mission.missionKey === 'daily_checkin') {
      goToCheckin();
      return;
    }
    const routes: Record<string, string> = {
      log_glucose: '/logs/glucose',
      log_bp: '/logs/blood-pressure',
      log_water: '/logs/water',
      log_weight: '/logs/weight',
    };
    router.push((routes[mission.missionKey] || '/(tabs)/missions') as any);
  }, [goToCheckin, router]);

  const healthFeedApi = useCallback(async <T,>(path: string, options?: any) => {
    return apiClient<T>(`/api/health-feed${path}`, options);
  }, []);

  // Health Feed states and effects
  const [healthFeedEnabled, setHealthFeedEnabled] = useState(false);
  const [healthFeedItems, setHealthFeedItems] = useState<any[]>([]);
  const unreadHealthFeedItems = healthFeedItems.filter(item => !item.read_at);
  const hasPriorityHealthFeed = unreadHealthFeedItems.some((item) => item.priority >= 100);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        healthFeedApi<any>('/feed')
          .then(res => {
            if (res.ok && res.enabled) {
              setHealthFeedEnabled(true);
              setHealthFeedItems(res.feed || []);
            } else {
              setHealthFeedEnabled(false);
            }
          })
          .catch(() => {});
      }
    }, [healthFeedApi, profile])
  );

  const handleOpenNotifications = useCallback(() => {
    void fetchFromBackend();
    router.push('/notifications');
  }, [fetchFromBackend, router]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshAll();
    await fetchFromBackend();
    if (profile) {
      try {
        const res = await healthFeedApi<any>('/feed');
        if (res.ok && res.enabled) {
          setHealthFeedEnabled(true);
          setHealthFeedItems(res.feed || []);
        } else {
          setHealthFeedEnabled(false);
        }
      } catch {}
    }
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthFeedApi, profile]); // Empty deps - refreshAll is stable

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = (logsStatus === 'loading' || missionsStatus === 'loading' || treeStatus === 'loading') && !hasData;
  const showInitialSkeleton = useInitialLoadingGate(!loading);
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  const renderHealthFeedBlock = () => {
    if (!healthFeedEnabled) return null;

    return (
      <Animated.View entering={FadeIn.delay(135).duration(350)} style={styles.healthFeedContainer}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Asinu nhắc bạn</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push('/feed' as any)} hitSlop={12}>
            <Text style={styles.healthFeedSeeAllText}>Xem tất cả ({healthFeedItems.length})</Text>
          </Pressable>
        </View>

        {unreadHealthFeedItems.length > 0 ? (
          <View style={styles.healthFeedList}>
            {unreadHealthFeedItems.slice(0, 2).map((item) => {
              const isRead = !!item.read_at;
              const isWarning = item.severity_level === 'warning' || item.priority >= 100;

              const getIcon = (type: string) => {
                switch (type) {
                  case 'checklist':
                    return <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={iconColors.primary} />;
                  case 'warning':
                    return <MaterialCommunityIcons name="alert-circle-outline" size={22} color={iconColors.danger} />;
                  case 'family_note':
                    return <MaterialCommunityIcons name="account-group-outline" size={22} color={iconColors.orange} />;
                  case 'weekly_summary':
                    return <MaterialCommunityIcons name="chart-line" size={22} color={iconColors.indigo} />;
                  default:
                    return <MaterialCommunityIcons name="book-open-variant" size={22} color={iconColors.cyan} />;
                }
              };

              const handleHomeDismiss = async (itemId: string) => {
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await healthFeedApi(`/feed/${itemId}/dismiss`, { method: 'POST' });
                  setHealthFeedItems(prev => prev.filter(i => i.id !== itemId));
                  showToast(tc('feedDismissed'), 'success');
                } catch (err) {
                  console.error('[Home Health Feed] Failed to dismiss:', err);
                  showToast(tc('feedActionFailed'), 'error');
                }
              };

              const handleHomePress = async (i: any) => {
                try {
                  await healthFeedApi(`/feed/${i.id}/read`, { method: 'POST' });
                  setHealthFeedItems(prev =>
                    prev.map(item => (item.id === i.id ? { ...item, read_at: new Date().toISOString() } : item))
                  );
                  healthFeedApi(`/event`, {
                    method: 'POST',
                    body: { content_id: i.content_id, event_type: 'viewed' }
                  }).catch(() => {});
                } catch {}
                router.push(`/feed/${i.content_id}` as any);
              };

              const renderRightAction = () => (
                <Pressable
                  style={styles.healthFeedDismissBtn}
                  onPress={() => handleHomeDismiss(item.id)}
                >
                  <Ionicons name="eye-off-outline" size={20} color="#fff" />
                </Pressable>
              );

              return (
                <Swipeable
                  key={item.id}
                  renderRightActions={renderRightAction}
                  onSwipeableOpen={(direction) => {
                    if (direction === 'right') {
                      handleHomeDismiss(item.id);
                    }
                  }}
                >
                  <Pressable
                    style={[
                      styles.healthFeedCard,
                      isRead && styles.healthFeedCardRead,
                      isWarning && styles.healthFeedCardWarning,
                    ]}
                    onPress={() => handleHomePress(item)}
                  >
                    <View style={styles.healthFeedIconWrapper}>
                      {getIcon(item.feed_type)}
                    </View>

                    <View style={styles.healthFeedCardContent}>
                      <Text style={[styles.healthFeedCardTitle, isRead && styles.healthFeedCardTitleRead]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.healthFeedCardMessage, isRead && styles.healthFeedCardMessageRead]} numberOfLines={1}>
                        {item.message}
                      </Text>
                    </View>

                    {isWarning && !isRead && <View style={styles.healthFeedWarningDot} />}

                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.healthFeedChevron} />
                  </Pressable>
                </Swipeable>
              );
            })}
          </View>
        ) : (
          <View style={styles.healthFeedEmptyCard}>
            <Image
              source={require('../../../assets/asinu_chat_sticker.png')}
              style={styles.healthFeedEmptyMascot}
              resizeMode="contain"
            />
            <View style={styles.healthFeedEmptyTextContainer}>
              <Text style={styles.healthFeedEmptyTitle}>Đã đọc hết nhắc nhở!</Text>
              <Text style={styles.healthFeedEmptyMessage}>
                Tuyệt vời! Bác đã đọc hết các nhắc nhở hôm nay. Chúc bác một ngày tràn đầy năng lượng!
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <Screen>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#e0f7f4', '#f0fbf9', '#f8fafc', '#f8fafc']}
        locations={[0, 0.2, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Modal: Đã check-in rồi */}
      <Modal visible={showAlreadyDoneModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowAlreadyDoneModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }} onPress={() => setShowAlreadyDoneModal(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, width: '100%', maxWidth: 320 }} onPress={() => {}}>
            <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>{t('alreadyCheckedIn')}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{t('alreadyCheckedInSub')}</Text>
            <Pressable style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 4 }} onPress={() => setShowAlreadyDoneModal(false)}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{tc('understood')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {isOffline ? <OfflineBanner /> : null}
      
      {/* Notification Bell — chỉ hiện khi đã đăng nhập */}
      {profile && (
        <View style={[styles.notificationContainer, { top: insets.top + spacing.sm }]}>
          <NotificationBell
            unreadCount={unreadCount}
            onOpen={handleOpenNotifications}
          />
        </View>
      )}

      {!showInitialSkeleton && noDataError ? <StateError onRetry={refreshAll} message={tc('cannotLoadData')} /> : null}
      {!showInitialSkeleton && !hasData && !loading && !noDataError ? <StateError onRetry={refreshAll} message={tc('noData')} /> : null}
      <RippleRefreshScrollView
        refreshing={refreshing || loading}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {showInitialSkeleton ? (
          <HomeTabSkeleton />
        ) : (
        <>
        {/* Hero Banner */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
        <View style={styles.heroBanner}>
          {/* Header Graphic (White Cross on LEFT, Leaf Petals + Animated EKG Pulse Line on RIGHT) */}
          <View style={{ position: 'absolute', top: -20, right: -spacing.lg, width: 240, height: 200 }} pointerEvents="none">
            <Svg height="200" width="240" style={{ position: 'absolute', top: 0, right: 0 }}>
              <Defs>
                <SvgGradient id="leafTint" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.18" />
                  <Stop offset="100%" stopColor="#0d9488" stopOpacity="0.04" />
                </SvgGradient>
              </Defs>

              {/* Leaf Petals fanning towards top right */}
              <Path
                d="M 170 120 C 170 70, 210 20, 240 10 C 225 50, 210 90, 170 120 Z"
                fill="url(#leafTint)"
              />
              <Path
                d="M 160 130 C 180 90, 225 55, 240 50 C 215 80, 190 115, 160 130 Z"
                fill="url(#leafTint)"
              />
              <Path
                d="M 155 140 C 190 110, 235 90, 240 95 C 205 120, 175 140, 155 140 Z"
                fill="url(#leafTint)"
              />

              {/* Solid White Medical Cross (+) — Positioned on the LEFT of the heartbeat line */}
              <G transform="translate(72, 28)">
                <Rect x="0" y="21" width="58" height="20" rx="7" fill="#ffffff" fillOpacity="0.88" />
                <Rect x="19" y="0" width="20" height="58" rx="7" fill="#ffffff" fillOpacity="0.88" />
              </G>
            </Svg>

            {/* Animated EKG / Pulse line — Gently pulsing on the RIGHT of the (+) cross */}
            <AnimatedHeartbeatPulse />
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>{t('greeting')}</Text>
            <Text style={styles.heroName}>{profile?.name || t('defaultName')}</Text>
            <Text style={styles.heroSummary}>{t('heroSummary')}</Text>
          </View>
        </View>
        </Animated.View>

        {/* Check-in reminder banner */}
        {showCheckinBanner && (
          <Animated.View entering={FadeIn.delay(100).duration(300)}>
            <Pressable
              style={styles.checkinBanner}
              onPress={() => { setShowCheckinBanner(false); goToCheckin(); }}
            >
              <MaterialCommunityIcons name="emoticon-happy-outline" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkinBannerText}>{t('checkinReminder')}</Text>
              </View>
              <Pressable hitSlop={12} onPress={() => setShowCheckinBanner(false)}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          </Animated.View>
        )}

        {hasPriorityHealthFeed && renderHealthFeedBlock()}



        {/* Metrics Row */}
        <Animated.View entering={FadeIn.delay(80).duration(350)}>
        <View style={styles.metricsRow}>
          <Pressable style={[styles.metricCard, styles.metricCardGlucose]} onPress={() => router.push('/logs/glucose')}>
            <MaterialCommunityIcons name="water" size={22} color={iconColors.glucose} />
            <Text style={styles.metricTitle}>{t('glucose')}</Text>
            <Text style={[styles.metricValue, { color: '#0d9488' }]}>{quickMetrics.glucose ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMgdl')}</Text>
          </Pressable>
          <Pressable style={[styles.metricCard, styles.metricCardBP]} onPress={() => router.push('/logs/blood-pressure')}>
            <MaterialCommunityIcons name="heart-pulse" size={22} color={iconColors.bp} />
            <Text style={styles.metricTitle}>{t('bloodPressure')}</Text>
            <Text style={[styles.metricValue, { color: '#ea580c' }]}>{quickMetrics.bloodPressure ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMmhg')}</Text>
          </Pressable>
        </View>
        </Animated.View>

        {/* Health Score Card */}
        {healthScore && (
          <Animated.View entering={FadeIn.delay(120).duration(350)}>
            <HealthScoreCard
              level={healthScore.level}
              factors={healthScore.factors}
              checkinDone={healthScore.checkinDone}
            />
          </Animated.View>
        )}

        {!hasPriorityHealthFeed && renderHealthFeedBlock()}

        <Animated.View entering={FadeIn.delay(150).duration(350)}>
        <DailyCheckinCard />
        </Animated.View>


        {isChatbotAvailable && (
          <Animated.View entering={FadeIn.delay(190).duration(350)}>
            <AsinuChatSticker onPress={() => setChatOpen(true)} />
          </Animated.View>
        )}

        {/* Section Header */}
        <Animated.View entering={FadeIn.delay(210).duration(350)}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="flag" size={20} color={iconColors.warning} />
          <Text style={styles.sectionTitle}>{t('todayMissions')}</Text>
          <View style={{ flex: 1 }} />
          <InfoButton text={t('missionsRefreshDaily')} styles={styles} />
        </View>
        <View style={styles.cardList}>
        <HomeMissionCarousel missions={missions} styles={styles} onOpen={handleMissionOpen} />
        {missions.length > 0 && (
          <Pressable style={styles.seeMoreBtn} onPress={() => router.push('/missions')}>
            <Text style={styles.seeMoreText}>{tc('viewMore')}</Text>
            <Ionicons name="chevron-forward" size={16} color={iconColors.primary} />
          </Pressable>
        )}
        </View>
        </Animated.View>

        {/* Tree Section */}
        <Animated.View entering={FadeIn.delay(260).duration(350)}>
        <View style={styles.sectionHeaderRow}>
            <Ionicons name="leaf" size={20} color={iconColors.emerald} />
          <Text style={styles.sectionTitle}>{t('healthTree')}</Text>
          <View style={{ flex: 1 }} />
          <InfoButton text={t('treeFormula')} styles={styles} />
        </View>
        <View style={styles.healthTreeCard}>
          <View style={styles.healthTreeOverview}>
            <Suspense fallback={<View style={styles.healthTreeRingFallback} />}>
              <T1ProgressRing
                percentage={treeSummary?.score ?? 0}
                label={t('score')}
                size={112}
                strokeWidth={9}
                accentColor={colors.primary}
              />
            </Suspense>
            <View style={styles.healthTreeOverviewCopy}>
              <View style={styles.healthTreeStatusRow}>
                <MaterialCommunityIcons name="sprout-outline" size={18} color={iconColors.emerald} />
                <Text style={styles.healthTreeStatusLabel}>
                  {(treeSummary?.score ?? 0) >= 0.7 ? tt('good') : (treeSummary?.score ?? 0) >= 0.4 ? tt('average') : tt('needsImprovement')}
                </Text>
              </View>
              <Text style={styles.healthTreeStatusText}>{t('treeFormula')}</Text>
            </View>
          </View>

          <View style={styles.healthTreeMetricsRow}>
            <View style={styles.healthTreeMetric}>
              <Ionicons name="flame-outline" size={18} color={iconColors.premium} />
              <Text style={styles.healthTreeMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {treeSummary?.streakDays ?? 0} {t('days')}
              </Text>
              <Text style={styles.healthTreeMetricLabel} numberOfLines={1}>{t('streak')}</Text>
            </View>
            <View style={styles.healthTreeMetricDivider} />
            <View style={styles.healthTreeMetric}>
              <Ionicons name="checkmark-circle-outline" size={18} color={iconColors.emerald} />
              <Text style={styles.healthTreeMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {treeSummary?.completedToday ?? 0}/{treeSummary?.totalMissions ?? 0}
              </Text>
              <Text style={styles.healthTreeMetricLabel} numberOfLines={1}>{t('todayMissions')}</Text>
            </View>
          </View>

          <Pressable style={styles.treeBtn} onPress={() => router.push('/tree')}>
            <Text style={styles.treeBtnText}>{tc('viewDetails')}</Text>
            <Ionicons name="chevron-forward" size={18} color={iconColors.primary} />
          </Pressable>
        </View>
        </Animated.View>

        {/* Chart Section */}
        <Animated.View entering={FadeIn.delay(310).duration(350)}>
        <View style={styles.sectionHeaderRow}>
            <Ionicons name="trending-up" size={20} color={iconColors.indigo} />
          <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('glucoseTrend')}</Text>
          <InfoButton text={t('last7Days')} styles={styles} />
        </View>
        <Suspense fallback={<View style={{ height: 240 }} />}>
          <GlucoseTrendChart
            data={glucoseTrendData.length > 0 ? glucoseTrendData : []}
          />
        </Suspense>
        </Animated.View>

        {/* Recent Logs */}
        <Animated.View entering={FadeIn.delay(360).duration(350)}>
        <View style={styles.sectionHeaderRow}>
            <Ionicons name="journal" size={20} color={iconColors.pink} />
          <Text style={styles.sectionTitle}>{t('recentLogs')}</Text>
        </View>
        {logs.filter((log: LogEntry) => ['glucose', 'blood-pressure', 'water', 'weight'].includes(log.type)).length === 0 ? (
          <View style={styles.emptyLogsContainer}>
            <Ionicons name="document-text-outline" size={40} color={iconColors.primary} />
            <Text style={styles.emptyLogsTitle}>{t('noLogsYet')}</Text>
            <Text style={styles.emptyLogsSub}>{t('noLogsSub')}</Text>
          </View>
        ) : (
          <View style={styles.logsGrid}>
            {logs.filter((log: LogEntry) => ['glucose', 'blood-pressure', 'water', 'weight'].includes(log.type)).slice(0, 3).map((log: LogEntry) => {
              const logMeta: Record<string, { bg: string; iconBg: string; color: string; icon: string }> = {
                'glucose':        { bg: '#e8f4fd', iconBg: '#bfdbfe', color: iconColors.glucose,    icon: 'water' },
                'blood-pressure': { bg: '#fde8e8', iconBg: '#fecaca', color: iconColors.bp,         icon: 'heart-pulse' },
                'weight':         { bg: '#ede8fd', iconBg: '#ddd6fe', color: iconColors.weight,     icon: 'scale-bathroom' },
                'water':          { bg: '#e8f8fc', iconBg: '#a5f3fc', color: iconColors.water,      icon: 'cup-water' },
              };
              const meta = logMeta[log.type] ?? { bg: colors.surfaceMuted, iconBg: colors.border, color: colors.textSecondary, icon: 'dots-horizontal' };
              return (
              <View key={log.id} style={[styles.logCard, { backgroundColor: meta.bg }]}>
                <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
                <View style={styles.logContent}>
                  <Text style={styles.logType}>{t(`logType${log.type === 'blood-pressure' ? 'BloodPressure' : log.type.charAt(0).toUpperCase() + log.type.slice(1)}` as any)}</Text>
                  <Text style={styles.logValue}>
                    {log.type === 'glucose' && (log.value ? `${log.value} ${tc('unitMgdl')}` : tc('noData'))}
                    {log.type === 'blood-pressure' && (log.systolic && log.diastolic ? `${log.systolic}/${log.diastolic} ${tc('unitMmhg')}` : tc('noData'))}
                    {log.type === 'weight' && (log.weight_kg ? `${log.weight_kg} ${tc('unitKg')}` : tc('noData'))}
                    {log.type === 'water' && (log.volume_ml ? `${log.volume_ml} ${tc('unitMl')}` : tc('noData'))}
                  </Text>
                  {log.recordedAt ? (
                    <Text style={styles.logTime}>
                      {(() => {
                        const d = new Date(log.recordedAt);
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        const ss = String(d.getSeconds()).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mo = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return `${hh}:${mm}:${ss} ${dd}/${mo}/${yyyy}`;
                      })()}
                    </Text>
                  ) : null}
                </View>
              </View>
              );
            })}
          </View>
        )}
        </Animated.View>
        </>
        )}
      </RippleRefreshScrollView>
{isChatOpen && (
        <Suspense fallback={null}>
          <ChatModal visible={isChatOpen} onClose={() => setChatOpen(false)} />
        </Suspense>
      )}
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  const translucentCardSurface = Platform.select({
    android: {
      backgroundColor: '#F7FFFC',
      shadowOpacity: 0.025,
      elevation: 1,
    },
    default: {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      shadowOpacity: 0.05,
      elevation: 2,
    },
  })!;

  const brightCardSurface = Platform.select({
    android: {
      backgroundColor: '#F9FFFD',
      shadowOpacity: 0.02,
      elevation: 1,
    },
    default: {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      shadowOpacity: 0.03,
      elevation: 2,
    },
  })!;

  return StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl
  },
  notificationContainer: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 1000,
  },
  checkinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#e6faf8',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkinBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f766e',
  },
  heroBanner: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'visible',
  },
  heroContent: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d9488',
    marginTop: 2,
    marginBottom: 4,
  },
  heroSummary: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  heroSettingsBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: spacing.lg,
  },
  metricCardGlucose: {
    borderWidth: 1.2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricCardBP: {
    borderWidth: 1.2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricTitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoBtn: {
    padding: 2,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  infoModalBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoModalTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoModalText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  cardList: {
    gap: spacing.md
  },
  homeMissionCarousel: {
    gap: spacing.sm,
  },
  homeMissionCarouselContent: {
    paddingRight: spacing.lg,
  },
  homeMissionSlide: {
    paddingVertical: spacing.xs,
  },
  homeMissionPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  homeMissionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  homeMissionDotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  missionCard: {
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...translucentCardSurface,
    gap: spacing.sm
  },
  missionCardCompleted: {
    borderColor: colors.border,
    backgroundColor: colors.emeraldLight,
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missionBadge: {},
  missionBadgeCompleted: {},
  missionBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: typography.size.md,
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  missionTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  missionDesc: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  missionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  missionProgressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden'
  },
  missionProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  missionProgressText: {
    fontWeight: '600',
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  missionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  missionBtnCompleted: {
    backgroundColor: colors.emeraldLight,
  },
  missionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  missionBtnTextCompleted: {
    color: colors.emeraldDark,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  seeMoreText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  healthTreeCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: spacing.lg,
  },
  healthTreeOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  healthTreeRingFallback: {
    width: 112,
    height: 112,
  },
  healthTreeOverviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  healthTreeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  healthTreeStatusLabel: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  healthTreeStatusText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  healthTreeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  healthTreeMetric: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  healthTreeMetricValue: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  healthTreeMetricLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  healthTreeMetricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: colors.border,
  },
  treeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  treeBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  logsGrid: {
    gap: spacing.sm,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...translucentCardSurface,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyLogsTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyLogsSub: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  logContent: {
    flex: 1,
  },
  logType: {
    textTransform: 'capitalize',
    color: colors.textSecondary,
    fontSize: typography.size.sm
  },
  logValue: {
    fontWeight: '600',
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  logTime: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportCard: {
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: brandColors.indigo + '18',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reportTitle: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportSub: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  healthFeedContainer: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  healthFeedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  healthFeedSectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  healthFeedSeeAllText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: '700',
  },
  healthFeedList: {
    gap: spacing.sm,
  },
  healthFeedCard: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...brightCardSurface,
    marginBottom: 2,
  },
  healthFeedCardRead: {
    opacity: 0.65,
    backgroundColor: '#f8fafc',
  },
  healthFeedCardWarning: {
    backgroundColor: '#fffaf8',
  },
  healthFeedIconWrapper: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  healthFeedCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  healthFeedCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  healthFeedCardTitleRead: {
    fontWeight: '600',
  },
  healthFeedCardMessage: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  healthFeedCardMessageRead: {
    fontStyle: 'italic',
  },
  healthFeedWarningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginHorizontal: spacing.sm,
  },
  healthFeedChevron: {
    marginLeft: spacing.xs,
  },
  healthFeedDismissBtn: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    borderRadius: 16,
    height: 80,
    marginLeft: 10,
  },
  healthFeedEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...brightCardSurface,
    minHeight: 90,
  },
  healthFeedEmptyMascot: {
    width: 56,
    height: 56,
    marginRight: spacing.sm,
  },
  healthFeedEmptyTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  healthFeedEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  healthFeedEmptyMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
}
