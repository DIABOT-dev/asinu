import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useGuardedRouter } from "../hooks/useGuardedRouter";
import { useScaledTypography } from "../hooks/useScaledTypography";
import { useThemeColors } from "../hooks/useThemeColors";
import { useAuthStore } from "../features/auth/auth.store";
import {
  checkinCallApi,
  type CheckinCallSettings,
} from "../features/checkin-call/checkin-call.api";
import { apiClient, getApiErrorMessage } from "../lib/apiClient";
import { showToast } from "../stores/toast.store";
import { colors, spacing } from "../styles";
import { AppAlertModal, type AlertButton } from "./AppAlertModal";
import { ScaledText as Text } from "./ScaledText";
import { AndroidCallAccessCard } from '../features/checkin-call/AndroidCallAccessCard';

type Dialog = { kind: "confirm"; enabled: boolean } | { kind: "access" };

export function HomeCheckinCallControl({ userId }: { userId: string }) {
  const router = useGuardedRouter();
  const { t } = useTranslation("checkinCall");
  const { t: tc } = useTranslation("common");
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography), [typography, isDark]);
  const token = useAuthStore((state) => state.token);
  const [settings, setSettings] = useState<CheckinCallSettings | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [noContacts, setNoContacts] = useState(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const requestVersion = useRef(0);
  const saveInFlight = useRef(false);
  const settingsOwner = useRef({ userId, token });
  const sameSession = settingsOwner.current.userId === userId && settingsOwner.current.token === token;

  const isCurrentAuth = useCallback(
    (requestToken: string | null) => {
      const auth = useAuthStore.getState();
      return mounted.current && String(auth.profile?.id) === userId && auth.token === requestToken;
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    const requestToken = useAuthStore.getState().token;
    if (!focused.current || saveInFlight.current || !requestToken || !isCurrentAuth(requestToken)) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const [status, result] = await Promise.all([
        apiClient<{ isAnTam: boolean; callCenterEnabled?: boolean }>("/api/subscriptions/status"),
        checkinCallApi.settings(),
      ]);
      if (version !== requestVersion.current || !isCurrentAuth(requestToken)) return;
      setSettings(result.settings);
      const access = status.callCenterEnabled ?? status.isAnTam;
      setAllowed(access);
      if (!access) setDialog(current => current?.kind === "confirm" ? { kind: "access" } : current);
      setNoContacts(result.contacts?.length === 0);
    } catch (e) {
      if (version !== requestVersion.current || !isCurrentAuth(requestToken)) return;
      // A failed revalidation does not mean the saved setting was turned off.
      // Retain the display, but block changes until access can be checked again.
      setLoadFailed(true);
      setDialog(current => current?.kind === "confirm" ? null : current);
      showToast(getApiErrorMessage(e, tc), "error", 5000);
    } finally {
      if (version === requestVersion.current && isCurrentAuth(requestToken)) setLoading(false);
    }
  }, [isCurrentAuth, tc]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestVersion.current++; };
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setDialog(null);
    if (settingsOwner.current.userId !== userId || settingsOwner.current.token !== token) {
      settingsOwner.current = { userId, token };
      setAllowed(null);
      setSettings(null);
      setNoContacts(false);
      setLoadFailed(false);
    }
    // Keep the last confirmed value visible when returning from another tab.
    // The refresh still reconciles it with the current backend setting/access.
    setLoading(true);
    void refresh();
    return () => {
      focused.current = false;
      requestVersion.current++;
      setDialog(null);
    };
  }, [refresh, token, userId]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => {
      if (next === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const closeDialog = () => { if (!saveInFlight.current) setDialog(null); };
  const navigate = (route: "/subscription" | "/care-circle") => {
    if (focused.current && isCurrentAuth(useAuthStore.getState().token)) router.push(route);
  };
  const openConfirmation = (enabled: boolean) => {
    if (loading || loadFailed || saveInFlight.current || dialog || allowed === null || !sameSession || !focused.current || !isCurrentAuth(token)) return;
    setDialog(allowed ? { kind: "confirm", enabled } : { kind: "access" });
  };
  const confirm = async (enabled: boolean) => {
    const requestToken = useAuthStore.getState().token;
    if (saveInFlight.current || loadFailed || !settings || !allowed || !sameSession || !focused.current || requestToken !== token || !isCurrentAuth(requestToken)) return;
    saveInFlight.current = true;
    requestVersion.current++;
    setLoading(false);
    setSaving(true);
    try {
      const result = await checkinCallApi.setEnabled(enabled);
      if (!isCurrentAuth(requestToken) || !focused.current) return;
      if (!result.ok || result.settings.enabled !== enabled) throw new Error(t("homeControl.updateFailed"));
      setSettings(result.settings);
      showToast(t(enabled ? "homeControl.savedOnTitle" : "homeControl.savedOffTitle"), "success");
    } catch (e) {
      if (isCurrentAuth(requestToken) && focused.current) showToast(getApiErrorMessage(e, tc), "error", 5000);
    } finally {
      saveInFlight.current = false;
      if (mounted.current) {
        setSaving(false);
        // Reconcile canonical state, including returning while a save is pending.
        void refresh();
      }
    }
  };

  const enabled = sameSession && allowed === true && settings?.enabled === true;
  const busy = loading || saving || loadFailed || allowed === null || !sameSession;
  const isConfirmOn = dialog?.kind === "confirm" && dialog.enabled;
  const warnNoContacts = isConfirmOn && noContacts;
  const dialogTitle = dialog?.kind === "access" ? t("accessRequiredTitle")
    : t(isConfirmOn ? "homeControl.confirmOnTitle" : "homeControl.confirmOffTitle");
  const dialogBody = dialog?.kind === "access" ? t("accessRequiredBody")
    : t(isConfirmOn ? "homeControl.onBody" : "homeControl.offBody");
  const buttons: AlertButton[] = dialog?.kind === "confirm" ? [
    {
      text: t(dialog.enabled ? "homeControl.turnOn" : "homeControl.turnOff"),
      variant: dialog.enabled ? "primary" : "destructive",
      icon: dialog.enabled ? "phone" : undefined,
      onPress: () => confirm(dialog.enabled),
    },
    ...(warnNoContacts ? [{
      text: t("manageCareCircle"),
      variant: "outline" as const,
      style: "cancel" as const,
      icon: "account-multiple" as const,
      onPress: () => navigate("/care-circle"),
    }] : []),
    {
      text: tc("cancel"),
      variant: isConfirmOn ? "text" as const : undefined,
      style: "cancel" as const,
    },
  ] : [
    { text: `${t("viewPlans")} →`, variant: "primary", onPress: () => navigate("/subscription") },
    { text: tc("later"), variant: "text", style: "cancel" },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Ionicons name="call-outline" size={28} color={colors.primaryDark} />
        <View style={styles.copy}><Text style={styles.title}>{t("homeControl.title")}</Text></View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t("homeControl.title")}
          accessibilityState={{ checked: enabled, disabled: busy || !!dialog, busy: loading || saving }}
          value={enabled}
          disabled={busy || !!dialog}
          hitSlop={12}
          trackColor={{ false: colors.border, true: colors.primaryDark }}
          onValueChange={openConfirmation}
        />
      </View>
      {!loading && loadFailed && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          style={({ pressed }) => [styles.link, (pressed || saving) && styles.dimmed]}
          onPress={() => void refresh()}
        >
          <Text style={styles.linkText}>{tc("retry")}</Text>
          <Ionicons name="refresh-outline" size={20} color={colors.primaryDark} />
        </Pressable>
      )}
      {enabled && <AndroidCallAccessCard onlyWhenNeeded />}
      <AppAlertModal
        queued
        visible={!!dialog}
        title={dialogTitle}
        message={dialogBody}
        headerImage={isConfirmOn ? doctorHeaderArt : undefined}
        showCloseButton={isConfirmOn}
        titleAlign={isConfirmOn ? "left" : "center"}
        messageAlign={isConfirmOn ? "left" : "center"}
        icon={isConfirmOn ? undefined : {
          name: dialog?.kind === "access" ? "lock-outline" : "phone-outline",
          color: colors.primaryDark,
        }}
        buttons={buttons}
        stackButtons
        scrollable
        onDismiss={closeDialog}
      >
        {warnNoContacts ? (
          <View style={styles.warnCard} accessibilityLabel={t("noContactsWarning.title")}>
            <View style={styles.warnIconBadge}>
              <Ionicons name="shield-checkmark" size={18} color="#1d9c94" />
            </View>
            <View style={styles.warnTextWrap}>
              <Text style={styles.srOnly}>{t("noContactsWarning.title")}</Text>
              <Text style={styles.warnBody}>{t("noContactsWarning.body")}</Text>
            </View>
          </View>
        ) : null}
      </AppAlertModal>
    </View>
  );
}

let doctorHeaderArt: any = null;
try {
  doctorHeaderArt = require("../../assets/images/checkin-call/checkin_call_confirm_doctor_art.png");
} catch {}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    root: { paddingVertical: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    copy: { flex: 1, minWidth: 0 },
    title: { fontSize: typography.size.md, fontWeight: "700", color: colors.textPrimary },
    link: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    linkText: { flexShrink: 1, fontSize: typography.size.sm, fontWeight: "600", color: colors.textPrimary },
    dimmed: { opacity: 0.5 },
    warnCard: {
      backgroundColor: "#f1f8fa",
      borderRadius: 16,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: spacing.md,
    },
    warnIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#ddf2f3",
      alignItems: "center",
      justifyContent: "center",
    },
    warnTextWrap: {
      flex: 1,
    },
    srOnly: {
      position: "absolute",
      width: 0,
      height: 0,
      opacity: 0,
    },
    warnBody: {
      fontSize: typography.size.sm,
      color: "#2e4d86",
      lineHeight: 20,
    },
  });
}
