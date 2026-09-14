import type React from 'react';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
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
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(shimmer.value, [0, 1], [-containerWidth, containerWidth]),
    }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: color ?? colors.border,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {containerWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: Math.max(containerWidth * 0.55, 48),
            },
            animatedStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
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
