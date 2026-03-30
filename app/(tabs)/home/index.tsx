import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
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
import { useToastStore } from '../../../src/stores/toast.store';
import { brandColors, categoryColors, colors, iconColors, radius, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import React from 'react';
const GlucoseTrendChart = React.lazy(() => import('../../../src/ui-kit/GlucoseTrendChart').then(m => ({ default: m.GlucoseTrendChart })));
const T1ProgressRing = React.lazy(() => import('../../../src/ui-kit/T1ProgressRing').then(m => ({ default: m.T1ProgressRing })));


function InfoButton({ text, styles }: { text: string; styles: any }) {
  const [open, setOpen] = useState(false);
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
              <Text style={styles.infoModalTitle}>Thông tin</Text>
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
        {/* Hero Banner */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
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
        </LinearGradient>
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
          <Pressable style={[styles.metricCard, styles.metricCardGlucose]} onPress={() => router.push('/logs/glucose')}>
            <MaterialCommunityIcons name="water" size={22} color={iconColors.glucose} />
            <Text style={styles.metricTitle}>{t('glucose')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.glucose ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMgdl')}</Text>
          </Pressable>
          <Pressable style={[styles.metricCard, styles.metricCardBP]} onPress={() => router.push('/logs/blood-pressure')}>
            <MaterialCommunityIcons name="heart-pulse" size={22} color={iconColors.bp} />
            <Text style={styles.metricTitle}>{t('bloodPressure')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.bloodPressure ?? '--'}</Text>
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

        <Animated.View entering={FadeIn.delay(150).duration(350)}>
        <DailyCheckinCard />
        </Animated.View>


        <Animated.View entering={FadeIn.delay(190).duration(350)}>
        <AsinuChatSticker onPress={() => setChatOpen(true)} />
        </Animated.View>

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
              router.push(routes[mission.missionKey] || '/(tabs)/missions');
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
