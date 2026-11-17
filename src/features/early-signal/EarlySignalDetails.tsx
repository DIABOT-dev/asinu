import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type {
  EarlySignalAssessment,
  EarlySignalSeverity,
} from "./early-signal.api";

type Level = EarlySignalSeverity | "attention" | null;
type Props = {
  assessment: EarlySignalAssessment | null;
  level: Level;
  redFlag: boolean;
  summary?: string;
  signals: string[];
  loading: boolean;
  evaluating: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onEvaluate: () => void | Promise<void>;
  onEmergency?: () => void;
};
const levels = {
  monitor: {
    labelKey: "earlyMonitor",
    icon: "leaf-outline",
    color: "#047857",
    tint: "#EAF7F1",
  },
  attention: {
    labelKey: "earlyAttention",
    icon: "alert-circle-outline",
    color: "#9A5B08",
    tint: "#FFF6E7",
  },
  see_doctor: {
    labelKey: "earlySeeDoctor",
    icon: "medical-outline",
    color: "#9A5B08",
    tint: "#FFF6E7",
  },
  urgent: {
    labelKey: "earlyUrgent",
    icon: "warning-outline",
    color: "#B42332",
    tint: "#FFF0F0",
  },
} as const;

export function EarlySignalDetails({
  assessment,
  level,
  redFlag,
  summary,
  signals,
  loading,
  evaluating,
  loadFailed,
  onRetry,
  onEvaluate,
  onEmergency,
}: Props) {
  const { t, i18n } = useTranslation("tree");
  const { colors, isDark } = useThemeColors();
  const hasData = !!assessment || level !== null;
  const urgent = redFlag;
  const status = level ? levels[level] : null;
  const urgentSigns = [...new Set(assessment?.urgent_signs ?? [])];
  const recorded = [...new Set(signals)].filter(
    (signal) => !urgentSigns.includes(signal)
  );
  const created = assessment?.created_at
    ? new Date(assessment.created_at)
    : null;
  const updated =
    created && Number.isFinite(created.getTime())
      ? new Intl.DateTimeFormat(
          i18n?.language?.startsWith("vi") ? "vi-VN" : "en-GB",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        ).format(created)
      : null;
  const primary = (
    label: string,
    onPress: () => void | Promise<void>,
    testID: string
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading || evaluating}
      accessibilityState={{ disabled: loading || evaluating, busy: evaluating }}
      onPress={onPress}
      style={[
        styles.primary,
        {
          backgroundColor: colors.primaryText,
          opacity: loading || evaluating ? 0.55 : 1,
        },
      ]}
    >
      {evaluating ? (
        <ActivityIndicator color="#F4FFFC" />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
  const retry = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("earlyRetry")}
      onPress={onRetry}
      disabled={loading || evaluating}
      style={[styles.retry, { borderColor: colors.border }]}
      testID="early-signal-retry"
    >
      <Ionicons name="refresh-outline" size={20} color={colors.primaryText} />
      <Text style={[styles.buttonText, { color: colors.primaryText }]}>
        {t("earlyRetry")}
      </Text>
    </Pressable>
  );
  const list = (
    items: string[],
    title: string,
    testID: string,
    critical = false
  ) =>
    items.length > 0 && (
      <View style={styles.section} testID={testID}>
        <Text
          accessibilityRole="header"
          style={[
            styles.sectionTitle,
            { color: critical ? "#B42332" : colors.textPrimary },
          ]}
        >
          {title}
        </Text>
        {items.map((item, index) => (
          <View
            key={item}
            style={[
              styles.signal,
              {
                borderBottomColor: colors.border,
                borderBottomWidth:
                  index < items.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            <Ionicons
              name={critical ? "warning-outline" : "ellipse"}
              size={critical ? 18 : 6}
              color={critical ? "#B42332" : colors.primaryText}
              style={styles.marker}
            />
            <Text
              selectable
              style={[
                styles.body,
                styles.signalText,
                { color: colors.textPrimary },
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>
    );

  if (!hasData && loading)
    return (
      <View
        testID="early-signal-loading"
        style={styles.content}
        accessibilityRole="progressbar"
        accessibilityLabel={t("earlyLoading")}
      >
        <View
          style={[
            styles.skeleton,
            { height: 80, backgroundColor: colors.surfaceMuted },
          ]}
        />
        <View
          style={[
            styles.skeleton,
            { height: 24, width: "60%", backgroundColor: colors.surfaceMuted },
          ]}
        />
        <View
          style={[
            styles.skeleton,
            { height: 56, backgroundColor: colors.surfaceMuted },
          ]}
        />
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {t("earlyLoading")}
        </Text>
      </View>
    );
  if (!hasData && loadFailed)
    return (
      <View testID="early-signal-load-error" style={styles.empty}>
        <Ionicons
          name="cloud-offline-outline"
          size={32}
          color={colors.textSecondary}
        />
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.textPrimary }]}
        >
          {t("earlyErrorTitle")}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t("earlyErrorBody")}
        </Text>
        {retry}
      </View>
    );
  if (!hasData)
    return (
      <View testID="early-signal-empty" style={styles.empty}>
        <Ionicons name="pulse-outline" size={32} color={colors.primaryText} />
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.textPrimary }]}
        >
          {t("earlyNoAssessment")}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t("earlyEmpty")}
        </Text>
        {primary(t("earlyEvaluate"), onEvaluate, "early-signal-evaluate")}
      </View>
    );

  return (
    <View testID="early-signal-details" style={styles.content}>
      {updated && (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {t("earlyUpdatedAt", { time: updated })}
        </Text>
      )}
      {status && (
        <View
          style={[
            styles.status,
            { backgroundColor: isDark ? colors.surfaceMuted : status.tint },
          ]}
          accessibilityRole={urgent ? "alert" : undefined}
        >
          <View style={styles.statusHeading}>
            <Ionicons name={status.icon} size={30} color={status.color} />
            <View style={styles.statusCopy}>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                {t("earlyLevelHeading")}
              </Text>
              <Text
                accessibilityRole="header"
                testID="early-signal-level"
                style={[styles.level, { color: status.color }]}
              >
                {t(redFlag ? "earlyRedFlagTitle" : status.labelKey)}
              </Text>
            </View>
          </View>
          {urgent && onEmergency && (
            <Pressable
              testID="early-signal-emergency"
              accessibilityRole="button"
              accessibilityLabel={t("earlyCall115")}
              onPress={onEmergency}
              style={[styles.primary, { backgroundColor: status.color }]}
            >
              <Ionicons name="call-outline" size={21} color="#FFF8F6" />
              <Text style={styles.primaryText}>{t("earlyCall115")}</Text>
            </Pressable>
          )}
          {!!summary && (
            <Text
              selectable
              style={[styles.body, { color: colors.textPrimary }]}
            >
              {summary}
            </Text>
          )}
        </View>
      )}
      {list(
        urgentSigns,
        t("earlyUrgentSignals"),
        "early-signal-urgent-signs",
        true
      )}
      {list(recorded, t("earlyRecordedSignals"), "early-signal-recorded-signs")}
      {!!assessment?.suggested_specialty && (
        <View style={styles.section} testID="early-signal-next-step">
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: colors.textPrimary }]}
          >
            {t("earlyNextStep")}
          </Text>
          <View style={styles.specialty}>
            <Ionicons
              name="medical-outline"
              size={22}
              color={colors.primaryText}
            />
            <Text
              selectable
              style={[
                styles.body,
                styles.signalText,
                { color: colors.textPrimary },
              ]}
            >
              {t("earlySpecialty", {
                specialty: assessment.suggested_specialty,
              })}
            </Text>
          </View>
        </View>
      )}
      {assessment?.is_red_flag && (
        <View style={styles.family} testID="early-signal-family-status">
          <Ionicons
            name={
              assessment.family_notified_at
                ? "checkmark-circle-outline"
                : "information-circle-outline"
            }
            size={22}
            color={
              assessment.family_notified_at
                ? colors.primaryText
                : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.body,
              styles.signalText,
              { color: colors.textPrimary },
            ]}
          >
            {t(
              assessment.family_notified_at
                ? "earlyFamilySent"
                : "earlyFamilyUnavailable"
            )}
          </Text>
        </View>
      )}
      {loadFailed && (
        <View style={styles.section}>
          <Text
            accessibilityRole="alert"
            style={[styles.body, { color: colors.textSecondary }]}
          >
            {t("earlyRefreshError")}
          </Text>
          {retry}
        </View>
      )}
      {!assessment &&
        !loading &&
        !loadFailed &&
        primary(t("earlyEvaluate"), onEvaluate, "early-signal-evaluate")}
      {!!assessment?.disclaimer && (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {assessment.disclaimer}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 20 },
  status: { padding: 16, borderRadius: 18, gap: 12 },
  statusHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusCopy: { flex: 1, minWidth: 0, gap: 3 },
  level: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 25 },
  caption: { fontSize: 13, lineHeight: 20 },
  section: { gap: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 25,
    marginBottom: 4,
  },
  signal: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  signalText: { flex: 1, minWidth: 0 },
  marker: { marginTop: 9 },
  specialty: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  family: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  primary: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: {
    color: "#F4FFFC",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  empty: { gap: 14, paddingVertical: 8 },
  skeleton: { borderRadius: 12 },
});
