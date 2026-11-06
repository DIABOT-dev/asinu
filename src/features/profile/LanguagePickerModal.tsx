import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text as NativeText, View } from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { AppLanguage } from "../../stores/language.store";
import {
  ProfilePreferenceModal,
  preferenceStyles as styles,
} from "./ProfilePreferenceModal";

const choices = [
  {
    value: "vi",
    labelKey: "languageVi",
    previewKey: "languageViPreview",
    flag: "🇻🇳",
  },
  {
    value: "en",
    labelKey: "languageEn",
    previewKey: "languageEnPreview",
    flag: "🇬🇧",
  },
] as const;

type Props = {
  visible: boolean;
  value: AppLanguage;
  onSelect: (value: AppLanguage) => void;
  onClose: () => void;
};

export function LanguagePickerModal({
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
      title={t("language")}
      onClose={onClose}
    >
      <View accessibilityRole="radiogroup" accessibilityLabel={t("language")}>
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
              <NativeText
                accessible={false}
                allowFontScaling={false}
                style={styles.flag}
              >
                {choice.flag}
              </NativeText>
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
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  {t(choice.previewKey)}
                </Text>
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
