import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { env } from "../../lib/env";
import type { MedSetupDraft } from "./v21.api";

export function MedicationDraftEntry({
  draft,
  onContinue,
  onDelete,
  disabled = false,
}: {
  draft: MedSetupDraft;
  onContinue: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("v21"),
    { colors } = useThemeColors();
  const [failed, setFailed] = useState(false);
  const media =
    draft.snapshot.photoMediaId ||
    draft.snapshot.items.find((i) => i.photo_media_id)?.photo_media_id;
  const uri =
    media && draft.photos[media]
      ? `${env.apiBaseUrl}${draft.photos[media]}`
      : null;
  const names = draft.snapshot.items
    .map((item) => item.display_name.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  return (
    <View style={[s.row, { borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("continueDraft")}${names ? `: ${names}` : ""}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onContinue}
        style={s.main}
      >
        <View style={[s.thumbnail, { backgroundColor: colors.primaryLight }]}>
          {uri && !failed ? (
            <Image
              source={{ uri }}
              resizeMode="cover"
              style={s.image}
              onError={() => setFailed(true)}
            />
          ) : (
            <Ionicons
              name="document-text-outline"
              size={26}
              color={colors.primaryText}
            />
          )}
        </View>
        <View style={s.copy}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t("draftTitle")}
          </Text>
          <Text style={[s.caption, { color: colors.textSecondary }]}>
            {t("draftItems", { count: draft.snapshot.items.length })}
          </Text>
          {draft.snapshot.items.slice(0, 2).map((item) => (
            <View key={item.clientId} style={s.item}>
              <Text style={[s.name, { color: colors.textPrimary }]}>
                {item.display_name.trim() ||
                  item.printed_name ||
                  t("draftUntitledItem")}
              </Text>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {t(item.kind || "draftKindPending")}
              </Text>
            </View>
          ))}
          {draft.snapshot.items.length > 2 && (
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              {t("draftMoreItems", { count: draft.snapshot.items.length - 2 })}
            </Text>
          )}
          <Text style={[s.action, { color: colors.primaryText }]}>
            {t("continueDraft")}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("deleteDraft")}${names ? `: ${names}` : ""}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onDelete}
        style={s.remove}
      >
        <Ionicons name="trash-outline" size={22} color={colors.danger} />
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 72,
  },
  thumbnail: {
    width: 52,
    height: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  item: { gap: 2, paddingTop: 4 },
  name: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 20 },
  action: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  remove: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
