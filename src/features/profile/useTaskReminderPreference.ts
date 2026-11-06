import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../notifications/notifications.api";
import { useAuthStore } from "../auth/auth.store";
import { checkNotificationPermission } from "../../lib/notifications";
import { subscribeTaskReminderPreferenceChanged } from "../../lib/device-permission-events";
import { showToast } from "../../stores/toast.store";
import { useDevicePermission } from "./useDevicePermission";

export function useTaskReminderPreference() {
  const { t } = useTranslation("settings");
  const token = useAuthStore((state) => state.token);
  const native = useDevicePermission("notifications");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const focused = useRef(false);
  const generation = useRef(0);
  const latestRead = useRef(0);
  const operation = useRef<object | null>(null);
  const current = useCallback(
    (version: number) =>
      focused.current &&
      generation.current === version &&
      useAuthStore.getState().token === token,
    [token]
  );

  const refresh = useCallback(async () => {
    const version = generation.current;
    const read = ++latestRead.current;
    setLoading(true);
    try {
      const prefs = await getNotificationPreferences();
      if (!prefs.ok) throw new Error("Reminder preference unavailable");
      if (current(version) && read === latestRead.current) {
        setEnabled(prefs.reminders_enabled === true);
        setFailed(false);
      }
    } catch {
      if (current(version) && read === latestRead.current) {
        setEnabled(null);
        setFailed(true);
      }
    } finally {
      if (current(version) && read === latestRead.current) setLoading(false);
    }
  }, [current]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      generation.current++;
      operation.current = null;
      setEnabled(null);
      setSaving(false);
      void refresh();
      const reload = () => {
        if (focused.current && !operation.current) void refresh();
      };
      const unsubscribe = subscribeTaskReminderPreferenceChanged(reload);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") reload();
      });
      return () => {
        focused.current = false;
        generation.current++;
        latestRead.current++;
        operation.current = null;
        unsubscribe();
        subscription.remove();
      };
    }, [refresh])
  );

  const change = async (next: boolean) => {
    if (
      operation.current ||
      enabled === null ||
      loading ||
      native.loading ||
      native.pending ||
      !native.permission ||
      !current(generation.current)
    )
      return;
    const owner = {};
    const version = generation.current;
    const canRun = () => current(version) && operation.current === owner;
    operation.current = owner;
    latestRead.current++;
    setSaving(true);
    try {
      if (next) {
        await native.change(true);
        if (!canRun()) return;
        const granted = await checkNotificationPermission();
        if (!canRun() || !granted) return;
      }
      const prefs = await updateNotificationPreferences({
        reminders_enabled: next,
      });
      if (!prefs.ok) throw new Error("Reminder preference could not be saved");
      if (canRun()) {
        setEnabled(prefs.reminders_enabled === true);
        setFailed(false);
      }
    } catch {
      if (canRun()) showToast(t("scheduleSaveError"), "error");
    } finally {
      if (canRun()) {
        operation.current = null;
        setSaving(false);
      }
    }
  };

  return {
    enabled: enabled === true && native.permission?.granted === true,
    loading: loading || native.loading,
    pending: saving || native.pending,
    failed: failed || native.failed,
    available: enabled !== null && native.permission !== null,
    refresh: () => {
      void refresh();
      void native.refresh();
    },
    change,
  };
}
