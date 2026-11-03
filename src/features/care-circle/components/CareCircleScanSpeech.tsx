import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useThemeColors } from "../../../hooks/useThemeColors";

export function CareCircleScanSpeech() {
  const { t } = useTranslation("careCircle");
  const { isDark } = useThemeColors();
  const bubbleColor = isDark ? "#134e4a" : "#d1fae5";
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      opacity.value = 1;
      if (!reducedMotion) {
        opacity.value = withRepeat(
          withSequence(
            withDelay(3000, withTiming(0, { duration: 0 })),
            withDelay(1500, withTiming(1, { duration: 0 }))
          ),
          -1,
          false
        );
      }
      return () => cancelAnimation(opacity);
    }, [opacity, reducedMotion])
  );

  const animation = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.speech, animation]}
    >
      <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
        <Text style={[styles.text, { color: isDark ? "#ecfdf5" : "#064e3b" }]}>
          {t("qrConnectFamilyNow")}
        </Text>
      </View>
      <Svg width={32} height={16} viewBox="0 0 32 16" style={styles.tail}>
        <Path d="M0 0 H32 L16 16 Z" fill={bubbleColor} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Keep the speech above the centered mascot, clear of both action buttons.
  speech: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingBottom: 16,
    zIndex: 2,
  },
  tail: { position: "absolute", bottom: 0 },
  bubble: {
    width: 164,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
  },
  text: { fontSize: 18, fontWeight: "800", textAlign: "center" },
});
