import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { ScreenBackButton } from '../../../src/components/ScreenHeaderButton';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { StateError } from '../../../src/components/state/StateError';
import { MissionsTabSkeleton } from '../../../src/components/state/MainScreenSkeletons';
import { useMissionActions } from '../../../src/features/missions/useMissionActions';
import { MissionProgressBar } from '../../../src/features/missions/MissionProgressBar';
import type { Mission } from '../../../src/features/missions/missions.store';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import { getBottomTabBarHeight } from '../../../src/styles';

type MissionKey = 'daily_checkin' | 'log_bp' | 'log_glucose' | 'log_water' | 'log_weight';

const MISSION_ORDER: MissionKey[] = [
  'daily_checkin',
  'log_bp',
  'log_glucose',
  'log_water',
  'log_weight',
];

const MISSION_ROUTES: Record<MissionKey, string> = {
  daily_checkin: '/checkin',
  log_bp: '/logs/blood-pressure',
  log_glucose: '/logs/glucose',
  log_water: '/logs/water',
  log_weight: '/logs/weight',
};

const MISSION_CONFIG: Record<
  MissionKey,
  {
    image: ImageSourcePropType;
    defaultGoal: number;
    titleKey: string;
    descKey: string;
  }
> = {
  daily_checkin: {
    image: require('../../../assets/images/missions/icons-v2/checkin-v2.png'),
    defaultGoal: 1,
    titleKey: 'dailyCheckIn',
    descKey: 'dailyCheckInDesc',
  },
  log_bp: {
    image: require('../../../assets/images/missions/icons-v2/blood-pressure-v2.png'),
    defaultGoal: 2,
    titleKey: 'measureBP',
    descKey: 'measureBPDesc',
  },
  log_glucose: {
    image: require('../../../assets/images/missions/icons-v2/glucose-v2.png'),
    defaultGoal: 2,
    titleKey: 'measureGlucose',
    descKey: 'measureGlucoseDesc',
  },
  log_water: {
    image: require('../../../assets/images/missions/icons-v2/water-v2.png'),
    defaultGoal: 4,
    titleKey: 'waterIntake',
    descKey: 'waterIntakeDesc',
  },
  log_weight: {
    image: require('../../../assets/images/missions/icons-v2/weight-v2.png'),
    defaultGoal: 1,
    titleKey: 'weightMission',
    descKey: 'weightMissionDesc',
  },
};

type MissionItem = {
  id: string;
  missionKey: MissionKey;
  title: string;
  description: string;
  progress: number;
  goal: number;
  status: 'active' | 'completed';
  config: (typeof MISSION_CONFIG)[MissionKey];
};

