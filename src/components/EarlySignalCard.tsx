import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ScaledText as Text } from "./ScaledText";
import { AppAlertModal, useAppAlert } from "./AppAlertModal";
import {
  earlySignalApi,
  type EarlySignalAssessment,
} from "../features/early-signal/early-signal.api";
import { colors, radius, spacing, typography } from "../styles";

type Props = { refreshKey?: number };

const presentation = {
  monitor: {
    labelKey: "earlyMonitor",
    color: "#047857",
    icon: "leaf-outline" as const,
  },
  see_doctor: {
    labelKey: "earlySeeDoctor",
    color: "#b45309",
    icon: "medical-outline" as const,
  },
  urgent: {
    labelKey: "earlyUrgent",
    color: "#dc2626",
    icon: "warning-outline" as const,
  },
};

export function EarlySignalCard({ refreshKey = 0 }: Props) {
  const { t } = useTranslation("tree");
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [assessment, setAssessment] = useState<EarlySignalAssessment | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    earlySignalApi
      .latest()
      .then(setAssessment)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const evaluate = useCallback(async () => {
    setEvaluating(true);
    try {
      const result = await earlySignalApi.evaluate();
      setAssessment(result);
      setOpen(true);
    } catch {
      showAlert(t("earlyErrorTitle"), t("earlyErrorBody"));
    } finally {
      setEvaluating(false);
    }
  }, [showAlert, t]);

  const view = useMemo(
    () => presentation[assessment?.severity ?? "monitor"],
    [assessment?.severity]
  );

  if (assessment?.is_red_flag) {
    return (
      <>
        <View style={styles.emergencyCard} accessibilityRole="alert">
          <View style={styles.emergencyHeading}>
            <Ionicons name="warning-outline" size={28} color="#b91c1c" />
            <Text style={styles.redFlagTitle}>{t("earlyRedFlagTitle")}</Text>
          </View>
          <Text style={styles.redFlagBody}>{assessment.summary}</Text>
          {!!assessment.urgent_signs.length && (
            <View style={styles.inlineSigns}>
              {assessment.urgent_signs.map((sign) => (
                <Text key={sign} style={styles.inlineSign}>
                  • {sign}
                </Text>
              ))}
            </View>
          )}
          <Pressable
            style={styles.emergencyButton}
            onPress={() => Linking.openURL("tel:115")}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.emergencyText}>{t("earlyCall115")}</Text>
          </Pressable>
          <Text
            style={
              assessment.family_notified_at
                ? styles.familySent
                : styles.familyPending
            }
          >
            {assessment.family_notified_at
              ? t("earlyFamilySent")
              : t("earlyFamilyUnavailable")}
          </Text>
          <Text style={styles.disclaimer}>{assessment.disclaimer}</Text>
        </View>
        <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      </>
    );
  }

  return (
    <>
      <Pressable
        style={[
          styles.card,
          assessment && {
            borderColor: view.color + "26",
            backgroundColor: view.color + "08",
          },
        ]}
        onPress={() => (assessment ? setOpen(true) : evaluate())}
      >
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="radar"
            size={27}
            color={assessment ? view.color : colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t("earlyTitle")}</Text>
            {assessment && (
              <Text style={[styles.level, { color: view.color }]}>
                {t(view.labelKey)}
              </Text>
            )}
          </View>
          <Text style={styles.body} numberOfLines={assessment ? 2 : 3}>
            {assessment?.summary ?? t("earlyEmpty")}
          </Text>
        </View>
        {loading || evaluating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        )}
      </Pressable>

      {!assessment && !loading && (
        <Pressable
          style={styles.evaluateButton}
          onPress={evaluate}
          disabled={evaluating}
        >
          <Text style={styles.evaluateText}>{t("earlyEvaluate")}</Text>
        </Pressable>
      )}

      <Modal
        visible={open && Boolean(assessment)}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetTitleRow}>
            <View style={styles.sheetIcon}>
              <Ionicons name={view.icon} size={27} color={view.color} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.sheetTitle}>{t("earlyTitle")}</Text>
              <Text style={[styles.sheetLevel, { color: view.color }]}>
                {t(view.labelKey)}
              </Text>
            </View>
          </View>

          {assessment?.is_red_flag ? (
            <View style={styles.redFlagBox}>
              <Text style={styles.redFlagTitle}>{t("earlyRedFlagTitle")}</Text>
              <Text style={styles.redFlagBody}>{assessment.summary}</Text>
              <Pressable
                style={styles.emergencyButton}
                onPress={() => Linking.openURL("tel:115")}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.emergencyText}>{t("earlyCall115")}</Text>
              </Pressable>
              {assessment.family_notified_at && (
                <Text style={styles.familySent}>{t("earlyFamilySent")}</Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.summary}>{assessment?.summary}</Text>
              {!!assessment?.signals.length && (
                <View style={styles.signalsBox}>
                  <Text style={styles.boxLabel}>{t("earlyFound")}</Text>
                  {assessment.signals.map((signal) => (
                    <View key={signal} style={styles.signalRow}>
                      <View
                        style={[styles.dot, { backgroundColor: view.color }]}
                      />
                      <Text style={styles.signalText}>{signal}</Text>
                    </View>
                  ))}
                </View>
              )}
              {assessment?.suggested_specialty && (
                <Text style={styles.specialty}>
                  {t("earlySpecialty", {
                    specialty: assessment.suggested_specialty,
                  })}
                </Text>
              )}
            </>
          )}
          <Text style={styles.disclaimer}>{assessment?.disclaimer}</Text>
          <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>{t("earlyUnderstood")}</Text>
          </Pressable>
        </View>
      </Modal>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  level: { fontSize: typography.size.xxs, fontWeight: "900" },
  body: {
    marginTop: 5,
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  evaluateButton: {
    marginTop: -8,
    alignSelf: "flex-start",
    marginLeft: 62,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  evaluateText: {
    fontSize: typography.size.xs,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    paddingBottom: 38,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: typography.size.lg,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  sheetLevel: { marginTop: 3, fontSize: typography.size.sm, fontWeight: "800" },
  summary: {
    marginTop: spacing.lg,
    color: colors.textPrimary,
    fontSize: typography.size.md,
    lineHeight: 24,
    fontWeight: "600",
  },
  signalsBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  boxLabel: {
    fontSize: typography.size.xs,
    fontWeight: "900",
    color: colors.textSecondary,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  signalText: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  specialty: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#fffbeb",
    color: "#92400e",
    fontSize: typography.size.sm,
    fontWeight: "700",
  },
  redFlagBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  emergencyCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  emergencyHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  inlineSigns: { marginTop: spacing.sm, gap: 4 },
  inlineSign: {
    color: "#991b1b",
    fontSize: typography.size.xs,
    lineHeight: 18,
    fontWeight: "700",
  },
  redFlagTitle: {
    color: "#b91c1c",
    fontSize: typography.size.md,
    fontWeight: "900",
  },
  redFlagBody: {
    marginTop: spacing.sm,
    color: "#7f1d1d",
    fontSize: typography.size.sm,
    lineHeight: 21,
  },
  emergencyButton: {
    marginTop: spacing.md,
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emergencyText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: typography.size.md,
  },
  familySent: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: "#047857",
    fontSize: typography.size.xs,
    fontWeight: "800",
  },
  familyPending: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: "#92400e",
    fontSize: typography.size.xs,
    fontWeight: "800",
  },
  disclaimer: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    lineHeight: 18,
    fontStyle: "italic",
  },
  closeButton: {
    marginTop: spacing.lg,
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontWeight: "900", fontSize: typography.size.sm },
});
