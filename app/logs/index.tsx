import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { brandColors, categoryColors, colors, radius, spacing } from '../../src/styles';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = spacing.md;
const CARD_W = (SCREEN_W - spacing.lg * 2 - CARD_GAP) / 2;

type LogCard = {
  key: string;
  route: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  colors: [string, string];
  iconBg: string;
  desc: string;
};

export default function LogsIndexScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const fetchLogs = useLogsStore((s) => s.fetchRecent);
  const status    = useLogsStore((s) => s.status);
  const isStale   = useLogsStore((s) => s.isStale);

  useEffect(() => {
    if (status === 'idle') {
      const c = new AbortController();
      fetchLogs(c.signal);
      return () => c.abort();
    }
  }, [status, fetchLogs]);

  const handleRefresh = useCallback(() => {
    const c = new AbortController();
    fetchLogs(c.signal);
  }, [fetchLogs]);

  const LOG_CARDS: LogCard[] = useMemo(() => [
    {
      key: 'glucose',
      route: '/logs/glucose',
      icon: 'water',
      colors: [categoryColors.glucose, '#2563eb'],
      iconBg: categoryColors.glucoseBg,
      desc: t('glucoseValue'),
    },
    {
      key: 'bloodPressure',
      route: '/logs/blood-pressure',
      icon: 'heart-pulse',
      colors: [categoryColors.bloodPressure, '#b91c1c'],
      iconBg: categoryColors.bloodPressureBg,
      desc: t('systolic') + ' / ' + t('diastolic'),
    },
    {
      key: 'medicationInsulin',
      route: '/logs/medication',
      icon: 'pill',
      colors: [categoryColors.medication, '#047857'],
      iconBg: categoryColors.medicationBg,
      desc: t('medicationName'),
    },
    {
      key: 'insulin',
      route: '/logs/insulin',
      icon: 'needle',
      colors: [categoryColors.insulin, '#4338ca'],
      iconBg: categoryColors.insulinBg,
      desc: t('insulinDose'),
    },
    {
      key: 'meal',
      route: '/logs/meal',
      icon: 'food',
      colors: [categoryColors.meal, '#d97706'],
      iconBg: categoryColors.mealBg,
      desc: t('kcal'),
    },
    {
      key: 'water',
      route: '/logs/water',
      icon: 'cup-water',
      colors: [categoryColors.water, '#0891b2'],
      iconBg: categoryColors.waterBg,
      desc: t('volumeMl'),
    },
    {
      key: 'weight',
      route: '/logs/weight',
      icon: 'scale-bathroom',
      colors: [categoryColors.weight, '#6d28d9'],
      iconBg: categoryColors.weightBg,
      desc: t('weightKg'),
    },
  ], [t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        {isStale ? <OfflineBanner /> : null}

        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{t('logTitle')}</Text>
                <Text style={styles.headerSub}>{t('logSubtitle')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Hero banner */}
          <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            >
              <View style={styles.heroIconWrap}>
                <MaterialCommunityIcons name="notebook-edit-outline" size={36} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{t('quickLog')}</Text>
                <Text style={styles.heroSub}>Chọn chỉ số bạn muốn ghi hôm nay</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Grid cards */}
          <View style={styles.grid}>
            {LOG_CARDS.map((card, i) => (
              <Animated.View
                key={card.key}
                entering={FadeInDown.delay(120 + i * 60).duration(400).springify()}
              >
                <Pressable
                  onPress={() => router.push(card.route as any)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <LinearGradient
                    colors={card.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    {/* Icon bubble */}
                    <View style={styles.cardIconBg}>
                      <MaterialCommunityIcons name={card.icon} size={28} color="#fff" />
                    </View>
                    <Text style={styles.cardTitle}>{t(card.key as any)}</Text>
                    <Text style={styles.cardDesc} numberOfLines={1}>{card.desc}</Text>
                    <View style={styles.cardArrow}>
                      <MaterialCommunityIcons name="arrow-right" size={14} color="rgba(255,255,255,0.7)" />
                    </View>
                  </LinearGradient>
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

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
      backgroundColor: colors.background,
    },
    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: { flex: 1 },
    headerTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSub: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Hero banner
    heroBanner: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    heroIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: '#fff',
    },
    heroSub: {
      fontSize: typography.size.xs,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 4,
    },
    // Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CARD_GAP,
    },
    card: {
      width: CARD_W,
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    cardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.97 }],
    },
    cardGradient: {
      padding: spacing.lg,
      minHeight: 140,
      gap: spacing.xs,
    },
    cardIconBg: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    cardTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: '#fff',
    },
    cardDesc: {
      fontSize: typography.size.xs,
      color: 'rgba(255,255,255,0.75)',
    },
    cardArrow: {
      marginTop: 'auto',
      alignSelf: 'flex-end',
    },
  });
}
