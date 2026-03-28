/**
 * RippleRefresh — Pull-to-refresh with ripple animation + haptic feedback.
 *
 * Wraps a ScrollView. When user pulls down past threshold, triggers onRefresh
 * and shows ripple animation. Haptic feedback on trigger and completion.
 *
 * Usage:
 *   <RippleRefreshScrollView refreshing={loading} onRefresh={handleRefresh}>
 *     {children}
 *   </RippleRefreshScrollView>
 *
 * Or standalone indicator (legacy):
 *   <RippleRefreshIndicator refreshing={loading} />
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, RefreshControl, ScrollView, ScrollViewProps, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors } from '../styles';

let _Haptics: typeof import('expo-haptics') | null = null;
async function triggerHaptic(type: 'trigger' | 'done') {
  if (!_Haptics) {
    try { _Haptics = await import('expo-haptics'); } catch { return; }
  }
  try {
    if (type === 'trigger') {
      await _Haptics.impactAsync(_Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await _Haptics.notificationAsync(_Haptics.NotificationFeedbackType.Success);
    }
  } catch {}
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const PULL_THRESHOLD = 80;

// ─── Ripple indicator (used both standalone and inside pull-to-refresh) ────

interface RippleProps {
  active: boolean;
  color?: string;
  size?: number;
  progress?: number; // 0-1 pull progress for scaling
}

function RippleCircles({ active, color = colors.primary, size = 44, progress = 1 }: RippleProps) {
  const styles = useMemo(() => StyleSheet.create({
    rippleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), []);
  const ring1Scale = useSharedValue(0.3);
  const ring2Scale = useSharedValue(0.3);
  const ring3Scale = useSharedValue(0.3);
  const ring1Op = useSharedValue(0.7);
  const ring2Op = useSharedValue(0.7);
  const ring3Op = useSharedValue(0.7);

  useEffect(() => {
    if (!active) {
      ring1Scale.value = 0.3; ring2Scale.value = 0.3; ring3Scale.value = 0.3;
      ring1Op.value = 0.7; ring2Op.value = 0.7; ring3Op.value = 0.7;
      return;
    }
    const duration = 1600;
    const animate = (s: typeof ring1Scale, o: typeof ring1Op, d: number) => {
      s.value = 0.3;
      o.value = 0.7;
      s.value = withDelay(d, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1));
      o.value = withDelay(d, withRepeat(withTiming(0, { duration, easing: Easing.out(Easing.ease) }), -1));
    };
    animate(ring1Scale, ring1Op, 0);
    animate(ring2Scale, ring2Op, 350);
    animate(ring3Scale, ring3Op, 700);
  }, [active]);

  const r1 = useAnimatedStyle(() => ({ transform: [{ scale: ring1Scale.value }], opacity: ring1Op.value }));
  const r2 = useAnimatedStyle(() => ({ transform: [{ scale: ring2Scale.value }], opacity: ring2Op.value }));
  const r3 = useAnimatedStyle(() => ({ transform: [{ scale: ring3Scale.value }], opacity: ring3Op.value }));

  const ringBase = {
    position: 'absolute' as const,
    width: size, height: size, borderRadius: size / 2,
    borderWidth: 2.5, borderColor: color,
  };

  return (
    <View style={[styles.rippleContainer, { width: size, height: size, transform: [{ scale: progress }] }]}>
      <Animated.View style={[ringBase, r1]} />
      <Animated.View style={[ringBase, r2]} />
      <Animated.View style={[ringBase, r3]} />
      <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: color }} />
    </View>
  );
}

// ─── Standalone overlay indicator (legacy, for non-scrollview contexts) ────

interface RippleRefreshProps {
  refreshing: boolean;
  color?: string;
  size?: number;
}

export function RippleRefreshIndicator({ refreshing, color, size }: RippleRefreshProps) {
  const { t } = useTranslation('common');
  const prevRefreshing = useRef(refreshing);
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  }), []);

  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      triggerHaptic('done');
    }
    prevRefreshing.current = refreshing;
  }, [refreshing]);

  if (!refreshing) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(300)} style={styles.overlay} pointerEvents="none">
      <RippleCircles active={true} color={color} size={size} />
      <Text style={styles.loadingText}>{t('loading')}</Text>
    </Animated.View>
  );
}

// ─── Pull-to-refresh ScrollView wrapper ───────────────────────────────────

interface PullRefreshScrollViewProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  rippleColor?: string;
  children: React.ReactNode;
}

export function RippleRefreshScrollView({
  refreshing,
  onRefresh,
  rippleColor = colors.primary,
  children,
  contentContainerStyle,
  ...scrollProps
}: PullRefreshScrollViewProps) {
  const pullDistance = useSharedValue(0);
  const isTriggered = useSharedValue(false);
  const isRefreshing = useSharedValue(refreshing);
  const prevRefreshing = useRef(refreshing);

  useEffect(() => {
    isRefreshing.value = refreshing;
  }, [refreshing]);
  const styles = useMemo(() => StyleSheet.create({
    pullIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 70,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
  }), []);

  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      triggerHaptic('done');
      pullDistance.value = withSpring(0, { damping: 15 });
    }
    prevRefreshing.current = refreshing;
  }, [refreshing]);

  const onTrigger = useCallback(() => {
    triggerHaptic('trigger');
    onRefresh();
  }, [onRefresh]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      if (y < 0) {
        pullDistance.value = Math.abs(y);
        if (Math.abs(y) >= PULL_THRESHOLD && !isTriggered.value && !isRefreshing.value) {
          isTriggered.value = true;
          runOnJS(onTrigger)();
        }
      } else {
        pullDistance.value = 0;
      }
    },
    onEndDrag: () => {
      isTriggered.value = false;
      if (!isRefreshing.value && pullDistance.value > 0) {
        pullDistance.value = withSpring(0, { damping: 15 });
      }
    },
  });

  const indicatorStyle = useAnimatedStyle(() => {
    const progress = interpolate(pullDistance.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [
        { translateY: interpolate(pullDistance.value, [0, PULL_THRESHOLD, PULL_THRESHOLD * 2], [-30, 10, 30], Extrapolation.CLAMP) },
        { scale: interpolate(progress, [0, 1], [0.5, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const showRipple = refreshing || pullDistance.value > 10;

  return (
    <View style={{ flex: 1 }}>
      {/* Pull indicator */}
      <Animated.View style={[styles.pullIndicator, indicatorStyle]} pointerEvents="none">
        <RippleCircles active={refreshing} color={rippleColor} size={40} />
      </Animated.View>

      <AnimatedScrollView
        {...scrollProps}
        contentContainerStyle={contentContainerStyle}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={true}
        refreshControl={Platform.OS === 'android' ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[rippleColor]}
            tintColor={rippleColor}
          />
        ) : undefined}
      >
        {children}
      </AnimatedScrollView>
    </View>
  );
}
