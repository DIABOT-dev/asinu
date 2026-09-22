import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import type { HealthScoreData } from '../features/checkin/checkin.api';
import { colors, iconColors, radius, spacing } from '../styles';
import { useScaledTypography } from '../hooks/useScaledTypography';

type HealthTreeStatusCardProps = {
  score: HealthScoreData | null;
  compact?: boolean;
};

type StatusMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  titleKey: string;
  subtitleKey: string;
};

const STATUS_META: Record<HealthScoreData['level'], StatusMeta> = {
  ok: {
    icon: 'shield-checkmark-outline',
    color: '#16a34a',
    background: '#f0fdf4',
    titleKey: 'healthScoreOk',
    subtitleKey: 'healthScoreOkSub',
  },
  monitor: {
    icon: 'eye-outline',
    color: '#d97706',
    background: '#fffbeb',
    titleKey: 'healthScoreMonitor',
    subtitleKey: 'healthScoreMonitorSub',
  },
  danger: {
    icon: 'alert-circle-outline',
    color: '#dc2626',
    background: '#fef2f2',
    titleKey: 'healthScoreDanger',
    subtitleKey: 'healthScoreDangerSub',
  },
};

export function HealthTreeStatusCard({ score, compact = false }: HealthTreeStatusCardProps) {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const meta = score?.checkinDone ? STATUS_META[score.level] : null;
  const title = meta ? t(meta.titleKey) : score ? t('healthScoreNoCheckin') : t('healthScoreUnavailable');
  const subtitle = meta ? t(meta.subtitleKey) : score ? t('healthScoreNoCheckinSub') : t('healthScoreUnavailableSub');
  const icon = meta?.icon || (score ? 'clipboard-outline' : 'help-circle-outline');
  const color = meta?.color || colors.textSecondary;
  const background = meta?.background || colors.surfaceMuted;
  const factorCount = score?.factors.length ?? 0;

  const styles = useMemo(() => createStyles(typography), [typography]);

  return (
    <View style={[styles.card, compact && styles.compactCard, { backgroundColor: compact ? 'transparent' : background }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={compact ? 24 : 28} color={color} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.textPrimary, fontSize: compact ? typography.size.md : typography.size.lg }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { fontSize: typography.size.sm }]}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaChip, { backgroundColor: `${color}12` }]}>
          <Ionicons name={score ? (score.checkinDone ? 'checkmark-circle-outline' : 'time-outline') : 'help-circle-outline'} size={15} color={color} />
          <Text style={[styles.metaText, { color }]}>
            {score ? (score.checkinDone ? t('healthTreeCheckinDone') : t('healthTreeCheckinNeeded')) : t('healthScoreUnavailable')}
          </Text>
        </View>
        {score?.checkinDone && factorCount > 0 ? (
          <Text style={[styles.factorText, { color: iconColors.warning }]}>
            {t('healthTreeSignalsCount', { count: factorCount })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    compactCard: {
      borderWidth: 0,
      padding: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
      color: colors.textSecondary,
      lineHeight: 19,
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
      paddingVertical: 5,
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
