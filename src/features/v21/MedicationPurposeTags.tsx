import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { MedicationDraft } from "./useMedicationSetup";
import type { MedPurposeCode } from "./v21.api";
import { medicationSetupStyles as s } from "./medication-setup.styles";

export function MedicationPurposeTags({
  codes,
  selected,
  onToggle,
  disabled = false,
}: {
  codes: MedPurposeCode[];
  selected?: MedPurposeCode[];
  onToggle?: (code: MedPurposeCode) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  if (!codes.length) return null;
  return (
    <View style={s.chips}>
      {codes.map((code) => {
        const checked = !selected || selected.includes(code);
        const style = [
          s.chip,
          {
            backgroundColor: checked
              ? colors.primaryLight
              : colors.surfaceMuted,
          },
        ];
        const label = t(`medicationPurpose.${code}`);
        const content = (
          <>
            {onToggle && checked ? (
              <Ionicons name="checkmark" size={17} color={colors.primaryText} />
            ) : null}
            <Text
              style={[
                s.chipText,
                { color: checked ? colors.primaryText : colors.textSecondary },
              ]}
            >
              {label}
            </Text>
          </>
        );
        return onToggle ? (
          <Pressable
            key={code}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            style={style}
            onPress={() => onToggle(code)}
          >
            {content}
          </Pressable>
        ) : (
          <View key={code} style={style}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

export function MedicationPurposeReview({
  item,
  disabled,
  onToggle,
  onRetry,
}: {
  item: MedicationDraft;
  disabled: boolean;
  onToggle: (code: MedPurposeCode) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  if (item.kind !== "MEDICINE" || item.display_name.trim().length < 2)
    return null;
  const state = item.purposeLookup;
  const result = state?.result;
  const loading = !state || state.loading;
  const hasTags = !!result?.tags.length;
  return (
    <View style={{ gap: 8 }}>
      <View style={s.itemHeader}>
        <Text style={[s.label, s.flex, { color: colors.textPrimary }]}>
          {t(
            loading
              ? "medicationPurposeLoading"
              : hasTags
              ? "medicationPurposeTitle"
              : result?.status === "ambiguous"
              ? "medicationPurposeAmbiguous"
              : result?.status === "unavailable"
              ? "medicationPurposeUnavailable"
              : "medicationPurposeNotFound"
          )}
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : result?.source ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("medicationPurposeSource", {
              name: result.source.name,
            })}
            style={s.iconButton}
            onPress={() =>
              void Linking.openURL(result.source!.url).catch(() => {})
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.primaryText}
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("medicationPurposeRetry")}
            disabled={disabled}
            style={s.iconButton}
            onPress={onRetry}
          >
            <Ionicons
              name="refresh-outline"
              size={21}
              color={colors.primaryText}
            />
          </Pressable>
        )}
      </View>
      {hasTags ? (
        <MedicationPurposeTags
          codes={result.tags}
          selected={item.selectedPurposeCodes || []}
          onToggle={onToggle}
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}
