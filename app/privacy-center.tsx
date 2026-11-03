import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../src/components/ScaledText";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { AppAlertModal } from "../src/components/AppAlertModal";
import { useGuardedRouter } from "../src/hooks/useGuardedRouter";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { apiClient, getApiErrorMessage } from "../src/lib/apiClient";
import { env } from "../src/lib/env";
import { showToast } from "../src/stores/toast.store";
import { lightColors, radius, spacing } from "../src/styles";

type PrivacyAction =
  | "grant_consent"
  | "withdraw_consent"
  | "export"
  | "anonymize"
  | "delete";
type Receipt = {
  id: string;
  action: PrivacyAction;
  status: string;
  created_at: string;
};
type ThemeColors = ReturnType<typeof useThemeColors>["colors"];

const createRequestId = () => {
  const cryptoObject = (
    globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    }
  );
};

export default function PrivacyCenterScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation("settings");
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [busy, setBusy] = useState<PrivacyAction | null>(null);
  const submitting = useRef(false);
  const [selectedAction, setSelectedAction] = useState<"delete" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptsError, setReceiptsError] = useState(false);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    setReceiptsError(false);
    try {
      const response = await apiClient<{
        ok: boolean;
        data?: {
          items: Receipt[];
        };
      }>(
        `/api/doctor/privacy?tenant_id=${encodeURIComponent(
          env.doctorTenantId
        )}`
      );
      if (!response.ok || !Array.isArray(response.data?.items)) {
        throw new Error("Doctor privacy status is unavailable");
      }
      setReceipts(response.data?.items ?? []);
    } catch {
      setReceiptsError(true);
    } finally {
      setReceiptsLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  const submit = async (action: "export" | "delete") => {
    if (submitting.current) return;
    // Opening an option never sends a request that changes the patient's data.
    if (action !== "export" && selectedAction !== action) return;
    submitting.current = true;
    setBusy(action);
    try {
      const response = await apiClient<{
        ok: boolean;
        data?: Record<string, unknown>;
      }>("/api/doctor/privacy", {
        method: "POST",
        body: {
          tenant_id: env.doctorTenantId,
          action,
          request_id: createRequestId(),
          confirmation: "CONFIRM_DOCTOR_DATA_REQUEST",
          reason: "Patient self-service request from ASINU mobile",
        },
      });
      if (!response.ok || response.data?.action !== action) {
        throw new Error(t("privacyRequestError"));
      }
      setSelectedAction(null);
      await loadReceipts();
      if (action === "export") {
        await Share.share({
          title: t("privacyExportTitle"),
          message: JSON.stringify(response.data ?? {}, null, 2),
        });
      }
      showToast(t(`privacySuccess_${action}`), "success");
    } catch (error) {
      showToast(getApiErrorMessage(error, t, "privacyRequestError"), "error");
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  const closeConfirmation = () => {
    if (submitting.current) return;
    setSelectedAction(null);
  };

  const closeScreen = () => {
    if (submitting.current) return;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };
  const dialogAction = selectedAction;
  const openDeleteConfirmation = () => {
    if (busy !== null || submitting.current || dialogAction) return;
    setSelectedAction("delete");
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, spacing.lg) + spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <ScreenBackButton
            onPress={closeScreen}
            accessibilityLabel={t("privacyBack")}
            disabled={busy !== null}
          />
          <Text accessibilityRole="header" style={styles.title}>
            {t("privacyCenterTitle")}
          </Text>
        </View>
        <View style={styles.actionList}>
          <View style={[styles.actionRow, styles.controlRow]}>
            <View style={styles.copy}>
              <Text style={styles.actionTitle}>
                {t("privacyAction_export")}
              </Text>
              <Text style={styles.actionDescription}>
                {t("privacyDescription_export")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("privacyAction_export")}
              accessibilityState={{
                disabled: busy !== null,
                busy: busy === "export",
              }}
              disabled={busy !== null}
              onPress={() => void submit("export")}
              style={({ pressed }) => [
                styles.exportButton,
                pressed && styles.pressed,
                busy !== null && styles.disabled,
              ]}
            >
              {busy === "export" ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={24}
                  color={colors.primaryText}
                />
              )}
              <Text style={styles.exportButtonText}>
                {t("privacyExportButton")}
              </Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("privacyAction_delete")}
          accessibilityHint={t("privacyDescription_delete")}
          accessibilityState={{ disabled: busy !== null, busy: busy === "delete" }}
          disabled={busy !== null}
          onPress={openDeleteConfirmation}
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.pressed,
            busy !== null && styles.disabled,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={24}
            color={colors.danger}
            style={styles.actionIcon}
          />
          <View style={styles.copy}>
            <Text style={[styles.actionTitle, styles.dangerText]}>
              {t("privacyAction_delete")}
            </Text>
            <Text style={styles.actionDescription}>
              {t("privacyDescription_delete")}
            </Text>
          </View>
          {busy === "delete" && (
            <ActivityIndicator
              accessibilityLabel={t("privacyAction_delete")}
              color={colors.danger}
            />
          )}
        </Pressable>
        {receiptsError ? (
          <View style={styles.loadError}>
            <Text style={styles.empty}>{t("privacySettingsError")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("privacyRetry")}
              disabled={busy !== null || receiptsLoading}
              onPress={() => void loadReceipts()}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmButtonText}>{t("privacyRetry")}</Text>
            </Pressable>
          </View>
        ) : null}
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("privacyHistoryTitle")}
            accessibilityState={{ expanded: showHistory }}
            onPress={() => setShowHistory((value) => !value)}
            style={({ pressed }) => [
              styles.disclosure,
              styles.historyToggle,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={21}
              color={colors.textSecondary}
            />
            <Text style={styles.historyTitle}>{t("privacyHistoryTitle")}</Text>
            <Ionicons
              name={showHistory ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
          {showHistory ? (
            <View style={styles.history}>
              {receiptsLoading ? (
                <ActivityIndicator
                  accessibilityLabel={t("privacyHistoryLoading")}
                  color={colors.primaryText}
                />
              ) : receiptsError ? (
                <>
                  <Text style={styles.empty}>{t("privacyHistoryError")}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("privacyRetry")}
                    onPress={() => void loadReceipts()}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.confirmButtonText}>
                      {t("privacyRetry")}
                    </Text>
                  </Pressable>
                </>
              ) : receipts.length ? (
                receipts.map((receipt) => (
                  <View key={receipt.id} style={styles.receipt}>
                    <View style={styles.receiptHeader}>
                      <Text style={styles.receiptAction}>
                        {t(`privacyAction_${receipt.action}`)}
                      </Text>
                      <Text
                        style={[
                          styles.receiptStatus,
                          receipt.status === "completed" &&
                            styles.receiptComplete,
                        ]}
                      >
                        {t(`privacyStatus_${receipt.status}`, {
                          defaultValue: t("privacyStatus_unknown"),
                        })}
                      </Text>
                    </View>
                    <Text style={styles.receiptMeta}>
                      {new Date(receipt.created_at).toLocaleString(
                        (i18n.resolvedLanguage ?? i18n.language).startsWith(
                          "en"
                        )
                          ? "en-US"
                          : "vi-VN",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.empty}>{t("privacyHistoryEmpty")}</Text>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <AppAlertModal
        queued
        visible={!!dialogAction}
        title={dialogAction ? t(`privacyConfirmTitle_${dialogAction}`) : ""}
        message=""
        icon={{
          background: "none",
          name: "trash-can-outline",
          color: colors.danger,
        }}
        primaryButtonColors={{
          background: colors.primary,
          foreground: lightColors.textPrimary,
        }}
        stackButtons
        scrollable
        onDismiss={closeConfirmation}
        buttons={
          dialogAction
            ? [
                {
                  text: t(`privacyConfirmButton_${dialogAction}`),
                  variant: "destructive",
                  onPress: () => submit(dialogAction),
                },
                { text: t("privacyCancel"), style: "cancel" },
              ]
            : []
        }
      >
        {dialogAction ? (
          <View style={styles.confirmationDetails}>
            <View style={styles.cancellationWarning} accessibilityRole="alert">
              <Text style={styles.cancellationWarningTitle}>
                {t("privacyCancellationWarningTitle")}
              </Text>
              <Text style={styles.cancellationWarningBody}>
                {t("privacyCancellationWarningBody")}
              </Text>
            </View>
            <Text style={styles.confirmationBody}>
              {t(`privacyConfirmBody_${dialogAction}`)}
            </Text>
          </View>
        ) : null}
      </AppAlertModal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
      paddingHorizontal: spacing.xl,
      gap: spacing.xl,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    title: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 32,
    },
    actionList: {
      backgroundColor: 'transparent',
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      minHeight: 88,
    },
    actionIcon: { marginTop: 3 },
    controlRow: { alignItems: "center" },
    confirmationDetails: { gap: spacing.md, marginTop: spacing.md },
    cancellationWarning: {
      gap: spacing.sm,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.danger + "45",
      borderRadius: radius.md,
      backgroundColor: colors.danger + "12",
    },
    cancellationWarningTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 25,
    },
    cancellationWarningBody: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 23,
    },
    confirmationBody: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 23,
    },
    exportButton: {
      minWidth: 56,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
    },
    exportButtonText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "600",
    },
    loadError: { gap: spacing.xs },
    copy: { flex: 1, minWidth: 0, gap: spacing.xs },
    actionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "600",
      lineHeight: 24,
    },
    actionDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    confirmButtonText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    dangerText: { color: colors.danger },
    cancelButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
    },
    disclosure: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    historyToggle: {
      paddingTop: spacing.xl,
    },
    history: { gap: spacing.sm, paddingTop: spacing.sm },
    historyTitle: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
    },
    receipt: {
      paddingVertical: 10,
    },
    receiptAction: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    receiptHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    receiptStatus: {
      flexShrink: 1,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      fontSize: 13,
      fontWeight: "600",
    },
    receiptComplete: {
      color: colors.primaryText,
      backgroundColor: colors.primaryLight,
    },
    receiptMeta: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: spacing.xs,
    },
    empty: { color: colors.textSecondary, fontSize: 14 },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.5 },
  });
