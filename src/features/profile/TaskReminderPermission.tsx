import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useTaskReminderPreference } from "./useTaskReminderPreference";

export function TaskReminderPermission() {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const state = useTaskReminderPreference();
  const disabled = state.loading || state.pending || !state.available;
  return (
    <View style={styles.row}>
      <Ionicons
        name="alarm-outline"
        size={22}
        color={colors.primaryDark}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t("taskReminders")}
        </Text>
        {state.failed && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t("taskRemindersStatusUnavailable")}
          </Text>
        )}
      </View>
      {state.loading || state.pending ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
      {state.failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("devicePermissionRetry", {
            name: t("taskReminders"),
          })}
          onPress={state.refresh}
          style={styles.retry}
        >
          <Ionicons name="refresh" size={22} color={colors.primaryDark} />
        </Pressable>
      ) : (
        <Switch
          accessibilityLabel={t("taskReminders")}
          accessibilityState={{
            checked: state.enabled,
            disabled,
            busy: state.loading || state.pending,
          }}
          value={state.enabled}
          disabled={disabled}
          onValueChange={(value) => void state.change(value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      )}
    </View>
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
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 12 },
  retry: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
