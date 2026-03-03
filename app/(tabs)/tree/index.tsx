import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { StateError } from '../../../src/components/state/StateError';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { useLogsStore } from '../../../src/features/logs/logs.store';
import { useTreeStore } from '../../../src/features/tree/tree.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import i18n from '../../../src/i18n';
import { colors, spacing } from '../../../src/styles';
import { C1TrendChart } from '../../../src/ui-kit/C1TrendChart';
import { T1ProgressRing } from '../../../src/ui-kit/T1ProgressRing';

export default function TreeScreen() {
  const { t } = useTranslation('tree');
  const { t: tc } = useTranslation('common');
  const summary = useTreeStore((state) => state.summary);
  const history = useTreeStore((state) => state.history);
  const fetchTree = useTreeStore((state) => state.fetchTree);
  const status = useTreeStore((state) => state.status);
  const isStale = useTreeStore((state) => state.isStale);
  const errorState = useTreeStore((state) => state.errorState);
  const recentLogs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const padTop = insets.top + spacing.lg;

  const formatTime = (iso?: string) => {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const latestLogByType = (type: string) =>
    recentLogs.find((log) => log.type === type);

  const glucoseLog = latestLogByType('glucose');
  const bpLog = latestLogByType('blood-pressure');
  const weightLog = latestLogByType('weight');
  const waterLog = latestLogByType('water');

  const metrics = [
    {
      key: 'glucose',
      title: t('glucose'),
      value: typeof glucoseLog?.value === 'number' ? `${glucoseLog.value}` : '--',
      unit: tc('unitMgdl'),
      meta: glucoseLog?.recordedAt
        ? t('latest', { time: formatTime(glucoseLog.recordedAt) })
        : t('noDataYet'),
      trend: undefined,
      icon: 'water' as const,
      iconColor: '#3b82f6',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe'
    },
    {
      key: 'blood-pressure',
      title: t('bloodPressure'),
      value:
        typeof bpLog?.systolic === 'number' && typeof bpLog?.diastolic === 'number'
          ? `${bpLog.systolic}/${bpLog.diastolic}`
          : '--',
      unit: tc('unitMmhg'),
      meta: bpLog?.recordedAt ? t('latest', { time: formatTime(bpLog.recordedAt) }) : t('noDataYet'),
      trend: undefined,
      icon: 'heart-pulse' as const,
      iconColor: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#fecaca'
    },
    {
      key: 'weight',
      title: t('weight'),
      value: typeof weightLog?.weight_kg === 'number' ? `${weightLog.weight_kg}` : '--',
      unit: tc('unitKg'),
      meta: weightLog?.recordedAt ? t('latest', { time: formatTime(weightLog.recordedAt) }) : t('noDataYet'),
      trend: undefined,
      icon: 'scale-bathroom' as const,
      iconColor: '#8b5cf6',
      bgColor: '#f5f3ff',
      borderColor: '#ddd6fe'
    },
    {
      key: 'water',
      title: t('waterIntake'),
      value: typeof waterLog?.volume_ml === 'number' ? `${waterLog.volume_ml}` : '--',
      unit: tc('unitMl'),
      meta: waterLog?.volume_ml ? t('todayLabel') : t('noDataYet'),
      trend: undefined,
      icon: 'cup-water' as const,
      iconColor: '#06b6d4',
      bgColor: '#ecfeff',
      borderColor: '#a5f3fc'
    }
  ];

  const hasAnyMetric = metrics.some((metric) => metric.value !== '--');
  const showChart = hasAnyMetric;
  const chartData = showChart ? history : [];

  // Tự động fetch khi tab được focus (không cần pull to refresh)
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchTree(controller.signal);
      fetchLogs(controller.signal);
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty deps - fetchTree and fetchLogs are stable in Zustand
  );

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    fetchTree(controller.signal);
    fetchLogs(controller.signal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - fetchTree and fetchLogs are stable in Zustand

  return (
    <Screen>
      {isStale || errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' && !summary ? <StateLoading /> : null}
      {errorState === 'no-data' && !summary ? <StateError onRetry={() => fetchTree()} message={tc('cannotLoadData')} /> : null}
      <ScrollView 
        contentContainerStyle={[styles.container, { paddingTop: padTop }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {status === 'success' && !summary ? <StateEmpty /> : null}
        
        {/* Header Card */}
        <LinearGradient
          colors={['#10b981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerIconContainer}>
            <FontAwesome5 name="tree" size={28} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t('healthTree')}</Text>
          <Text style={styles.headerSubtitle}>{t('summaryFromLogs')}</Text>
        </LinearGradient>
        
        {/* Giải thích cách tính điểm */}
        <View style={styles.infoBox}>
          <View style={styles.infoTitleRow}>
            <View style={styles.infoIconBg}>
              <Ionicons name="bar-chart" size={16} color="#fff" />
            </View>
            <Text style={styles.infoTitle}>{t('scoringMethod')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="journal" size={14} color={colors.primary} />
            <Text style={styles.infoText}>{t('logScore')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkbox" size={14} color="#10b981" />
            <Text style={styles.infoText}>{t('missionScore')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={14} color="#8b5cf6" />
            <Text style={styles.infoText}>{t('last7DaysData')}</Text>
          </View>
        </View>

        {/* Score Section */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreCard}>
            <T1ProgressRing percentage={summary?.score ?? 0.6} label={t('score')} accentColor={colors.warning} />
            <Text style={styles.scoreCaption}>
              {Math.round((summary?.score ?? 0) * 100)}% - {(summary?.score ?? 0) >= 0.7 ? t('good') : (summary?.score ?? 0) >= 0.4 ? t('average') : t('needsImprovement')}
            </Text>
          </View>
          <View style={styles.streakCard}>
            <View style={styles.streakItem}>
              <View style={[styles.streakIconBg, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="flame" size={20} color="#f59e0b" />
              </View>
              <View style={styles.streakContent}>
                <Text style={styles.streakValue}>{summary?.streakDays ?? 0}</Text>
                <Text style={styles.streakLabel}>{t('consecutiveDays')}</Text>
              </View>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <View style={[styles.streakIconBg, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
              <View style={styles.streakContent}>
                <Text style={styles.streakValue}>{summary?.completedThisWeek ?? 0}/{summary?.totalMissions ?? 8}</Text>
                <Text style={styles.streakLabel}>{t('today')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart" size={20} color={colors.textPrimary} />
          <Text style={styles.sectionTitle}>{t('healthMetrics')}</Text>
        </View>

        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.key} style={[styles.metricCard, { backgroundColor: metric.bgColor, borderColor: metric.borderColor }]}>
              <View style={styles.metricHeader}>
                <MaterialCommunityIcons name={metric.icon} size={20} color={metric.iconColor} />
                <Text style={styles.metricTitle}>{metric.title}</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>
              <Text style={styles.metricMeta}>{metric.meta}</Text>
            </View>
          ))}
        </View>
        {!hasAnyMetric ? (
          <View style={styles.emptyCard}>
            <Ionicons name="information-circle" size={24} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {t('noDataPrompt')}
            </Text>
          </View>
        ) : null}
        
        <Pressable style={styles.quickLogButton} onPress={() => router.push('/logs')}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quickLogGradient}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.quickLogText}>{tc('quickLog')}</Text>
          </LinearGradient>
        </Pressable>
        
        {/* Biểu đồ 7 ngày với giải thích */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
              <Text style={styles.chartLabel}>{t('activityChart7Days')}</Text>
            </View>
            <Text style={styles.chartExplain}>{t('chartExplain')}</Text>
          </View>
          {showChart ? (
            <C1TrendChart data={chartData} title={t('activityScore')} unit={t('scoreUnit')} />
          ) : (
            <View style={styles.placeholderCard}>
              <Ionicons name="analytics" size={32} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>{t('noChartData')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg
  },
  // Header Card
  headerCard: {
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.xs
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.85)'
  },
  // Info Box
  infoBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    gap: spacing.sm
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  infoIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  infoTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  infoText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    flex: 1
  },
  // Score Section
  scoreSection: {
    flexDirection: 'row',
    gap: spacing.md
  },
  scoreCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.sm
  },
  scoreCaption: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  streakCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    gap: spacing.md
  },
  streakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  streakIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  streakContent: {
    flex: 1
  },
  streakValue: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary
  },
  streakLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary
  },
  streakDivider: {
    height: 1,
    backgroundColor: colors.border
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Metric Grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 2,
    gap: spacing.xs
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  metricTitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs
  },
  metricValue: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.textPrimary
  },
  metricUnit: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: 3
  },
  metricMeta: {
    fontSize: typography.size.xs,
    color: colors.textSecondary
  },
  // Empty Card
  emptyCard: {
    padding: spacing.xl,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    flex: 1
  },
  // Quick Log Button
  quickLogButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  quickLogGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl
  },
  quickLogText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff'
  },
  // Chart Section
  chartSection: {
    gap: spacing.md
  },
  chartHeader: {
    gap: spacing.xs
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  chartLabel: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  chartExplain: {
    fontSize: typography.size.xs,
    color: colors.textSecondary
  },
  placeholderCard: {
    padding: spacing.xxl,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.sm
  },
  placeholderText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  }
});
}
