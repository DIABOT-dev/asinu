import React, { useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import type { HealthScoreData } from '../features/checkin/checkin.api';
import { iconColors, radius, spacing } from '../styles';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { HEALTH_SCORE_FACTORS } from '../features/checkin/health-score-factors';
import { useGuardedRouter } from '../hooks/useGuardedRouter';

type HealthTreeStatusCardProps = {
  score: HealthScoreData | null;
  compact?: boolean;
  showDetails?: boolean;
};

type StatusMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  chipBg: string;
  titleKey: string;
  subtitleKey: string;
};

const STATUS_META: Record<HealthScoreData['level'], StatusMeta> = {
  ok: {
    icon: 'shield-checkmark',
    color: '#059669',
    background: '#f0fdf4',
    chipBg: '#dcfce7',
    titleKey: 'healthScoreOk',
    subtitleKey: 'healthScoreOkSub',
  },
  monitor: {
    icon: 'eye',
    color: '#d97706',
    background: '#fffbeb',
    chipBg: '#fef3c7',
    titleKey: 'healthScoreMonitor',
    subtitleKey: 'healthScoreMonitorSub',
  },
  danger: {
    icon: 'alert-circle',
    color: '#dc2626',
    background: '#fef2f2',
    chipBg: '#fee2e2',
    titleKey: 'healthScoreDanger',
    subtitleKey: 'healthScoreDangerSub',
  },
};

export function HealthTreeStatusCard({ score, compact = false, showDetails = true }: HealthTreeStatusCardProps) {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const { colors, isDark } = useThemeColors();
  const router = useGuardedRouter();
  const factorCount = score?.factors.length ?? 0;
  const hasFactors = factorCount > 0;
  const meta = score && (score.checkinDone || hasFactors) ? STATUS_META[score.level] : null;
  const title = meta ? t(meta.titleKey) : score ? t('healthScoreNoCheckin') : t('healthScoreUnavailable');
  const subtitle = hasFactors
    ? [...new Set(score?.factors.map(factor => t(HEALTH_SCORE_FACTORS[factor]?.labelKey || 'healthFactorUnknown')))].join('\n')
    : meta ? t(meta.subtitleKey) : score ? t('healthScoreNoCheckinSub') : t('healthScoreUnavailableSub');
  const icon = meta?.icon || (score ? 'clipboard-outline' : 'help-circle-outline');
  const color = meta
    ? isDark ? (score?.level === 'danger' ? colors.danger : score?.level === 'monitor' ? colors.warning : colors.emerald) : meta.color
    : colors.textSecondary;
  const background = isDark ? colors.surface : meta?.background || '#f0fdf4';
  const chipBg = isDark ? `${color}18` : meta?.chipBg || `${color}14`;
  const canOpenDetails = showDetails && hasFactors;
  const detailsLabel = t('healthTreeShowSignals');
  const interactionProps = {
    disabled: !canOpenDetails,
    onPress: canOpenDetails ? () => router.push('/health-status') : undefined,
    accessibilityRole: canOpenDetails ? 'button' as const : undefined,
    accessibilityHint: canOpenDetails ? detailsLabel : undefined,
  };

  const styles = useMemo(() => createStyles(typography), [typography]);
  const detailsArrow = canOpenDetails ? <Ionicons name="chevron-forward" size={22} color={color} /> : null;

  if (compact) {
    return (
      <Pressable {...interactionProps} style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}>
        <View style={styles.headerRow}>
          <View style={styles.compactIconWrap}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.size.md }]}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { fontSize: typography.size.sm, color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
          {detailsArrow}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: `${color}12` }]}>
            <Ionicons name={score ? (score.checkinDone ? 'checkmark-circle' : 'time-outline') : 'help-circle-outline'} size={14} color={color} />
            <Text style={[styles.metaText, { color }]}>
              {score ? (score.checkinDone ? t('healthTreeCheckinDone') : t('healthTreeCheckinNeeded')) : t('healthScoreUnavailable')}
            </Text>
          </View>
          {hasFactors ? (
            <Text style={[styles.factorText, { color: iconColors.warning }]}>
              {t('healthTreeSignalsCount', { count: factorCount })}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...interactionProps} style={({ pressed }) => [styles.card, { backgroundColor: background, borderColor: `${color}30` }, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="tree-outline" size={28} color={color} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.size.md }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { fontSize: typography.size.sm, color: colors.textSecondary }]}>
            {subtitle}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.pillBadge, { backgroundColor: chipBg }]}>
              <Ionicons
                name={score ? (score.checkinDone ? 'checkmark-circle' : 'time-outline') : 'help-circle-outline'}
                size={14}
                color={color}
              />
              <Text style={[styles.pillText, { color }]}>
                {score ? (score.checkinDone ? t('healthTreeCheckinDone') : t('healthTreeCheckinNeeded')) : t('healthScoreUnavailable')}
              </Text>
            </View>

            {hasFactors ? (
              <View style={[styles.pillBadge, { backgroundColor: isDark ? colors.premiumLight : '#fef3c7' }]}>
                <Ionicons name="alert-circle" size={14} color={iconColors.warning} />
                <Text style={[styles.pillText, { color: iconColors.warning }]}>
                  {t('healthTreeSignalsCount', { count: factorCount })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {detailsArrow}
      </View>
    </Pressable>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    compactCard: {
      borderWidth: 0,
      padding: 0,
      gap: spacing.sm,
    },
    pressed: {
      opacity: 0.75,
    },
    headerRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontWeight: '800',
    },
    subtitle: {
      lineHeight: Math.round(typography.size.sm * 1.5),
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 6,
      flexWrap: 'wrap',
    },
    pillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    pillText: {
      fontSize: 12,
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    metaText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    factorText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
  });
}
