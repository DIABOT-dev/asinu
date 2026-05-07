import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsinuChatSticker from '../../../src/components/AsinuChatSticker';
import { DailyCheckinCard } from '../../../src/components/DailyCheckinCard';
import { HealthScoreCard } from '../../../src/components/HealthScoreCard';
import { HomeBackground } from '../../../src/components/HomeBackground';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { checkinApi } from '../../../src/features/checkin/checkin.api';
const ChatModal = React.lazy(() => import('../../../src/components/ChatModal'));
import { NotificationBell } from '../../../src/components/NotificationBell';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateError } from '../../../src/components/state/StateError';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { useAuthStore } from '../../../src/features/auth/auth.store';
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

export default function HomeScreen() {
  const flushPending = useToastStore((s) => s.flushPending);
  useEffect(() => { flushPending(); }, []);

  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const { t: tt } = useTranslation('tree');
  const [isChatOpen, setChatOpen] = useState(false);
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

  const handleNotificationPress = useCallback((notification: any) => {
    const route = routeFromNotificationData(notification?.data);
    if (!route) return;
    if (typeof route === 'string') router.push(route as any);
    else router.push(route as any);
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshAll();
    await fetchFromBackend();
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - refreshAll is stable

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = (logsStatus === 'loading' || missionsStatus === 'loading' || treeStatus === 'loading') && !hasData;
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  return (
    <Screen>
      {/* Animated background — gradient + 2 breathing blobs (teal + gold).
          Render đầu tiên để layer dưới cùng; pointerEvents=none, không chặn scroll. */}
      <HomeBackground />
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
        {/* Header row — KHÔNG nằm trong hero gradient. Avatar + greeting + bell. */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
          <View style={styles.designHeaderRow}>
            <Image
              source={require('../../../assets/asinu_chat_sticker.png')}
              style={styles.designAvatar}
              resizeMode="contain"
            />
            <View style={{ flex: 1, marginLeft: spacing.md, minWidth: 0 }}>
              <Text style={styles.designGreeting} numberOfLines={1}>{t('greeting')}</Text>
              <Text style={styles.designName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {profile?.name || t('defaultName')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MaterialCommunityIcons name="heart" size={12} color={colors.success} />
                <Text style={styles.designTagline} numberOfLines={2}>{t('heroSummary')}</Text>
              </View>
            </View>
            {/* Bell rendered ngoài header trong NotificationBell — đã có ở line ~190+ */}
          </View>
        </Animated.View>

        {/* Mascot floating right — overlap giữa header & hero (z-index trên gradient) */}
        <View pointerEvents="none" style={styles.designMascot}>
          <Image
            source={require('../../../assets/asinu_chat_sticker.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>

        {/* HERO green gradient — score + ring + 3 metric cards */}
        <Animated.View entering={FadeIn.delay(80).duration(400)}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroNewBanner}
        >
          {/* Top row */}
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.heroScoreLabel}>{t('healthScoreOverall')}</Text>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.85)" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={styles.heroScoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {Math.round((treeSummary?.score ?? 0.78) * 100)}
                </Text>
                <Text style={styles.heroScoreMax}>/100</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Text style={{ fontSize: 14 }}>😊</Text>
                <Text style={styles.heroScoreCaption}>{t('healthScoreOverallSub')}</Text>
              </View>
            </View>
            {/* Heart pulse với decorative circle ring */}
            <View style={styles.heroRingWrap}>
              <View style={styles.heroRingArc} />
              <View style={styles.heroRingInner}>
                <MaterialCommunityIcons name="heart-pulse" size={36} color="rgba(255,255,255,0.95)" />
              </View>
            </View>
          </View>

          {/* Bottom row: 3 mini cards */}
          <View style={styles.heroMetricsRow}>
            <Pressable style={styles.heroMetricCard} onPress={() => router.push('/logs/glucose')}>
              <View style={styles.heroMetricHeader}>
                <View style={[styles.heroMetricDot, { backgroundColor: '#dbeafe' }]}>
                  <MaterialCommunityIcons name="water" size={12} color="#3b82f6" />
                </View>
                <Text style={styles.heroMetricTitle} numberOfLines={1}>{t('glucose')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.heroMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {quickMetrics.glucose ?? '--'}
                </Text>
                <Text style={styles.heroMetricUnit} numberOfLines={1}>{tc('unitMgdl')}</Text>
              </View>
              <View style={styles.heroStatusPill}>
                <Text style={styles.heroStatusPillText}>{tc('normal') || 'Bình thường'}</Text>
              </View>
            </Pressable>

            <Pressable style={styles.heroMetricCard} onPress={() => router.push('/logs/blood-pressure')}>
              <View style={styles.heroMetricHeader}>
                <View style={[styles.heroMetricDot, { backgroundColor: '#fee2e2' }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={12} color="#ef4444" />
                </View>
                <Text style={styles.heroMetricTitle} numberOfLines={1}>{t('bloodPressure')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.heroMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {quickMetrics.bloodPressure ?? '--'}
                </Text>
                <Text style={styles.heroMetricUnit} numberOfLines={1}>{tc('unitMmhg')}</Text>
              </View>
              <View style={styles.heroStatusPill}>
                <Text style={styles.heroStatusPillText}>{tc('normal') || 'Bình thường'}</Text>
              </View>
            </Pressable>

            <Pressable style={styles.heroCheckinBtn} onPress={goToCheckin}>
              <MaterialCommunityIcons name="calendar-check" size={26} color={colors.primary} />
              <Text style={styles.heroCheckinText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {t('checkinNow') || 'Check-in ngay'}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
        </Animated.View>

        {/* Quick Actions section */}
        <Animated.View entering={FadeIn.delay(120).duration(350)}>
          <View style={styles.quickSectionHeader}>
            <Text style={styles.quickSectionTitle}>{t('quickActions') || 'Thao tác nhanh'}</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <Pressable style={styles.quickActionCard} onPress={() => router.push('/logs/glucose')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
                <MaterialCommunityIcons name="water" size={22} color="#3b82f6" />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={2}>{t('measureGlucose') || 'Đo\nđường huyết'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.quickActionCard} onPress={() => router.push('/logs/blood-pressure')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#fee2e2' }]}>
                <MaterialCommunityIcons name="heart-pulse" size={22} color="#ef4444" />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={2}>{t('measureBP') || 'Đo\nhuyết áp'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.quickActionCard} onPress={() => router.push('/logs/water')}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#e0f2fe' }]}>
                <MaterialCommunityIcons name="cup-water" size={22} color="#0ea5e9" />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={2}>{t('drinkWater') || 'Uống\nnước'}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Health Score Card — chỉ hiện khi cần (warning hoặc chưa check-in) */}
        {healthScore && (healthScore.level !== 'ok' || !healthScore.checkinDone) && (
          <Animated.View entering={FadeIn.delay(160).duration(350)}>
            <HealthScoreCard
              level={healthScore.level}
              factors={healthScore.factors}
              checkinDone={healthScore.checkinDone}
            />
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
            <Suspense fallback={<View style={{ width: 120, height: 120 }} />}>
              <T1ProgressRing percentage={treeSummary?.score ?? 0.6} label={t('score')} accentColor={colors.warning} />
            </Suspense>
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
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
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
    borderRadius: 20,
    padding: spacing.lg,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
  },
  metricCardGlucose: {
    borderWidth: 1.5,
    borderColor: categoryColors.glucose,
  },
  metricCardBP: {
    borderWidth: 1.5,
    borderColor: categoryColors.bloodPressure,
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

  // ─── DESIGN MATCH (mockup) ────────────────────────────────────────────────
  // Header row: avatar + greeting + tagline + bell
  designHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  designAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  designGreeting: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  designName: {
    fontSize: typography.size.xl,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    marginTop: 2,
  },
  designTagline: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  designMascot: {
    position: 'absolute',
    top: 60,
    right: 70,
    width: 130,
    height: 130,
    zIndex: 5,
  },
  // Hero gradient combined card
  heroNewBanner: {
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 110,
  },
  heroScoreLabel: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600' as const,
  },
  heroScoreValue: {
    fontSize: typography.size.xl + 18,
    fontWeight: '800' as const,
    color: '#fff',
    lineHeight: typography.size.xl + 26,
  },
  heroScoreMax: {
    fontSize: typography.size.lg,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 2,
  },
  heroScoreCaption: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.92)',
    flexShrink: 1,
  },
  heroRingWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingArc: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.55)',
    borderTopColor: 'transparent',
    borderRightColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '-45deg' }],
  },
  heroRingInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroMetricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: spacing.sm,
    gap: 4,
    minWidth: 0,
  },
  heroMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetricDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricTitle: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  heroMetricValue: {
    fontSize: typography.size.md,
    fontWeight: '800' as const,
    color: colors.textPrimary,
  },
  heroMetricUnit: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  heroStatusPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  heroStatusPillText: {
    fontSize: typography.size.xs,
    color: '#16a34a',
    fontWeight: '700' as const,
  },
  heroCheckinBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  heroCheckinText: {
    fontSize: typography.size.xs,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // Quick Actions
  quickSectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickSectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '800' as const,
    color: colors.textPrimary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    lineHeight: typography.size.xs + 4,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
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
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
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
});
}
