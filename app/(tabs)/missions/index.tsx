import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { StateError } from '../../../src/components/state/StateError';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { useMissionActions } from '../../../src/features/missions/useMissionActions';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../../src/styles';

export default function MissionsScreen() {
  const { missions, status, isStale, errorState, fetchMissions } = useMissionActions();
  const { t } = useTranslation('missions');
  const { t: tc } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const padTop = insets.top + spacing.lg;

  useEffect(() => {
    // ensure data ready
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchMissions(controller.signal);
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty deps - fetchMissions is stable in Zustand
  );

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    fetchMissions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - fetchMissions is stable in Zustand

  return (
    <Screen>
      {isStale || errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' && missions.length === 0 ? <StateLoading /> : null}
      {errorState === 'no-data' && missions.length === 0 ? (
        <StateError onRetry={() => fetchMissions()} message={tc('cannotLoadData')} />
      ) : null}
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
        {status === 'success' && missions.length === 0 ? <StateEmpty /> : null}
        
        {/* Header Section */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="flag-checkered" size={32} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t('dailyMissions')}</Text>
          <Text style={styles.headerSubtitle}>{t('refreshDaily')}</Text>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardActive]}>
            <Ionicons name="time-outline" size={20} color={colors.premium} />
            <Text style={styles.statValue}>{missions.filter(m => m.status !== 'completed').length}</Text>
            <Text style={styles.statLabel}>{t('inProgress')}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardCompleted]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />
            <Text style={styles.statValue}>{missions.filter(m => m.status === 'completed').length}</Text>
            <Text style={styles.statLabel}>{t('completed')}</Text>
          </View>
        </View>
        
        {/* Thông tin hướng dẫn */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <View style={styles.infoIconBg}>
              <Ionicons name="information-circle" size={18} color="#fff" />
            </View>
            <Text style={styles.infoTitle}>{t('howItWorks')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="refresh-circle" size={16} color={colors.primary} />
            <Text style={styles.infoText}>{t('resetDaily')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="leaf" size={16} color={colors.emerald} />
            <Text style={styles.infoText}>{t('pointsToTree')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="book" size={16} color="#8b5cf6" />
            <Text style={styles.infoText}>{t('historyTracked')}</Text>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Ionicons name="list" size={20} color={colors.textPrimary} />
          <Text style={styles.sectionTitle}>{t('missionList')}</Text>
        </View>

        {missions.map((mission, index) => {
          const progressRatio = mission.goal > 0 ? mission.progress / mission.goal : 0;
          const isCompleted = mission.status === 'completed';
          return (
            <View key={mission.id} style={[styles.card, isCompleted && styles.cardCompleted]}>
              <View style={styles.cardHeader}>
                <View style={[styles.missionNumberBadge, isCompleted && styles.missionNumberBadgeCompleted]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Text style={styles.missionNumber}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={[styles.title, isCompleted && styles.titleCompleted]}>{mission.title}</Text>
                  {mission.description ? <Text style={styles.description}>{mission.description}</Text> : null}
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={isCompleted ? [colors.emerald, colors.emeraldDark] : [colors.primary, colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.min(progressRatio * 100, 100)}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {mission.progress}/{mission.goal}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeCompleted : styles.statusBadgeActive]}>
                    <Ionicons 
                      name={isCompleted ? 'checkmark-circle' : 'time'} 
                      size={14} 
                      color={isCompleted ? colors.emerald : colors.premium} 
                    />
                    <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextActive]}>
                      {isCompleted ? t('statusCompleted') : t('statusInProgress')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        {status === 'loading' && missions.length > 0 && (
          <View style={styles.loadingMore}>
            <Text style={styles.loadingText}>{t('loadingData')}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md
  },
  // Header Card
  headerCard: {
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2
  },
  statCardActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  statCardCompleted: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0'
  },
  statValue: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.textPrimary
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  // Info Card
  infoCard: {
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
    backgroundColor: colors.primary,
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
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Mission Card
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  cardCompleted: {
    borderColor: '#a7f3d0',
    backgroundColor: colors.emeraldLight
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  missionNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center'
  },
  missionNumberBadgeCompleted: {
    backgroundColor: colors.emerald
  },
  missionNumber: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.primary
  },
  cardTitleContainer: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary
  },
  titleCompleted: {
    color: colors.emeraldDark
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.sm
  },
  progressContainer: {
    gap: spacing.sm
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999
  },
  progressText: {
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: typography.size.sm,
    minWidth: 40,
    textAlign: 'right'
  },
  statusRow: {
    flexDirection: 'row'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8
  },
  statusBadgeActive: {
    backgroundColor: colors.premiumLight
  },
  statusBadgeCompleted: {
    backgroundColor: colors.emeraldLight
  },
  statusText: {
    fontSize: typography.size.xs,
    fontWeight: '600'
  },
  statusTextActive: {
    color: '#b45309'
  },
  statusTextCompleted: {
    color: '#047857'
  },
  loadingMore: {
    padding: spacing.lg,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  }
});
}
