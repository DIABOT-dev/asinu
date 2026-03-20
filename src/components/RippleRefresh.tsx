/**
 * RippleRefresh — Custom pull-to-refresh overlay with ripple animation
 * Replaces native RefreshControl with an animated ripple effect.
 *
 * Usage:
 *   <RippleRefresh refreshing={loading} onRefresh={handleRefresh}>
 *     <ScrollView>...</ScrollView>
 *   </RippleRefresh>
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors } from '../styles';

interface RippleRefreshProps {
  refreshing: boolean;
  color?: string;
  size?: number;
}

export function RippleRefreshIndicator({
  refreshing,
  color = colors.primary,
  size = 44,
}: RippleRefreshProps) {
  const ring1Scale = useSharedValue(0.3);
  const ring2Scale = useSharedValue(0.3);
  const ring3Scale = useSharedValue(0.3);
  const ring1Op = useSharedValue(0.7);
  const ring2Op = useSharedValue(0.7);
  const ring3Op = useSharedValue(0.7);

  useEffect(() => {
    if (!refreshing) return;
    const duration = 1600;
    const animateRing = (scale: typeof ring1Scale, op: typeof ring1Op, delay: number) => {
      scale.value = 0.3;
      op.value = 0.7;
      scale.value = withDelay(delay, withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1
      ));
      op.value = withDelay(delay, withRepeat(
        withTiming(0, { duration, easing: Easing.out(Easing.ease) }), -1
      ));
    };
    animateRing(ring1Scale, ring1Op, 0);
    animateRing(ring2Scale, ring2Op, 350);
    animateRing(ring3Scale, ring3Op, 700);
  }, [refreshing]);

  const makeRingStyle = (scale: typeof ring1Scale, opacity: typeof ring1Op) =>
    useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

  const r1 = makeRingStyle(ring1Scale, ring1Op);
  const r2 = makeRingStyle(ring2Scale, ring2Op);
  const r3 = makeRingStyle(ring3Scale, ring3Op);

  if (!refreshing) return null;

  const ringBase = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2.5,
    borderColor: color,
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="none"
    >
      <View style={[styles.rippleContainer, { width: size, height: size }]}>
        <Animated.View style={[ringBase, r1]} />
        <Animated.View style={[ringBase, r2]} />
        <Animated.View style={[ringBase, r3]} />
        <View style={[styles.dot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  rippleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {},
});
