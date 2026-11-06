import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import type { GreetingTemplate } from "./v21.api";

const LEAF = require("../../../assets/images/profile/footer_leaf_right.png");
const themes = {
  MISS_YOU: {
    paper: ["#e3f4ed", "#f8fcf9"],
    accent: "#116f61",
    wash: "#c8e9dd",
    icon: "heart-outline",
  },
  BIRTHDAY: {
    paper: ["#fcf1dc", "#f9fcf5"],
    accent: "#786019",
    wash: "#f3e4bd",
    icon: "gift-outline",
  },
  NEW_YEAR: {
    paper: ["#e7f3e1", "#fbfaf0"],
    accent: "#42683c",
    wash: "#d4e8c8",
    icon: "sparkles-outline",
  },
} as const;

export function GreetingCard({
  template,
  recipientName,
  senderName,
  compact = false,
  selected,
}: {
  template: GreetingTemplate;
  recipientName?: string;
  senderName?: string;
  compact?: boolean;
  selected?: boolean;
}) {
  const { t, i18n } = useTranslation("v21");
  const en = i18n.language.startsWith("en");
  const theme = themes[template.code as keyof typeof themes] || themes.MISS_YOU;
  const title = en ? template.title_en : template.title;
  const body = en ? template.body_en : template.body;
  return (
    <View
      testID="family-greeting-card"
      style={[
        s.paper,
        compact && s.compact,
        {
          borderColor: selected === true ? theme.accent : "#d5e6dc",
          borderWidth: selected === true ? 2 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={[...theme.paper]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Image
        source={LEAF}
        accessible={false}
        resizeMode="contain"
        style={[s.leaf, compact && s.smallLeaf]}
      />
      <View style={s.brandRow}>
        <Text style={[s.brand, { color: theme.accent }]}>
          {t("greetingBrand")}
        </Text>
        {selected !== undefined && (
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={theme.accent}
            accessible={false}
          />
        )}
      </View>
      {!!recipientName && !compact && (
        <Text style={s.recipient}>
          {t("greetingTo", { name: recipientName })}
        </Text>
      )}
      <View
        style={[
          s.illustration,
          compact && s.smallIllustration,
          { backgroundColor: theme.wash },
        ]}
      >
        <Ionicons
          name={theme.icon}
          size={compact ? 34 : 62}
          color={theme.accent}
          accessible={false}
        />
      </View>
      <Text
        accessibilityRole="header"
        style={[s.title, compact && s.smallTitle, { color: theme.accent }]}
      >
        {title}
      </Text>
      {!!body && (
        <Text
          numberOfLines={compact ? 2 : undefined}
          style={[s.body, compact && s.smallBody]}
        >
          {body}
        </Text>
      )}
      {!compact && (
        <View style={s.signature}>
          {!!senderName && (
            <Text style={[s.sender, { color: theme.accent }]}>
              {t("greetingFrom", { name: senderName })}
            </Text>
          )}
          <Text style={s.tagline}>{t("greetingSignature")}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  paper: {
    width: "100%",
    minHeight: 430,
    borderRadius: 26,
    padding: 26,
    overflow: "hidden",
    alignItems: "center",
    gap: 20,
  },
  compact: { minHeight: 185, borderRadius: 20, padding: 18, gap: 10 },
  brandRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 26,
  },
  brand: { fontSize: 12, lineHeight: 18, letterSpacing: 2, fontWeight: "800" },
  leaf: {
    position: "absolute",
    right: -12,
    bottom: -10,
    width: 145,
    height: 220,
    opacity: 0.35,
  },
  smallLeaf: { width: 80, height: 120, right: -8, opacity: 0.25 },
  recipient: {
    fontSize: 16,
    lineHeight: 24,
    color: "#35584b",
    textAlign: "center",
  },
  illustration: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  smallIllustration: { width: 58, height: 58, borderRadius: 29 },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    textAlign: "center",
  },
  smallTitle: { fontSize: 20, lineHeight: 28 },
  body: { fontSize: 20, lineHeight: 32, color: "#294c3e", textAlign: "center" },
  smallBody: { fontSize: 15, lineHeight: 23 },
  signature: {
    alignSelf: "stretch",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#cbded1",
    paddingTop: 20,
    marginTop: 4,
    gap: 8,
  },
  sender: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  tagline: {
    fontSize: 13,
    lineHeight: 20,
    color: "#426152",
    textAlign: "center",
  },
});
