import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Path } from "react-native-svg";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { CheckinStatus } from "./checkin.api";

// The same quiet botanical motif ties all three status cards together.
function WatermarkLeaves({ color }: { color: string }) {
  return (
    <Svg width={150} height={118} viewBox="0 0 150 118" fill="none" style={styles.watermark} pointerEvents="none" accessible={false}>
      <Path d="M76 124C72 92 73 57 93 12M75 112C57 93 41 78 17 68M78 110C95 91 113 78 137 70" stroke={color} strokeWidth={1.5} opacity={0.14} />
      <Path d="M80 75C59 49 74 18 99 7C109 31 100 60 80 75Z" fill={color} opacity={0.14} />
      <Path d="M72 111C40 109 15 89 11 61C42 61 68 79 72 111Z" fill={color} opacity={0.11} />
      <Path d="M80 113C83 85 110 70 145 72C134 101 110 117 80 113Z" fill={color} opacity={0.12} />
    </Svg>
  );
}

// One source for the real check-in screen and its onboarding preview.
export const CHECKIN_STATUS_CHOICES: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  labelKey: string;
  sublabelKey: string;
  bg: string;
  border: string;
  borderDark: string;
  color: string;
  darkColor: string;
  iconColor: string;
  subColor: string;
  darkSubColor: string;
  gradient: [string, string];
  gradientDark: [string, string];
  avatarBg: string;
  avatarBgDark: string;
  avatarBorder: string;
  chevronColor: string;
}> = [
  {
    status: "fine",
    icon: "emoticon-happy-outline",
    labelKey: "checkinFine",
    sublabelKey: "checkinFineSub",
    bg: "#f4fcfb",
    border: "#a4e8df",
    borderDark: "rgba(8, 184, 162, 0.35)",
    color: "#083842",
    darkColor: "#5eead4",
    iconColor: "#00847d",
    subColor: "#61758b",
    darkSubColor: "#94a3b8",
    gradient: ["#fdfffe", "#effbf8"],
    gradientDark: ["#072421", "#041715"],
    avatarBg: "#e2f7f3",
    avatarBgDark: "#163e38",
    avatarBorder: "transparent",
    chevronColor: "#00847d",
  },
  {
    status: "tired",
    icon: "emoticon-neutral-outline",
    labelKey: "checkinTired",
    sublabelKey: "checkinTiredSub",
    bg: "#ffffff",
    border: "#fed7aa",
    borderDark: "rgba(245, 158, 11, 0.35)",
    color: "#b45309",
    darkColor: "#fcd34d",
    iconColor: "#d97706",
    subColor: "#61758b",
    darkSubColor: "#fde68a",
    gradient: ["#fffdfb", "#fff7ee"],
    gradientDark: ["#291a07", "#1c1103"],
    avatarBg: "#fff0e1",
    avatarBgDark: "#483015",
    avatarBorder: "transparent",
    chevronColor: "#d97706",
  },
  {
    status: "very_tired",
    icon: "emoticon-sad-outline",
    labelKey: "checkinVeryTired",
    sublabelKey: "checkinVeryTiredSub",
    bg: "#ffffff",
    border: "#fecdd3",
    borderDark: "rgba(244, 63, 94, 0.35)",
    color: "#be123c",
    darkColor: "#fda4af",
    iconColor: "#e11d48",
    subColor: "#61758b",
    darkSubColor: "#fecdd3",
    gradient: ["#fffdfd", "#fff1f4"],
    gradientDark: ["#29080e", "#1c0307"],
    avatarBg: "#ffe7ec",
    avatarBgDark: "#4b2030",
    avatarBorder: "transparent",
    chevronColor: "#e11d48",
  },
];

export function CheckinStatusChoice({
  choice,
  onSelect,
}: {
  choice: (typeof CHECKIN_STATUS_CHOICES)[number];
  onSelect?: (status: CheckinStatus) => void;
}) {
  const { t } = useTranslation("home");
  const { isDark } = useThemeColors();
  const faceColor = isDark ? choice.darkColor : choice.iconColor;

  const content = (
    <LinearGradient
      colors={isDark ? choice.gradientDark : choice.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.8 }}
      style={[
        styles.card,
        { borderColor: isDark ? choice.borderDark : choice.border },
      ]}
    >
      <WatermarkLeaves color={isDark ? choice.darkColor : choice.iconColor} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.avatarWrap, { backgroundColor: isDark ? choice.avatarBgDark : choice.avatarBg }]}>
        <Svg width={46} height={46} viewBox="0 0 46 46" fill="none" accessible={false}>
          <Circle cx={23} cy={23} r={17} stroke={faceColor} strokeWidth={2.5} />
          <Circle cx={17} cy={20} r={1.7} fill={faceColor} />
          <Circle cx={29} cy={20} r={1.7} fill={faceColor} />
          <Path d={choice.status === "fine" ? "M16 28Q23 35 30 28" : choice.status === "tired" ? "M17 29H29" : "M17 32Q23 25 29 32"} stroke={faceColor} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </View>

      {/* Text Copy */}
      <View style={styles.copy}>
        <Text
          allowFontScaling
          style={[
            styles.label,
            { color: isDark ? choice.darkColor : choice.color },
          ]}
        >
          {t(choice.labelKey)}
        </Text>
        <Text
          allowFontScaling
          style={[
            styles.sub,
            { color: isDark ? choice.darkSubColor : choice.subColor },
          ]}
        >
          {t(choice.sublabelKey)}
        </Text>
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.chevron, { backgroundColor: isDark ? choice.avatarBgDark : choice.avatarBg }]}>
        <Ionicons name="chevron-forward" size={22} color={isDark ? choice.darkColor : choice.chevronColor} />
      </View>
    </LinearGradient>
  );

  return onSelect ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(choice.labelKey)}. ${t(choice.sublabelKey)}`}
      testID={`checkin-status-${choice.status}`}
      style={({ pressed }) => [pressed && { opacity: 0.88, transform: [{ scale: 0.995 }] }]}
      onPress={() => onSelect(choice.status)}
    >
      {content}
    </Pressable>
  ) : (
    <View>{content}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 104,
    shadowColor: "#08b8a2",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  watermark: {
    position: "absolute",
    right: 26,
    bottom: -4,
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
  },
  label: {
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  sub: {
    maxWidth: 188,
    fontSize: 16,
    marginTop: 4,
    lineHeight: 23,
    fontWeight: "400",
  },
});
