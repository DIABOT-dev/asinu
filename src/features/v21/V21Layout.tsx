import { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  TextInputProps,
  ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ApiError } from "../../lib/apiClient";
import { useToastStore } from "../../stores/toast.store";

export function V21Layout({
  title,
  children,
  onBack,
  refreshControl,
}: {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const { t } = useTranslation("v21");
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={v21Styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={onBack || (() => router.back())}
            style={v21Styles.back}
          >
            <Ionicons name="arrow-back" size={28} color={colors.textPrimary} />
          </Pressable>
          <Text style={[v21Styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <View style={v21Styles.back} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          contentContainerStyle={v21Styles.content}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        v21Styles.action,
        {
          backgroundColor: secondary
            ? colors.surface
            : danger
              ? colors.danger
              : colors.primaryText,
          borderColor: secondary
            ? colors.border
            : danger
              ? colors.danger
              : colors.primaryText,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          v21Styles.actionText,
          { color: secondary ? colors.textPrimary : colors.surface },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        v21Styles.choice,
        {
          borderColor: selected ? colors.primaryText : colors.border,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.primaryText : colors.textPrimary,
          fontSize: 18,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field(props: TextInputProps) {
  const { colors } = useThemeColors();
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textSecondary}
      style={[
        v21Styles.input,
        {
          color: colors.textPrimary,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        props.style,
      ]}
    />
  );
}
export function Note({ children }: { children: ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Text style={{ fontSize: 17, lineHeight: 26, color: colors.textSecondary }}>
      {children}
    </Text>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Text
      style={{
        fontSize: 23,
        lineHeight: 31,
        fontWeight: "700",
        color: colors.textPrimary,
      }}
    >
      {children}
    </Text>
  );
}
export function v21Error(error: unknown, t: (key: string) => string) {
  const code = error instanceof ApiError ? error.code : undefined;
  const key =
    code === "COIN_INSUFFICIENT"
      ? "insufficient"
      : code === "COIN_REWARD_LIMIT"
        ? "rewardLimit"
        : code === "MED_SCHEDULE_LIMIT"
          ? "scheduleLimit"
          : code === "MED_CONSENT_COOLDOWN"
            ? "consentCooldown"
            : code === "MED_TIME_EXISTS"
              ? "timeExists"
              : code === "AI_CONSENT_REQUIRED" ||
                  code === "MED_PATIENT_AI_CONSENT_REQUIRED"
                ? "aiConsentNeeded"
                : code === "V21_FEATURE_DISABLED"
                  ? "featureUnavailable"
                  : code === "MED_DOSE_NOT_DUE"
                    ? "notDue"
                    : "error";
  useToastStore.getState().show(t(key), "error");
}
export const v21Styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  back: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, textAlign: "center", fontSize: 24, fontWeight: "700" },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  action: {
    minHeight: 58,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  choice: {
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
    justifyContent: "center",
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    fontSize: 18,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  section: { gap: 14 },
  divider: { height: 1 },
});
