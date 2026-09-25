import React, { useMemo } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

export function HealthTreeStatusCard({ score, compact = false }: HealthTreeStatusCardProps) {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const meta = score?.checkinDone ? STATUS_META[score.level] : null;
  const title = meta ? t(meta.titleKey) : score ? t('healthScoreNoCheckin') : t('healthScoreUnavailable');
  const subtitle = meta ? t(meta.subtitleKey) : score ? t('healthScoreNoCheckinSub') : t('healthScoreUnavailableSub');
  const icon = meta?.icon || (score ? 'clipboard-outline' : 'help-circle-outline');
  const color = meta?.color || colors.textSecondary;
  const background = meta?.background || '#f0fdf4';
  const chipBg = meta?.chipBg || `${color}14`;
  const factorCount = score?.factors.length ?? 0;

  const styles = useMemo(() => createStyles(typography), [typography]);

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={styles.headerRow}>
          <View style={[styles.compactIconWrap, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.size.md }]}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { fontSize: typography.size.sm }]}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: `${color}12` }]}>
            <Ionicons name={score ? (score.checkinDone ? 'checkmark-circle' : 'time-outline') : 'help-circle-outline'} size={14} color={color} />
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

  return (
    <View style={[styles.card, { backgroundColor: background, borderColor: `${color}30` }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
          <MaterialCommunityIcons name="tree-outline" size={28} color={color} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: '#111827', fontSize: 18 }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { fontSize: 13, color: '#4b5563' }]}>
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

            {score?.checkinDone && factorCount > 0 ? (
              <View style={[styles.pillBadge, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="alert-circle" size={14} color={iconColors.warning} />
                <Text style={[styles.pillText, { color: iconColors.warning }]}>
                  {t('healthTreeSignalsCount', { count: factorCount })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </View>
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
    headerRow: {
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
      lineHeight: 18,
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
