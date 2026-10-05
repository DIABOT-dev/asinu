import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import type { CheckinStatus } from "./checkin.api";

// One source for the real check-in screen and its onboarding preview.
export const CHECKIN_STATUS_CHOICES: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  labelKey: string;
  sublabelKey: string;
  bg: string;
  border: string;
  color: string;
  iconColor: string;
  subColor: string;
}> = [
  {
    status: "fine",
    icon: "check-circle-outline",
    labelKey: "checkinFine",
    sublabelKey: "checkinFineSub",
    bg: "#eefaf5",
    border: "#cceee2",
    color: "#064e3b",
    iconColor: "#059669",
    subColor: "#0f766e",
  },
  {
    status: "specific_concern",
    icon: "alert-circle-outline",
    labelKey: "checkinAbnormal",
    sublabelKey: "checkinAbnormalSub",
    bg: "#fffaf0",
    border: "#f5d9a8",
    color: "#92400e",
    iconColor: "#d97706",
    subColor: "#a16207",
  },
  {
    status: "tired",
    icon: "emoticon-neutral-outline",
    labelKey: "checkinTired",
    sublabelKey: "checkinTiredSub",
    bg: "#fff7ed",
    border: "#fed7aa",
    color: "#9a3412",
    iconColor: "#ea580c",
    subColor: "#c2410c",
  },
  {
    status: "very_tired",
    icon: "emoticon-sad-outline",
    labelKey: "checkinVeryTired",
    sublabelKey: "checkinVeryTiredSub",
    bg: "#fef2f2",
    border: "#fecaca",
    color: "#991b1b",
    iconColor: "#dc2626",
    subColor: "#b91c1c",
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
  const content = (
    <>
      <MaterialCommunityIcons
        name={choice.icon}
        size={30}
        color={choice.iconColor}
      />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: choice.color }]}>
          {t(choice.labelKey)}
        </Text>
        <Text style={[styles.sub, { color: choice.subColor }]}>
          {t(choice.sublabelKey)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={choice.iconColor} />
    </>
  );
  const style = [
    styles.card,
    { backgroundColor: choice.bg, borderColor: choice.border },
  ];
  // A preview is not a disabled button pretending to perform a real check-in.
  return onSelect ? (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [...style, pressed && { opacity: 0.88 }]}
      onPress={() => onSelect(choice.status)}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 64,
    shadowColor: "#059669",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
  sub: { fontSize: 13, marginTop: 3, lineHeight: 18 },
});