export default function MissionsScreen() {
  const router = useRouter();
  const { missions, status, errorState, fetchMissions } = useMissionActions();
  const { t } = useTranslation('missions');
  const { t: tc } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchMissions(controller.signal);
      return () => controller.abort();
    }, [fetchMissions])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMissions();
    } finally {
      setRefreshing(false);
    }
  }, [fetchMissions]);

  const orderedMissions: MissionItem[] = useMemo(() => {
    const map = new Map<string, Mission>(missions.map((mission) => [mission.missionKey, mission]));
    // A missing server task is not an unstarted task. Keep the empty state honest.
    return MISSION_ORDER.flatMap((key) => {
      const existing = map.get(key);
      if (!existing) {
        return [];
      }
      const config = MISSION_CONFIG[key];
      const goal = Number.isFinite(existing.goal) && existing.goal > 0
        ? existing.goal : config.defaultGoal;
      const progress = Number.isFinite(existing.progress)
        ? Math.min(goal, Math.max(0, existing.progress)) : 0;
      return [{
        id: existing.id,
        missionKey: key,
        title: existing.title || t(config.titleKey as any),
        description: existing.description || t(config.descKey as any),
        progress,
        goal,
        status: existing.status === 'completed' || progress >= goal ? 'completed' : 'active',
        config,
      } satisfies MissionItem];
    });
  }, [missions, t]);
  const remaining = orderedMissions.filter((item) => item.status !== 'completed');
  const completed = orderedMissions.filter((item) => item.status === 'completed');
  const showInitialSkeleton = (status === 'idle' || status === 'loading') && missions.length === 0;
  const showError = errorState === 'no-data' && missions.length === 0 && !showInitialSkeleton;

  const renderGroup = (items: MissionItem[], group: 'remaining' | 'completed') => (
    <View style={styles.taskGroup} testID={`missions-${group}`}>
      {items.map((item, index) => {
        const done = item.status === 'completed';
        const progressLabel = done ? t('statusCompleted') : item.goal === 1 && item.progress === 0
          ? t('singlePending') : t('recordedProgress', { progress: item.progress, goal: item.goal });
        return (
          <React.Fragment key={item.missionKey}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <Pressable
              testID={`mission-${item.missionKey}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${progressLabel}`}
              accessibilityHint={t('openMission')}
              onPress={() => router.push(MISSION_ROUTES[item.missionKey] as any)}
              style={({ pressed }) => [styles.taskRow, pressed && styles.pressedRow]}
            >
              <View style={styles.missionArtwork}>
                <Image source={item.config.image} style={styles.missionImage}
                  resizeMode="contain" resizeMethod="resize" accessible={false} />
              </View>
              <View style={styles.taskContent}>
                <Text allowFontScaling style={styles.taskTitle}>{item.title}</Text>
                <Text allowFontScaling style={[styles.taskProgress, done && styles.completedText]}>
                  {progressLabel}
                </Text>
                {!done && item.progress > 0 ? (
                  <MissionProgressBar title={item.title} progress={item.progress}
                    goal={item.goal} completed={false} />
                ) : null}
              </View>
              <View style={[styles.rowAction, done && styles.completedAction]}>
                <Ionicons name={done ? 'checkmark' : 'chevron-forward'} size={20}
                  color={colors.primaryText} />
              </View>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );

  return (
    <Screen>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <ScreenBackButton style={styles.backButton} iconColor={colors.textPrimary} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/home' as any);
            }
          }} />
          <Text allowFontScaling accessibilityRole="header" style={styles.headerTitle}>
            {t('missionList')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {errorState === 'remote-failed' ? <OfflineBanner onRetry={() => fetchMissions()} /> : null}
        <RippleRefreshScrollView
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={[styles.scrollContent, {
            paddingBottom: getBottomTabBarHeight(insets.bottom) + 24,
          }]}
          showsVerticalScrollIndicator={false}
        >
          {showInitialSkeleton ? <MissionsTabSkeleton /> : showError ? (
            <StateError onRetry={() => fetchMissions()} message={tc('cannotLoadData')} />
          ) : orderedMissions.length === 0 ? (
            <StateEmpty message={t('noMissionsToday')} />
          ) : (
            <>
              <View style={styles.dailySummary} testID="missions-summary">
                <View style={styles.summaryHeading}>
                  <Text allowFontScaling accessibilityRole="header" style={styles.todayTitle}>
                    {t('today')}
                  </Text>
                  <Text allowFontScaling style={styles.summaryCount}>
                    {t('completionSummary', { completed: completed.length, total: orderedMissions.length })}
                  </Text>
                </View>
                <MissionProgressBar title={t('missionList')} progress={completed.length}
                  goal={orderedMissions.length} completed={remaining.length === 0} />
              </View>
              {remaining.length > 0 ? (
                <View style={styles.section}>
                  <Text allowFontScaling accessibilityRole="header" style={styles.sectionTitle}>
                    {t('remainingTitle')}
                  </Text>
                  {renderGroup(remaining, 'remaining')}
                </View>
              ) : null}
              {completed.length > 0 ? (
                <View style={styles.section}>
                  <Pressable testID="missions-completed-toggle" accessibilityRole="button"
                    accessibilityState={{ expanded: completedExpanded }}
                    onPress={() => setCompletedExpanded((value) => !value)}
                    style={({ pressed }) => [styles.disclosure, pressed && styles.pressedDisclosure]}>
                    <View style={styles.disclosureLabel}>
                      <Ionicons name="checkmark-circle-outline" size={22} color={colors.primaryText} />
                      <Text allowFontScaling style={styles.sectionTitle}>
                        {t('completedSection', { count: completed.length })}
                      </Text>
                    </View>
                    <Ionicons name={completedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20} color={colors.textSecondary} />
                  </Pressable>
                  {completedExpanded ? renderGroup(completed, 'completed') : null}
                </View>
              ) : null}
              <View style={styles.helpSection}>
                <Pressable testID="missions-help-toggle" accessibilityRole="button"
                  accessibilityState={{ expanded: helpExpanded }}
                  onPress={() => setHelpExpanded((value) => !value)}
                  style={({ pressed }) => [styles.disclosure, pressed && styles.pressedDisclosure]}>
                  <View style={styles.disclosureLabel}>
                    <Ionicons name="information-circle-outline" size={21} color={colors.textSecondary} />
                    <Text allowFontScaling style={styles.helpTitle}>{t('howItWorks')}</Text>
                  </View>
                  <Ionicons name={helpExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18} color={colors.textSecondary} />
                </Pressable>
                {helpExpanded ? (
                  <View testID="missions-help" style={styles.helpContent}>
                    <Text allowFontScaling style={styles.helpText}>{t('instructions')}</Text>
                    {orderedMissions.map((item) => (
                      <View key={item.missionKey} style={styles.helpItem}>
                        <Text allowFontScaling style={styles.helpItemTitle}>{item.title}</Text>
                        <Text allowFontScaling style={styles.helpText}>{item.description}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          )}
        </RippleRefreshScrollView>
      </View>
    </Screen>
  );
}

function createStyles({ colors, isDark }: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: isDark ? colors.background : '#F2F7F4' },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
    },
    backButton: { width: 44, height: 44 },
    headerSpacer: { width: 44 },
    headerTitle: {
      flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.textPrimary,
    },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, gap: 24 },
    dailySummary: { paddingHorizontal: 4, paddingBottom: 4 },
    summaryHeading: {
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      justifyContent: 'space-between', columnGap: 16, rowGap: 4,
    },
    todayTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    summaryCount: { fontSize: 14, fontWeight: '500', color: colors.primaryText, flexShrink: 1 },
    section: { gap: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
    taskGroup: {
      borderRadius: 24, overflow: 'hidden', borderWidth: 1,
      borderColor: isDark ? colors.border : '#E0EAE4',
      backgroundColor: isDark ? colors.surface : '#FDFFFE',
    },
    taskRow: {
      minHeight: 104, flexDirection: 'row', alignItems: 'center',
      gap: 12, paddingHorizontal: 16, paddingVertical: 20,
    },
    pressedRow: { backgroundColor: colors.primaryLight },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 84, marginRight: 16 },
    missionArtwork: {
      width: 56, height: 56, borderRadius: 16, flexShrink: 0,
      backgroundColor: isDark ? colors.surfaceMuted : '#EFF6F1',
      alignItems: 'center', justifyContent: 'center',
    },
    missionImage: { width: 52, height: 52 },
    taskContent: { flex: 1, minWidth: 0, gap: 4 },
    taskTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
    taskProgress: { fontSize: 14, color: colors.textSecondary },
    completedText: { color: colors.primaryText },
    rowAction: {
      width: 28, height: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    },
    completedAction: { borderRadius: 14, backgroundColor: colors.primaryLight },
    disclosure: {
      minHeight: 48, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, paddingVertical: 8, paddingHorizontal: 4,
    },
    disclosureLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    pressedDisclosure: { opacity: 0.65 },
    helpSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
    helpTitle: { fontSize: 15, fontWeight: '500', color: colors.textSecondary, flexShrink: 1 },
    helpContent: { paddingHorizontal: 4, paddingTop: 8, gap: 16 },
    helpText: { fontSize: 14, color: colors.textSecondary },
    helpItem: { gap: 2 },
    helpItemTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  });
}
