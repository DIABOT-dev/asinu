import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useCallback, useMemo, useRef, useState, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, withDelay } from 'react-native-reanimated';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { HealthReportPanel } from '../../../src/components/HealthReportPanel';
import { HealthTreeStatusCard } from '../../../src/components/HealthTreeStatusCard';
import { PineTreeIllustration } from '../../../src/components/PineTreeIllustration';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { StateError } from '../../../src/components/state/StateError';
import { TreeTabSkeleton } from '../../../src/components/state/MainScreenSkeletons';
import { useLogsStore } from '../../../src/features/logs/logs.store';
import { useTreeStore } from '../../../src/features/tree/tree.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { useInitialLoadingGate } from '../../../src/hooks/useInitialLoadingGate';
import { colors, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import { checkinApi, type HealthScoreData } from '../../../src/features/checkin/checkin.api';
import React from 'react';

const C1TrendChart = React.lazy(() => import('../../../src/ui-kit/C1TrendChart').then(m => ({ default: m.C1TrendChart })));

function FloatingSnow({ x, delay = 0, size = 16, duration = 3000 }: any) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      translateY.value = withRepeat(
        withTiming(150, { duration, easing: Easing.linear }),
        -1,
        false
      );
      translateX.value = withRepeat(
        withSequence(
          withTiming(15, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(-15, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      rotate.value = withRepeat(
        withTiming(360, { duration: duration * 1.2, easing: Easing.linear }),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration * 0.2 }),
          withTiming(0.8, { duration: duration * 0.6 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1,
        false
      );
    }, delay);
  }, [delay, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { rotate: `${rotate.value}deg` }
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', top: -10, left: x, zIndex: 5 }, animatedStyle]}>
      <Ionicons name="snow" size={size} color="#60a5fa" />
    </Animated.View>
  );
}


export default function TreeScreen() {
  const router = useRouter();
  const { t } = useTranslation('tree');
  const { t: tc } = useTranslation('common');
  const summary = useTreeStore((state) => state.summary);
  const history = useTreeStore((state) => state.history);
  const fetchTree = useTreeStore((state) => state.fetchTree);
  const status = useTreeStore((state) => state.status);
  const errorState = useTreeStore((state) => state.errorState);
  const recentLogs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  
  const padTop = insets.top + spacing.sm;
  const [chartTooltip, setChartTooltip] = useState(false);
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${hh}:${mm} ${dd}/${MM}/${yyyy}`;
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
      meta: glucoseLog?.recordedAt ? t('latest', { time: formatTime(glucoseLog.recordedAt) }) : t('noDataYet'),
      icon: 'water' as const,
      textColor: '#2563eb',
      bgColor: '#eff6ff',
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
      icon: 'heart-pulse' as const,
      textColor: '#e11d48',
      bgColor: '#fff1f2',
    },
    {
      key: 'weight',
      title: t('weight'),
      value: typeof weightLog?.weight_kg === 'number' ? `${weightLog.weight_kg}` : '--',
      unit: tc('unitKg'),
      meta: weightLog?.recordedAt ? t('latest', { time: formatTime(weightLog.recordedAt) }) : t('noDataYet'),
      icon: 'scale-bathroom' as const,
      textColor: '#7e22ce',
      bgColor: '#faf5ff',
    },
    {
      key: 'water',
      title: t('waterIntake'),
      value: typeof waterLog?.volume_ml === 'number' ? `${waterLog.volume_ml}` : '--',
      unit: tc('unitMl'),
      meta: waterLog?.volume_ml ? t('todayLabel') : t('noDataYet'),
      icon: 'cup-water' as const,
      textColor: '#0f766e',
      bgColor: '#f0fdfa',
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
      checkinApi.getHealthScore()
        .then((result) => setHealthScore(result))
        .catch(() => {});
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const showInitialSkeleton = useInitialLoadingGate(
    status !== 'loading' || Boolean(summary || healthScore),
    650,
    Boolean(summary || recentLogs.length || healthScore),
  );
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    await Promise.all([
      fetchTree(controller.signal),
      fetchLogs(controller.signal),
      checkinApi.getHealthScore().then((result) => setHealthScore(result)).catch(() => {}),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      {errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {errorState === 'no-data' && !summary && !healthScore && !showInitialSkeleton ? <StateError onRetry={() => fetchTree()} message={tc('cannotLoadData')} /> : null}
      
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {showInitialSkeleton ? (
          <TreeTabSkeleton />
        ) : (
        <>
        {status === 'success' && !summary && !healthScore ? <StateEmpty /> : null}
        
        {/* Brand Header Bar */}
        <View style={styles.brandBar}>
          <Image
            source={require('../../../assets/images/asinu-brand-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Image
            source={require('../../../assets/images/asinu-brand-slogan.png')}
            style={styles.brandSlogan}
            resizeMode="contain"
          />
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileBtn}
            accessibilityRole="button"
            accessibilityLabel="Hồ sơ"
            hitSlop={8}
          >
            <Ionicons name="person-outline" size={20} color="#0f766e" />
          </Pressable>
        </View>

        {/* Screen Title & Tree Row */}
        <View style={styles.headerRow}>
          <FloatingSnow x="10%" delay={0} size={14} duration={3500} />
          <FloatingSnow x="30%" delay={1000} size={20} duration={4000} />
          <FloatingSnow x="50%" delay={500} size={12} duration={3000} />
          <FloatingSnow x="70%" delay={1500} size={18} duration={4500} />
          <FloatingSnow x="85%" delay={200} size={16} duration={3200} />
          <View style={{ flex: 1, zIndex: 10 }}>
            <Text style={styles.headerTitle}>{t('healthTree')}</Text>
            <Text style={styles.headerSubtitle}>{t('summaryFromCheckins')}</Text>
          </View>
          <View style={styles.treeWrapper}>
            <Ionicons name="snow" size={14} color="#7dd3fc" style={styles.snowDecor1} />
            <Ionicons name="snow" size={12} color="#38bdf8" style={styles.snowDecor2} />
            <Ionicons name="snow" size={10} color="#bae6fd" style={styles.snowDecor3} />
            <PineTreeIllustration size={78} />
          </View>
        </View>

        {/* Cây sức khỏe lấy trạng thái check-in làm tín hiệu chính. */}
        <View style={styles.infoBox}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="pulse" size={18} color="#059669" />
            <Text style={styles.infoTitle}>{t('statusBasis')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="heart-outline" size={16} color="#059669" />
            <Text style={styles.infoText}>{t('checkinStatusBasis')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="trending-up-outline" size={16} color="#059669" />
            <Text style={styles.infoText}>{t('recentMetricsBasis')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color="#2563eb" />
            <Text style={styles.infoText}>{t('historySecondary')}</Text>
          </View>
        </View>

        {/* Health Tree Status Card */}
        <HealthTreeStatusCard score={healthScore} />

        {/* Trạng thái check-in và dấu hiệu cần chú ý */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Ionicons name="checkmark-circle" size={28} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreValue, { color: '#065f46' }]} numberOfLines={1} adjustsFontSizeToFit>
                {healthScore ? (healthScore.checkinDone ? t('checkinComplete') : t('checkinPending')) : '--'}
              </Text>
              <Text style={[styles.scoreLabel, { color: '#065f46' }]} numberOfLines={1}>{t('todayStatus')}</Text>
            </View>
          </View>

          <View style={styles.scoreCard}>
            <Ionicons name="alert-circle" size={28} color={healthScore?.factors.length ? '#f59e0b' : '#0f766e'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreValue, { color: healthScore?.factors.length ? '#f59e0b' : '#0f766e' }]} numberOfLines={1} adjustsFontSizeToFit>
                {healthScore?.checkinDone ? healthScore.factors.length : '0'}
              </Text>
              <Text style={[styles.scoreLabel, { color: '#6b7280' }]} numberOfLines={1}>{t('signalsToWatch')}</Text>
            </View>
          </View>
        </View>

        {/* Báo cáo sức khoẻ - nhúng nguyên khối */}
        <HealthReportPanel embedded healthScoreOverride={healthScore} />

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="pulse" size={20} color="#059669" />
          <Text style={styles.sectionTitle}>{t('healthMetrics')}</Text>
        </View>

        {/* Metrics Grid 2x2 */}
        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricItem}>
              <View style={styles.metricTop}>
                <View style={[styles.metricIconWrap, { backgroundColor: metric.bgColor }]}>
                  <MaterialCommunityIcons name={metric.icon} size={18} color={metric.textColor} />
                </View>
                <Text style={styles.metricTitle} numberOfLines={1}>{metric.title}</Text>
              </View>

              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>

              <View style={styles.metricMetaRow}>
                <Ionicons name="time-outline" size={12} color="#9ca3af" />
                <Text style={styles.metricMetaText} numberOfLines={1}>{metric.meta}</Text>
              </View>
            </View>
          ))}
        </View>
        
        {/* Activity Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <Ionicons name="trending-up" size={20} color="#059669" />
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

        </>
        )}

      </RippleRefreshScrollView>

      {/* Floating Action Button (+) */}
      <Pressable
        style={[styles.fabButton, { bottom: insets.bottom + 16 }]}
        onPress={() => router.push('/checkin')}
        accessibilityRole="button"
        accessibilityLabel="Check-in"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    brandBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xs,
    },
    brandLogo: {
      width: 125,
      height: 38,
    },
    brandSlogan: {
      width: 135,
      height: 34,
      flexShrink: 1,
      marginHorizontal: 4,
    },
    profileBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: '#a7f3d0',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xs,
      position: 'relative',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#064e3b',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: '#047857',
      fontWeight: '500',
    },
    treeWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    snowDecor1: {
      position: 'absolute',
      top: -6,
      left: -16,
    },
    snowDecor2: {
      position: 'absolute',
      bottom: 22,
      left: -10,
    },
    snowDecor3: {
      position: 'absolute',
      top: 14,
      right: -12,
    },
    infoBox: {
      padding: spacing.md,
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    infoTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 2,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    infoText: {
      fontSize: 13,
      color: '#4b5563',
      flex: 1,
      lineHeight: 18,
    },
    scoreRow: {
      flexDirection: 'row',
      gap: 12,
    },
    scoreCard: {
      flex: 1,
      borderRadius: 18,
      padding: 14,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    scoreValue: {
      fontSize: 18,
      fontWeight: '800',
    },
    scoreLabel: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    metricItem: {
      width: '48%',
      borderRadius: 18,
      padding: 14,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metricIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricTitle: {
      fontWeight: '600',
      fontSize: 13,
      color: '#374151',
      flex: 1,
      marginLeft: 6,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 10,
      marginBottom: 6,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: '800',
      color: '#111827',
    },
    metricUnit: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6b7280',
      marginLeft: 4,
    },
    metricMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metricMetaText: {
      fontSize: 11,
      color: '#9ca3af',
      flex: 1,
    },
    chartSection: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: spacing.md,
      marginTop: spacing.xs,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    chartHeader: {
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    chartTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    chartLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
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
      alignItems: 'center',
      gap: spacing.sm,
    },
    placeholderText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    fabButton: {
      position: 'absolute',
      right: 20,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#00897b',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00897b',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
      zIndex: 50,
    },
  });
}
