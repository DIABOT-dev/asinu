import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../ScaledText';
import { colors, radius, spacing } from '../../styles';
import { SkeletonBlock, SkeletonCard, SkeletonSectionTitle } from './Skeleton';

const onPrimary = 'rgba(255,255,255,0.38)';
const onPrimarySoft = 'rgba(255,255,255,0.24)';

function RowCardSkeleton({
  lines = 2,
  right = false,
}: {
  lines?: number;
  right?: boolean;
}) {
  return (
    <SkeletonCard style={styles.rowCard}>
      <SkeletonBlock width={44} height={44} borderRadius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock width="62%" height={14} />
        {lines > 1 ? <SkeletonBlock width="86%" height={10} /> : null}
      </View>
      {right ? <SkeletonBlock width={36} height={28} borderRadius={14} /> : null}
    </SkeletonCard>
  );
}

function MetricPairSkeleton() {
  return (
    <View style={styles.twoColumn}>
      {[0, 1].map((item) => (
        <SkeletonCard key={item} style={styles.metricCard}>
          <SkeletonBlock width={24} height={24} borderRadius={12} />
          <SkeletonBlock width="72%" height={12} />
          <SkeletonBlock width="58%" height={24} />
          <SkeletonBlock width="38%" height={10} />
        </SkeletonCard>
      ))}
    </View>
  );
}

function LoadingStatus() {
  const { t } = useTranslation('common');

  return (
    <View style={styles.loadingStatus}>
      <SkeletonBlock width={10} height={10} borderRadius={5} />
      <Text style={styles.loadingStatusText}>{t('loading')}</Text>
    </View>
  );
}

export function HomeTabSkeleton() {
  return (
    <>
      <LoadingStatus />
      <View style={styles.homeHero}>
        <SkeletonBlock width="34%" height={18} color={onPrimary} />
        <SkeletonBlock width="58%" height={24} color={onPrimary} />
        <SkeletonBlock width="78%" height={16} color={onPrimarySoft} />
      </View>

      <MetricPairSkeleton />

      <SkeletonCard style={styles.tallCard}>
        <View style={styles.centered}>
          <SkeletonBlock width={92} height={92} borderRadius={46} />
          <SkeletonBlock width="42%" height={16} />
          <SkeletonBlock width="70%" height={11} />
        </View>
      </SkeletonCard>

      <SkeletonSectionTitle width="46%" />
      {[0, 1, 2].map((item) => (
        <RowCardSkeleton key={item} right />
      ))}

      <SkeletonSectionTitle width="38%" />
      <View style={styles.treeGrid}>
        <SkeletonCard style={styles.treeMain}>
          <View style={styles.centered}>
            <SkeletonBlock width={104} height={104} borderRadius={52} />
            <SkeletonBlock width="68%" height={12} />
          </View>
        </SkeletonCard>
        <View style={{ flex: 1, gap: spacing.md }}>
          <SkeletonCard style={styles.smallStat}><SkeletonBlock width="76%" height={42} /></SkeletonCard>
          <SkeletonCard style={styles.smallStat}><SkeletonBlock width="64%" height={42} /></SkeletonCard>
        </View>
      </View>

      <SkeletonSectionTitle width="44%" />
      <SkeletonCard style={{ height: 220 }}>
        <SkeletonBlock width="100%" height={160} borderRadius={radius.lg} />
        <SkeletonBlock width="48%" height={12} />
      </SkeletonCard>
    </>
  );
}

