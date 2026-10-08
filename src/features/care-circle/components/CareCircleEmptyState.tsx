import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { spacing } from '../../../styles';

const EMPTY_STATE_ART = require('../../../../assets/images/care-circle/empty_state_art.png');

type Props = {
  onInvite: () => void;
};

export function CareCircleEmptyState({ onInvite }: Props) {
  const { t } = useTranslation('careCircle');
  const { isDark } = useThemeColors();

  // Floating & breathing motion for empty state illustration
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Signal ripple wave
  const rippleScale = useRef(new Animated.Value(0.85)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  // Sparkles
  const sparkleAnim = useRef(new Animated.Value(0.25)).current;

  // Button pulse and press spring
  const btnPulse = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Floating loop
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -4.5,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.025,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Ripple wave loop
    const rippleLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 1.45,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(rippleOpacity, {
            toValue: 0.5,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Sparkle twinkling
    const sparkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0.2,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Button subtle breathing pulse
    const btnLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(btnPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    rippleLoop.start();
    sparkleLoop.start();
    btnLoop.start();

    return () => {
      floatLoop.stop();
      rippleLoop.stop();
      sparkleLoop.stop();
      btnLoop.stop();
    };
  }, [floatAnim, scaleAnim, rippleScale, rippleOpacity, sparkleAnim, btnPulse]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
    }).start();
  };

  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: isDark ? '#1a1d27' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F4',
        },
      ]}
    >
      {/* Animated Illustration Container */}
      <View style={styles.imageContainer}>
        {/* Signal Ripple Wave */}
        <Animated.View
          style={[
            styles.rippleRing,
            {
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
        />

        {/* Floating Sparkle */}
        <Animated.View
          style={[
            styles.sparkle,
            {
              opacity: sparkleAnim,
              transform: [{ scale: sparkleAnim }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={14} color="#0D9488" />
        </Animated.View>

        {/* Floating Empty State Art */}
        <Animated.View
          style={{
            transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
          }}
        >
          <Image
            source={EMPTY_STATE_ART}
            style={styles.emptyStateImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Text
        style={[
          styles.emptyTitle,
          { color: isDark ? '#F8FAFC' : '#1E293B' },
        ]}
      >
        {t('noConnections')}
      </Text>
      <Text
        style={[
          styles.emptySubtitle,
          { color: isDark ? '#94A3B8' : '#64748B' },
        ]}
      >
        {t('noConnectionsHint')}
      </Text>

      {/* Animated Add Member Button */}
      <Animated.View
        style={{
          transform: [{ scale: btnPulse }, { scale: pressScale }],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('inviteMemberNew')}
          onPress={onInvite}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.emptyInviteButton,
            {
              backgroundColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#E8F7F4',
              borderColor: isDark ? '#14B8A6' : '#C1ECE4',
            },
          ]}
        >
          <Ionicons
            name="add"
            size={18}
            color={isDark ? '#2DD4BF' : '#0D9488'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.emptyInviteButtonText,
              { color: isDark ? '#2DD4BF' : '#0D9488' },
            ]}
          >
            {t('inviteMemberNew')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 1,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  imageContainer: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    position: 'relative',
    width: 140,
  },
  rippleRing: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 45,
    borderWidth: 1.5,
    height: 90,
    position: 'absolute',
    width: 90,
  },
  sparkle: {
    position: 'absolute',
    right: 14,
    top: 8,
    zIndex: 3,
  },
  emptyStateImage: {
    height: 110,
    width: 130,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyInviteButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  emptyInviteButtonText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
