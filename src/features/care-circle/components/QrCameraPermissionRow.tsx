import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, View } from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useThemeColors } from "../../../hooks/useThemeColors";
import { useQrCameraPermission } from "../useQrCameraPermission";

export function QrCameraPermissionRow() {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const { permission, pending, change } = useQrCameraPermission();
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name="camera-outline" size={22} color={colors.primaryDark} />
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t("cameraQrPermission")}
      </Text>
      <Switch
        accessibilityLabel={t("cameraQrPermission")}
        value={permission?.granted === true}
        disabled={pending || !permission}
        onValueChange={(value) => void change(value)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
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
  icon: { width: 28, alignItems: "center" },
  label: { flex: 1, fontSize: 15, fontWeight: "600" },
});
