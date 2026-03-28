import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
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
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import React from 'react';
const C1TrendChart = React.lazy(() => import('../../../src/ui-kit/C1TrendChart').then(m => ({ default: m.C1TrendChart })));
const T1ProgressRing = React.lazy(() => import('../../../src/ui-kit/T1ProgressRing').then(m => ({ default: m.T1ProgressRing })));

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
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const padTop = insets.top + spacing.lg;
  const [chartTooltip, setChartTooltip] = useState(false);

  const formatTime = (iso?: string) => {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${hh}:${mm}:${ss} ${dd}/${MM}/${yyyy}`;
  };

  const latestLogByType = (type: string) =>
    recentLogs.find((log) => log.type === type);

  const glucoseLog = latestLogByType('glucose');
  const bpLog = latestLogByType('blood-pressure');
  const weightLog = latestLogByType('weight');
  const waterLog = latestLogByType('water');

  const metrics = useMemo(() => [
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
  ], [glucoseLog, bpLog, weightLog, waterLog, t, tc]);

  const hasAnyMetric = metrics.some((metric) => metric.value !== '--');
  const showChart = hasAnyMetric;
  const chartData = showChart ? history : [];

  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) return;
      lastFetchRef.current = now;
      const controller = new AbortController();
      fetchTree(controller.signal);
      fetchLogs(controller.signal);
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    await Promise.all([fetchTree(controller.signal), fetchLogs(controller.signal)]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - fetchTree and fetchLogs are stable in Zustand

  return (
    <Screen>
      {errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' && !summary ? <StateLoading /> : null}
      {errorState === 'no-data' && !summary ? <StateError onRetry={() => fetchTree()} message={tc('cannotLoadData')} /> : null}
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {status === 'success' && !summary ? <StateEmpty /> : null}
        
        {/* Header Card */}
        <LinearGradient
          colors={[colors.emerald, colors.emeraldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <FontAwesome5 name="tree" size={28} color="#fff" />
          <Text style={styles.headerTitle}>{t('healthTree')}</Text>
          <Text style={styles.headerSubtitle}>{t('summaryFromLogs')}</Text>
        </LinearGradient>
        
        {/* Giải thích cách tính điểm */}
        <View style={styles.infoBox}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="bar-chart" size={16} color={colors.textSecondary} />
            <Text style={styles.infoTitle}>{t('scoringMethod')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="journal" size={14} color={colors.primary} />
            <Text style={styles.infoText}>{t('logScore')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkbox" size={14} color={colors.emerald} />
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
            <Suspense fallback={<View style={{ width: 120, height: 120 }} />}>
              <T1ProgressRing percentage={summary?.score ?? 0.6} label={t('score')} accentColor={colors.warning} />
            </Suspense>
            <Text style={styles.scoreCaption}>
              {Math.round((summary?.score ?? 0) * 100)}% - {(summary?.score ?? 0) >= 0.7 ? t('good') : (summary?.score ?? 0) >= 0.4 ? t('average') : t('needsImprovement')}
            </Text>
          </View>
          <View style={styles.streakCard}>
            <View style={styles.streakItem}>
              <Ionicons name="flame" size={20} color={colors.premium} />
              <View style={styles.streakContent}>
                <Text style={styles.streakValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{summary?.streakDays ?? 0}</Text>
                <Text style={styles.streakLabel} numberOfLines={1}>{t('consecutiveDays')}</Text>
              </View>
            </View>
          </View>
          <View style={styles.streakCard}>
            <View style={styles.streakItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
              <View style={styles.streakContent}>
                <Text style={styles.streakValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{summary?.completedToday ?? 0}/{summary?.totalMissions ?? 8}</Text>
                <Text style={styles.streakLabel} numberOfLines={1}>{t('todayMissions')}</Text>
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
              <View style={styles.metricTopRow}>
                <MaterialCommunityIcons name={metric.icon} size={20} color={metric.iconColor} />
                <Text style={styles.metricTitle}>{metric.title}</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>
              {metric.meta ? <Text style={styles.metricMeta}>{metric.meta}</Text> : null}
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
          <Text style={styles.quickLogText}>{tc('quickLog')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        
        {/* Biểu đồ 7 ngày với giải thích */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
              <Text style={styles.chartLabel}>{t('activityChart7Days')}</Text>
              <Pressable hitSlop={8} onPress={() => setChartTooltip(v => !v)}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {chartTooltip && (
              <View style={styles.chartTooltip}>
                <Text style={styles.chartTooltipText}>{t('chartExplain')}</Text>
              </View>
            )}
          </View>
          {showChart ? (
            <Suspense fallback={<View style={{ height: 200 }} />}>
              <C1TrendChart data={chartData} title={t('activityScore')} unit={t('scoreUnit')} />
            </Suspense>
          ) : (
            <View style={styles.placeholderCard}>
              <Ionicons name="analytics" size={32} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>{t('noChartData')}</Text>
            </View>
          )}
        </View>
      </RippleRefreshScrollView>
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
    shadowColor: colors.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
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
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
    gap: spacing.sm
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs
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
    gap: spacing.md,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  scoreCaption: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  streakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  streakContent: {
    flex: 1,
    overflow: 'hidden',
  },
  streakValue: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  streakLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
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
    gap: spacing.md
  },
  metricCard: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: spacing.xs
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricTitle: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  metricValue: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  metricMeta: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  // Empty Card
  emptyCard: {
    padding: spacing.xl,
    borderRadius: 16,
    borderWidth: 1.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  quickLogText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.size.md,
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
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  chartTooltip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTooltipText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  placeholderCard: {
    padding: spacing.xxl,
    borderRadius: 16,
    borderWidth: 1.5,
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
