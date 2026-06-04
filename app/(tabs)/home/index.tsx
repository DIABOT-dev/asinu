import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
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
import { ScreenReadyGate } from '../../../src/components/ScreenReadyGate';
import { StateError } from '../../../src/components/state/StateError';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useFlagsStore, selectIsChatbotAvailable } from '../../../src/features/app-config/flags.store';
import { useHomeViewModel } from '../../../src/features/home/home.vm';
import { LogEntry } from '../../../src/features/logs/logs.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { useNotificationStore } from '../../../src/stores/notification.store';
import { routeFromNotificationData } from '../../../src/lib/notifications';
import { useToastStore } from '../../../src/stores/toast.store';
import { brandColors, categoryColors, colors, iconColors, radius, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
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

function FloatingLeaf({ x, y, rotate, size, color, delay = 0 }: any) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, delay);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate }, { translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', ...(y.top !== undefined ? { top: y.top } : {}), ...(y.bottom !== undefined ? { bottom: y.bottom } : {}), ...(x.left !== undefined ? { left: x.left } : {}), ...(x.right !== undefined ? { right: x.right } : {}) }, animatedStyle]}>
      <Ionicons name="leaf" size={size} color={color} />
    </Animated.View>
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
  const notifications = useNotificationStore(s => s.notifications);
  const unreadCount = useNotificationStore(s => s.unreadCount);
  const notifLoading = useNotificationStore(s => s.loading);
  const markAsRead = useNotificationStore(s => s.markAsRead);
  const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
  const removeNotification = useNotificationStore(s => s.removeNotification);
  const clearAll = useNotificationStore(s => s.clearAll);
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

  // PHFNE Personalized Health Feed Engine states and effects
  const [phfneEnabled, setPhfneEnabled] = useState(false);
  const [phfneFeed, setPhfneFeed] = useState<any[]>([]);
  const unreadPhfneFeed = phfneFeed.filter(item => !item.read_at);

  useFocusEffect(
    useCallback(() => {
      if (process.env.EXPO_PUBLIC_ENABLE_PHFNE === 'true' && profile) {
        apiClient<any>('/api/phfne/feed')
          .then(res => {
            if (res.ok && res.enabled) {
              setPhfneEnabled(true);
              setPhfneFeed(res.feed || []);
            } else {
              setPhfneEnabled(false);
            }
          })
          .catch(() => {});
      }
    }, [profile])
  );

  const handleNotificationPress = useCallback((notification: any) => {
    const route = routeFromNotificationData(notification?.data);
    if (!route) return;
    if (typeof route === 'string') router.push(route as any);
    else router.push(route as any);
  }, []);

  const canNavigateNotification = useCallback((notification: any) => {
    return Boolean(routeFromNotificationData(notification?.data));
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshAll();
    await fetchFromBackend();
    if (process.env.EXPO_PUBLIC_ENABLE_PHFNE === 'true' && profile) {
      try {
        const res = await apiClient<any>('/api/phfne/feed');
        if (res.ok && res.enabled) {
          setPhfneEnabled(true);
          setPhfneFeed(res.feed || []);
        } else {
          setPhfneEnabled(false);
        }
      } catch {}
    }
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]); // Empty deps - refreshAll is stable

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = (logsStatus === 'loading' || missionsStatus === 'loading' || treeStatus === 'loading') && !hasData;
  const initialHomePending =
    !profile ||
    loading ||
    logsStatus === 'idle' ||
    missionsStatus === 'idle' ||
    treeStatus === 'idle';
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  return (
    <ScreenReadyGate
      ready={!initialHomePending}
      fallback={
        <Screen deferRender={false}>
          <LinearGradient
            colors={['#0d9488', '#2dd4bf', '#ccfbf1', '#f8fafc']}
            locations={[0, 0.2, 0.4, 0.8]}
            style={StyleSheet.absoluteFillObject}
          />
          <StateLoading overlay={false} />
        </Screen>
      }
    >
      <Screen deferRender={false}>
      <LinearGradient
        colors={['#0d9488', '#2dd4bf', '#ccfbf1', '#f8fafc']}
        locations={[0, 0.2, 0.4, 0.8]}
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
            notifications={notifications}
            unreadCount={unreadCount}
            loading={notifLoading}
            onOpen={fetchFromBackend}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDelete={removeNotification}
            onDeleteAll={clearAll}
            onNotificationPress={handleNotificationPress}
            canNavigateNotification={canNavigateNotification}
          />
        </View>
      )}

      {loading ? <StateLoading /> : null}
      {noDataError ? <StateError onRetry={refreshAll} message={tc('cannotLoadData')} /> : null}
      {!hasData && !loading && !noDataError ? <StateError onRetry={refreshAll} message={tc('noData')} /> : null}
      <RippleRefreshScrollView
        refreshing={refreshing || loading}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
        <View style={styles.heroBanner}>
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



        {/* Metrics Row */}
        <Animated.View entering={FadeIn.delay(80).duration(350)}>
        <View style={styles.metricsRow}>
          <Pressable style={[styles.metricCard, styles.metricCardGlucose, { borderWidth: 0, backgroundColor: 'transparent' }]} onPress={() => router.push('/logs/glucose')}>
            <AnimatedBorderLight color="#0ea5e9" />
            
            <MaterialCommunityIcons name="water" size={22} color={iconColors.glucose} />
            <Text style={styles.metricTitle}>{t('glucose')}</Text>
            <Text style={[styles.metricValue, { textShadowColor: '#2dd4bf', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10, color: '#0d9488' }]}>{quickMetrics.glucose ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMgdl')}</Text>
          </Pressable>
          <Pressable style={[styles.metricCard, styles.metricCardBP, { borderWidth: 0, backgroundColor: 'transparent' }]} onPress={() => router.push('/logs/blood-pressure')}>
            <AnimatedBorderLight color="#fb923c" />
            
            <MaterialCommunityIcons name="heart-pulse" size={22} color={iconColors.bp} />
            <Text style={styles.metricTitle}>{t('bloodPressure')}</Text>
            <Text style={[styles.metricValue, { textShadowColor: '#fb923c', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10, color: '#ea580c' }]}>{quickMetrics.bloodPressure ?? '--'}</Text>
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

        {/* PHFNE "Asinu nhắc bạn" block */}
        {phfneEnabled && (
          <Animated.View entering={FadeIn.delay(135).duration(350)} style={styles.phfneContainer}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Asinu nhắc bạn</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => router.push('/feed' as any)} hitSlop={12}>
                <Text style={styles.phfneSeeAllText}>Xem tất cả ({phfneFeed.length})</Text>
              </Pressable>
            </View>

            {unreadPhfneFeed.length > 0 ? (
              <View style={styles.phfneList}>
                {unreadPhfneFeed.slice(0, 2).map((item) => {
                  const isRead = !!item.read_at;
                  const isWarning = item.severity_level === 'warning' || item.priority >= 100;
                  
                  const getIcon = (type: string) => {
                    switch (type) {
                      case 'checklist':
                        return <Ionicons name="checkbox" size={20} color={colors.primary} />;
                      case 'warning':
                        return <Ionicons name="warning" size={20} color="#ef4444" />;
                      case 'family_note':
                        return <Ionicons name="people" size={20} color="#f97316" />;
                      case 'weekly_summary':
                        return <Ionicons name="stats-chart" size={20} color="#8b5cf6" />;
                      default:
                        return <Ionicons name="book" size={20} color="#06b6d4" />;
                    }
                  };

                  const handleHomeDismiss = async (itemId: string) => {
                    try {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      await apiClient(`/api/phfne/feed/${itemId}/dismiss`, { method: 'POST' });
                      setPhfneFeed(prev => prev.filter(i => i.id !== itemId));
                    } catch (err) {
                      console.error('[Home PHFNE] Failed to dismiss:', err);
                    }
                  };

                  const handleHomePress = async (i: any) => {
                    try {
                      await apiClient(`/api/phfne/feed/${i.id}/read`, { method: 'POST' });
                      setPhfneFeed(prev =>
                        prev.map(item => (item.id === i.id ? { ...item, read_at: new Date().toISOString() } : item))
                      );
                      apiClient(`/api/phfne/event`, {
                        method: 'POST',
                        body: { content_id: i.content_id, event_type: 'viewed' }
                      }).catch(() => {});
                    } catch {}
                    router.push(`/feed/${i.content_id}` as any);
                  };

                  const renderRightAction = () => (
                    <Pressable
                      style={styles.phfneDismissBtn}
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
                          styles.phfneCard,
                          isRead && styles.phfneCardRead,
                          isWarning && styles.phfneCardWarning,
                        ]}
                        onPress={() => handleHomePress(item)}
                      >
                        <View style={styles.phfneIconWrapper}>
                          {getIcon(item.feed_type)}
                        </View>
                        
                        <View style={styles.phfneCardContent}>
                          <Text style={[styles.phfneCardTitle, isRead && styles.phfneCardTitleRead]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.phfneCardMessage, isRead && styles.phfneCardMessageRead]} numberOfLines={1}>
                            {item.message}
                          </Text>
                        </View>

                        {isWarning && !isRead && <View style={styles.phfneWarningDot} />}
                        
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.phfneChevron} />
                      </Pressable>
                    </Swipeable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.phfneEmptyCard}>
                <Image
                  source={require('../../../assets/asinu_chat_sticker.png')}
                  style={styles.phfneEmptyMascot}
                  resizeMode="contain"
                />
                <View style={styles.phfneEmptyTextContainer}>
                  <Text style={styles.phfneEmptyTitle}>Đã đọc hết nhắc nhở!</Text>
                  <Text style={styles.phfneEmptyMessage}>
                    Tuyệt vời! Bác đã đọc hết các nhắc nhở hôm nay. Chúc bác một ngày tràn đầy năng lượng!
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

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
        {missions.slice(0, 3).map((mission, index) => {
          const ratio = mission.goal > 0 ? mission.progress / mission.goal : 0;
          const isCompleted = mission.status === 'completed';
          return (
            <Pressable key={mission.id} style={({ pressed }) => [styles.missionCard, isCompleted && styles.missionCardCompleted, pressed && { opacity: 0.85 }]} onPress={() => {
              if (mission.missionKey === 'daily_checkin') {
                goToCheckin();
                return;
              }
              const routes: Record<string, string> = {
                log_glucose: '/logs/glucose',
                log_bp: '/logs/blood-pressure',
                log_water: '/logs/water',
                log_meal: '/logs/meal',
                log_weight: '/logs/weight',
                log_medication: '/logs/medication',
                log_insulin: '/logs/insulin',
              };
              router.push((routes[mission.missionKey] || '/(tabs)/missions') as any);
            }}>
              <View style={styles.missionTitleRow}>
                <View style={[styles.missionBadge, isCompleted && styles.missionBadgeCompleted]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
                  ) : (
                    <Text style={styles.missionBadgeText}>{index + 1}</Text>
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
          );
        })}
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
        <View style={styles.treeCards}>
          <View style={styles.treeCard}>
            <View style={{ position: 'relative', width: 160, height: 140, justifyContent: 'center', alignItems: 'center' }}>
              {/* Background Glow */}
              <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(52, 211, 153, 0.3)', shadowColor: '#34d399', shadowOpacity: 1, shadowRadius: 35, shadowOffset: { width: 0, height: 0 }, elevation: 20 }} />
              
              {/* Decorative Leaves */}
              <FloatingLeaf size={14} color="#6ee7b7" x={{ left: 25 }} y={{ top: 15 }} rotate="-35deg" delay={0} />
              <FloatingLeaf size={22} color="#34d399" x={{ left: 0 }} y={{ top: 50 }} rotate="-75deg" delay={400} />
              <FloatingLeaf size={12} color="#6ee7b7" x={{ left: 20 }} y={{ bottom: 30 }} rotate="-110deg" delay={800} />
              
              <FloatingLeaf size={14} color="#6ee7b7" x={{ right: 25 }} y={{ top: 25 }} rotate="45deg" delay={200} />
              <FloatingLeaf size={20} color="#34d399" x={{ right: 5 }} y={{ top: 60 }} rotate="80deg" delay={600} />
              <FloatingLeaf size={18} color="#34d399" x={{ right: 15 }} y={{ bottom: 25 }} rotate="120deg" delay={1000} />
              
              <Suspense fallback={<View style={{ width: 120, height: 120 }} />}>
                <T1ProgressRing percentage={treeSummary?.score ?? 0.6} label={t('score')} accentColor="#34d399" />
              </Suspense>
            </View>
            <Text style={styles.treeStatLabel}>
              {Math.round((treeSummary?.score ?? 0) * 100)}% - {(treeSummary?.score ?? 0) >= 0.7 ? tt('good') : (treeSummary?.score ?? 0) >= 0.4 ? tt('average') : tt('needsImprovement')}
            </Text>
          </View>
          <View style={styles.treeCard}>
            <View style={styles.treeStatItem}>
              <Ionicons name="flame" size={18} color={iconColors.premium} />
              <View style={{ flex: 1, overflow: 'hidden' }}>
                <Text style={styles.treeStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{treeSummary?.streakDays ?? 0} {t('days')}</Text>
                <Text style={styles.treeStatLabel} numberOfLines={1}>{t('streak')}</Text>
              </View>
            </View>
          </View>
          <View style={styles.treeCard}>
            <View style={styles.treeStatItem}>
              <Ionicons name="checkmark-circle" size={18} color={iconColors.emerald} />
              <View style={{ flex: 1, overflow: 'hidden' }}>
                <Text style={styles.treeStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{treeSummary?.completedToday ?? 0}/{treeSummary?.totalMissions ?? 0}</Text>
                <Text style={styles.treeStatLabel} numberOfLines={1}>{t('todayMissions')}</Text>
              </View>
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
        {logs.length === 0 ? (
          <View style={styles.emptyLogsContainer}>
            <Ionicons name="document-text-outline" size={40} color={iconColors.primary} />
            <Text style={styles.emptyLogsTitle}>{t('noLogsYet')}</Text>
            <Text style={styles.emptyLogsSub}>{t('noLogsSub')}</Text>
          </View>
        ) : (
          <View style={styles.logsGrid}>
            {logs.slice(0, 3).map((log: LogEntry) => {
              const logMeta: Record<string, { bg: string; iconBg: string; color: string; icon: string }> = {
                'glucose':        { bg: '#e8f4fd', iconBg: '#bfdbfe', color: iconColors.glucose,    icon: 'water' },
                'blood-pressure': { bg: '#fde8e8', iconBg: '#fecaca', color: iconColors.bp,         icon: 'heart-pulse' },
                'weight':         { bg: '#ede8fd', iconBg: '#ddd6fe', color: iconColors.weight,     icon: 'scale-bathroom' },
                'water':          { bg: '#e8f8fc', iconBg: '#a5f3fc', color: iconColors.water,      icon: 'cup-water' },
                'medication':     { bg: '#e8faf2', iconBg: '#a7f3d0', color: iconColors.medication, icon: 'pill' },
                'meal':           { bg: '#fef6e8', iconBg: '#fde68a', color: iconColors.meal,       icon: 'food' },
                'insulin':        { bg: '#eceefe', iconBg: '#c7d2fe', color: iconColors.insulin,    icon: 'needle' },
              };
              const meta = logMeta[log.type] ?? { bg: colors.surfaceMuted, iconBg: colors.border, color: colors.textSecondary, icon: 'dots-horizontal' };
              return (
              <View key={log.id} style={[styles.logCard, { backgroundColor: meta.bg, borderColor: meta.iconBg }]}>
                <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
                <View style={styles.logContent}>
                  <Text style={styles.logType}>{t(`logType${log.type === 'blood-pressure' ? 'BloodPressure' : log.type.charAt(0).toUpperCase() + log.type.slice(1)}` as any)}</Text>
                  <Text style={styles.logValue}>
                    {log.type === 'glucose' && (log.value ? `${log.value} ${tc('unitMgdl')}` : tc('noData'))}
                    {log.type === 'blood-pressure' && (log.systolic && log.diastolic ? `${log.systolic}/${log.diastolic} ${tc('unitMmhg')}` : tc('noData'))}
                    {log.type === 'weight' && (log.weight_kg ? `${log.weight_kg} ${tc('unitKg')}` : tc('noData'))}
                    {log.type === 'water' && (log.volume_ml ? `${log.volume_ml} ${tc('unitMl')}` : tc('noData'))}
                    {log.type === 'medication' && (log.medication || tc('noData'))}
                    {log.type === 'meal' && (log.title || tc('noData'))}
                    {log.type === 'insulin' && (log.insulin_type ? `${log.dose_units} ${tc('unitInsulin')}` : tc('noData'))}
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
      </RippleRefreshScrollView>
{isChatOpen && (
        <Suspense fallback={null}>
          <ChatModal visible={isChatOpen} onClose={() => setChatOpen(false)} />
        </Suspense>
      )}
    </Screen>
    </ScreenReadyGate>
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
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkinBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  heroBanner: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: typography.size.md,
    color: 'rgba(255,255,255,0.8)',
  },
  heroName: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  heroSummary: {
    fontSize: typography.size.md,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: Platform.OS === 'android' ? '#F7FFFC' : 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    padding: spacing.lg,
  },
  metricCardGlucose: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: categoryColors.glucose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  metricCardBP: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: categoryColors.bloodPressure,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
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
  missionCard: {
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...translucentCardSurface,
    gap: spacing.sm
  },
  missionCardCompleted: {
    borderColor: colors.emerald,
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
  treeCards: {
    gap: spacing.md,
  },
  treeCard: {
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...translucentCardSurface,
    alignItems: 'center',
    gap: spacing.sm,
  },
  treeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  treeStatValue: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  treeStatLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
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
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...translucentCardSurface,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: brandColors.indigo + '44',
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
  phfneContainer: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phfneSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  phfneSectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phfneSeeAllText: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: '700',
  },
  phfneList: {
    gap: spacing.sm,
  },
  phfneCard: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...brightCardSurface,
    marginBottom: 2,
  },
  phfneCardRead: {
    opacity: 0.65,
    backgroundColor: '#f8fafc',
  },
  phfneCardWarning: {
    borderColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  phfneIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  phfneCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  phfneCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  phfneCardTitleRead: {
    fontWeight: '600',
  },
  phfneCardMessage: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  phfneCardMessageRead: {
    fontStyle: 'italic',
  },
  phfneWarningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginHorizontal: spacing.sm,
  },
  phfneChevron: {
    marginLeft: spacing.xs,
  },
  phfneDismissBtn: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    borderRadius: 16,
    height: 80,
    marginLeft: 10,
  },
  phfneEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    ...brightCardSurface,
    minHeight: 90,
  },
  phfneEmptyMascot: {
    width: 56,
    height: 56,
    marginRight: spacing.sm,
  },
  phfneEmptyTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  phfneEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  phfneEmptyMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
}
