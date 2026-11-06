import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { env } from "../../lib/env";
import { MedicationBackground } from "./MedicationBackground";
import { MedicationPhotoPreview } from "./MedicationPhotoPreview";
import type { MedItem } from "./v21.api";

export function MedicationCallLayout({
  title,
  time,
  status,
  children,
  busy,
  onBack,
  audioPhase,
  audioEnabled,
  onReplay,
  onStop,
}: {
  title: string;
  time?: string;
  status: string;
  children: ReactNode;
  busy: boolean;
  onBack: () => void;
  audioPhase: string;
  audioEnabled: boolean;
  onReplay: () => void;
  onStop: () => void;
}) {
  const { colors } = useThemeColors(),
    insets = useSafeAreaInsets(),
    { t } = useTranslation("v21");
  const speaking = ["loading", "playing"].includes(audioPhase);
  return (
    <View
      style={[
        s.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <MedicationBackground />
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          onPress={onBack}
          style={s.iconButton}
        >
          <Ionicons name="arrow-back" size={23} color={colors.textPrimary} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[s.headerTitle, { color: colors.textPrimary }]}
        >
          {title}
        </Text>
        <View style={s.iconButton} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: colors.primaryLight }]}>
            <MaterialCommunityIcons
              name="pill"
              size={32}
              color={colors.primaryText}
            />
          </View>
          <View style={s.copy}>
            {time && (
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {t("medicationDoseTime")}
              </Text>
            )}
            {time && (
              <Text style={[s.time, { color: colors.textPrimary }]}>
                {time.slice(0, 5)}
              </Text>
            )}
            <Text
              accessibilityLiveRegion="polite"
              style={[s.status, { color: colors.primaryText }]}
            >
              {status}
            </Text>
          </View>
        </View>
        {audioEnabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              speaking ? "medicationAudioStop" : "medicationAudioReplay",
            )}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={speaking ? onStop : onReplay}
            style={[s.audio, { borderColor: colors.border }]}
          >
            {audioPhase === "loading" ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Ionicons
                name="volume-high-outline"
                size={23}
                color={colors.primaryText}
              />
            )}
            <Text style={[s.caption, s.copy, { color: colors.textSecondary }]}>
              {t(
                audioPhase === "loading"
                  ? "medicationAudioLoading"
                  : audioPhase === "error"
                    ? "medicationAudioUnavailable"
                    : speaking
                      ? "medicationAudioPlaying"
                      : "medicationAudioReplay",
              )}
            </Text>
            <Ionicons
              name={speaking ? "stop-circle-outline" : "play-circle-outline"}
              size={27}
              color={colors.primaryText}
            />
          </Pressable>
        )}
        <View style={s.body}>{children}</View>
      </ScrollView>
    </View>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Text
      accessibilityRole="header"
      style={[s.heading, { color: colors.textPrimary }]}
    >
      {children}
    </Text>
  );
}
export function Note({ children }: { children: ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <Text style={[s.note, { color: colors.textSecondary }]}>{children}</Text>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
  number,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  number?: number;
}) {
  const { colors } = useThemeColors();
  const color = secondary ? colors.primaryText : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        {
          backgroundColor: secondary ? colors.primaryLight : colors.primaryText,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {number && (
        <View accessible={false} style={[s.number, { borderColor: color }]}>
          <Text style={[s.numberText, { color }]}>{number}</Text>
        </View>
      )}
      <Text style={[s.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}
export function MedicationItemsToggle({
  label,
  expanded,
  onPress,
  disabled,
}: {
  label: string;
  expanded: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.itemsToggle, { borderColor: colors.border }]}
    >
      <Ionicons name="medical-outline" size={22} color={colors.primaryText} />
      <Text style={[s.status, s.copy, { color: colors.primaryText }]}>
        {label}
      </Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={20}
        color={colors.primaryText}
      />
    </Pressable>
  );
}
export function MedicationDoseItem({ item }: { item: MedItem }) {
  const { colors } = useThemeColors(),
    { t } = useTranslation("v21");
  return (
    <View style={s.item}>
      {item.photoUrl && (
        <MedicationPhotoPreview
          compact
          uri={
            item.photoUrl.startsWith("/")
              ? env.apiBaseUrl + item.photoUrl
              : item.photoUrl
          }
          label={item.display_name}
        />
      )}
      <View style={s.copy}>
        <Text style={[s.itemName, { color: colors.textPrimary }]}>
          {item.display_name}
        </Text>
        <Text style={[s.caption, { color: colors.textSecondary }]}>
          {t(item.kind)}
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  headerTitle: { flex: 1, fontSize: 21, lineHeight: 29, fontWeight: "700" },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 8,
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  time: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  caption: { fontSize: 14, lineHeight: 21 },
  status: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  audio: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 58,
    borderBottomWidth: 1,
    paddingBottom: 14,
  },
  body: { gap: 14 },
  heading: { fontSize: 24, lineHeight: 34, fontWeight: "700", marginBottom: 6 },
  note: { fontSize: 14, lineHeight: 22, marginBottom: 4 },
  action: {
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  actionLabel: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 15, fontWeight: "700" },
  itemsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 12,
  },
  item: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 8,
  },
  itemName: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
});
