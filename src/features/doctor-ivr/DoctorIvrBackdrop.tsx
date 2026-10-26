import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors } from "../../hooks/useThemeColors";

// Reuse the illustrations and mint canvas from the existing check-in call.
// Decoration stays behind every scrollable control and out of accessibility.
export function DoctorIvrBackdrop() {
  const { colors, isDark } = useThemeColors();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip]}
    >
      <LinearGradient
        colors={
          isDark
            ? [colors.primaryLight, colors.background, colors.background]
            : [colors.primaryLight, "#f3fbf8", "#f3fbf8"]
        }
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require("../../../assets/images/care-circle/header_cross_leaves_left.png")}
        resizeMode="contain"
        style={[styles.headerLeaves, { opacity: isDark ? 0.09 : 0.24 }]}
      />
      <Image
        source={require("../../../assets/images/care-circle/scan_header_heart_ecg.png")}
        resizeMode="contain"
        style={[styles.headerHeart, { opacity: isDark ? 0.08 : 0.16 }]}
      />
      <Image
        source={require("../../../assets/images/checkin-call/call_bottom_deco.png")}
        resizeMode="cover"
        style={[styles.footer, { opacity: isDark ? 0.12 : 0.65 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  headerLeaves: {
    position: "absolute",
    top: 32,
    left: -70,
    width: 200,
    height: 265,
  },
  headerHeart: {
    position: "absolute",
    top: 95,
    right: -48,
    width: 210,
    height: 160,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: 160,
  },
});
