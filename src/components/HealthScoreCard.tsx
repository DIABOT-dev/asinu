import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
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

const FACTOR_LABELS: Record<string, { vi: string; en: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  status_tired:          { vi: 'Bạn báo hơi mệt hôm nay', en: 'You reported feeling tired', icon: 'bed-outline', color: '#d97706' },
  triage_severity_medium:{ vi: 'Mức độ sức khoẻ cần theo dõi', en: 'Health severity needs monitoring', icon: 'eye-outline', color: '#d97706' },
  triage_severity_high:  { vi: 'Mức độ sức khoẻ nghiêm trọng', en: 'Serious health severity', icon: 'alert-circle-outline', color: '#dc2626' },
  glucose_high:          { vi: 'Đường huyết cao hơn bình thường', en: 'Blood glucose above normal', icon: 'water-outline', color: '#d97706' },
  glucose_very_high:     { vi: 'Đường huyết rất cao — cần chú ý', en: 'Very high blood glucose — attention needed', icon: 'water', color: '#dc2626' },
  glucose_very_low:      { vi: 'Đường huyết thấp — nguy cơ hạ đường huyết', en: 'Low blood glucose — hypoglycemia risk', icon: 'water', color: '#dc2626' },
  systolic_high:         { vi: 'Huyết áp cao hơn bình thường', en: 'Blood pressure above normal', icon: 'heart-outline', color: '#d97706' },
  systolic_very_high:    { vi: 'Huyết áp rất cao — cần chú ý', en: 'Very high blood pressure — attention needed', icon: 'heart', color: '#dc2626' },
  emergency_triggered:   { vi: 'Đã kích hoạt cảnh báo khẩn cấp', en: 'Emergency alert triggered', icon: 'warning-outline', color: '#dc2626' },
};

export const HealthScoreCard = React.memo(function HealthScoreCard({ level, factors, checkinDone }: HealthScoreCardProps) {
  const { t, i18n } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const config = LEVEL_CONFIG[level];
  const { isDark } = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const isVi = i18n.language === 'vi';

  const styles = useMemo(() => StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1.5,
      padding: spacing.md,
      gap: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
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
    factorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.04)',
      borderRadius: radius.md,
    },
    factorText: {
      flex: 1,
      color: colors.textPrimary,
    },
    expandHint: {
      color: config.iconColor,
      fontWeight: '600',
      marginTop: 4,
    },
  }), [isDark, config.iconColor]);

  const hasFactors = factors.length > 0 && checkinDone;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: config.bg, borderColor: config.border }]}
      onPress={hasFactors ? () => setExpanded(v => !v) : undefined}
    >
      <View style={styles.headerRow}>
        <Ionicons name={config.icon} size={28} color={config.iconColor} />
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
        {hasFactors && (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={config.iconColor} />
        )}
      </View>

      {expanded && hasFactors && (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {factors.map((factor, i) => {
            const meta = FACTOR_LABELS[factor];
            return (
              <View key={i} style={styles.factorRow}>
                <Ionicons
                  name={meta?.icon || 'information-circle-outline'}
                  size={16}
                  color={meta?.color || colors.textSecondary}
                />
                <Text style={[styles.factorText, { fontSize: scaledTypography.size.xs }]}>
                  {meta ? (isVi ? meta.vi : meta.en) : factor}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
});
