import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, interpolateColor, withDelay } from 'react-native-reanimated';
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
import { colors, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import React from 'react';

const C1TrendChart = React.lazy(() => import('../../../src/ui-kit/C1TrendChart').then(m => ({ default: m.C1TrendChart })));
const T1ProgressRing = React.lazy(() => import('../../../src/ui-kit/T1ProgressRing').then(m => ({ default: m.T1ProgressRing })));

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

function FlashingScoreCard({ children, style }: any) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['#ffffff', '#ecfdf5', '#ffffff']
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['rgba(16,185,129,0.1)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.1)']
    );
    return {
      backgroundColor: bgColor,
      borderColor: borderColor,
    };
  });

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

function AnimatedBorderCard({ color, innerColors, style, children }: { color: string; innerColors: readonly [string, string, ...string[]]; style?: any; children: React.ReactNode }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
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
    <View style={[style, { overflow: 'hidden', position: 'relative' }]}>
      <Animated.View style={[{ width: '250%', height: '250%', position: 'absolute', top: '-75%', left: '-75%', opacity: 0.7 }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', color, color, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={innerColors}
        style={[StyleSheet.absoluteFill, { top: 2, left: 2, right: 2, bottom: 2, borderRadius: (style?.borderRadius || 24) - 2 }]}
      />
      {children}
    </View>
  );
}

function AnimatedLightningSparks() {
  const opacity1 = useSharedValue(0);
  const opacity2 = useSharedValue(0);

  useEffect(() => {
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 100, easing: Easing.linear }),
        withTiming(0, { duration: 120, easing: Easing.linear }),
        withTiming(0.25, { duration: 80, easing: Easing.linear }),
        withTiming(0, { duration: 150, easing: Easing.linear }),
        withDelay(3000, withTiming(0, { duration: 100 }))
      ),
      -1,
      false
    );

    opacity2.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(0.3, { duration: 120, easing: Easing.linear })),
        withTiming(0, { duration: 100, easing: Easing.linear }),
        withTiming(0.2, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 160, easing: Easing.linear }),
        withDelay(2800, withTiming(0, { duration: 100 }))
      ),
      -1,
      false
    );
  }, []);

  const animStyle1 = useAnimatedStyle(() => {
    return {
      opacity: opacity1.value,
    };
  });

  const animStyle2 = useAnimatedStyle(() => {
    return {
      opacity: opacity2.value,
    };
  });

  return (
    <>
      <Animated.View style={[{ position: 'absolute', top: -4, right: 8, transform: [{ rotate: '-15deg' }] }, animStyle1]}>
        <Ionicons name="flash" size={36} color="#fbbf24" />
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', bottom: -6, left: 32, transform: [{ rotate: '35deg' }] }, animStyle2]}>
        <Ionicons name="flash" size={24} color="#fbbf24" />
      </Animated.View>
    </>
  );
}

