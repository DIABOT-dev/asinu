import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { AsinuAssistantDialog } from "./AsinuAssistantDialog";

export const ASINU_ASSISTANT_IMAGE = require("../../../assets/asinu_assistant_listening_v1.png");

export function AsinuAssistantButton({
  variant = "icon",
}: {
  variant?: "icon" | "card";
}) {
  const { colors } = useThemeColors();
  const { t } = useTranslation("settings");
  const token = useAuthStore((state) => state.token);
  const owner = useAuthStore((state) => state.profile?.id);
  const [openFor, setOpenFor] = useState<{ owner?: string; token: string } | null>(null);
  useFocusEffect(useCallback(() => () => setOpenFor(null), []));
  useEffect(() => {
    setOpenFor(null);
  }, [token, owner]);
  return (
    <>
      <Pressable
        testID="home-asinu-assistant"
        accessibilityRole="button"
        accessibilityLabel={t("appAssistant.open")}
        accessibilityHint={t("appAssistant.openHint")}
        onPress={() => { if (token) setOpenFor({ owner, token }); }}
        style={({ pressed }) => [
          variant === "card"
            ? [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]
            : styles.button,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Image
          source={ASINU_ASSISTANT_IMAGE}
          resizeMode="contain"
          resizeMethod="resize"
          style={variant === "card" ? styles.cardImage : styles.image}
          accessible={false}
        />
        {variant === "card" && (
          <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>
            {t("appAssistant.entryLabel")}
          </Text>
        )}
      </Pressable>
      {openFor && token === openFor.token && owner === openFor.owner && (
        <AsinuAssistantDialog onClose={() => setOpenFor(null)} />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    alignItems: "center",
  },
  cardImage: { width: "100%", height: 72 },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    minHeight: 0,
  },
  button: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 58, height: 58 },
});
