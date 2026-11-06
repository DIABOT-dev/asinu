import React, { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ScaledText as Text } from '../../components/ScaledText';
import { MascotSpeechBubble } from '../../components/MascotSpeechBubble';
import { useThemeColors } from '../../hooks/useThemeColors';

export function ProfileMascotGreeting() {
  const { t } = useTranslation('profile');
  const { colors, isDark } = useThemeColors();
  const reducedMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      lift.value = 0;
      if (!reducedMotion) {
        const timing = { duration: 2400, easing: Easing.inOut(Easing.quad) };
        lift.value = withRepeat(
          withSequence(withTiming(-6, timing), withTiming(0, timing)),
          -1,
          false
        );
      }
      return () => cancelAnimation(lift);
    }, [lift, reducedMotion])
  );
  const animation = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  return (
    <View style={styles.brand} pointerEvents="none">
      <View
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 360 250"
          preserveAspectRatio="none"
          accessible={false}
        >
          <Defs>
            <LinearGradient
              id="profileGreetingWash"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop
                offset="0"
                stopColor={isDark ? '#153e3b' : '#edf8f3'}
                stopOpacity={0}
              />
              <Stop
                offset="0.55"
                stopColor={isDark ? '#153e3b' : '#edf8f3'}
                stopOpacity={0.8}
              />
              <Stop
                offset="1"
                stopColor={isDark ? '#153e3b' : '#edf8f3'}
                stopOpacity={0}
              />
            </LinearGradient>
            <LinearGradient
              id="profileGreetingWave"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop
                offset="0"
                stopColor={isDark ? '#235a53' : '#ccece2'}
                stopOpacity={0.6}
              />
              <Stop
                offset="1"
                stopColor={isDark ? '#153e3b' : '#e5f5ee'}
                stopOpacity={0}
              />
            </LinearGradient>
          </Defs>
          <Path
            d="M12 148 C20 80 76 38 147 37 C231 20 328 54 348 132 C360 184 299 230 217 235 C122 242 32 213 12 148 Z"
            fill="url(#profileGreetingWash)"
          />
          <Path
            d="M4 151 C62 114 109 161 171 143 C237 124 285 98 356 129 C344 181 298 219 221 231 C133 242 53 209 4 151 Z"
            fill="url(#profileGreetingWave)"
          />
          <Path
            d="M10 174 C75 142 118 190 186 166 C249 144 302 143 350 168 C300 218 211 238 134 222 C78 210 38 192 10 174 Z"
            fill="url(#profileGreetingWave)"
            opacity={0.7}
          />
          <Path
            d="M30 155 C83 132 116 172 176 153 C235 134 282 115 329 134"
            fill="none"
            stroke={isDark ? '#3c786c' : '#b5ddd0'}
            strokeOpacity={0.55}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <MascotSpeechBubble text={t('mascotGreeting')} />
      <Animated.View
        style={[styles.foreground, animation]}
        accessible={false}
        accessibilityElementsHidden
      >
        <Image
          source={require('../../../assets/images/profile/asinu-profile-mascot-v1.webp')}
          style={styles.mascot}
          resizeMode="contain"
        />
      </Animated.View>
      <Text
        style={[
          styles.foreground,
          styles.wordmark,
          { color: colors.primaryText },
        ]}
      >
        {t('brandName')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignSelf: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 8,
    paddingTop: 18,
    paddingBottom: 20,
  },
  backdrop: { zIndex: 0 },
  foreground: { zIndex: 1 },
  mascot: { width: 96, height: 96 },
  wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
});
