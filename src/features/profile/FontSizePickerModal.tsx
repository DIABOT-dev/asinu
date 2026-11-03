import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text as NativeText, View } from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { FontSizeScale } from "../../stores/font-size.store";
import {
  ProfilePreferenceModal,
  preferenceStyles as styles,
} from "./ProfilePreferenceModal";

// Preview the four app scales at a 16 pt baseline, without scaling them twice.
const choices = [
  { value: "small", labelKey: "fontSmall", previewSize: 14 },
  { value: "normal", labelKey: "fontNormal", previewSize: 16 },
  { value: "large", labelKey: "fontLarge", previewSize: 18 },
  { value: "xlarge", labelKey: "fontXLarge", previewSize: 20 },
] as const;

type Props = {
  visible: boolean;
  value: FontSizeScale;
  onSelect: (value: FontSizeScale) => void;
  onClose: () => void;
};

export function FontSizePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation("settings");
  const { colors } = useThemeColors();
  return (
    <ProfilePreferenceModal
      visible={visible}
      title={t("fontSize")}
      onClose={onClose}
    >
      <View accessibilityRole="radiogroup" accessibilityLabel={t("fontSize")}>
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={t(choice.labelKey)}
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(choice.value)}
              style={({ pressed }) => [
                styles.option,
                pressed && { opacity: 0.65 },
              ]}
            >
              <View style={styles.copy}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: selected ? colors.primaryText : colors.textPrimary,
                      fontWeight: selected ? "700" : "500",
                    },
                  ]}
                >
                  {t(choice.labelKey)}
                </Text>
                <NativeText
                  allowFontScaling={false}
                  style={[
                    styles.preview,
                    {
                      color: colors.textSecondary,
                      fontSize: choice.previewSize,
                      lineHeight: Math.round(choice.previewSize * 1.5),
                    },
                  ]}
                >
                  {t("fontPreview")}
                </NativeText>
              </View>
              {selected && (
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={colors.primaryText}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </ProfilePreferenceModal>
  );
}
