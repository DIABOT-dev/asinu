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
function WatermarkLeaves({ color = "#10B981" }: { color?: string }) {
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
    bg: "#F0FDF8",
    border: "#A7F3D0",
    borderDark: "rgba(45, 212, 191, 0.35)",
    color: "#0F2F2B",
    darkColor: "#6EE7B7",
    iconColor: "#0D9488",
    subColor: "#475569",
    darkSubColor: "#94A3B8",
    gradient: ["#F0FDF8", "#E6F9F3"],
    gradientDark: ["#0a2620", "#061a15"],
    avatarBg: "#DCFCE7",
    avatarBgDark: "rgba(16, 185, 129, 0.2)",
    avatarBorder: "#86EFAC",
    chevronColor: "#0D9488",
  },
  {
    status: "tired",
    icon: "emoticon-neutral-outline",
    labelKey: "checkinTired",
    sublabelKey: "checkinTiredSub",
    bg: "#FFFBF5",
    border: "#FED7AA",
    borderDark: "rgba(245, 158, 11, 0.35)",
    color: "#B45309",
    darkColor: "#FCD34D",
    iconColor: "#D97706",
    subColor: "#78350F",
    darkSubColor: "#FDE68A",
    gradient: ["#FFFBF5", "#FEF3E2"],
    gradientDark: ["#291a07", "#1c1103"],
    avatarBg: "#FEF3C7",
    avatarBgDark: "rgba(245, 158, 11, 0.2)",
    avatarBorder: "#FDE68A",
    chevronColor: "#D97706",
  },
  {
    status: "very_tired",
    icon: "emoticon-sad-outline",
    labelKey: "checkinVeryTired",
    sublabelKey: "checkinVeryTiredSub",
    bg: "#FFF5F5",
    border: "#FECDD3",
    borderDark: "rgba(244, 63, 94, 0.35)",
    color: "#BE123C",
    darkColor: "#FDA4AF",
    iconColor: "#E11D48",
    subColor: "#881337",
    darkSubColor: "#FECDD3",
    gradient: ["#FFF5F5", "#FFEBEB"],
    gradientDark: ["#29080e", "#1c0307"],
    avatarBg: "#FFE4E6",
    avatarBgDark: "rgba(244, 63, 94, 0.2)",
    avatarBorder: "#FECDD3",
    chevronColor: "#E11D48",
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

      {/* Avatar with status icon and check badge for 'fine' */}
      <View
        style={[
          styles.avatarWrap,
          {
            backgroundColor: isDark ? choice.avatarBgDark : choice.avatarBg,
            borderColor: isDark ? choice.borderDark : choice.avatarBorder,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={choice.icon}
          size={30}
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
    shadowColor: "#059669",
    shadowOpacity: 0.04,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#0D9488",
    borderWidth: 2,
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
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500",
  },
});
