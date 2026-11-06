import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueuedModal } from "../../components/QueuedModal";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { isDoctorFeaturesEnabled } from "../../lib/appEnv";
import { useSpecialistSharingPermission } from "./useSpecialistSharingPermission";

export function SpecialistSharingPermission() {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const sharing = useSpecialistSharingPermission();
  if (!isDoctorFeaturesEnabled) return null;
  const action = sharing.decision?.enabled
    ? "grant_consent"
    : "withdraw_consent";
  const disabled =
    sharing.loading ||
    sharing.failed ||
    sharing.busy ||
    sharing.enabled === null ||
    !!sharing.decision;
  return (
    <>
      <View style={styles.row}>
        <Ionicons
          name="finger-print-outline"
          size={22}
          color={colors.primaryDark}
          style={styles.icon}
        />
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t("specialistSharing")}
          </Text>
          {sharing.failed && (
            <Text style={[styles.error, { color: colors.textSecondary }]}>
              {t("privacySettingsError")}
            </Text>
          )}
        </View>
        {sharing.loading || sharing.busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}
        {sharing.failed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("privacyRetry")}
            onPress={() => void sharing.refresh()}
            style={styles.retry}
          >
            <Ionicons name="refresh" size={22} color={colors.primaryText} />
          </Pressable>
        ) : (
          <Switch
            accessibilityLabel={t("specialistSharing")}
            accessibilityState={{
              checked: sharing.enabled === true,
              disabled,
              busy: sharing.loading || sharing.busy,
            }}
            disabled={disabled}
            value={sharing.enabled === true}
            onValueChange={sharing.request}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        )}
      </View>
      <QueuedModal
        visible={!!sharing.decision}
        transparent
        animationType="fade"
        onRequestClose={sharing.cancel}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("privacyCancel")}
          onPress={sharing.cancel}
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[styles.dialog, { backgroundColor: colors.background }]}
          >
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {t(`privacyConfirmTitle_${action}`)}
            </Text>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.details}
            >
              {sharing.decision?.enabled === false && (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.warning,
                    {
                      backgroundColor: colors.danger + "12",
                      borderColor: colors.danger + "45",
                    },
                  ]}
                >
                  <Text
                    style={[styles.warningTitle, { color: colors.textPrimary }]}
                  >
                    {t("privacyCancellationWarningTitle")}
                  </Text>
                  <Text style={[styles.body, { color: colors.textPrimary }]}>
                    {t("privacyCancellationWarningBody")}
                  </Text>
                </View>
              )}
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {t(`privacyConfirmBody_${action}`)}
              </Text>
              {sharing.saveError && (
                <Text
                  accessibilityRole="alert"
                  style={[styles.body, { color: colors.danger }]}
                >
                  {t("privacyRequestError")}
                </Text>
              )}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`privacyConfirmButton_${action}`)}
              accessibilityState={{
                disabled: sharing.busy,
                busy: sharing.busy,
              }}
              disabled={sharing.busy}
              onPress={() => void sharing.confirm()}
              style={[
                styles.button,
                { backgroundColor: colors.primaryText },
                sharing.busy && styles.disabled,
              ]}
            >
              {sharing.busy && <ActivityIndicator color={colors.background} />}
              <Text style={[styles.buttonText, { color: colors.background }]}>
                {t(`privacyConfirmButton_${action}`)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("privacyCancel")}
              disabled={sharing.busy}
              onPress={sharing.cancel}
              style={[styles.button, sharing.busy && styles.disabled]}
            >
              <Text
                style={[styles.buttonText, { color: colors.textSecondary }]}
              >
                {t("privacyCancel")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </QueuedModal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { width: 28 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 15, fontWeight: "600" },
  error: { fontSize: 12 },
  retry: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "85%",
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  title: { fontSize: 22, lineHeight: 30, fontWeight: "700" },
  scroll: { flexShrink: 1, flexGrow: 0 },
  details: { gap: 14 },
  warning: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 8 },
  warningTitle: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 23 },
  button: {
    minHeight: 52,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  buttonText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.5 },
});
