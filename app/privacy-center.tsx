import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../src/components/ScaledText";
import { useGuardedRouter } from "../src/hooks/useGuardedRouter";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { apiClient } from "../src/lib/apiClient";
import { env } from "../src/lib/env";
import { showToast } from "../src/stores/toast.store";
import { radius, spacing } from "../src/styles";

type PrivacyAction = "withdraw_consent" | "export" | "anonymize" | "delete";
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
    },
  );
};
const actions: Array<{
  action: PrivacyAction;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}> = [
  { action: "export", icon: "download-outline" },
  { action: "withdraw_consent", icon: "hand-left-outline" },
  { action: "anonymize", icon: "eye-off-outline", destructive: true },
  { action: "delete", icon: "trash-outline", destructive: true },
];

export default function PrivacyCenterScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<PrivacyAction | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const loadReceipts = async () => {
    try {
      const response = await apiClient<{
        ok: boolean;
        data?: { items: Receipt[] };
      }>("/api/doctor/privacy");
      setReceipts(response.data?.items ?? []);
    } catch {
      setReceipts([]);
    }
  };
  useEffect(() => {
    void loadReceipts();
  }, []);

  const submit = async (action: PrivacyAction, destructive = false) => {
    if (
      destructive &&
      confirmation.trim().toUpperCase() !== t("privacyConfirmPhrase")
    ) {
      showToast(t("privacyConfirmError"), "error");
      return;
    }
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
      if (action === "export")
        await Share.share({
          title: t("privacyExportTitle"),
          message: JSON.stringify(response.data ?? {}, null, 2),
        });
      setConfirmation("");
      await loadReceipts();
      showToast(t("privacyRequestSuccess"), "success");
    } catch {
      showToast(t("privacyRequestError"), "error");
    } finally {
      setBusy(null);
    }
  };

  const topInset = Math.max(insets.top, 16);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("privacyClose")}
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.title}>{t("privacyCenterTitle")}</Text>
        <Text style={styles.lead}>{t("privacyCenterDescription")}</Text>
        <View style={styles.actionList}>
          {actions.map((item) => (
            <View key={item.action} style={styles.actionRow}>
              <Ionicons
                name={item.icon}
                size={22}
                color={item.destructive ? colors.danger : colors.primary}
              />
              <View style={styles.copy}>
                <Text style={styles.actionTitle}>
                  {t(`privacyAction_${item.action}`)}
                </Text>
                <Text style={styles.actionDescription}>
                  {t(`privacyDescription_${item.action}`)}
                </Text>
              </View>
              <Pressable
                disabled={busy !== null}
                onPress={() => void submit(item.action, item.destructive)}
                style={[
                  styles.actionButton,
                  item.destructive && styles.dangerButton,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    item.destructive && styles.dangerButtonText,
                  ]}
                >
                  {busy === item.action
                    ? t("privacyProcessing")
                    : t("privacySubmit")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.confirmSection}>
          <Text style={styles.confirmTitle}>
            {t("privacyVerificationTitle")}
          </Text>
          <Text style={styles.confirmHint}>
            {t("privacyVerificationHint", {
              phrase: t("privacyConfirmPhrase"),
            })}
          </Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setConfirmation}
            placeholder={t("privacyConfirmPhrase")}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={confirmation}
          />
        </View>
        <View style={styles.history}>
          <Text style={styles.historyTitle}>{t("privacyHistoryTitle")}</Text>
          {receipts.length ? (
            receipts.map((receipt) => (
              <View key={receipt.id} style={styles.receipt}>
                <Text style={styles.receiptAction}>
                  {t(`privacyAction_${receipt.action}`)}
                </Text>
                <Text style={styles.receiptMeta}>
                  {new Date(receipt.created_at).toLocaleString()} ·{" "}
                  {receipt.status}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>{t("privacyHistoryEmpty")}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.lg,
      paddingBottom: 48,
      gap: spacing.lg,
    },
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: -spacing.xs,
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800" },
    lead: { color: colors.textSecondary, lineHeight: 22 },
    actionList: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    copy: { flex: 1, gap: 3 },
    actionTitle: { color: colors.textPrimary, fontWeight: "700" },
    actionDescription: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: radius.md,
      backgroundColor: colors.primary + "18",
    },
    actionButtonText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
    },
    dangerButton: { backgroundColor: colors.danger + "14" },
    dangerButtonText: { color: colors.danger },
    confirmSection: {
      gap: spacing.sm,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    confirmTitle: { color: colors.textPrimary, fontWeight: "700" },
    confirmHint: { color: colors.textSecondary, fontSize: 12 },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      backgroundColor: colors.background,
    },
    history: { gap: spacing.sm },
    historyTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    receipt: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    receiptAction: { color: colors.textPrimary, fontWeight: "600" },
    receiptMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
    empty: { color: colors.textSecondary },
  });
