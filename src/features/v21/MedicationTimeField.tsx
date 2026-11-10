import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { CallSettingPicker } from "../checkin-call/CallSettingPicker";
import { validMedicationTime } from "./medication-input";

type Props = {
  label: string;
  accessibilityLabel?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** A confirmed 24-hour time, selected with the same library wheels as calls. */
export function MedicationTimeField({
  label,
  accessibilityLabel = label,
  value,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (disabled) setEditing(false);
  }, [disabled]);

  return (
    <View style={styles.root}>
      {editing && !disabled ? (
        <CallSettingPicker
          key={value}
          inline
          title={label}
          value={validMedicationTime(value) ? value : "07:00"}
          onClose={() => setEditing(false)}
          onConfirm={(next) => {
            if (
              disabled ||
              typeof next !== "string" ||
              !validMedicationTime(next)
            )
              return;
            setEditing(false);
            onChange(next);
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: value || t("chooseTime") }}
          accessibilityState={{ disabled, expanded: false }}
          disabled={disabled}
          onPress={() => {
            if (!disabled) setEditing(true);
          }}
          style={({ pressed }) => [
            styles.row,
            (pressed || disabled) && styles.disabled,
          ]}
        >
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {label}
          </Text>
          <View
            style={[styles.clock, { backgroundColor: colors.surfaceMuted }]}
          >
            <Text style={[styles.value, { color: colors.primaryText }]}>
              {value || t("chooseTime")}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.primaryText}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", minWidth: 0 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  label: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: "600" },
  clock: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  value: { fontSize: 22, fontWeight: "600", fontVariant: ["tabular-nums"] },
  disabled: { opacity: 0.5 },
});
