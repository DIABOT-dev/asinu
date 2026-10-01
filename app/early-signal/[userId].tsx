import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { Screen } from "../../src/components/Screen";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import {
  earlySignalApi,
  type EarlySignalAssessment,
} from "../../src/features/early-signal/early-signal.api";
import { useGuardedRouter as useRouter } from "../../src/hooks/useGuardedRouter";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { radius, spacing, typography } from "../../src/styles";

const severityPresentation = {
  monitor: {
    key: "earlyMonitor",
    color: "#047857",
    icon: "leaf-outline" as const,
  },
  see_doctor: {
    key: "earlySeeDoctor",
    color: "#b45309",
    icon: "medical-outline" as const,
  },
  urgent: {
    key: "earlyUrgent",
    color: "#dc2626",
    icon: "warning-outline" as const,
  },
};

export default function FamilyEarlySignalScreen() {
  const router = useRouter();
  const { userId: rawUserId } = useLocalSearchParams<{ userId: string }>();
  const userId = Number(rawUserId);
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { t } = useTranslation("tree");
  const { t: tCommon } = useTranslation("common");
  const [assessment, setAssessment] = useState<EarlySignalAssessment | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const presentation = useMemo(
    () => severityPresentation[assessment?.severity ?? "monitor"],
    [assessment?.severity]
  );

  const load = useCallback(async () => {
    if (!Number.isInteger(userId) || userId <= 0) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setAssessment(await earlySignalApi.latest(userId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const callFamilyMember = useCallback(() => {
    if (assessment?.user_phone)
      void Linking.openURL(`tel:${assessment.user_phone}`);
  }, [assessment?.user_phone]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <ScreenBackButton
          onPress={() => router.back()}
          accessibilityLabel={tCommon("back")}
        />
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {t("earlyTitle")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textSecondary }}>
            {tCommon("loading")}
          </Text>
        </View>
      ) : error || !assessment ? (
        <View style={styles.state}>
          <Ionicons
            name="cloud-offline-outline"
            size={36}
            color={colors.textSecondary}
          />
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
            {t("earlyErrorTitle")}
          </Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>
            {t("earlyErrorBody")}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => void load()}
          >
            <Text style={styles.retryText}>{t("earlyRetry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.hero,
              {
                backgroundColor: presentation.color + "0D",
                borderColor: presentation.color + "35",
              },
            ]}
          >
            <Ionicons
              name={presentation.icon}
              size={32}
              color={presentation.color}
            />
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {assessment.trigger_type === "weekly"
                ? t("earlyWeeklyFor", { name: assessment.user_name })
                : t("earlyFor", { name: assessment.user_name })}
            </Text>
            <Text style={[styles.level, { color: presentation.color }]}>
              {t(presentation.key)}
            </Text>
          </View>

          {assessment.is_red_flag ? (
            <View style={styles.redFlagBox} accessibilityRole="alert">
              <Text style={styles.redFlagTitle}>{t("earlyRedFlagTitle")}</Text>
              <Text style={styles.redFlagBody}>{assessment.summary}</Text>
              <Pressable
                style={styles.emergencyButton}
                onPress={() => void Linking.openURL("tel:115")}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.primaryActionText}>
                  {t("earlyCall115")}
                </Text>
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
            </View>
          ) : (
            <View
              style={[
                styles.resultCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summary, { color: colors.textPrimary }]}>
                {assessment.summary}
              </Text>
              {!!assessment.signals.length && (
                <View style={styles.signals}>
                  {assessment.signals.map((signal) => (
                    <View key={signal} style={styles.signalRow}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: presentation.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.signalText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {signal}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {assessment.suggested_specialty && (
                <Text style={styles.specialty}>
                  {t("earlySpecialty", {
                    specialty: assessment.suggested_specialty,
                  })}
                </Text>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionButton,
                !assessment.user_phone && styles.actionDisabled,
              ]}
              onPress={callFamilyMember}
              disabled={!assessment.user_phone}
            >
              <Ionicons name="call-outline" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>
                {t("earlyCallPerson", { name: assessment.user_name })}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryAction}
              onPress={() => router.push("/doctor-consultation" as never)}
            >
              <Ionicons
                name="medical-outline"
                size={20}
                color={colors.primary}
              />
              <Text
                style={[styles.secondaryActionText, { color: colors.primary }]}
              >
                {t("earlyConsult")}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            {assessment.disclaimer}
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.size.lg,
    fontWeight: "900",
  },
  headerSpacer: { width: 44 },
  state: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  stateTitle: {
    fontSize: typography.size.lg,
    fontWeight: "900",
    textAlign: "center",
  },
  stateBody: {
    fontSize: typography.size.sm,
    lineHeight: 21,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    borderRadius: radius.full,
    justifyContent: "center",
  },
  retryText: { color: "#fff", fontSize: typography.size.sm, fontWeight: "900" },
  content: { padding: spacing.lg, gap: spacing.md },
  hero: {
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xl,
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: typography.size.xl,
    lineHeight: 30,
    fontWeight: "900",
  },
  level: { fontSize: typography.size.sm, fontWeight: "900" },
  resultCard: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1 },
  summary: { fontSize: typography.size.md, lineHeight: 25, fontWeight: "700" },
  signals: { marginTop: spacing.md, gap: spacing.sm },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, marginTop: 6, borderRadius: 4 },
  signalText: { flex: 1, fontSize: typography.size.sm, lineHeight: 21 },
  specialty: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#fffbeb",
    color: "#92400e",
    fontSize: typography.size.sm,
    fontWeight: "800",
  },
  redFlagBox: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  redFlagTitle: {
    color: "#b91c1c",
    fontSize: typography.size.lg,
    fontWeight: "900",
  },
  redFlagBody: {
    marginTop: spacing.sm,
    color: "#7f1d1d",
    fontSize: typography.size.sm,
    lineHeight: 22,
  },
  emergencyButton: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
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
  actions: { gap: spacing.sm },
  actionButton: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#0f9f8f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actionDisabled: { opacity: 0.45 },
  primaryActionText: {
    color: "#fff",
    fontSize: typography.size.sm,
    fontWeight: "900",
  },
  secondaryAction: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#ecfdf5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryActionText: { fontSize: typography.size.sm, fontWeight: "900" },
  disclaimer: {
    paddingHorizontal: spacing.sm,
    fontSize: typography.size.xs,
    lineHeight: 19,
    fontStyle: "italic",
    textAlign: "center",
  },
});
