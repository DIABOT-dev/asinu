import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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
    image: ImageSourcePropType;
    badgeBg: string;
    defaultGoal: number;
    titleKey: string;
    descKey: string;
  }
> = {
  daily_checkin: {
    image: require('../../../assets/images/missions/mission_checkin_art.png'),
    badgeBg: '#dcfce7',
    defaultGoal: 1,
    titleKey: 'dailyCheckIn',
    descKey: 'dailyCheckInDesc',
  },
  log_bp: {
    image: require('../../../assets/images/missions/mission_bp_art.png'),
    badgeBg: '#ffe4e6',
    defaultGoal: 2,
    titleKey: 'measureBP',
    descKey: 'measureBPDesc',
  },
  log_glucose: {
    image: require('../../../assets/images/missions/mission_glucose_art.png'),
    badgeBg: '#ede9fe',
    defaultGoal: 2,
    titleKey: 'measureGlucose',
    descKey: 'measureGlucoseDesc',
  },
  log_water: {
    image: require('../../../assets/images/missions/mission_water_art.png'),
    badgeBg: '#e0f2fe',
    defaultGoal: 4,
    titleKey: 'waterIntake',
    descKey: 'waterIntakeDesc',
  },
  log_weight: {
    image: require('../../../assets/images/missions/mission_weight_art.png'),
    badgeBg: '#fef3c7',
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
        {errorState === 'remote-failed' ? <OfflineBanner onRetry={() => fetchMissions()} /> : null}
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
              <ScreenBackButton
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/home' as any);
                  }
                }}
                style={styles.backButton}
              />
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>{t('missionList')}</Text>
              </View>
            </View>
          </Animated.View>

          {showInitialSkeleton ? (
            <MissionsTabSkeleton />
          ) : (
            <>
              {status === 'success' && missions.length === 0 ? <StateEmpty /> : null}

              {/* Missions sit directly on the screen background. */}
              {orderedMissions.map((item) => {
                const isCompleted = item.status === 'completed' || item.progress >= item.goal;
                const isInProgress = item.progress > 0 && !isCompleted;

                return (
                  <View key={item.missionKey}>
                    <Pressable
                      testID={`mission-${item.missionKey}`}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
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
                      <View style={[styles.missionArtwork, { backgroundColor: item.config.badgeBg }]}>
                        <Image source={item.config.image} style={styles.missionImage} resizeMode="cover"
                          resizeMethod="resize" accessible={false} />
                      </View>
                      <View style={styles.cardContent}>
                        <View style={styles.cardHeaderRow}>
                          <Text allowFontScaling style={styles.cardTitle}>{item.title}</Text>
                          <Pressable style={styles.infoBtn} onPress={(event) => {
                            event.stopPropagation();
                            setTooltipMission(item);
                          }} accessibilityRole="button" accessibilityLabel={tc('info')}>
                            <Ionicons name="information-circle-outline" size={20} color="#64748b" />
                          </Pressable>
                        </View>

                        <MissionProgressBar
                          title={item.title}
                          progress={item.progress}
                          goal={item.goal}
                          completed={isCompleted}
                        />

                        {/* Progress count and status stay visible below the bar. */}
                        <View style={styles.statusRow}>
                          <Text style={styles.progressText}>
                            {item.progress}/{item.goal}
                          </Text>
                          <View
                            style={styles.statusPill}
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
                  </View>
                );
              })}
            </>
          )}
        </RippleRefreshScrollView>

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
                    styles.modalArtwork,
                    { backgroundColor: tooltipMission?.config.badgeBg },
                  ]}
                >
                  {tooltipMission && <Image source={tooltipMission.config.image} style={styles.modalImage}
                    resizeMode="cover" resizeMethod="resize" accessible={false} />}
                </View>
                <Text style={styles.modalTitle}>{tooltipMission?.title}</Text>
                <Pressable onPress={() => setTooltipMission(null)} style={styles.infoBtn}
                  accessibilityRole="button" accessibilityLabel={tc('close')}>
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
      gap: 0,
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
    backButton: {
      marginTop: 2,
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

    // Mission rows
    card: {
      backgroundColor: 'transparent',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#DFEBE6',
    },
    infoBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      flex: 1,
      minWidth: 0,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    missionArtwork: {
      width: 72,
      height: 72,
      borderRadius: 18,
      flexShrink: 0,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    missionImage: { width: 72, height: 72 },
    cardTitle: {
      flex: 1,
      fontSize: 16.5,
      fontWeight: '700',
      color: '#0f172a',
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
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 10,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
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
    modalArtwork: {
      width: 48,
      height: 48,
      borderRadius: 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalImage: { width: 48, height: 48 },
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
