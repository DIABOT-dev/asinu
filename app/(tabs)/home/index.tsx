import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsinuChatSticker from '../../../src/components/AsinuChatSticker';
import { DailyCheckinCard } from '../../../src/components/DailyCheckinCard';
import { HealthScoreCard } from '../../../src/components/HealthScoreCard';
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
import { brandColors, categoryColors, colors, radius, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import React from 'react';
const GlucoseTrendChart = React.lazy(() => import('../../../src/ui-kit/GlucoseTrendChart').then(m => ({ default: m.GlucoseTrendChart })));
const T1ProgressRing = React.lazy(() => import('../../../src/ui-kit/T1ProgressRing').then(m => ({ default: m.T1ProgressRing })));

// Module-level flag: auto-show fires once per app session, not on every tab switch
let checkinAutoShown = false;

export default function HomeScreen() {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
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
  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead, removeNotification, clearAll, fetchFromBackend } = useNotificationStore();
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
    if (!profile) return; // Don't fetch if not logged in

    fetchFromBackend();
    const interval = setInterval(fetchFromBackend, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchFromBackend, profile]);

  // Auto-show check-in screen if not yet checked in today
  useEffect(() => {
    if (!profile || checkinAutoShown) return;
    checkinAutoShown = true;

    checkinApi.getToday()
      .then(res => {
        if (!res.session) {
          setTimeout(() => router.push('/checkin'), 600);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshAll();
    await fetchFromBackend();
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - refreshAll is stable

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = logsStatus === 'loading' && missionsStatus === 'loading' && treeStatus === 'loading' && !hasData;
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  return (
    <Screen>
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
            onNotificationPress={(notification) => {
              if (notification.data?.type === 'care_circle_invitation') {
                router.push('/care-circle');
              } else if (notification.data?.type === 'health_alert') {
                if (notification.data?.alertType?.includes('glucose')) {
                  router.push('/logs/glucose');
                } else if (notification.data?.alertType?.includes('blood_pressure')) {
                  router.push('/logs/blood-pressure');
                } else {
                  router.push('/care-circle');
                }
              }
            }}
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
        <Animated.View entering={FadeInDown.delay(0).duration(500).springify()}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroContent}>
            <Text style={styles.heroGreeting}>{t('greeting')}</Text>
            <Text style={styles.heroName}>{profile?.name || t('defaultName')}</Text>
            <Text style={styles.heroSummary}>{t('heroSummary')}</Text>
          </View>
          <Pressable style={styles.heroSettingsBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </Pressable>
        </LinearGradient>
        </Animated.View>

        {/* Metrics Row */}
        <Animated.View entering={FadeInDown.delay(120).duration(450).springify()}>
        <View style={styles.metricsRow}>
          <Pressable style={[styles.metricCard, styles.metricCardGlucose]} onPress={() => router.push('/logs/glucose')}>
            <View style={styles.metricIconBg}>
              <MaterialCommunityIcons name="water" size={22} color={categoryColors.glucose} />
            </View>
            <Text style={styles.metricTitle}>{t('glucose')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.glucose ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMgdl')}</Text>
          </Pressable>
          <Pressable style={[styles.metricCard, styles.metricCardBP]} onPress={() => router.push('/logs/blood-pressure')}>
            <View style={[styles.metricIconBg, { backgroundColor: categoryColors.bloodPressureBg }]}>
              <MaterialCommunityIcons name="heart-pulse" size={22} color={categoryColors.bloodPressure} />
            </View>
            <Text style={styles.metricTitle}>{t('bloodPressure')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.bloodPressure ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMmhg')}</Text>
          </Pressable>
        </View>
        </Animated.View>

        {/* Health Score Card */}
        {healthScore && (
          <Animated.View entering={FadeInDown.delay(160).duration(400).springify()}>
            <HealthScoreCard
              level={healthScore.level}
              factors={healthScore.factors}
              checkinDone={healthScore.checkinDone}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
        <DailyCheckinCard />
        </Animated.View>

        {/* Health Report Card */}
        <Animated.View entering={FadeInDown.delay(230).duration(400).springify()}>
        <Pressable
          style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/report')}
        >
          <View style={styles.reportRow}>
            <View style={styles.reportIconWrap}>
              <Ionicons name="document-text" size={22} color={brandColors.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>{t('healthReport')}</Text>
              <Text style={styles.reportSub}>{t('healthReportSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={brandColors.indigo} />
          </View>
        </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(400).springify()}>
        <AsinuChatSticker onPress={() => setChatOpen(true)} />
        </Animated.View>

        {/* Section Header */}
        <Animated.View entering={FadeInDown.delay(280).duration(400).springify()}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBg}>
            <Ionicons name="flag" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('todayMissions')}</Text>
            <Text style={styles.sectionSubtitle}>{t('missionsRefreshDaily')}</Text>
          </View>
        </View>
        <View style={styles.cardList}>
        {missions.slice(0, 3).map((mission, index) => {
          const ratio = mission.goal > 0 ? mission.progress / mission.goal : 0;
          const isCompleted = mission.status === 'completed';
          return (
            <Pressable key={mission.id} style={({ pressed }) => [styles.missionCard, isCompleted && styles.missionCardCompleted, pressed && { opacity: 0.85 }]} onPress={() => router.push('/missions')}>
              <View style={styles.missionHeader}>
                <View style={[styles.missionBadge, isCompleted && styles.missionBadgeCompleted]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={styles.missionBadgeText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.missionInfo}>
                  <Text style={[styles.missionTitle, isCompleted && styles.missionTitleCompleted]}>{mission.title}</Text>
                  {mission.description ? <Text style={styles.missionDesc}>{mission.description}</Text> : null}
                </View>
              </View>
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
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </Pressable>
        )}
        </View>
        </Animated.View>

        {/* Tree Section */}
        <Animated.View entering={FadeInDown.delay(360).duration(400).springify()}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: colors.emerald }]}>
            <Ionicons name="leaf" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('healthTree')}</Text>
            <Text style={styles.sectionSubtitle}>{t('treeFormula')}</Text>
          </View>
        </View>
        <View style={styles.treeCard}>
          <View style={styles.treeRow}>
            <Suspense fallback={<View style={{ width: 120, height: 120 }} />}>
              <T1ProgressRing percentage={treeSummary?.score ?? 0.6} label={t('score')} accentColor={colors.warning} />
            </Suspense>
            <View style={styles.treeStats}>
              <View style={styles.treeStatItem}>
                <View style={[styles.treeStatIcon, { backgroundColor: colors.premiumLight }]}>
                  <Ionicons name="flame" size={16} color={colors.premium} />
                </View>
                <View>
                  <Text style={styles.treeStatValue}>{treeSummary?.streakDays ?? 0} {t('days')}</Text>
                  <Text style={styles.treeStatLabel}>{t('streak')}</Text>
                </View>
              </View>
              <View style={styles.treeStatItem}>
                <View style={[styles.treeStatIcon, { backgroundColor: colors.emeraldLight }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
                </View>
                <View>
                  <Text style={styles.treeStatValue}>{treeSummary?.completedToday ?? 0}/{treeSummary?.totalMissions ?? 0}</Text>
                  <Text style={styles.treeStatLabel}>{t('todayMissions')}</Text>
                </View>
              </View>
            </View>
          </View>
          <Pressable style={styles.treeBtn} onPress={() => router.push('/tree')}>
            <Text style={styles.treeBtnText}>{tc('viewDetails')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>
        </Animated.View>

        {/* Chart Section */}
        <Animated.View entering={FadeInDown.delay(440).duration(400).springify()}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: brandColors.indigo }]}>
            <Ionicons name="trending-up" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('glucoseTrend')}</Text>
            <Text style={styles.sectionSubtitle}>{t('last7Days')}</Text>
          </View>
        </View>
        <Suspense fallback={<View style={{ height: 240 }} />}>
          <GlucoseTrendChart
            data={glucoseTrendData.length > 0 ? glucoseTrendData : []}
          />
        </Suspense>
        </Animated.View>

        {/* Recent Logs */}
        <Animated.View entering={FadeInDown.delay(520).duration(400).springify()}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: brandColors.pink }]}>
            <Ionicons name="journal" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('recentLogs')}</Text>
          </View>
        </View>
        <View style={styles.logsCard}>
          {logs.length === 0 ? (
            <View style={styles.emptyLogsContainer}>
              <Ionicons name="document-text-outline" size={40} color={colors.primary} />
              <Text style={styles.emptyLogsTitle}>{t('noLogsYet')}</Text>
              <Text style={styles.emptyLogsSub}>{t('noLogsSub')}</Text>
            </View>
          ) : (
            logs.slice(0, 3).map((log: LogEntry, index) => (
              <View key={log.id} style={[styles.logItem, index < 2 && styles.logItemBorder]}>
                <View style={styles.logIconBg}>
                  {log.type === 'glucose' && <MaterialCommunityIcons name="water" size={18} color={categoryColors.glucose} />}
                  {log.type === 'blood-pressure' && <MaterialCommunityIcons name="heart-pulse" size={18} color={categoryColors.bloodPressure} />}
                  {log.type === 'weight' && <MaterialCommunityIcons name="scale-bathroom" size={18} color={categoryColors.weight} />}
                  {log.type === 'water' && <MaterialCommunityIcons name="cup-water" size={18} color={categoryColors.water} />}
                  {log.type === 'medication' && <MaterialCommunityIcons name="pill" size={18} color={categoryColors.medication} />}
                  {log.type === 'meal' && <MaterialCommunityIcons name="food" size={18} color={categoryColors.meal} />}
                  {log.type === 'insulin' && <MaterialCommunityIcons name="needle" size={18} color={categoryColors.insulin} />}
                </View>
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
            ))
          )}
        </View>
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
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: categoryColors.glucoseBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
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
  missionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionBadgeCompleted: {
    backgroundColor: colors.emerald,
  },
  missionBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: typography.size.xs,
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
  treeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  treeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center'
  },
  treeStats: {
    flex: 1,
    gap: spacing.md
  },
  treeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  treeStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  logsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: brandColors.indigo + '22',
    justifyContent: 'center',
    alignItems: 'center',
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
