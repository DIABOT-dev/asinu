import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

function Snowflake({
  x,
  height,
  delay,
  size,
}: {
  x: number;
  height: number;
  delay: number;
  size: number;
}) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useFocusEffect(
    useCallback(() => {
      progress.value = 0;
      if (!reducedMotion) {
        progress.value = withDelay(
          delay,
          withRepeat(
            withTiming(1, {
              duration: 5200 + delay,
              easing: Easing.linear,
            }),
            -1,
            false
          )
        );
      }
      return () => cancelAnimation(progress);
    }, [delay, progress, reducedMotion])
  );
  const animation = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.85, 1], [0, 0.8, 0.8, 0]),
    transform: [
      { translateY: progress.value * (height + 32) - 16 },
      { translateX: Math.sin(progress.value * Math.PI * 2) * 14 },
      { rotate: `${progress.value * 120}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.flake, { left: x }, animation]}>
      <Ionicons name="snow" size={size} color="#93c5fd" />
    </Animated.View>
  );
}

export function HealthTreeSnow({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[0.06, 0.24, 0.42, 0.62, 0.8, 0.94].map((position, index) => (
        <Snowflake
          key={position}
          x={position * width}
          height={height}
          delay={index * 650}
          size={12 + (index % 3) * 3}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ flake: { position: "absolute", top: 0 } });
