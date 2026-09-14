import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from './Skeleton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { radius, spacing } from '../../styles';

type ChartFrameSkeletonProps = {
  height?: number;
};

/** Reserves the same visual frame as GlucoseTrendChart while its chunk loads. */
export function ChartFrameSkeleton({ height = 280 }: ChartFrameSkeletonProps) {
  const { colors } = useThemeColors();
  const { t } = useTranslation('common');

  return (
    <View
      style={[
        styles.card,
        {
          height,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={t('loading')}
      accessibilityRole="progressbar"
    >
      <View style={styles.rangeRow}>
        <View style={styles.inline}>
          <SkeletonBlock width={9} height={9} borderRadius={5} color={colors.border} />
          <SkeletonBlock width={112} height={13} borderRadius={6} color={colors.border} />
        </View>
        <SkeletonBlock width={64} height={13} borderRadius={6} color={colors.border} />
      </View>

      <View style={styles.chartArea}>
        {[0, 1, 2, 3].map((line) => (
          <View key={line} style={[styles.gridLine, { backgroundColor: colors.border }]} />
        ))}
        <SkeletonBlock
          width="82%"
          height={4}
          borderRadius={2}
          color={colors.border}
          style={styles.curve}
        />
      </View>

      <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.statItem}>
            <SkeletonBlock width={44} height={16} borderRadius={6} color={colors.border} />
            <SkeletonBlock width={64} height={11} borderRadius={5} color={colors.border} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rangeRow: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chartArea: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    justifyContent: 'space-between',
    position: 'relative',
  },
  gridLine: {
    height: 1,
    opacity: 0.6,
  },
  curve: {
    position: 'absolute',
    top: '48%',
    left: '8%',
  },
  statsRow: {
    minHeight: 58,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
});
