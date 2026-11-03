import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useThemeColors } from "../hooks/useThemeColors";
import { TypewriterText } from "./TypewriterText";

export function MascotSpeechBubble({
  text,
  decorative = false,
}: {
  text: string;
  decorative?: boolean;
}) {
  const { isDark } = useThemeColors();
  const bubbleColor = isDark ? "#134e4a" : "#d1fae5";

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : undefined}
      style={styles.speech}
    >
      <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
        <TypewriterText
          text={text}
          style={[styles.text, { color: isDark ? "#ecfdf5" : "#064e3b" }]}
        />
      </View>
      <Svg
        width={32}
        height={16}
        viewBox="0 0 32 16"
        style={styles.tail}
        accessible={false}
      >
        <Path d="M0 0 H32 L16 16 Z" fill={bubbleColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
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
