import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { medicationSetupStyles as s } from "./medication-setup.styles";
import {
  medicationAnchors,
  validMedicationTime,
  type MedicationSetupController,
} from "./useMedicationSetup";
import type { Meals } from "./v21.api";
import { MedicationTimeField } from "./MedicationTimeField";

export function MedicationDosePicker({
  setup,
}: {
  setup: MedicationSetupController;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const [customTime, setCustomTime] = useState("");
  const [editMeals, setEditMeals] = useState(false);
  const disabled = setup.busy || !setup.data;
  const existingTimes = [
    ...new Set(
      setup.data?.schedules
        .filter((row) => row.active && row.consent_state !== "DECLINED")
        .map((row) => row.time_local.slice(0, 5))
    ),
  ];
  const anchorChoices = [
    ...new Map(
      medicationAnchors.map((anchor) => [setup.anchorTimes?.[anchor], anchor])
    ).entries(),
  ].filter(([time]) => time && !existingTimes.includes(time));
  const choice = (
    time: string,
    label: string,
    anchor: Parameters<typeof setup.toggleTime>[1] = null
  ) => {
    const selected = setup.slots.some((slot) => slot.time_local === time);
    return (
      <Pressable
        key={`${label}:${time}`}
        accessibilityRole="checkbox"
        accessibilityLabel={`${label} ${time}`}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={() => setup.toggleTime(time, anchor)}
        style={[s.option, disabled && s.disabled]}
      >
        <Ionicons
          name={selected ? "checkbox" : "square-outline"}
          size={24}
          color={colors.primaryText}
        />
        <Text style={[s.label, s.flex, { color: colors.textPrimary }]}>
          {label}
        </Text>
        <Text style={[s.label, { color: colors.primaryText }]}>{time}</Text>
      </Pressable>
    );
  };
  return (
    <View style={s.section}>
      {existingTimes.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
            {t("doseExistingTimes")}
          </Text>
          {existingTimes.map((time) => choice(time, t("doseExisting")))}
        </View>
      )}
      {anchorChoices.map(([time, anchor]) =>
        choice(
          time!,
          t(anchor === "bedtime" ? "anchor_bedtime" : anchor),
          anchor
        )
      )}
      <View style={s.section}>
        <MedicationTimeField
          label={t("doseOtherTime")}
          value={customTime}
          onChange={setCustomTime}
          disabled={disabled}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("doseAddTime")}
          accessibilityState={{
            disabled: disabled || !validMedicationTime(customTime),
          }}
          disabled={disabled || !validMedicationTime(customTime)}
          onPress={() => {
            if (!setup.slots.some((row) => row.time_local === customTime))
              setup.toggleTime(customTime);
            setCustomTime("");
          }}
          style={[
            s.option,
            (!validMedicationTime(customTime) || disabled) && s.disabled,
          ]}
        >
          <Ionicons name="add" size={25} color={colors.primaryText} />
          <Text style={[s.label, { color: colors.primaryText }]}>
            {t("doseAddTime")}
          </Text>
        </Pressable>
      </View>
      {setup.slots
        .filter(
          (slot) =>
            !existingTimes.includes(slot.time_local) &&
            !Object.values(setup.anchorTimes || {}).includes(slot.time_local)
        )
        .map((slot) => choice(slot.time_local, t("doseCustomTime")))}
      {setup.slots.some(
        (slot) => slot.time_local < "07:00" || slot.time_local >= "21:00"
      ) && (
        <Text style={[s.caption, { color: colors.primaryText }]}>
          {t("medicationPushOnly")}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("step3")}
        accessibilityState={{ expanded: editMeals }}
        onPress={() => setEditMeals(!editMeals)}
        style={s.helpToggle}
      >
        <Text style={[s.label, s.flex, { color: colors.primaryText }]}>
          {t("step3")}
        </Text>
        <Ionicons
          name={editMeals ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      {editMeals &&
        (Object.keys(setup.meals) as (keyof Meals)[]).map((meal) => (
          <MedicationTimeField
            key={meal}
            label={t(meal)}
            value={setup.meals[meal]}
            disabled={disabled}
            onChange={(value) =>
              setup.setMeals((old) => ({ ...old, [meal]: value }))
            }
          />
        ))}
      {setup.timingLimitExceeded && (
        <Text
          accessibilityRole="alert"
          style={[s.error, { color: colors.danger }]}
        >
          {t("setupTooManyTimes")}
        </Text>
      )}
    </View>
  );
}
