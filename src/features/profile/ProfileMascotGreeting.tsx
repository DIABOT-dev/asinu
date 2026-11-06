import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ScaledText as Text } from "../../components/ScaledText";
import { MascotSpeechBubble } from "../../components/MascotSpeechBubble";
import { useThemeColors } from "../../hooks/useThemeColors";

export function ProfileMascotGreeting() {
  const { t } = useTranslation("profile");
  const { colors } = useThemeColors();
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
      <MascotSpeechBubble text={t("mascotGreeting")} />
      <Animated.View
        style={animation}
        accessible={false}
        accessibilityElementsHidden
      >
        <Image
          source={require("../../../assets/images/profile/asinu-profile-mascot-v1.webp")}
          style={styles.mascot}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={[styles.wordmark, { color: colors.primaryText }]}>
        {t("brandName")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignSelf: "center", alignItems: "center", gap: 8, paddingTop: 6 },
  mascot: { width: 96, height: 96 },
  wordmark: { fontSize: 18, fontWeight: "800", letterSpacing: 2 },
});
