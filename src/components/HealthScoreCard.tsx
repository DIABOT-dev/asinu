import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing, radius } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type HealthLevel = 'ok' | 'monitor' | 'danger';

interface HealthScoreCardProps {
  level: HealthLevel;
  factors: string[];
  checkinDone: boolean;
}

const LEVEL_CONFIG: Record<HealthLevel, {
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  titleKey: string;
  subKey: string;
}> = {
  ok: {
    bg: '#f0fdf4',
    border: '#22c55e66',
    icon: 'shield-checkmark-outline',
    iconColor: '#16a34a',
    titleKey: 'healthScoreOk',
    subKey: 'healthScoreOkSub',
  },
  monitor: {
    bg: '#fffbeb',
    border: '#f59e0b66',
    icon: 'eye-outline',
    iconColor: '#d97706',
    titleKey: 'healthScoreMonitor',
    subKey: 'healthScoreMonitorSub',
  },
  danger: {
    bg: '#fef2f2',
    border: '#ef444466',
    icon: 'alert-circle-outline',
    iconColor: '#dc2626',
    titleKey: 'healthScoreDanger',
    subKey: 'healthScoreDangerSub',
  },
};

export const HealthScoreCard = React.memo(function HealthScoreCard({ level, factors, checkinDone }: HealthScoreCardProps) {
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const config = LEVEL_CONFIG[level];
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1.5,
      padding: spacing.md,
      gap: spacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: 2,
    },
  }), [isDark]);

  return (
    <View style={[styles.card, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={styles.iconWrap}>
        <Ionicons name={config.icon} size={28} color={config.iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>
          {!checkinDone ? t('healthScoreNoCheckin' as any) : t(config.titleKey as any)}
        </Text>
        <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>
          {!checkinDone
            ? t('healthScoreOkSub' as any)
            : t(config.subKey as any)
          }
        </Text>
      </View>
    </View>
  );
});
