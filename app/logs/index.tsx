import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { brandColors, categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';


type LogCard = {
  key: string;
  route: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  bg: string;
  iconColor: string;
  desc: string;
};

export default function LogsIndexScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

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
    { key: 'glucose',          route: '/logs/glucose',       icon: 'water',          bg: '#e8f4fd', iconColor: iconColors.glucose,    desc: t('glucoseValue') },
    { key: 'bloodPressure',    route: '/logs/blood-pressure',icon: 'heart-pulse',    bg: '#fde8e8', iconColor: iconColors.bp,         desc: t('systolic') + ' / ' + t('diastolic') },
    { key: 'medicationInsulin',route: '/logs/medication',    icon: 'pill',           bg: '#e8faf2', iconColor: iconColors.medication, desc: t('medicationName') },
    { key: 'insulin',          route: '/logs/insulin',       icon: 'needle',         bg: '#eceefe', iconColor: iconColors.insulin,    desc: t('insulinDose') },
    { key: 'meal',             route: '/logs/meal',          icon: 'food',           bg: '#fef6e8', iconColor: iconColors.meal,       desc: t('kcal') },
    { key: 'water',            route: '/logs/water',         icon: 'cup-water',      bg: '#e8f8fc', iconColor: iconColors.water,      desc: t('volumeMl') },
    { key: 'weight',           route: '/logs/weight',        icon: 'scale-bathroom', bg: '#ede8fd', iconColor: iconColors.weight,     desc: t('weightKg') },
  ], [t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>

        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={iconColors.primary} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{t('logTitle')}</Text>
                <Text style={styles.headerSub}>{t('logSubtitle')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Cards — 1 per row */}
          <View style={styles.grid}>
            {LOG_CARDS.map((card, i) => (
              <Animated.View
                key={card.key}
                entering={FadeInDown.delay(120 + i * 60).duration(400).springify()}
              >
                <Pressable
                  onPress={() => router.push(card.route as any)}
                  style={({ pressed }) => [styles.card, { backgroundColor: card.bg }, pressed && styles.cardPressed]}
                >
                  <MaterialCommunityIcons name={card.icon} size={26} color={card.iconColor} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{t(card.key as any)}</Text>
                    <Text style={styles.cardDesc}>{card.desc}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textSecondary} />
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
    headerText: { flex: 1, marginLeft: spacing.sm },
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
    // Grid
    grid: {
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cardBody: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDesc: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
  });
}
