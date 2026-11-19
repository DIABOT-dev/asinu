import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useLoadOnScrollEnd } from "../../hooks/useLoadOnScrollEnd";
import { HealthCoinIcon } from "./HealthCoinIcon";
import { CoinEarnTab, CoinHistoryTab } from "./CoinDetailsContent";
import type { HealthCoinsController } from "./useHealthCoins";
import type { CoinHistoryScope } from "./v21.api";

type CoinDetailsSection = "earn" | "history" | CoinHistoryScope;
const sectionTitles = {
  earn: "coinsEarnTitle",
  history: "history",
  usage: "coinUsageHistory",
  earned: "coinEarnHistory",
} as const;

export function CoinHistoryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.historyButton,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        accessible={false}
        name="time-outline"
        size={23}
        color={colors.primaryText}
      />
    </Pressable>
  );
}

function CoinDetailsPanel({
  coins,
  section,
}: {
  coins: HealthCoinsController;
  section: CoinDetailsSection;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const isHistory = section !== "earn";
  const scope =
    section === "usage" || section === "earned" ? section : undefined;
  const pagingScroll = useLoadOnScrollEnd(
    () => {
      if (isHistory && !coins.historyError) void coins.more();
    },
    section,
    isHistory && coins.hasMore
  );
  return (
    <View style={styles.panel}>
      <LinearGradient
        colors={isDark ? ["#1e4239", "#152c28"] : ["#e9f7f0", "#f8fcfa"]}
        style={styles.wash}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <HealthCoinIcon size={42} />
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {t(sectionTitles[section])}
          </Text>
          {isHistory && coins.data && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("balance", { count: coins.data.balance })}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={coins.close}
          style={styles.close}
        >
          <Ionicons name="close" size={23} color={colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        key={section}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={pagingScroll.minimumContentSize}
        {...(isHistory ? pagingScroll.scrollProps : undefined)}
      >
        {isHistory ? (
          <CoinHistoryTab coins={coins} scope={scope} />
        ) : (
          <CoinEarnTab coins={coins} />
        )}
      </ScrollView>
    </View>
  );
}

export function CoinDetailsModal({
  coins,
  section = "earn",
}: {
  coins: HealthCoinsController;
  section?: CoinDetailsSection;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal
      visible={coins.visible}
      transparent
      animationType="fade"
      onRequestClose={coins.close}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={coins.close}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              height: Math.min(
                height - insets.top - 12,
                Math.round(height * 0.88)
              ),
              backgroundColor: isDark ? "#152c28" : "#f8fcfa",
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <CoinDetailsPanel coins={coins} section={section} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  historyButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
  },
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  panel: { flex: 1 },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 160 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 20,
    paddingRight: 12,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 21, fontWeight: "700" },
  subtitle: { fontSize: 13, lineHeight: 19 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  scroll: { flex: 1 },
});
