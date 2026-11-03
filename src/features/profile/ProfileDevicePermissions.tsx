import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { runNativePermission } from "../../lib/native-permissions";
import { showToast } from "../../stores/toast.store";
import { QrCameraPermissionRow } from "../care-circle/components/QrCameraPermissionRow";
import { AndroidCallAccessCard } from "../checkin-call/AndroidCallAccessCard";
import { useAuthStore } from "../auth/auth.store";

export function ProfileDevicePermissions() {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const [opening, setOpening] = useState(false);
  const focused = useRef(false);
  const busy = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, [])
  );

  const openDeviceSettings = async () => {
    if (busy.current || !focused.current) return;
    busy.current = true;
    setOpening(true);
    const token = useAuthStore.getState().token;
    const canRun = () =>
      focused.current && useAuthStore.getState().token === token;
    try {
      await runNativePermission(() => Linking.openSettings(), {
        key: "app-settings",
        settings: true,
        canRun,
      });
    } catch {
      if (canRun()) showToast(t("devicePermissionsError"), "error");
    } finally {
      busy.current = false;
      if (canRun()) setOpening(false);
    }
  };

  return (
    <View>
      <QrCameraPermissionRow />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("devicePermissions")}
        accessibilityState={{ disabled: opening, busy: opening }}
        disabled={opening}
        onPress={() => void openDeviceSettings()}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
      >
        <Ionicons
          name="options-outline"
          size={22}
          color={colors.primaryDark}
          style={styles.icon}
        />
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t("devicePermissions")}
        </Text>
        {opening && <ActivityIndicator color={colors.primary} />}
      </Pressable>
      <AndroidCallAccessCard onlyWhenNeeded plain />
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
  icon: { width: 28 },
  label: { flex: 1, fontSize: 15, fontWeight: "600" },
});
