import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ScaledText as Text } from '../../components/ScaledText';
// The interview keeps its light mint surface in both app themes.
import { lightColors as colors } from '../../styles/theme';

const MASCOT = require('../../../assets/asinu_chat_sticker.png');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 164;
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// This endpoint has no streaming progress. Keep the estimate below completion
// and replace the loader immediately when the actual response arrives.
export function estimatedQuestionProgress(elapsedMs: number) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.min(94, Math.round(12 + 82 * (1 - Math.exp(-elapsed / 2400))));
}

export function CheckinQuestionLoading({
  first = false,
  active = true,
}: {
  first?: boolean;
  active?: boolean;
}) {
  const { t } = useTranslation('home');
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reducedMotion, setReducedMotion] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const lift = useSharedValue(0);
  const ring = useSharedValue(12);
  const playing = active && foreground && focused;
  const percent = estimatedQuestionProgress(elapsed);
  const title = t(first ? 'checkinQuestionPreparingFirst' : 'checkinQuestionReviewingAnswer');

  useEffect(() => {
    if (!active) {
      return;
    }
    let alive = true;
    let changed = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive && !changed) {
          setReducedMotion(value);
        }
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReducedMotion(value);
    });
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => {
      alive = false;
      motion.remove();
      app.remove();
    };
  }, [active]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const started = Date.now();
    const previous = elapsedRef.current;
    const timer = setInterval(() => {
      elapsedRef.current = previous + Date.now() - started;
      setElapsed(elapsedRef.current);
    }, 250);
    return () => {
      elapsedRef.current = previous + Date.now() - started;
      clearInterval(timer);
    };
  }, [playing]);

  useEffect(() => {
    if (playing && !reducedMotion) {
      const easing = Easing.inOut(Easing.quad);
      lift.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 900, easing }),
          withTiming(0, { duration: 900, easing }),
        ),
        -1,
        false,
      );
    } else {
      lift.value = 0;
    }
    return () => cancelAnimation(lift);
  }, [lift, playing, reducedMotion]);

  useEffect(() => {
    ring.value =
      playing && !reducedMotion
        ? withTiming(percent, { duration: 220, easing: Easing.out(Easing.cubic) })
        : percent;
    return () => cancelAnimation(ring);
  }, [ring, percent, playing, reducedMotion]);

  const mascotMotion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const ringMotion = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - ring.value / 100),
  }));

  return (
    <View style={styles.container} testID="checkin-question-loading">
      <View
        style={styles.stage}
        accessibilityRole="progressbar"
        accessible
        accessibilityLabel={title}
        accessibilityState={{ busy: active }}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: percent,
          text: t('checkinQuestionLoadingPercent', { percent }),
        }}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} accessible={false}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={4}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.primaryText}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
            animatedProps={ringMotion}
          />
        </Svg>
        <Animated.View style={[styles.mascot, mascotMotion]} pointerEvents="none">
          <Image source={MASCOT} style={styles.image} resizeMode="contain" accessible={false} />
        </Animated.View>
        <View style={[styles.percent, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.number, { color: colors.primaryText }]}>{percent}%</Text>
        </View>
      </View>
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      <Text style={[styles.estimate, { color: colors.textSecondary }]}>
        {t('checkinQuestionLoadingEstimate')}
        {elapsed >= 12000 ? `\n${t('checkinQuestionLoadingLonger')}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  stage: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mascot: { position: 'absolute', top: 30, alignSelf: 'center' },
  image: { width: 98, height: 104 },
  percent: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  number: { fontSize: 22, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { width: '100%', fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  estimate: { width: '100%', fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
