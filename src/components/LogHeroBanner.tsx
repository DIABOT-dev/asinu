import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
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

const HERO_IMAGES: Record<LogHeroCategory, any> = {
  bloodPressure: require('../../assets/images/logs/banner_bp.png'),
  glucose: require('../../assets/images/logs/banner_glucose.png'),
  weight: require('../../assets/images/logs/banner_weight.png'),
  water: require('../../assets/images/logs/banner_water.png'),
  insulin: require('../../assets/images/logs/banner_insulin.png'),
  meal: require('../../assets/images/logs/banner_meal.png'),
  medication: require('../../assets/images/logs/banner_medication.png'),
};

const THEME_CONFIG: Record<
  LogHeroCategory,
  {
    borderLight: string;
    borderDark: string;
    eyebrowLight: string;
    eyebrowDark: string;
    badgeBgLight: string;
    badgeTextLight: string;
  }
> = {
  bloodPressure: {
    borderLight: '#fecdd3',
    borderDark: '#4c222b',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(244, 63, 94, 0.12)',
    badgeTextLight: '#e11d48',
  },
  glucose: {
    borderLight: '#bae6fd',
    borderDark: '#1e3e60',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(14, 165, 233, 0.14)',
    badgeTextLight: '#0284c7',
  },
  weight: {
    borderLight: '#e9d5ff',
    borderDark: '#432d66',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(168, 85, 247, 0.14)',
    badgeTextLight: '#9333ea',
  },
  water: {
    borderLight: '#99f6e4',
    borderDark: '#1f4e4b',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(20, 184, 166, 0.14)',
    badgeTextLight: '#0d9488',
  },
  insulin: {
    borderLight: '#c7d2fe',
    borderDark: '#313a70',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(99, 102, 241, 0.14)',
    badgeTextLight: '#4f46e5',
  },
  meal: {
    borderLight: '#fde68a',
    borderDark: '#543f1f',
    eyebrowLight: '#94a3b8',
    eyebrowDark: '#94a3b8',
    badgeBgLight: 'rgba(245, 158, 11, 0.16)',
    badgeTextLight: '#d97706',
  },
  medication: {
    borderLight: '#bbf7d0',
    borderDark: '#214932',
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
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const borderColor = isDark ? theme.borderDark : theme.borderLight;
  const imageSource = HERO_IMAGES[category];

  return (
    <View style={[styles.cardContainer, { borderColor }, style]}>
      {/* Full-bleed background banner image */}
      <Image
        source={imageSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />

      {/* Dark mode overlay */}
      {isDark && (
        <LinearGradient
          colors={['rgba(20, 24, 33, 0.88)', 'rgba(20, 24, 33, 0.45)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content overlay on the left */}
      <View style={styles.textColumn}>
        <Text style={[styles.eyebrow, { color: isDark ? theme.eyebrowDark : theme.eyebrowLight }]}>
          {eyebrow ?? t('healthTracking')}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
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

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    cardContainer: {
      borderRadius: radius.xxl,
      overflow: 'hidden',
      borderWidth: 1,
      minHeight: 140,
      position: 'relative',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.25 : 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    textColumn: {
      maxWidth: '60%',
      paddingLeft: 20,
      paddingRight: 6,
      paddingVertical: 16,
      justifyContent: 'center',
      zIndex: 2,
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