export function ProfileTabSkeleton() {
  return (
    <>
      <LoadingStatus />
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHero}
      >
        <View style={styles.profileTop}>
          <SkeletonBlock width={76} height={76} borderRadius={38} color={onPrimary} />
          <View style={{ flex: 1, gap: 9 }}>
            <SkeletonBlock width="42%" height={13} color={onPrimarySoft} />
            <SkeletonBlock width="78%" height={24} color={onPrimary} />
            <SkeletonBlock width="38%" height={12} color={onPrimarySoft} />
          </View>
        </View>
        <SkeletonBlock width="56%" height={30} borderRadius={15} color={onPrimarySoft} />
      </LinearGradient>

      <SkeletonSectionTitle width="44%" />
      {[0, 1, 2, 3].map((item) => (
        <RowCardSkeleton key={item} />
      ))}

      <SkeletonSectionTitle width="36%" />
      {[0, 1, 2].map((group) => (
        <View key={group} style={styles.actionGroup}>
          <SkeletonBlock width="30%" height={12} />
          <View style={styles.actionGrid}>
            {[0, 1].map((item) => (
              <SkeletonCard key={item} style={styles.actionCard}>
                <SkeletonBlock width={22} height={22} borderRadius={11} />
                <SkeletonBlock width="70%" height={12} />
              </SkeletonCard>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

export function MissionsTabSkeleton() {
  return (
    <>
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.missionsHero}
      >
        <SkeletonBlock width={36} height={36} borderRadius={18} color={onPrimary} />
        <SkeletonBlock width="54%" height={26} color={onPrimary} />
        <SkeletonBlock width="70%" height={14} color={onPrimarySoft} />
      </LinearGradient>

      <View style={styles.twoColumn}>
        {[0, 1].map((item) => (
          <SkeletonCard key={item} style={styles.statCard}>
            <SkeletonBlock width={22} height={22} borderRadius={11} />
            <SkeletonBlock width="36%" height={28} />
            <SkeletonBlock width="64%" height={12} />
          </SkeletonCard>
        ))}
      </View>

      <SkeletonCard>
        <SkeletonBlock width="48%" height={16} />
        <SkeletonBlock width="92%" height={12} />
        <SkeletonBlock width="78%" height={12} />
        <SkeletonBlock width="84%" height={12} />
      </SkeletonCard>

      <SkeletonSectionTitle width="46%" />
      {[0, 1, 2, 3].map((item) => (
        <SkeletonCard key={item}>
          <View style={styles.cardHeader}>
            <SkeletonBlock width={32} height={32} borderRadius={10} />
            <SkeletonBlock width="66%" height={18} />
          </View>
          <SkeletonBlock width="88%" height={10} />
          <View style={styles.progressRow}>
            <SkeletonBlock width="78%" height={10} borderRadius={999} />
            <SkeletonBlock width={42} height={14} />
          </View>
          <SkeletonBlock width={96} height={26} borderRadius={13} />
        </SkeletonCard>
      ))}
    </>
  );
}

export function TreeTabSkeleton() {
  return (
    <>
      <LoadingStatus />
      <View style={styles.treeHeader}>
        <View style={{ flex: 1, gap: 9 }}>
          <SkeletonBlock width="58%" height={28} />
          <SkeletonBlock width="82%" height={14} />
        </View>
        <SkeletonBlock width={76} height={76} borderRadius={38} />
      </View>

      <SkeletonCard>
        <SkeletonBlock width="48%" height={16} />
        <SkeletonBlock width="88%" height={12} />
        <SkeletonBlock width="76%" height={12} />
        <SkeletonBlock width="82%" height={12} />
      </SkeletonCard>

      <SkeletonCard style={styles.scoreCard}>
        <SkeletonBlock width={122} height={122} borderRadius={61} />
        <SkeletonBlock width="54%" height={16} />
      </SkeletonCard>

      <View style={styles.twoColumn}>
        {[0, 1].map((item) => (
          <SkeletonCard key={item} style={styles.scoreMini}>
            <SkeletonBlock width={42} height={42} borderRadius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBlock width="56%" height={22} />
              <SkeletonBlock width="88%" height={11} />
            </View>
          </SkeletonCard>
        ))}
      </View>

      <SkeletonSectionTitle width="46%" />
      <View style={styles.metricGrid}>
        {[0, 1, 2, 3].map((item) => (
          <SkeletonCard key={item} style={styles.metricTile}>
            <SkeletonBlock width="60%" height={14} />
            <SkeletonBlock width="44%" height={26} />
            <SkeletonBlock width="76%" height={11} />
          </SkeletonCard>
        ))}
      </View>
    </>
  );
}

export function CareCircleTabSkeleton() {
  return (
    <>
      <LoadingStatus />
      <SkeletonCard style={styles.careHero}>
        <View style={styles.centered}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <SkeletonBlock width="48%" height={24} />
          <SkeletonBlock width="74%" height={14} />
        </View>
      </SkeletonCard>

      <View style={styles.careSection}>
        {[0, 1, 2].map((item) => (
          <RowCardSkeleton key={item} lines={1} right />
        ))}
      </View>

      <View style={styles.careSection}>
        <SkeletonBlock width="100%" height={54} borderRadius={radius.lg} color={colors.primaryLight} />
      </View>

      <View style={styles.careSection}>
        <SkeletonSectionTitle width="50%" />
        {[0, 1, 2].map((item) => (
          <RowCardSkeleton key={item} right />
        ))}
      </View>
    </>
  );
}

export function ReminderConfigSkeleton() {
  return (
    <>
      <SkeletonCard style={styles.reminderHero}>
        <SkeletonBlock width={28} height={28} borderRadius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width="62%" height={20} />
          <SkeletonBlock width="92%" height={12} />
        </View>
      </SkeletonCard>

      <RowCardSkeleton lines={2} right />

      {[0, 1, 2].map((item) => (
        <SkeletonCard key={item}>
          <View style={styles.cardHeader}>
            <SkeletonBlock width={24} height={24} borderRadius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBlock width="42%" height={16} />
              <SkeletonBlock width="72%" height={10} />
            </View>
          </View>
          <View style={styles.progressRow}>
            <SkeletonBlock width={92} height={28} borderRadius={14} />
            <SkeletonBlock width={78} height={22} borderRadius={11} />
            <SkeletonBlock width={32} height={32} borderRadius={12} style={{ marginLeft: 'auto' }} />
          </View>
        </SkeletonCard>
      ))}

      <SkeletonCard style={styles.infoSkeleton}>
        <SkeletonBlock width={18} height={18} borderRadius={9} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width="86%" height={11} />
          <SkeletonBlock width="64%" height={11} />
        </View>
      </SkeletonCard>
    </>
  );
}

const styles = StyleSheet.create({
  loadingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  loadingStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  homeHero: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  profileHero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  missionsHero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  treeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    minHeight: 128,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    minHeight: 112,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tallCard: {
    minHeight: 172,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  treeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  treeMain: {
    flex: 1.2,
    minHeight: 178,
  },
  smallStat: {
    minHeight: 80,
  },
  actionGroup: {
    gap: spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionCard: {
    flex: 1,
    minHeight: 84,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreCard: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMini: {
    flex: 1,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricTile: {
    width: '47%',
    minHeight: 128,
  },
  careHero: {
    marginHorizontal: spacing.lg,
    minHeight: 146,
  },
  careSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  reminderHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
  },
  infoSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
  },
});
