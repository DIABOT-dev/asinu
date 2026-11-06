import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import {
  getNotificationPreferences,
  type NotificationPreferences,
} from "../notifications/notifications.api";
import { useAuthStore } from "../auth/auth.store";
import { checkNotificationPermission } from "../../lib/notifications";
import {
  subscribeNotificationPermissionChanged,
  subscribeTaskReminderPreferenceChanged,
} from "../../lib/device-permission-events";

export function useReminderConfigPreferences() {
  const token = useAuthStore((state) => state.token);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermissionGranted, setNotificationPermissionGranted] =
    useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let request = 0;
      setPrefs(null);
      setLoading(true);
      setNotificationPermissionGranted(false);
      const load = async () => {
        const version = ++request;
        const current = () =>
          active &&
          request === version &&
          useAuthStore.getState().token === token;
        try {
          const [preferences, granted] = await Promise.all([
            getNotificationPreferences(),
            checkNotificationPermission(),
          ]);
          if (!preferences.ok)
            throw new Error("Reminder preference unavailable");
          if (current()) {
            setPrefs(preferences);
            setNotificationPermissionGranted(granted);
          }
        } catch {
          if (current()) {
            setPrefs(null);
            setNotificationPermissionGranted(false);
          }
        } finally {
          if (current()) setLoading(false);
        }
      };
      void load();
      const reload = () => {
        void load();
      };
      const unsubscribeNative = subscribeNotificationPermissionChanged(reload);
      const unsubscribeTask = subscribeTaskReminderPreferenceChanged(reload);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") reload();
      });
      return () => {
        active = false;
        request++;
        unsubscribeNative();
        unsubscribeTask();
        subscription.remove();
      };
    }, [token])
  );
  return { prefs, setPrefs, loading, notificationPermissionGranted };
}
