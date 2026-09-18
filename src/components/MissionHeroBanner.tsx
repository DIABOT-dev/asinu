import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useThemeColors } from '../hooks/useThemeColors';

type MissionHeroBannerProps = {
  style?: StyleProp<ViewStyle>;
};

const BANNER_IMAGE = require('../../assets/images/missions/banner_mission.png');

export function MissionHeroBanner({ style }: MissionHeroBannerProps) {
  const { t } = useTranslation('missions');
  const { colors, isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={[styles.cardContainer, style]}>
      {/* 1. Full-bleed 3D illustrated background image */}
      <Image
        source={BANNER_IMAGE}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />

      {/* 2. Dark mode subtle gradient overlay */}
      {isDark && (
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.88)', 'rgba(15, 23, 42, 0.42)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* 3. Text content column on the left */}
      <View style={styles.contentColumn}>
        <View style={styles.topSection}>
          <View style={styles.flagBadge}>
            <Ionicons name="flag" size={17} color={isDark ? '#34d399' : '#059669'} />
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {t('dailyMissions')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('refreshDaily')}
          </Text>
        </View>

        <View style={styles.quoteBox}>
          <Text style={styles.quoteText} numberOfLines={2}>
            {t('missionHabitQuote')}
          </Text>
          <View style={styles.quoteUnderline} />
        </View>
      </View>

      {/* 4. Cute sticker text near the sun on the right */}
      <View style={styles.sunBadge} pointerEvents="none">
        <Text style={styles.sunBadgeText}>
          {t('betterEveryDay')}
        </Text>
        <Text style={styles.sunHeart}>♥</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    cardContainer: {
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? '#1e3e60' : '#bbf7d0',
      minHeight: 195,
      position: 'relative',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    contentColumn: {
      maxWidth: '57%',
      paddingLeft: 20,
      paddingRight: 6,
      paddingVertical: 18,
      justifyContent: 'space-between',
      minHeight: 195,
      zIndex: 2,
    },
    topSection: {
      alignItems: 'flex-start',
    },
    flagBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: isDark ? '#f8fafc' : '#064e3b',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? '#94a3b8' : '#047857',
    },
    quoteBox: {
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    quoteText: {
      fontSize: 12.5,
      lineHeight: 17,
      fontStyle: 'italic',
      fontWeight: '600',
      color: isDark ? '#cbd5e1' : '#065f46',
    },
    quoteUnderline: {
      height: 2.5,
      width: 54,
      borderRadius: 2,
      backgroundColor: isDark ? '#34d399' : '#059669',
      marginTop: 4,
      opacity: 0.85,
    },
    sunBadge: {
      position: 'absolute',
      top: 66,
      right: 18,
      alignItems: 'center',
      zIndex: 2,
    },
    sunBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#86efac' : '#065f46',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    sunHeart: {
      fontSize: 12,
      color: isDark ? '#f87171' : '#059669',
      marginTop: 1,
    },
  });
