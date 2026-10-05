import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "./ScaledText";
import { useThemeColors } from "../hooks/useThemeColors";
import {
  CHECKIN_STATUS_CHOICES,
  CheckinStatusChoice,
} from "../features/checkin/CheckinStatusChoice";

// Render the same UI primitives/labels as check-in, not outdated illustrations.
// These examples have no network calls and cannot create a check-in.
export function CheckinGuidePreview({ step }: { step: number }) {
  const { t } = useTranslation("home");
  const { isDark } = useThemeColors();
  const styles = createStyles(isDark);
  return (
    <View style={styles.preview} pointerEvents="none">
      <Text style={styles.caption}>{t("checkinGuide.preview")}</Text>
      {step <= 3 ? (
        <>
          <Text style={styles.heading}>{t("checkinGreetingMorning")}</Text>
          <Text style={styles.body}>{t("checkinSubheading")}</Text>
          {CHECKIN_STATUS_CHOICES.filter(
            (choice) =>
              step === 1 ||
              (step === 2 ? choice.status === "fine" : choice.status !== "fine")
          ).map((choice) => (
            <CheckinStatusChoice key={choice.status} choice={choice} />
          ))}
        </>
      ) : step === 4 ? (
        <>
          <Text style={styles.heading}>{t("checkinLocationTitle")}</Text>
          <Text style={styles.body}>{t("checkinLocationDescription")}</Text>
          {(["Head", "Chest", "Abdomen"] as const).map((location, index) => (
            <View
              key={location}
              style={[
                styles.location,
                styles.locationCard,
                index === 0 && styles.selectedLocation,
              ]}
            >
              <Ionicons
                name={index === 0 ? "checkbox" : "square-outline"}
                size={24}
                color={index === 0 ? "#00897b" : "#cbd5e1"}
              />
              <MaterialCommunityIcons
                name={
                  index === 0
                    ? "head-outline"
                    : index === 1
                    ? "heart-pulse"
                    : "stomach"
                }
                size={28}
                color={index === 0 ? "#00897b" : "#64748b"}
              />
              <View style={styles.copy}>
                <Text style={[styles.label, styles.cardLabel]}>
                  {t(`checkinLocation${location}`)}
                </Text>
                <Text style={[styles.body, styles.cardBody]}>
                  {t(`checkinLocation${location}Desc`)}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={index === 0 ? "#00897b" : "#cbd5e1"}
              />
            </View>
          ))}
          <Text style={styles.action}>
            {t("checkinLocationContinueCount", { count: 1 })}
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={44}
            color={isDark ? "#6ee7b7" : "#059669"}
            style={styles.resultIcon}
          />
          <Text style={styles.heading}>{t("checkinDoneNoted")}</Text>
          <Text style={styles.label}>{t("checkinFine")}</Text>
          <Text style={styles.body}>{t("checkinFineAdvice")}</Text>
          <View style={styles.location}>
            <Ionicons name="volume-high-outline" size={24} color={isDark ? "#5eead4" : "#00897b"} />
            <Text style={styles.label}>{t("checkinReplaySound")}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (isDark: boolean) => StyleSheet.create({
  preview: { width: "100%", gap: 10, paddingVertical: 10 },
  caption: { color: isDark ? "#cbd5e1" : "#64748b", fontSize: 12, textAlign: "center" },
  heading: { fontSize: 20, color: isDark ? "#ccfbf1" : "#134e4a", fontWeight: "800" },
  body: { color: isDark ? "#e2e8f0" : "#475569", fontSize: 13 },
  label: { color: isDark ? "#ccfbf1" : "#134e4a", fontSize: 16, fontWeight: "700", flexShrink: 1 },
  cardLabel: { color: "#134e4a" },
  cardBody: { color: "#475569" },
  location: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  copy: { flex: 1, minWidth: 0 },
  locationCard: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  selectedLocation: { backgroundColor: "#eefaf5", borderColor: "#00897b" },
  action: {
    color: "#f0fdfa",
    backgroundColor: "#00897b",
    borderRadius: 16,
    textAlign: "center",
    padding: 14,
    fontWeight: "700",
  },
  resultIcon: { alignSelf: "center" },
});
