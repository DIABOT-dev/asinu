import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { CheckinStatus } from "./checkin.api";

// Subtle watermarks rendered on the right background of each card
function WatermarkLeaves({ color = "#08b8a2" }: { color?: string }) {
  return (
    <Svg width={80} height={76} viewBox="0 0 80 76" fill="none" style={styles.watermark}>
      <Path
        d="M20 72C32 56 48 38 64 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.32}
      />
      <Path
        d="M64 12C70 24 58 36 46 34C40 33 50 18 64 12Z"
        fill={color}
        opacity={0.22}
      />
      <Path
        d="M50 32C62 38 58 50 46 48C38 46 43 35 50 32Z"
        fill={color}
        opacity={0.2}
      />
      <Path
        d="M32 46C22 42 24 28 36 30C42 31 38 44 32 46Z"
        fill={color}
        opacity={0.18}
      />
    </Svg>
  );
}

function WatermarkHeartPulse({ color = "#F59E0B" }: { color?: string }) {
  return (
    <Svg width={78} height={66} viewBox="0 0 78 66" fill="none" style={styles.watermark}>
      <Path
        d="M39 58C39 58 14 40 14 22C14 12 21 6 30 6C36 6 39 10 39 10C39 10 42 6 48 6C57 6 64 12 64 22C64 40 39 58 39 58Z"
        fill={color}
        opacity={0.22}
      />
      <Path
        d="M22 25H29L33 16L39 34L44 20L48 25H58"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </Svg>
  );
}

function WatermarkHospitalBed({ color = "#F43F5E" }: { color?: string }) {
  return (
    <Svg width={78} height={66} viewBox="0 0 78 66" fill="none" style={styles.watermark}>
      {/* Medical Cross above */}
      <Path
        d="M48 8H54V14H60V20H54V26H48V20H42V14H48V8Z"
        fill={color}
        opacity={0.25}
      />
      {/* Bed headboard */}
      <Path
        d="M12 24V50"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.3}
      />
      {/* Person pillow / head */}
      <Path
        d="M22 32C25 32 27 30 27 27C27 24 25 22 22 22C19 22 17 24 17 27C17 30 19 32 22 32Z"
        fill={color}
        opacity={0.25}
      />
      {/* Bed mattress */}
      <Path
        d="M12 40H64C66 40 68 38 68 36V35H12V40Z"
        fill={color}
        opacity={0.25}
      />
      {/* Bed frame & legs */}
      <Path
        d="M12 42H68V50"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.3}
      />
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
    color: "#0f766e",
    darkColor: "#5eead4",
    iconColor: "#08b8a2",
    subColor: "#475569",
    darkSubColor: "#94a3b8",
    gradient: ["#ffffff", "#f8fdfb"],
    gradientDark: ["#072421", "#041715"],
    avatarBg: "transparent",
    avatarBgDark: "transparent",
    avatarBorder: "transparent",
    chevronColor: "#08b8a2",
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
    subColor: "#78350F",
    darkSubColor: "#fde68a",
    gradient: ["#ffffff", "#fffdf7"],
    gradientDark: ["#291a07", "#1c1103"],
    avatarBg: "transparent",
    avatarBgDark: "transparent",
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
    subColor: "#881337",
    darkSubColor: "#fecdd3",
    gradient: ["#ffffff", "#fffafa"],
    gradientDark: ["#29080e", "#1c0307"],
    avatarBg: "transparent",
    avatarBgDark: "transparent",
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
      {/* Right Watermark */}
      {choice.status === "fine" ? (
        <WatermarkLeaves color={choice.iconColor} />
      ) : choice.status === "tired" ? (
        <WatermarkHeartPulse color={choice.iconColor} />
      ) : (
        <WatermarkHospitalBed color={choice.iconColor} />
      )}

      {/* Status icon with check badge for 'fine' - clean direct icon without background */}
      <View style={styles.avatarWrap}>
        <MaterialCommunityIcons
          name={choice.icon}
          size={34}
          color={choice.iconColor}
        />
        {choice.status === "fine" && (
          <View style={styles.avatarCheckBadge}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Text Copy */}
      <View style={styles.copy}>
        <Text
          style={[
            styles.label,
            { color: isDark ? choice.darkColor : choice.color },
          ]}
        >
          {t(choice.labelKey)}
        </Text>
        <Text
          style={[
            styles.sub,
            { color: isDark ? choice.darkSubColor : choice.subColor },
          ]}
        >
          {t(choice.sublabelKey)}
        </Text>
      </View>

      {/* Chevron Forward */}
      <Ionicons name="chevron-forward" size={22} color={choice.chevronColor} />
    </LinearGradient>
  );

  return onSelect ? (
    <Pressable
      accessibilityRole="button"
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
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    minHeight: 80,
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
    bottom: -6,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#08b8a2",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
  },
  label: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 18,
    marginTop: 4,
    lineHeight: 25,
    fontWeight: "500",
  },
});
