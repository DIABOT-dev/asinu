import { Image, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "./ScaledText";
import { AsinuAssistantButton } from "../features/app-assistant/AsinuAssistantButton";
import { useThemeColors } from "../hooks/useThemeColors";
import { useGuardedRouter } from "../hooks/useGuardedRouter";
import { isExpertConsultationEnabled } from "../lib/appEnv";

export function HomeConnections() {
  const { t } = useTranslation("home");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const entries = [
    {
      label: t("connectionFamily"),
      route: "/care-circle",
      image: require("../../assets/images/care-circle/family_3d_art.png"),
    },
    ...(isExpertConsultationEnabled
      ? [
          {
            label: t("connectionExpert"),
            route: "/doctor-consultation",
            // Stock photo by Tima Miroshnichenko, Pexels photo 8376280.
            image: require("../../assets/images/care-circle/expert-consultation-cutout.png"),
          },
        ]
      : []),
  ];
  return (
    <View testID="home-connections" style={styles.row}>
      <AsinuAssistantButton variant="card" />
      {entries.map((entry) => (
        <Pressable
          key={entry.route}
          accessibilityRole="button"
          accessibilityLabel={entry.label}
          onPress={() => router.push(entry.route as never)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Image
            source={entry.image}
            style={styles.image}
            resizeMode="contain"
            resizeMethod="resize"
            accessible={false}
          />
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {entry.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "stretch" },
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
  image: { width: "100%", height: 72 },
  label: { fontSize: 14, fontWeight: "700", textAlign: "center", minHeight: 0 },
});