function FloatingLeaf({ x, y, rotate, size, color, delay = 0 }: any) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    const t1 = setTimeout(() => {
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
    return () => clearTimeout(t1);
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

export default function TreeScreen() {
  const { t } = useTranslation('tree');
  const { t: tc } = useTranslation('common');
  const { t: th } = useTranslation('home');
  const summary = useTreeStore((state) => state.summary);
  const history = useTreeStore((state) => state.history);
  const fetchTree = useTreeStore((state) => state.fetchTree);
  const status = useTreeStore((state) => state.status);
  const errorState = useTreeStore((state) => state.errorState);
  const recentLogs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  
  const orangeColors = isDark 
    ? (['#271c06', '#1d1403'] as const) 
    : (['#fffbeb', '#fef3c7'] as const);
  const orangeBorder = isDark ? 'rgba(245, 158, 11, 0.25)' : '#fde68a';
  const orangeText = isDark ? '#fbbf24' : '#b45309';
  const orangeValue = isDark ? '#fbbf24' : '#d97706';
  const orangeIconBg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fff';

  const purpleColors = isDark 
    ? (['#1c142c', '#150d22'] as const) 
    : (['#faf5ff', '#f3e8ff'] as const);
  const purpleBorder = isDark ? 'rgba(139, 92, 246, 0.25)' : '#ddd6fe';
  const purpleText = isDark ? '#a78bfa' : '#6d28d9';
  const purpleValue = isDark ? '#a78bfa' : '#7c3aed';
  const purpleIconBg = isDark ? 'rgba(139, 92, 246, 0.15)' : '#fff';

  const padTop = insets.top + spacing.lg;
  const [chartTooltip, setChartTooltip] = useState(false);

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
      bgIcon: 'sprout' as const,
      colors: ['#eff6ff', '#dbeafe'] as const,
      textColor: '#2563eb',
      bgIconColor: 'rgba(59,130,246,0.1)'
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
      bgIcon: 'heart-pulse' as const,
      colors: ['#fdf2f8', '#fce7f3'] as const,
      textColor: '#e11d48',
      bgIconColor: 'rgba(225,29,72,0.1)'
    },
    {
      key: 'weight',
      title: t('weight'),
      value: typeof weightLog?.weight_kg === 'number' ? `${weightLog.weight_kg}` : '--',
      unit: tc('unitKg'),
      meta: weightLog?.recordedAt ? t('latest', { time: formatTime(weightLog.recordedAt) }) : t('noDataYet'),
      icon: 'scale-bathroom' as const,
      bgIcon: 'scale-bathroom' as const,
      colors: ['#faf5ff', '#f3e8ff'] as const,
      textColor: '#7e22ce',
      bgIconColor: 'rgba(126,34,206,0.1)'
    },
    {
      key: 'water',
      title: t('waterIntake'),
      value: typeof waterLog?.volume_ml === 'number' ? `${waterLog.volume_ml}` : '--',
      unit: tc('unitMl'),
      meta: waterLog?.volume_ml ? t('todayLabel') : t('noDataYet'),
      icon: 'cup-water' as const,
      bgIcon: 'cup-water' as const,
      colors: ['#f0fdfa', '#ccfbf1'] as const,
      textColor: '#0f766e',
      bgIconColor: 'rgba(15,118,110,0.1)'
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
  }, []);

  return (
    <Screen>
      <LinearGradient
        colors={['#f0fdf4', '#e0f2fe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
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
        
        {/* Header Section */}
        <View style={styles.headerRow}>
          <FloatingSnow x="10%" delay={0} size={14} duration={3500} />
          <FloatingSnow x="30%" delay={1000} size={20} duration={4000} />
          <FloatingSnow x="50%" delay={500} size={12} duration={3000} />
          <FloatingSnow x="70%" delay={1500} size={18} duration={4500} />
          <FloatingSnow x="85%" delay={200} size={16} duration={3200} />
          
          <View style={{ flex: 1, zIndex: 10 }}>
            <Text style={styles.headerTitle}>{t('healthTree')}</Text>
            <Text style={styles.headerSubtitle}>{t('summaryFromLogs')}</Text>
          </View>
          <Animated.View style={{ zIndex: 10 }}>
            <FontAwesome5 name="tree" size={72} color="#10b981" />
          </Animated.View>
        </View>

        {/* Giải thích cách tính điểm (Info Box) */}
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

        {/* Progress Score (Ring) */}
        <FlashingScoreCard style={styles.scoreCardContainer}>
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
              <T1ProgressRing percentage={summary?.score ?? 0} label={t('score')} accentColor="#34d399" />
            </Suspense>
          </View>
          <Text style={styles.scoreCaption}>
            {Math.round((summary?.score ?? 0) * 100)}% - {(summary?.score ?? 0) >= 0.7 ? t('good') : (summary?.score ?? 0) >= 0.4 ? t('average') : t('needsImprovement')}
          </Text>
        </FlashingScoreCard>

        {/* Streak & Missions Row */}
        <View style={styles.scoreRow}>
          <LinearGradient colors={orangeColors} style={[styles.scoreCard, { borderColor: orangeBorder, borderWidth: 1.5, position: 'relative', overflow: 'hidden' }]}>
            <AnimatedLightningSparks />
            <View style={[styles.scoreIconWrap, { backgroundColor: orangeIconBg, zIndex: 2 }]}>
              <Ionicons name="flame" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1, zIndex: 2 }}>
              <Text style={[styles.scoreValue, { color: orangeValue }]} numberOfLines={1} adjustsFontSizeToFit>{summary?.streakDays ?? 0}</Text>
              <Text style={[styles.scoreLabel, { color: orangeText }]} numberOfLines={1}>{t('consecutiveDays')}</Text>
            </View>
          </LinearGradient>

          <LinearGradient colors={purpleColors} style={[styles.scoreCard, { borderColor: purpleBorder, borderWidth: 1.5 }]}>
            <View style={[styles.scoreIconWrap, { backgroundColor: purpleIconBg }]}>
              <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreValue, { color: purpleValue }]} numberOfLines={1} adjustsFontSizeToFit>{summary?.completedToday ?? 0}/{summary?.totalMissions ?? 8}</Text>
              <Text style={[styles.scoreLabel, { color: purpleText }]} numberOfLines={1}>{t('todayMissions')}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart" size={20} color={colors.textPrimary} />
          <Text style={styles.sectionTitle}>{t('healthMetrics')}</Text>
        </View>

        {/* Metrics Grid 2x2 */}
        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <AnimatedBorderCard
              key={metric.key}
              innerColors={metric.colors}
              color={metric.textColor}
              style={styles.metricItem}
            >
              <View style={styles.metricContent}>
                <View style={styles.metricTop}>
                  <MaterialCommunityIcons name={metric.icon} size={20} color={metric.textColor} />
                  <Text style={[styles.metricTitle, { color: metric.textColor }]}>{metric.title}</Text>
                </View>
                
                <Text style={[styles.metricValue, { color: metric.textColor }]} numberOfLines={1} adjustsFontSizeToFit>{metric.value}</Text>
                <Text style={[styles.metricUnit, { color: metric.textColor, opacity: 0.7 }]}>{metric.unit}</Text>
                
                <MaterialCommunityIcons 
                  name={metric.bgIcon} 
                  size={70} 
                  color={metric.bgIconColor} 
                  style={styles.metricBgIcon} 
                />
              </View>
            </AnimatedBorderCard>
          ))}
        </View>
        
        {/* Health Report Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            pressed && { opacity: 0.85 }
          ]}
          onPress={() => router.push('/report')}
        >
          <Text style={styles.actionBtnText}>{th('healthReport')}</Text>
        </Pressable>
        
        {/* Activity Chart */}
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

        {/* Quick Log Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: '#0ea5e9', marginTop: 0 },
            pressed && { opacity: 0.85 }
          ]}
          onPress={() => router.push('/logs')}
        >
          <Text style={styles.actionBtnText}>{tc('quickLog')}</Text>
        </Pressable>

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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#065f46',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: typography.size.sm,
      color: '#047857',
    },
    infoBox: {
      padding: spacing.lg,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
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
    scoreCardContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 24,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
      gap: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    scoreCaption: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      fontWeight: '500'
    },
    scoreRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    scoreCard: {
      flex: 1,
      borderRadius: 20,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    scoreIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreValue: {
      fontSize: 20,
      fontWeight: '800',
    },
    scoreLabel: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      marginTop: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      justifyContent: 'space-between'
    },
    metricItem: {
      width: '47.5%',
      borderRadius: 24,
      minHeight: 140,
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5,
    },
    metricContent: {
      flex: 1,
      padding: spacing.lg,
      zIndex: 2,
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.md,
    },
    metricTitle: {
      fontWeight: '600',
      fontSize: typography.size.sm,
    },
    metricValue: {
      fontSize: 26,
      fontWeight: '800',
      marginTop: 'auto',
    },
    metricUnit: {
      fontSize: typography.size.xs,
    },
    metricBgIcon: {
      position: 'absolute',
      bottom: -15,
      right: -10,
      transform: [{ rotate: '-10deg' }],
      zIndex: -1,
    },
    actionBtn: {
      backgroundColor: '#10b981',
      borderRadius: 100,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xs,
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    actionBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: typography.size.md,
    },
    chartSection: {
      backgroundColor: '#ffffff',
      borderRadius: 24,
      padding: spacing.lg,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
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
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
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
  });
}
