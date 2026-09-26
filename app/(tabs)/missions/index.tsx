import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { StateError } from '../../../src/components/state/StateError';
import { MissionsTabSkeleton } from '../../../src/components/state/MainScreenSkeletons';
import { useMissionActions } from '../../../src/features/missions/useMissionActions';
import type { Mission } from '../../../src/features/missions/missions.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';

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
    order: number;
    badgeBg: string;
    badgeColor: string;
    art: any;
    defaultGoal: number;
    titleKey: string;
    descKey: string;
  }
> = {
  daily_checkin: {
    order: 1,
    badgeBg: '#dcfce7',
    badgeColor: '#059669',
    art: require('../../../assets/images/missions/mission_checkin_art.png'),
    defaultGoal: 1,
    titleKey: 'dailyCheckIn',
    descKey: 'dailyCheckInDesc',
  },
  log_bp: {
    order: 2,
    badgeBg: '#ffe4e6',
    badgeColor: '#f43f5e',
    art: require('../../../assets/images/missions/mission_bp_art.png'),
    defaultGoal: 2,
    titleKey: 'measureBP',
    descKey: 'measureBPDesc',
  },
  log_glucose: {
    order: 3,
    badgeBg: '#ede9fe',
    badgeColor: '#6366f1',
    art: require('../../../assets/images/missions/mission_glucose_art.png'),
    defaultGoal: 2,
    titleKey: 'measureGlucose',
    descKey: 'measureGlucoseDesc',
  },
  log_water: {
    order: 4,
    badgeBg: '#e0f2fe',
    badgeColor: '#0284c7',
    art: require('../../../assets/images/missions/mission_water_art.png'),
    defaultGoal: 4,
    titleKey: 'waterIntake',
    descKey: 'waterIntakeDesc',
  },
  log_weight: {
    order: 5,
    badgeBg: '#fef3c7',
    badgeColor: '#d97706',
    art: require('../../../assets/images/missions/mission_weight_art.png'),
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
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [tooltipMission, setTooltipMission] = useState<MissionItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) {
        return;
      }
      lastFetchRef.current = now;
      const controller = new AbortController();
      fetchMissions(controller.signal);
      return () => controller.abort();
    }, [fetchMissions])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const controller = new AbortController();
    await fetchMissions(controller.signal);
    setRefreshing(false);
  }, [fetchMissions]);

  const orderedMissions: MissionItem[] = useMemo(() => {
    const map = new Map<string, Mission>();
    missions.forEach((m) => {
      map.set(m.missionKey, m);
    });

    return MISSION_ORDER.map((key) => {
      const existing = map.get(key);
      const conf = MISSION_CONFIG[key];
      return {
        id: existing?.id || key,
        missionKey: key,
        title: existing?.title || t(conf.titleKey as any),
        description: existing?.description || t(conf.descKey as any),
        progress: existing ? existing.progress : 0,
        goal: existing?.goal && existing.goal > 0 ? existing.goal : conf.defaultGoal,
        status: existing?.status || 'active',
        config: conf,
      };
    });
  }, [missions, t]);

  const showInitialSkeleton = status === 'loading' && missions.length === 0;

  return (
    <Screen>
      <View style={styles.root}>
        {errorState === 'remote-failed' ? <OfflineBanner /> : null}
        {errorState === 'no-data' && missions.length === 0 && !showInitialSkeleton ? (
          <StateError onRetry={() => fetchMissions()} message={tc('cannotLoadData')} />
        ) : null}

        {/* Top Header Background Illustration */}
        <Image
          source={require('../../../assets/images/missions/header_cross_heart.png')}
          style={[styles.headerArt, { top: insets.top - 6 }]}
          resizeMode="contain"
        />

        <RippleRefreshScrollView
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 90,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Title Section */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.headerSection}>
            <View style={styles.headerTopRow}>
              <Pressable
                style={styles.menuButton}
                onPress={() => router.push('/profile' as any)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={tc('menu')}
              >
                <Ionicons name="menu" size={28} color="#0f3e36" />
              </Pressable>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>{t('missionList')}</Text>
                <Text style={styles.headerSubtitle}>{t('missionListSubtitle')}</Text>
              </View>
            </View>
          </Animated.View>

          {showInitialSkeleton ? (
            <MissionsTabSkeleton />
          ) : (
            <>
              {status === 'success' && missions.length === 0 ? <StateEmpty /> : null}

              {/* Cards List */}
              {orderedMissions.map((item, index) => {
                const progressRatio = item.goal > 0 ? item.progress / item.goal : 0;
                const isCompleted = item.status === 'completed' || item.progress >= item.goal;
                const isInProgress = item.progress > 0 && !isCompleted;

                return (
                  <Animated.View
                    key={item.missionKey}
                    entering={FadeInDown.delay(100 + index * 60).duration(400)}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.card,
                        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                      ]}
                      onPress={() => {
                        const route = MISSION_ROUTES[item.missionKey];
                        if (route) {
                          router.push(route as any);
                        }
                      }}
                    >
                      {/* Background Artwork */}
                      <Image
                        source={item.config.art}
                        style={styles.cardBgArt}
                        resizeMode="contain"
                      />

                      {/* Top-Right Info Button */}
                      <Pressable
                        style={styles.infoBtn}
                        hitSlop={12}
                        onPress={(e) => {
                          e.stopPropagation();
                          setTooltipMission(item);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={tc('info')}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={22}
                          color="#64748b"
                        />
                      </Pressable>

                      {/* Card Content */}
                      <View style={styles.cardContent}>
                        {/* Title Row */}
                        <View style={styles.cardHeaderRow}>
                          <View
                            style={[
                              styles.badgeCircle,
                              { backgroundColor: item.config.badgeBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeNumber,
                                { color: item.config.badgeColor },
                              ]}
                            >
                              {item.config.order}
                            </Text>
                          </View>
                          <View style={styles.cardTitleWrap}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSubtitle}>{item.description}</Text>
                          </View>
                        </View>

                        {/* Progress Bar Row */}
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.min(progressRatio * 100, 100)}%`,
                                  backgroundColor: isCompleted
                                    ? '#00897b'
                                    : item.config.badgeColor,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.progressText}>
                            {item.progress}/{item.goal}
                          </Text>
                        </View>

                        {/* Status Badge */}
                        <View style={styles.statusRow}>
                          <View
                            style={[
                              styles.statusPill,
                              isCompleted
                                ? styles.statusPillCompleted
                                : isInProgress
                                ? styles.statusPillActive
                                : styles.statusPillNotStarted,
                            ]}
                          >
                            <Ionicons
                              name={
                                isCompleted
                                  ? 'checkmark-circle'
                                  : isInProgress
                                  ? 'time-outline'
                                  : 'ellipse-outline'
                              }
                              size={13}
                              color={
                                isCompleted
                                  ? '#16a34a'
                                  : isInProgress
                                  ? '#ca8a04'
                                  : '#475569'
                              }
                            />
                            <Text
                              style={[
                                styles.statusText,
                                isCompleted
                                  ? styles.statusTextCompleted
                                  : isInProgress
                                  ? styles.statusTextActive
                                  : styles.statusTextNotStarted,
                              ]}
                            >
                              {isCompleted
                                ? t('statusCompleted')
                                : isInProgress
                                ? t('statusInProgress')
                                : t('statusNotStarted')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          )}
        </RippleRefreshScrollView>

        {/* Floating Action Button (+) */}
        <View style={[styles.fabWrap, { bottom: insets.bottom + 22 }]}>
          <Pressable
            style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/reminder-config')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tc('add')}
          >
            <Ionicons name="add" size={34} color="#ffffff" />
          </Pressable>
          <View style={styles.fabSparkle1} />
          <View style={styles.fabSparkle2} />
          <View style={styles.fabSparkle3} />
        </View>

        {/* Info Modal */}
        <Modal
          visible={!!tooltipMission}
          transparent
          animationType="fade"
          onRequestClose={() => setTooltipMission(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setTooltipMission(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.modalBadge,
                    { backgroundColor: tooltipMission?.config.badgeBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalBadgeText,
                      { color: tooltipMission?.config.badgeColor },
                    ]}
                  >
                    {tooltipMission?.config.order}
                  </Text>
                </View>
                <Text style={styles.modalTitle}>{tooltipMission?.title}</Text>
                <Pressable onPress={() => setTooltipMission(null)} hitSlop={12}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </Pressable>
              </View>
              <Text style={styles.modalDesc}>{tooltipMission?.description}</Text>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
}

function createStyles(_typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#f3fbf8',
      position: 'relative',
    },
    headerArt: {
      position: 'absolute',
      right: 0,
      width: 175,
      height: 115,
      zIndex: 1,
      pointerEvents: 'none',
      opacity: 0.9,
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 14,
    },

    // Header
    headerSection: {
      marginBottom: 6,
      zIndex: 2,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    menuButton: {
      marginTop: 2,
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitleWrap: {
      flex: 1,
      paddingRight: 60,
    },
    headerTitle: {
      fontSize: 25,
      fontWeight: '800',
      color: '#0f3e36',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      color: '#476861',
      lineHeight: 18,
      marginTop: 4,
      fontWeight: '500',
    },

    // Card
    card: {
      backgroundColor: '#ffffff',
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: '#eef5f2',
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.035,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardBgArt: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 170,
      height: '100%',
      pointerEvents: 'none',
    },
    infoBtn: {
      position: 'absolute',
      right: 14,
      top: 14,
      zIndex: 6,
    },
    cardContent: {
      zIndex: 2,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingRight: 80,
    },
    badgeCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeNumber: {
      fontSize: 18,
      fontWeight: '800',
    },
    cardTitleWrap: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: 16.5,
      fontWeight: '700',
      color: '#0f172a',
    },
    cardSubtitle: {
      fontSize: 12.5,
      color: '#64748b',
      lineHeight: 16,
    },

    // Progress Bar
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
      paddingRight: 60,
    },
    progressTrack: {
      flex: 1,
      height: 6.5,
      backgroundColor: '#e2e8f0',
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0f172a',
      minWidth: 28,
      textAlign: 'right',
    },

    // Status Row
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4.5,
      borderRadius: 999,
    },
    statusPillNotStarted: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    statusPillActive: {
      backgroundColor: '#fefce8',
      borderWidth: 1,
      borderColor: '#fef08a',
    },
    statusPillCompleted: {
      backgroundColor: '#f0fdf4',
      borderWidth: 1,
      borderColor: '#bbf7d0',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
    },
    statusTextNotStarted: {
      color: '#475569',
    },
    statusTextActive: {
      color: '#a16207',
      fontWeight: '600',
    },
    statusTextCompleted: {
      color: '#15803d',
      fontWeight: '600',
    },

    // Floating Action Button (+)
    fabWrap: {
      position: 'absolute',
      right: 20,
      zIndex: 20,
    },
    fabBtn: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#00897b',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00897b',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    fabSparkle1: {
      position: 'absolute',
      top: -3,
      right: 0,
      width: 6,
      height: 2,
      backgroundColor: '#00897b',
      transform: [{ rotate: '45deg' }],
      borderRadius: 1,
    },
    fabSparkle2: {
      position: 'absolute',
      top: 6,
      right: -7,
      width: 7,
      height: 2,
      backgroundColor: '#00897b',
      borderRadius: 1,
    },
    fabSparkle3: {
      position: 'absolute',
      top: 15,
      right: -5,
      width: 6,
      height: 2,
      backgroundColor: '#00897b',
      transform: [{ rotate: '-30deg' }],
      borderRadius: 1,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 20,
      gap: 12,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBadgeText: {
      fontSize: 15,
      fontWeight: '800',
    },
    modalTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: '#0f172a',
    },
    modalDesc: {
      fontSize: 14,
      color: '#475569',
      lineHeight: 20,
    },
  });
}
