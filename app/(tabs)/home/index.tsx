import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsinuChatSticker from '../../../src/components/AsinuChatSticker';
import ChatModal from '../../../src/components/ChatModal';
import { FloatingActionButton } from '../../../src/components/FloatingActionButton';
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
import { colors, spacing } from '../../../src/styles';
import { C1TrendChart } from '../../../src/ui-kit/C1TrendChart';
import { T1ProgressRing } from '../../../src/ui-kit/T1ProgressRing';

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
    logsStatus,
    missionsStatus,
    treeStatus,
    logsError,
    missionsError,
    treeError,
    anyStale,
    refreshAll
  } = useHomeViewModel();
  const profile = useAuthStore((state) => state.profile);
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchFromBackend } = useNotificationStore();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const padTop = insets.top + spacing.lg;

  // Fetch notifications on mount and periodically - only when logged in
  useEffect(() => {
    if (!profile) return; // Don't fetch if not logged in
    
    fetchFromBackend();
    const interval = setInterval(fetchFromBackend, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchFromBackend, profile]);

  const handleRefresh = useCallback(() => {
    refreshAll();
    fetchFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - refreshAll is stable

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = logsStatus === 'loading' && missionsStatus === 'loading' && treeStatus === 'loading' && !hasData;
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  return (
    <Screen>
      {anyStale ? <OfflineBanner /> : null}
      
      {/* Notification Bell in top right */}
      <View style={[styles.notificationContainer, { top: insets.top + spacing.sm }]}>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onNotificationPress={(notification) => {
            // Handle notification press - navigate based on type
            if (notification.data?.type === 'care_circle_invitation') {
              router.push('/care-circle');
            } else if (notification.data?.type === 'health_alert') {
              // Navigate to logs or care circle based on alert
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

      {loading ? <StateLoading /> : null}
      {noDataError ? <StateError onRetry={refreshAll} message={tc('cannotLoadData')} /> : null}
      {!hasData && !loading && !noDataError ? <StateError onRetry={refreshAll} message={tc('noData')} /> : null}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: padTop }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={['#08b8a2', '#0ea18f']}
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

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <Pressable style={[styles.metricCard, styles.metricCardGlucose]} onPress={() => router.push('/logs/glucose')}>
            <View style={styles.metricIconBg}>
              <MaterialCommunityIcons name="water" size={22} color="#3b82f6" />
            </View>
            <Text style={styles.metricTitle}>{t('glucose')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.glucose ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMgdl')}</Text>
          </Pressable>
          <Pressable style={[styles.metricCard, styles.metricCardBP]} onPress={() => router.push('/logs/blood-pressure')}>
            <View style={[styles.metricIconBg, { backgroundColor: '#fef2f2' }]}>
              <MaterialCommunityIcons name="heart-pulse" size={22} color="#ef4444" />
            </View>
            <Text style={styles.metricTitle}>{t('bloodPressure')}</Text>
            <Text style={styles.metricValue}>{quickMetrics.bloodPressure ?? '--'}</Text>
            <Text style={styles.metricUnit}>{tc('unitMmhg')}</Text>
          </Pressable>
        </View>
        <AsinuChatSticker onPress={() => setChatOpen(true)} />

        {/* Section Header */}
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
        {missions.map((mission, index) => {
          const ratio = mission.goal > 0 ? mission.progress / mission.goal : 0;
          const isCompleted = mission.status === 'completed';
          return (
            <View key={mission.id} style={[styles.missionCard, isCompleted && styles.missionCardCompleted]}>
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
                    colors={isCompleted ? ['#10b981', '#059669'] : [colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.missionProgressFill, { width: `${Math.min(ratio * 100, 100)}%` }]}
                  />
                </View>
                <Text style={styles.missionProgressText}>{mission.progress}/{mission.goal}</Text>
              </View>
              <Pressable
                style={[styles.missionBtn, isCompleted && styles.missionBtnCompleted]}
                onPress={() => router.push('/missions')}
              >
                <Text style={[styles.missionBtnText, isCompleted && styles.missionBtnTextCompleted]}>
                  {isCompleted ? t('completed') : tc('viewDetails')}
                </Text>
              </Pressable>
            </View>
          );
        })}
        </View>

        {/* Tree Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: '#10b981' }]}>
            <Ionicons name="leaf" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('healthTree')}</Text>
            <Text style={styles.sectionSubtitle}>{t('treeFormula')}</Text>
          </View>
        </View>
        <View style={styles.treeCard}>
          <View style={styles.treeRow}>
            <T1ProgressRing percentage={treeSummary?.score ?? 0.6} label={t('score')} accentColor={colors.warning} />
            <View style={styles.treeStats}>
              <View style={styles.treeStatItem}>
                <View style={[styles.treeStatIcon, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="flame" size={16} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.treeStatValue}>{treeSummary?.streakDays ?? 0} {t('days')}</Text>
                  <Text style={styles.treeStatLabel}>{t('streak')}</Text>
                </View>
              </View>
              <View style={styles.treeStatItem}>
                <View style={[styles.treeStatIcon, { backgroundColor: '#d1fae5' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.treeStatValue}>{treeSummary?.completedThisWeek ?? 0}/{treeSummary?.totalMissions ?? 0}</Text>
                  <Text style={styles.treeStatLabel}>{t('thisWeek')}</Text>
                </View>
              </View>
            </View>
          </View>
          <Pressable style={styles.treeBtn} onPress={() => router.push('/tree')}>
            <Text style={styles.treeBtnText}>{tc('viewDetails')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {/* Chart Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: '#6366f1' }]}>
            <Ionicons name="trending-up" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('glucoseTrend')}</Text>
            <Text style={styles.sectionSubtitle}>{t('last7Days')}</Text>
          </View>
        </View>
        <C1TrendChart
          data={glucoseTrendData.length > 0 ? glucoseTrendData : treeHistory}
          title={t('glucose')}
          unit={tc('unitMgdl')}
        />

        {/* Recent Logs */}
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconBg, { backgroundColor: '#ec4899' }]}>
            <Ionicons name="journal" size={18} color="#fff" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{t('recentLogs')}</Text>
          </View>
        </View>
        <View style={styles.logsCard}>
          {logs.slice(0, 3).map((log: LogEntry, index) => (
            <View key={log.id} style={[styles.logItem, index < 2 && styles.logItemBorder]}>
              <View style={styles.logIconBg}>
                {log.type === 'glucose' && <MaterialCommunityIcons name="water" size={18} color="#3b82f6" />}
                {log.type === 'blood-pressure' && <MaterialCommunityIcons name="heart-pulse" size={18} color="#ef4444" />}
                {log.type === 'weight' && <MaterialCommunityIcons name="scale-bathroom" size={18} color="#8b5cf6" />}
                {log.type === 'water' && <MaterialCommunityIcons name="cup-water" size={18} color="#06b6d4" />}
                {log.type === 'medication' && <MaterialCommunityIcons name="pill" size={18} color="#10b981" />}
                {log.type === 'meal' && <MaterialCommunityIcons name="food" size={18} color="#f59e0b" />}
                {log.type === 'insulin' && <MaterialCommunityIcons name="needle" size={18} color="#6366f1" />}
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
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <FloatingActionButton label={tc('quickLog')} onPress={() => router.push('/logs')} />
      <ChatModal visible={isChatOpen} onClose={() => setChatOpen(false)} />
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
  },
  metricCardGlucose: {
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  metricCardBP: {
    borderWidth: 3,
    borderColor: '#ef4444',
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
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
    marginTop: spacing.md,
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
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    gap: spacing.sm
  },
  missionCardCompleted: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
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
    backgroundColor: '#10b981',
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
    backgroundColor: '#e5e7eb',
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
    backgroundColor: '#d1fae5',
  },
  missionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  missionBtnTextCompleted: {
    color: '#059669',
  },
  treeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
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
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
  },
  treeBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  logsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
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
  }
});
}
