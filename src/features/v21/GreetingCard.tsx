import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text as NativeText, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import type { GreetingTemplate } from "./v21.api";

const stationery = {
  paper: "#FFFCF5",
  stroke: "#C8B386",
  ink: "#273830",
};
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});
const themes = {
  MISS_YOU: { accent: "#225847", icon: "heart-outline" },
  BIRTHDAY: { accent: "#78521E", icon: "gift-outline" },
  NEW_YEAR: { accent: "#435A30", icon: "sparkles-outline" },
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
  const titleSize = useScaledFontSize(compact ? 20 : 32);
  const bodySize = useScaledFontSize(compact ? 15 : 19);
  const en = i18n.language.startsWith("en");
  const theme = themes[template.code as keyof typeof themes] || themes.MISS_YOU;
  const title = en ? template.title_en : template.title;
  const body = en ? template.body_en : template.body;
  const titleType = {
    color: theme.accent,
    fontSize: titleSize,
    lineHeight: Math.ceil(titleSize * 1.35),
  };
  const bodyType = {
    fontSize: bodySize,
    lineHeight: Math.ceil(bodySize * 1.65),
  };

  if (compact) {
    return (
      <View
        testID="family-greeting-card"
        style={[
          s.paper,
          s.option,
          { borderColor: selected ? theme.accent : stationery.stroke },
        ]}
      >
        <View style={s.optionHeader}>
          <Ionicons
            name={theme.icon}
            size={22}
            color={theme.accent}
            accessible={false}
          />
          <NativeText
            allowFontScaling={false}
            style={[s.title, s.optionTitle, titleType]}
          >
            {title}
          </NativeText>
          {selected !== undefined && (
            <Ionicons
              name={selected ? "checkmark-circle" : "ellipse-outline"}
              size={21}
              color={theme.accent}
              accessible={false}
            />
          )}
        </View>
        {!!body && (
          <NativeText
            allowFontScaling={false}
            numberOfLines={2}
            style={[s.body, bodyType]}
          >
            {body}
          </NativeText>
        )}
      </View>
    );
  }

  return (
    <View testID="family-greeting-card" style={[s.paper, s.letter]}>
      <Ionicons
        name={theme.icon}
        size={26}
        color={theme.accent}
        accessible={false}
      />
      <NativeText
        accessibilityRole="header"
        allowFontScaling={false}
        style={[s.title, s.center, titleType]}
      >
        {title}
      </NativeText>
      {!!recipientName && (
        <Text style={[s.recipient, { color: theme.accent }]}>
          {t("greetingTo", { name: recipientName })}
        </Text>
      )}
      {!!body && (
        <NativeText
          allowFontScaling={false}
          style={[s.body, s.letterBody, bodyType]}
        >
          {body}
        </NativeText>
      )}
      {!!senderName && (
        <Text style={[s.sender, { color: theme.accent }]}>
          {t("greetingFrom", { name: senderName })}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  paper: {
    width: "100%",
    backgroundColor: stationery.paper,
    borderColor: stationery.stroke,
    borderWidth: 1,
  },
  option: { borderRadius: 12, padding: 16, gap: 8 },
  optionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionTitle: { flex: 1, minWidth: 0 },
  letter: {
    minHeight: 340,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 26,
    paddingVertical: 36,
    gap: 18,
  },
  title: { fontFamily: serif, fontWeight: "600" },
  body: { fontFamily: serif, color: stationery.ink },
  center: { textAlign: "center" },
  letterBody: { alignSelf: "stretch" },
  recipient: { alignSelf: "stretch", fontSize: 14, fontWeight: "600" },
  sender: {
    alignSelf: "stretch",
    textAlign: "right",
    fontSize: 15,
    fontWeight: "600",
  },
});
