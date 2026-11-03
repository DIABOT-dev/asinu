import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useGuardedRouter } from "../../hooks/useGuardedRouter";
import { useThemeColors } from "../../hooks/useThemeColors";
import { checkNotificationPermission } from "../../lib/notifications";
import {
  subscribeNotificationPermissionChanged,
  subscribeTaskReminderPreferenceChanged,
} from "../../lib/device-permission-events";
import { getNotificationPreferences } from "../notifications/notifications.api";
import { useAuthStore } from "../auth/auth.store";

export function ReminderSettingsEntry() {
  const { t } = useTranslation("profile");
  const { t: ts } = useTranslation("settings");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const focused = useRef(false);
  const request = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    const token = useAuthStore.getState().token;
    setLoading(true);
    const [allowed, prefs] = await Promise.all([
      checkNotificationPermission().catch(() => false),
      getNotificationPreferences().catch(() => null),
    ]);
    if (
      focused.current &&
      version === request.current &&
      useAuthStore.getState().token === token
    ) {
      setGranted(allowed);
      setRemindersEnabled(prefs?.ok ? prefs.reminders_enabled === true : null);
      setLoading(false);
    }
    return allowed && prefs?.ok && prefs.reminders_enabled === true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      const unsubscribePermission = subscribeNotificationPermissionChanged(
        () => {
          if (focused.current) void refresh();
        }
      );
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && focused.current) void refresh();
      });
      const unsubscribeReminders = subscribeTaskReminderPreferenceChanged(
        () => {
          if (focused.current) void refresh();
        }
      );
      return () => {
        focused.current = false;
        request.current++;
        subscription.remove();
        unsubscribePermission();
        unsubscribeReminders();
      };
    }, [refresh])
  );

  const open = async () => {
    if (
      granted !== true ||
      remindersEnabled !== true ||
      loading ||
      !focused.current ||
      inFlight.current
    )
      return;
    const token = useAuthStore.getState().token;
    const version = request.current;
    inFlight.current = true;
    setOpening(true);
    try {
      // Recheck before navigating, including revocation after the row was rendered.
      const [allowed, prefs] = await Promise.all([
        checkNotificationPermission().catch(() => false),
        getNotificationPreferences().catch(() => null),
      ]);
      if (
        !focused.current ||
        version !== request.current ||
        useAuthStore.getState().token !== token
      )
        return;
      setGranted(allowed);
      setRemindersEnabled(prefs?.ok ? prefs.reminders_enabled === true : null);
      if (allowed && prefs?.ok && prefs.reminders_enabled === true)
        router.push("/reminder-config");
    } finally {
      inFlight.current = false;
      if (focused.current && useAuthStore.getState().token === token)
        setOpening(false);
    }
  };

  const disabled =
    granted !== true || remindersEnabled !== true || loading || opening;
  const hint =
    granted === false
      ? "enableNotificationsFirst"
      : remindersEnabled === false
      ? "enableTaskRemindersFirst"
      : remindersEnabled === null && !loading
      ? "taskRemindersStatusUnavailable"
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("reminderSchedule")}
      accessibilityState={{ disabled, busy: loading || opening }}
      disabled={disabled}
      onPress={() => void open()}
      style={({ pressed }) => [
        styles.row,
        disabled && styles.disabled,
        pressed && { opacity: 0.65 },
      ]}
    >
      <Ionicons
        name="alarm-outline"
        size={22}
        color={disabled ? colors.textSecondary : colors.primaryDark}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text
          style={[
            styles.label,
            { color: disabled ? colors.textSecondary : colors.textPrimary },
          ]}
        >
          {t("reminderSchedule")}
        </Text>
        {hint && !loading && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {ts(hint)}
          </Text>
        )}
      </View>
      {(loading || opening) && <ActivityIndicator color={colors.primary} />}
    </Pressable>
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
  hint: { fontSize: 12 },
  disabled: { opacity: 0.55 },
});
