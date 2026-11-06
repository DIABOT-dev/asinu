import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { QrCameraPermissionRow } from "../care-circle/components/QrCameraPermissionRow";
import { AndroidCallAccessCard } from "../checkin-call/AndroidCallAccessCard";
import {
  useDevicePermission,
  type DevicePermissionKind,
} from "./useDevicePermission";

const permissionRows = [
  {
    kind: "notifications",
    labelKey: "deviceNotifications",
    icon: "notifications-outline",
  },
  { kind: "microphone", labelKey: "deviceMicrophone", icon: "mic-outline" },
  { kind: "photos", labelKey: "devicePhotos", icon: "images-outline" },
] as const;

function DevicePermissionRow({
  kind,
  labelKey,
  icon,
}: {
  kind: DevicePermissionKind;
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  const { permission, loading, pending, failed, refresh, change } =
    useDevicePermission(kind);
  const granted =
    permission?.granted === true || permission?.accessPrivileges === "limited";
  const disabled = loading || pending || !permission;
  return (
    <View style={styles.row}>
      <Ionicons
        name={icon}
        size={22}
        color={colors.primaryDark}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t(labelKey)}
        </Text>
        {failed ? (
          <Text style={[styles.status, { color: colors.textSecondary }]}>
            {t("devicePermissionUnavailable")}
          </Text>
        ) : null}
      </View>
      {loading || pending ? <ActivityIndicator color={colors.primary} /> : null}
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("devicePermissionRetry", { name: t(labelKey) })}
          onPress={() => void refresh()}
          style={styles.retry}
        >
          <Ionicons name="refresh" size={22} color={colors.primaryDark} />
        </Pressable>
      ) : (
        <Switch
          accessibilityLabel={t(labelKey)}
          accessibilityHint={t("devicePermissionSwitchHint")}
          accessibilityValue={
            permission?.accessPrivileges === "limited"
              ? { text: t("devicePhotosLimited") }
              : undefined
          }
          accessibilityState={{
            checked: granted,
            disabled,
            busy: loading || pending,
          }}
          value={granted}
          disabled={disabled}
          onValueChange={(enabled) => void change(enabled)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      )}
    </View>
  );
}

export function ProfileDevicePermissions() {
  return (
    <View>
      <QrCameraPermissionRow />
      {permissionRows.map((row) => (
        <DevicePermissionRow key={row.kind} {...row} />
      ))}
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
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 15, fontWeight: "600" },
  status: { fontSize: 12 },
  retry: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
