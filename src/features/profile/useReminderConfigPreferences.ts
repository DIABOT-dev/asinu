import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  const [prefs, setPreferences] = useState<NotificationPreferences | null>(null);
  const request = useRef(0);
  // A load begun before a manual/agent save must not overwrite its result.
  const setPrefs: Dispatch<SetStateAction<NotificationPreferences | null>> = useCallback(value => {
    request.current++;
    setPreferences(value);
  }, []);
  const [loading, setLoading] = useState(true);
  const [notificationPermissionGranted, setNotificationPermissionGranted] =
    useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPreferences(null);
      setLoading(true);
      setNotificationPermissionGranted(false);
      const load = async () => {
        const version = ++request.current;
        const current = () =>
          active &&
          request.current === version &&
          useAuthStore.getState().token === token;
        try {
          const [preferences, granted] = await Promise.all([
            getNotificationPreferences(),
            checkNotificationPermission(),
          ]);
          if (!preferences.ok)
            throw new Error("Reminder preference unavailable");
          if (current()) {
            setPreferences(preferences);
            setNotificationPermissionGranted(granted);
          }
        } catch {
          if (current()) {
            setPreferences(null);
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
        request.current++;
        unsubscribeNative();
        unsubscribeTask();
        subscription.remove();
      };
    }, [token])
  );
  return { prefs, setPrefs, loading, notificationPermissionGranted };
}
