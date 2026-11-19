import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';

const mascot = require('../../../assets/asinu_assistant_listening_v1.png');

function ThinkingDot({ animate, delay }: { animate: boolean; delay: number }) {
  const { colors } = useThemeColors();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    cancelAnimation(opacity);
    opacity.value = 0.4;
    if (animate) {
      const timing = { duration: 320, easing: Easing.inOut(Easing.quad) };
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, timing),
            withTiming(0.4, timing),
            withTiming(0.4, { duration: 400 })
          ),
          -1,
          false
        )
      );
    }
    return () => cancelAnimation(opacity);
  }, [animate, delay, opacity]);
  const motion = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: colors.primaryText }, motion]}
    />
  );
}

export function AssistantThinkingIndicator({ label }: { label: string }) {
  const { colors, isDark } = useThemeColors();
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    let mounted = true;
    let foreground = AppState.currentState === 'active';
    let reducedMotion = true;
    let motionChanged = false;
    const update = () => {
      if (mounted) setAnimate(foreground && !reducedMotion);
    };
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        motionChanged = true;
        reducedMotion = value;
        update();
      }
    );
    const state = AppState.addEventListener('change', (value) => {
      foreground = value === 'active';
      update();
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!mounted || motionChanged) return;
        reducedMotion = value;
        update();
      })
      .catch(() => {});
    return () => {
      mounted = false;
      motion.remove();
      state.remove();
    };
  }, []);
  return (
    <View
      testID="assistant-thinking"
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
        <Image
          source={mascot}
          style={styles.avatarImage}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      <View
        style={[
          styles.bubble,
          { backgroundColor: isDark ? '#1A302E' : '#FDFFFE' },
        ]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <View
          style={styles.dots}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {[0, 160, 320].map((delay) => (
            <ThinkingDot key={delay} animate={animate} delay={delay} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 38, height: 38 },
  bubble: {
    flexShrink: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderTopLeftRadius: 6,
  },
  label: { fontSize: 14, lineHeight: 21 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
