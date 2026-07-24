import type React from 'react';
import { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../../styles';

type SkeletonBlockProps = {
  width?: number | string;
  height: number;
  borderRadius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({
  width = '100%',
  height,
  borderRadius = radius.md,
  color,
  style,
}: SkeletonBlockProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + shimmer.value * 0.36,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: color ?? colors.border,
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonCard({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SkeletonSectionTitle({ width = '42%' }: { width?: number | string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <SkeletonBlock width={22} height={22} borderRadius={11} />
      <SkeletonBlock width={width} height={18} />
    </View>
  );
}
