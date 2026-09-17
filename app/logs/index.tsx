import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useLogsStore, type LogEntry } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';

type LogCardItem = {
  key: string;
  route: string;
  title: string;
  value: string | number;
  unit: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  banner: any;
};

// Tạm ẩn Thuốc và Insulin khỏi màn Ghi nhật ký; giữ nguyên dữ liệu và màn nhập riêng.
const HIDDEN_LOG_CARD_KEYS = new Set(['medication', 'insulin']);

export default function LogsIndexScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);

  const fetchLogs = useLogsStore((s) => s.fetchRecent);
  const status    = useLogsStore((s) => s.status);
  const logs      = useLogsStore((s) => s.recent);

  useEffect(() => {
    if (status === 'idle') {
      const c = new AbortController();
      fetchLogs(c.signal);
      return () => c.abort();
    }
  }, [status, fetchLogs]);

  const quickMetrics = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isToday = (iso?: string) => {
      if (!iso) return false;
      return new Date(iso).getTime() >= todayStart.getTime();
    };

    const latestGlucose = logs.find((l: LogEntry) => l.type === 'glucose' && isToday(l.recordedAt));
    const latestBp = logs.find((l: LogEntry) => l.type === 'blood-pressure' && isToday(l.recordedAt));
    const latestWeight = logs.find((l: LogEntry) => l.type === 'weight' && isToday(l.recordedAt));
    const waterTotal = logs
      .filter((l: LogEntry) => l.type === 'water' && isToday(l.recordedAt))
      .reduce((sum: number, l: LogEntry) => sum + (Number(l.volume_ml) || 0), 0);
    const medCount = logs.filter((l: LogEntry) => l.type === 'medication' && isToday(l.recordedAt)).length;
    const mealCount = logs.filter((l: LogEntry) => l.type === 'meal' && isToday(l.recordedAt)).length;
    const insulinTotal = logs
      .filter((l: LogEntry) => l.type === 'insulin' && isToday(l.recordedAt))
      .reduce((sum: number, l: LogEntry) => sum + (Number(l.dose_units) || 0), 0);

    const gVal = latestGlucose?.value;
    const bpVal = latestBp?.systolic && latestBp?.diastolic ? `${latestBp.systolic}/${latestBp.diastolic}` : null;
    const wVal = latestWeight?.weight_kg;

    return {
      glucose: typeof gVal === 'number' && Number.isFinite(gVal) ? gVal : '--',
      bloodPressure: bpVal || '--',
      water: waterTotal > 0 ? waterTotal : '--',
      weight: typeof wVal === 'number' && Number.isFinite(wVal) ? wVal : '--',
      medication: medCount > 0 ? medCount : '--',
      meal: mealCount > 0 ? mealCount : '--',
      insulin: insulinTotal > 0 ? insulinTotal : '--',
    };
  }, [logs]);

  const LOG_CARDS: LogCardItem[] = useMemo(() => [
    {
      key: 'glucose',
      route: '/logs/glucose',
      title: t('glucose'),
      value: quickMetrics.glucose,
      unit: 'mg/dL',
      icon: 'water',
      iconColor: '#E11D48',
      iconBg: '#FFF1F2',
      banner: require('../../assets/images/logs/banner_glucose.png'),
    },
    {
      key: 'bloodPressure',
      route: '/logs/blood-pressure',
      title: t('bloodPressure'),
      value: quickMetrics.bloodPressure,
      unit: 'mmHg',
      icon: 'heart-pulse',
      iconColor: '#E11D48',
      iconBg: '#FFF0F2',
      banner: require('../../assets/images/logs/banner_bp.png'),
    },
    {
      key: 'water',
      route: '/logs/water',
      title: t('water'),
      value: quickMetrics.water,
      unit: 'ml',
      icon: 'cup-water',
      iconColor: '#0284C7',
      iconBg: '#E0F2FE',
      banner: require('../../assets/images/logs/banner_water.png'),
    },
    {
      key: 'weight',
      route: '/logs/weight',
      title: t('weight'),
      value: quickMetrics.weight,
      unit: 'kg',
      icon: 'scale-bathroom',
      iconColor: '#7C3AED',
      iconBg: '#F3EBFD',
      banner: require('../../assets/images/logs/banner_weight.png'),
    },
    {
      key: 'medication',
      route: '/logs/medication',
      title: t('medication'),
      value: quickMetrics.medication,
      unit: t('doseUnit', { defaultValue: 'liều' }),
      icon: 'pill',
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      banner: require('../../assets/images/logs/banner_medication.png'),
    },
    {
      key: 'meal',
      route: '/logs/meal',
      title: t('meal'),
      value: quickMetrics.meal,
      unit: t('mealUnit', { defaultValue: 'bữa' }),
      icon: 'food-apple',
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      banner: require('../../assets/images/logs/banner_meal.png'),
    },
    {
      key: 'insulin',
      route: '/logs/insulin',
      title: t('insulin'),
      value: quickMetrics.insulin,
      unit: t('insulinUnit', { defaultValue: 'U' }),
      icon: 'needle',
      iconColor: '#4F46E5',
      iconBg: '#EEF2FF',
      banner: require('../../assets/images/logs/banner_insulin.png'),
    },
  ], [quickMetrics, t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.sm }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
            <View style={styles.headerRow}>
              <ScreenBackButton onPress={() => router.back()} />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{t('logTitle')}</Text>
                <Text style={styles.headerSub}>{t('logSubtitle')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Cards Grid — All 7 categories in clean 3D card layout */}
          <View style={styles.grid}>
            {LOG_CARDS.filter((card) => !HIDDEN_LOG_CARD_KEYS.has(card.key)).map((card, i) => (
              <Animated.View
                key={card.key}
                entering={FadeInDown.delay(60 + i * 50).duration(400).springify()}
              >
                <Pressable
                  onPress={() => router.push(card.route as any)}
                  style={({ pressed }) => [styles.metricCard, pressed && styles.cardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.title}: ${card.value} ${card.unit}`}
                >
                  {/* 3D Crystal Banner Background */}
                  <Image
                    source={card.banner}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                  />

                  {/* Dark mode overlay */}
                  {isDark && (
                    <LinearGradient
                      colors={['rgba(15, 23, 42, 0.90)', 'rgba(15, 23, 42, 0.45)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}

                  {/* Card Content Column */}
                  <View style={styles.metricCardContent}>
                    <View style={styles.metricHeaderRow}>
                      <View style={[styles.metricIconCircle, { backgroundColor: card.iconBg }]}>
                        <MaterialCommunityIcons name={card.icon} size={20} color={card.iconColor} />
                      </View>
                      <Text style={styles.metricTitle}>{card.title}</Text>
                    </View>

                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValue}>{card.value}</Text>
                      <Text style={styles.metricUnit}>{card.unit}</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          <View style={{ height: insets.bottom + spacing.xl }} />
        </ScrollView>
      </Screen>
    </>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  isDark: boolean
) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    headerText: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    headerSub: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Grid
    grid: {
      gap: 16,
    },
    metricCard: {
      height: 144,
      borderRadius: 24,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#263044' : '#EEF2F5',
      overflow: 'hidden',
      paddingHorizontal: 20,
      paddingVertical: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.04,
      shadowRadius: 10,
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    metricCardContent: {
      zIndex: 2,
      maxWidth: '60%',
      flex: 1,
      justifyContent: 'space-between',
    },
    metricHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metricIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#F8FAFC' : '#0F172A',
      marginLeft: 12,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    metricValue: {
      fontSize: 28,
      fontWeight: '800',
      color: isDark ? '#F8FAFC' : '#0F172A',
    },
    metricUnit: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#64748B',
      marginLeft: 8,
    },
  });
}
