import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useThemeColors } from '../hooks/useThemeColors';
import { radius, spacing } from '../styles';

export type LogHeroCategory =
  | 'bloodPressure'
  | 'glucose'
  | 'weight'
  | 'water'
  | 'insulin'
  | 'meal'
  | 'medication';

type LogHeroBannerProps = {
  category: LogHeroCategory;
  title: string;
  description: string;
  eyebrow?: string;
  unit?: string;
  style?: StyleProp<ViewStyle>;
};

const THEME_CONFIG: Record<
  LogHeroCategory,
  {
    eyebrowLight: string;
    eyebrowDark: string;
    badgeBgLight: string;
    badgeTextLight: string;
  }
> = {
  bloodPressure: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(244, 63, 94, 0.12)',
    badgeTextLight: '#e11d48',
  },
  glucose: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(14, 165, 233, 0.14)',
    badgeTextLight: '#0284c7',
  },
  weight: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(168, 85, 247, 0.14)',
    badgeTextLight: '#9333ea',
  },
  water: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(20, 184, 166, 0.14)',
    badgeTextLight: '#0d9488',
  },
  insulin: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(99, 102, 241, 0.14)',
    badgeTextLight: '#4f46e5',
  },
  meal: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(245, 158, 11, 0.16)',
    badgeTextLight: '#d97706',
  },
  medication: {
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(16, 185, 129, 0.14)',
    badgeTextLight: '#059669',
  },
};

export function LogHeroBanner({
  category,
  title,
  description,
  eyebrow,
  unit,
  style,
}: LogHeroBannerProps) {
  const { t } = useTranslation('logs');
  const { colors, isDark } = useThemeColors();
  const theme = THEME_CONFIG[category];
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.header, style]}>
      <View style={styles.textColumn}>
        <Text style={[styles.eyebrow, { color: isDark ? theme.eyebrowDark : theme.eyebrowLight }]}>
          {eyebrow ?? t('healthTracking')}
        </Text>
        <Text style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>
          {description}
        </Text>
        {unit ? (
          <View
            style={[
              styles.unitBadge,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : theme.badgeBgLight },
            ]}
          >
            <Text
              style={[
                styles.unitText,
                { color: isDark ? '#f1f5f9' : theme.badgeTextLight },
              ]}
            >
              {unit}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>['colors']) =>
  StyleSheet.create({
    header: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.sm,
    },
    textColumn: {
      gap: spacing.xs,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    description: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    unitBadge: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    unitText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
