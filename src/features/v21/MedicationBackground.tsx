import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useThemeColors } from "../../hooks/useThemeColors";

/** Same restrained mint and medical artwork as the rest of Asinu. */
export function MedicationBackground() {
  const { isDark } = useThemeColors();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <LinearGradient
        colors={
          isDark
            ? ["#122D29", "#111F24", "#132824"]
            : ["#EAF8F2", "#F6FBF8", "#F0F8F4"]
        }
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={235} height={190} viewBox="0 0 180 180" style={styles.heart}>
        <Path
          d="M90 151C60 126 19 96 19 62C19 23 67 13 90 48C113 13 161 23 161 62C161 96 120 126 90 151Z"
          fill={isDark ? "#3B7564" : "#B8DDC9"}
          opacity={0.22}
        />
        <Path
          d="M30 90H64L76 67L91 110L103 81L115 90H150"
          fill="none"
          stroke={isDark ? "#477F6D" : "#A4D5C1"}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.24}
        />
      </Svg>
      <Svg
        width="100%"
        height={240}
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        style={styles.wave}
      >
        <Path
          d="M0 130C90 75 170 235 400 112V240H0Z"
          fill={isDark ? "#1B3932" : "#DFF1E7"}
          opacity={0.44}
        />
        <Path
          d="M0 184C170 105 285 255 400 166V240H0Z"
          fill={isDark ? "#20443A" : "#D6EEE2"}
          opacity={0.3}
        />
      </Svg>
    </View>
  );
}
const styles = StyleSheet.create({
  heart: { position: "absolute", width: 235, height: 190, right: -48, top: 15 },
  wave: { position: "absolute", bottom: 0, left: 0 },
});
