import { useCallback, useId } from "react";
import { useFocusEffect } from "expo-router";
import { Image, StyleSheet } from "react-native";
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const MASCOT = require("../../../assets/images/care-circle/asinu-pointing-qr-v1.png");
const SIZE = 104;
const SCALE = SIZE / 1280;
// Overlap the shoulder so the original artwork stays joined as the arm moves.
const ARM = { x: 832, y: 590, width: 448, height: 190 };

export function CoinRulesMascot() {
  const clipId = `coin-mascot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reducedMotion = useReducedMotion();
  const lift = useSharedValue(0);
  const point = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      lift.value = 0;
      point.value = 0;
      if (!reducedMotion) {
        const easing = Easing.inOut(Easing.quad);
        lift.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 1600, easing }),
            withTiming(0, { duration: 1600, easing })
          ),
          -1,
          false
        );
        point.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600, easing }),
            withTiming(0, { duration: 700, easing }),
            withDelay(1600, withTiming(0, { duration: 0 }))
          ),
          -1,
          false
        );
      }
      return () => {
        cancelAnimation(lift);
        cancelAnimation(point);
      };
    }, [lift, point, reducedMotion])
  );

  const bodyMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  const armMotion = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-3 * point.value}deg` },
      { scaleX: 1 + 0.08 * point.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.mascot, bodyMotion]}
    >
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 1280 1280"
        accessible={false}
      >
        <Defs>
          <ClipPath id={clipId}>
            <Path d="M0 0 H1280 V594 H848 V780 H1280 V1280 H0 Z" />
          </ClipPath>
        </Defs>
        <SvgImage
          href={MASCOT}
          width={1280}
          height={1280}
          clipPath={`url(#${clipId})`}
        />
      </Svg>
      <Animated.View style={[styles.arm, armMotion]}>
        <Image source={MASCOT} style={styles.armImage} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mascot: { width: SIZE, height: SIZE, flexShrink: 0 },
  arm: {
    position: "absolute",
    left: ARM.x * SCALE,
    top: ARM.y * SCALE,
    width: ARM.width * SCALE,
    height: ARM.height * SCALE,
    overflow: "hidden",
    transformOrigin: "left center",
  },
  armImage: {
    position: "absolute",
    left: -ARM.x * SCALE,
    top: -ARM.y * SCALE,
    width: SIZE,
    height: SIZE,
  },
});
