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

const INVITE_GIRL_IMG = require('../../../../assets/images/care-circle/invite_girl.png');

type Props = {
  onPress: () => void;
};

export function CareCircleInviteBanner({ onPress }: Props) {
  const { t } = useTranslation('careCircle');
  const { isDark } = useThemeColors();

  // 1. Character floating & breathing animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const charScaleAnim = useRef(new Animated.Value(1)).current;

  // 2. Connecting signal ripple rings
  const ripple1Scale = useRef(new Animated.Value(0.8)).current;
  const ripple1Opacity = useRef(new Animated.Value(0)).current;
  const ripple2Scale = useRef(new Animated.Value(0.8)).current;
  const ripple2Opacity = useRef(new Animated.Value(0)).current;

  // 3. Twinkling sparkles
  const sparkle1Anim = useRef(new Animated.Value(0.3)).current;
  const sparkle2Anim = useRef(new Animated.Value(0.2)).current;

  // 4. Beckoning CTA button arrow & pulse
  const chevronX = useRef(new Animated.Value(0)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Character floating loop (smooth sine wave bobbing + subtle tilt + breathe)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -4.5,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(charScaleAnim, {
            toValue: 1.025,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 1300,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(charScaleAnim, {
            toValue: 1,
            duration: 1300,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Connecting wave ripple 1
    const ripple1Loop = Animated.loop(
      Animated.parallel([
        Animated.timing(ripple1Scale, {
          toValue: 1.55,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ripple1Opacity, {
            toValue: 0.55,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ripple1Opacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Connecting wave ripple 2 (offset)
    const ripple2Delay = setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ripple2Scale, {
            toValue: 1.6,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ripple2Opacity, {
              toValue: 0.45,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ripple2Opacity, {
              toValue: 0,
              duration: 1800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }, 750);

    // Sparkle 1 twinkling
    const sparkle1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle1Anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkle1Anim, {
          toValue: 0.25,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Sparkle 2 twinkling
    const sparkle2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle2Anim, {
          toValue: 0.95,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkle2Anim, {
          toValue: 0.2,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Beckoning button chevron slide + subtle breathing
    const buttonBeckonLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(chevronX, {
            toValue: 3.5,
            duration: 350,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(btnPulse, {
            toValue: 1.035,
            duration: 350,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(chevronX, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(btnPulse, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1600),
      ])
    );

    floatLoop.start();
    ripple1Loop.start();
    sparkle1Loop.start();
    sparkle2Loop.start();
    buttonBeckonLoop.start();

    return () => {
      clearTimeout(ripple2Delay);
      floatLoop.stop();
      ripple1Loop.stop();
      sparkle1Loop.stop();
      sparkle2Loop.stop();
      buttonBeckonLoop.stop();
    };
  }, [
    floatAnim,
    rotateAnim,
    charScaleAnim,
    ripple1Scale,
    ripple1Opacity,
    ripple2Scale,
    ripple2Opacity,
    sparkle1Anim,
    sparkle2Anim,
    chevronX,
    btnPulse,
  ]);

  const spin = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.5deg', '1.5deg'],
  });

  const sparkle1Rotate = sparkle1Anim.interpolate({
    inputRange: [0.25, 1],
    outputRange: ['0deg', '45deg'],
  });

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.965,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('inviteNew')}
        accessibilityHint={t('inviteNewSubtitle')}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.banner,
          {
            backgroundColor: isDark ? 'rgba(13, 90, 80, 0.22)' : '#E8F7F4',
            borderColor: isDark ? 'rgba(20, 184, 166, 0.3)' : '#D4F0EA',
          },
        ]}
      >
        {/* Animated Avatar with floating, connection signal ripple and twinkling sparkles */}
        <View style={styles.avatarContainer}>
          {/* Signal Ripple 1 (Connecting Wave) */}
          <Animated.View
            style={[
              styles.rippleRing,
              {
                transform: [{ scale: ripple1Scale }],
                opacity: ripple1Opacity,
              },
            ]}
          />

          {/* Signal Ripple 2 (Offset Connecting Wave) */}
          <Animated.View
            style={[
              styles.rippleRing,
              {
                transform: [{ scale: ripple2Scale }],
                opacity: ripple2Opacity,
              },
            ]}
          />

          {/* Sparkle 1 */}
          <Animated.View
            style={[
              styles.sparkle1,
              {
                opacity: sparkle1Anim,
                transform: [{ scale: sparkle1Anim }, { rotate: sparkle1Rotate }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={13} color="#0D9488" />
          </Animated.View>

          {/* Sparkle 2 */}
          <Animated.View
            style={[
              styles.sparkle2,
              {
                opacity: sparkle2Anim,
                transform: [{ scale: sparkle2Anim }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={10} color="#F59E0B" />
          </Animated.View>

          {/* Character floating with tilt and subtle breathe */}
          <Animated.View
            style={{
              transform: [
                { translateY: floatAnim },
                { rotate: spin },
                { scale: charScaleAnim },
              ],
            }}
          >
            <Image
              source={INVITE_GIRL_IMG}
              style={styles.girlImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Copy / Text Info */}
        <View style={styles.copyWrap}>
          <Text
            style={[
              styles.title,
              { color: isDark ? '#A7F3D0' : '#0D5A50' },
            ]}
          >
            {t('inviteNew')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? '#94A3B8' : '#6B7280' },
            ]}
            numberOfLines={2}
          >
            {t('inviteNewSubtitle')}
          </Text>
        </View>

        {/* Animated Pill CTA Button */}
        <Animated.View
          style={[
            styles.pillButton,
            { transform: [{ scale: btnPulse }] },
          ]}
        >
          <Text style={styles.pillText}>{t('inviteNow')}</Text>
          <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
            <Ionicons
              name="chevron-forward"
              size={13}
              color="#FFFFFF"
              style={{ marginLeft: 2 }}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  avatarContainer: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    position: 'relative',
    width: 76,
  },
  rippleRing: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    borderRadius: 25,
    borderWidth: 1.5,
    height: 50,
    left: 20,
    position: 'absolute',
    top: 15,
    width: 50,
  },
  sparkle1: {
    position: 'absolute',
    right: 4,
    top: 2,
    zIndex: 3,
  },
  sparkle2: {
    left: 4,
    position: 'absolute',
    top: 8,
    zIndex: 3,
  },
  girlImage: {
    height: 68,
    width: 76,
  },
  copyWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  pillButton: {
    alignItems: 'center',
    backgroundColor: '#0D9488',
    borderRadius: 20,
    elevation: 2,
    flexDirection: 'row',
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
