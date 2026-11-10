import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AppAlertModal, useAppAlert } from "../../components/AppAlertModal";
import { ScaledText as Text } from "../../components/ScaledText";

export function CheckinCallPhoneAction({
  phone,
  onBeforeCall,
}: {
  phone: string;
  onBeforeCall?: () => Promise<unknown>;
}) {
  const { t } = useTranslation("checkinCall");
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d{3,15}$/.test(normalized)) return null;
  const label = t("contact.callPerson");
  const call = async () => {
    await onBeforeCall?.();
    showAlert(label, t("phoneConfirmation", { phone: normalized }), [
      { text: t("cancel", { ns: "common" }), style: "cancel" },
      {
        text: label,
        onPress: () => {
          void Linking.openURL(`tel:${normalized}`).catch(() =>
            showAlert(label, t("phoneUnavailable"))
          );
        },
      },
    ]);
  };
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => void call()}
        style={styles.button}
      >
        <Ionicons
          name="call-outline"
          size={22}
          color="#087f6d"
        />
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 6, marginVertical: 10 },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#99d5c8",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 17, fontWeight: "700", color: "#087f6d", flexShrink: 1 },
});
