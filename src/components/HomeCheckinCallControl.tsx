import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGuardedRouter } from "../hooks/useGuardedRouter";
import { useScaledTypography } from "../hooks/useScaledTypography";
import { useThemeColors } from "../hooks/useThemeColors";
import { useAuthStore } from "../features/auth/auth.store";
import {
  checkinCallApi,
  type CheckinCallSettings,
} from "../features/checkin-call/checkin-call.api";
import { apiClient, getApiErrorMessage } from "../lib/apiClient";
import { colors, radius, spacing } from "../styles";
import { QueuedModal } from "./QueuedModal";
import { ScaledText as Text } from "./ScaledText";

type Dialog =
  | { kind: "confirm" | "success"; enabled: boolean }
  | { kind: "access" };

export function HomeCheckinCallControl({ userId }: { userId: string }) {
  const router = useGuardedRouter();
  const { t } = useTranslation("checkinCall");
  const { t: tc } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography), [typography, isDark]);
  const token = useAuthStore((state) => state.token);
  const [settings, setSettings] = useState<CheckinCallSettings | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [noContacts, setNoContacts] = useState(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const requestVersion = useRef(0);
  const saveInFlight = useRef(false);
  const closingDialog = useRef(false);
  const navigationAfterDismiss = useRef<(() => void) | null>(null);

  const isCurrentAuth = useCallback(
    (requestToken: string | null) => {
      const auth = useAuthStore.getState();
      return (
        mounted.current &&
        String(auth.profile?.id) === userId &&
        auth.token === requestToken
      );
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    const requestToken = useAuthStore.getState().token;
    if (
      !focused.current ||
      saveInFlight.current ||
      !requestToken ||
      !isCurrentAuth(requestToken)
    )
      return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const [status, result] = await Promise.all([
        apiClient<{ isAnTam: boolean; callCenterEnabled?: boolean }>(
          "/api/subscriptions/status"
        ),
        checkinCallApi.settings(),
      ]);
      if (version !== requestVersion.current || !isCurrentAuth(requestToken))
        return;
      setSettings(result.settings);
      const access = status.callCenterEnabled ?? status.isAnTam;
      setAllowed(access);
      if (!access)
        setDialog((current) =>
          current?.kind === "confirm" ? { kind: "access" } : current
        );
      setNoContacts(result.contacts?.length === 0);
    } catch (e) {
      if (version !== requestVersion.current || !isCurrentAuth(requestToken))
        return;
      setAllowed(null);
      setError(getApiErrorMessage(e, tc));
      setDialog((current) => (current?.kind === "confirm" ? null : current));
    } finally {
      if (version === requestVersion.current && isCurrentAuth(requestToken))
        setLoading(false);
    }
  }, [isCurrentAuth, tc]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setDialog(null);
      setAllowed(null);
      setSettings(null);
      setLoading(true);
      void refresh();
      return () => {
        focused.current = false;
        requestVersion.current++;
        navigationAfterDismiss.current = null;
        setDialog(null);
      };
    }, [refresh, token])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const closeDialog = () => {
    if (saveInFlight.current || closingDialog.current) return;
    closingDialog.current = true;
    setDialog(null);
    setDialogError("");
  };
  const navigateAfterDismiss = (route: "/subscription" | "/care-circle") => {
    if (closingDialog.current || saveInFlight.current) return;
    navigationAfterDismiss.current = () => router.push(route);
    closeDialog();
  };
  const openConfirmation = (enabled: boolean) => {
    if (
      loading ||
      saveInFlight.current ||
      dialog ||
      closingDialog.current ||
      allowed === null
    )
      return;
    setDialogError("");
    setDialog(allowed ? { kind: "confirm", enabled } : { kind: "access" });
  };
  const confirm = async (enabled: boolean) => {
    const requestToken = useAuthStore.getState().token;
    if (
      saveInFlight.current ||
      closingDialog.current ||
      !settings ||
      !allowed ||
      !isCurrentAuth(requestToken)
    )
      return;
    saveInFlight.current = true;
    requestVersion.current++;
    setLoading(false);
    setSaving(true);
    setDialogError("");
    try {
      const result = await checkinCallApi.setEnabled(enabled);
      if (!isCurrentAuth(requestToken) || !focused.current) return;
      if (!result.ok || result.settings.enabled !== enabled)
        throw new Error(t("homeControl.updateFailed"));
      setSettings(result.settings);
      setDialog({ kind: "success", enabled: result.settings.enabled });
    } catch (e) {
      if (isCurrentAuth(requestToken) && focused.current)
        setDialogError(getApiErrorMessage(e, tc));
    } finally {
      saveInFlight.current = false;
      if (mounted.current) {
        setSaving(false);
        // Reconcile permissions and canonical state, including a return during saving.
        void refresh();
      }
    }
  };

  const enabled = allowed === true && settings?.enabled === true;
  const busy = loading || saving || allowed === null;
  const schedule = settings
    ? (() => {
        const [hours, minutes] = settings.checkin_time
          .slice(0, 5)
          .split(":")
          .map(Number);
        const due = hours * 60 + minutes + settings.grace_hours * 60;
        const time = `${String(Math.floor((due % 1440) / 60)).padStart(
          2,
          "0"
        )}:${String(due % 60).padStart(2, "0")}`;
        return t("schedulePreview", {
          time,
          timezone: settings.timezone,
          nextDay: due >= 1440 ? t("nextDay") : "",
        });
      })()
    : "";
  const dialogEnabled = dialog && dialog.kind !== "access" && dialog.enabled;
  const dialogTitle =
    dialog?.kind === "access"
      ? t("accessRequiredTitle")
      : t(
          `homeControl.${dialog?.kind === "success" ? "saved" : "confirm"}${
            dialogEnabled ? "On" : "Off"
          }Title`
        );
  const dialogBody =
    dialog?.kind === "access"
      ? t("accessRequiredBody")
      : t(`homeControl.${dialogEnabled ? "on" : "off"}Body`);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Ionicons name="call-outline" size={28} color={colors.primaryDark} />
        <View style={styles.copy}>
          <Text style={styles.title}>{t("homeControl.title")}</Text>
          <Text style={styles.status}>
            {loading
              ? t("loadingSettings")
              : allowed === null
              ? t("homeControl.unknown")
              : enabled
              ? t("active")
              : t("inactive")}
          </Text>
        </View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t("homeControl.title")}
          accessibilityState={{
            checked: enabled,
            disabled: busy || !!dialog,
            busy: loading || saving,
          }}
          value={enabled}
          disabled={busy || !!dialog}
          hitSlop={12}
          trackColor={{ false: colors.border, true: colors.primaryDark }}
          onValueChange={openConfirmation}
        />
      </View>
      {!loading && allowed !== null && (
        <Text style={styles.description}>
          {allowed
            ? enabled
              ? schedule
              : t("homeControl.offSummary")
            : t("accessRequiredBody")}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!loading && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          style={({ pressed }) => [
            styles.link,
            (pressed || saving) && styles.dimmed,
          ]}
          onPress={() =>
            allowed === null
              ? void refresh()
              : router.push(
                  allowed ? "/checkin-call/settings" : "/subscription"
                )
          }
        >
          <Text style={styles.linkText}>
            {allowed === null
              ? tc("retry")
              : allowed
              ? t("homeControl.configure")
              : t("viewPlans")}
          </Text>
          <Ionicons
            name={allowed === null ? "refresh-outline" : "chevron-forward"}
            size={20}
            color={colors.primaryDark}
          />
        </Pressable>
      )}
      <QueuedModal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
        onDismiss={() => {
          closingDialog.current = false;
          const action = navigationAfterDismiss.current;
          navigationAfterDismiss.current = null;
          if (mounted.current && focused.current) action?.();
        }}
      >
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
            >
              <Ionicons
                name={
                  dialog?.kind === "access"
                    ? "lock-closed-outline"
                    : dialog?.kind === "success"
                    ? "checkmark-circle-outline"
                    : dialogEnabled
                    ? "call-outline"
                    : "pause-circle-outline"
                }
                size={36}
                color={colors.primaryDark}
                style={styles.modalIcon}
              />
              <Text accessibilityRole="header" style={styles.modalTitle}>
                {dialogTitle}
              </Text>
              <Text style={styles.modalBody}>{dialogBody}</Text>
              {dialogEnabled && (
                <Text style={styles.modalBody}>{schedule}</Text>
              )}
              {dialog?.kind === "confirm" && dialog.enabled && noContacts && (
                <Text style={styles.modalBody}>{t("contactSetupHint")}</Text>
              )}
              {!!dialogError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {dialogError}
                </Text>
              )}
            </ScrollView>
            <View style={styles.actions}>
              {dialog?.kind === "confirm" ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    accessibilityState={{ disabled: saving, busy: saving }}
                    style={[
                      styles.button,
                      styles.primaryButton,
                      saving && styles.dimmed,
                    ]}
                    onPress={() => void confirm(dialog.enabled)}
                  >
                    {saving && <ActivityIndicator color={colors.textPrimary} />}
                    <Text style={styles.primaryButtonText}>
                      {saving
                        ? t("homeControl.saving")
                        : t(
                            dialog.enabled
                              ? "homeControl.turnOn"
                              : "homeControl.turnOff"
                          )}
                    </Text>
                  </Pressable>
                  {dialog.enabled && noContacts && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      style={styles.button}
                      onPress={() => navigateAfterDismiss("/care-circle")}
                    >
                      <Text style={styles.linkText}>
                        {t("manageCareCircle")}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    style={styles.button}
                    onPress={closeDialog}
                  >
                    <Text style={styles.buttonText}>{tc("cancel")}</Text>
                  </Pressable>
                </>
              ) : dialog?.kind === "access" ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.button, styles.primaryButton]}
                    onPress={() => navigateAfterDismiss("/subscription")}
                  >
                    <Text style={styles.primaryButtonText}>
                      {t("viewPlans")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={closeDialog}
                  >
                    <Text style={styles.buttonText}>{tc("later")}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.button, styles.primaryButton]}
                  onPress={closeDialog}
                >
                  <Text style={styles.primaryButtonText}>{tc("ok")}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </QueuedModal>
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    root: { paddingVertical: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    copy: { flex: 1, minWidth: 0 },
    title: {
      fontSize: typography.size.md,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    status: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    description: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    error: {
      fontSize: typography.size.sm,
      color: colors.danger,
      marginTop: spacing.sm,
    },
    link: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    linkText: {
      flexShrink: 1,
      fontSize: typography.size.sm,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    dimmed: { opacity: 0.5 },
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.overlay,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "100%",
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalScroll: { flexShrink: 1 },
    modalContent: { padding: spacing.xl, gap: spacing.md },
    modalIcon: { alignSelf: "center" },
    modalTitle: {
      fontSize: typography.size.lg,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    modalBody: { fontSize: typography.size.sm, color: colors.textSecondary },
    actions: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    button: {
      minHeight: 52,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primaryDark,
    },
    primaryButtonText: {
      fontSize: typography.size.sm,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    buttonText: {
      fontSize: typography.size.sm,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
  });
}
