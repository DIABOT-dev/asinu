import { useState } from "react";
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
import { HealthCoinIcon } from "./HealthCoinIcon";
import {
  CoinEarnTab,
  CoinSpendTab,
  CoinHistoryTab,
} from "./CoinDetailsContent";
import type { HealthCoinsController } from "./useHealthCoins";

export type CoinDetailsTab = "earn" | "spend" | "history";
const TABS = [
  { id: "earn", labelKey: "coinsEarnTab" },
  { id: "spend", labelKey: "coinsSpendTab" },
  { id: "history", labelKey: "coinsHistoryTab" },
] as const;

export function CoinDetailsPanel({
  coins,
  tab,
  onTabChange,
  onClose,
}: {
  coins: HealthCoinsController;
  tab: CoinDetailsTab;
  onTabChange: (tab: CoinDetailsTab) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
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
            {t("coinsTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("rules")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
          style={styles.close}
        >
          <Ionicons name="close" size={23} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: colors.primaryLight }]}
      >
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={t(item.labelKey)}
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => onTabChange(item.id)}
            style={[
              styles.tab,
              tab === item.id && {
                backgroundColor: isDark ? "#28584c" : "#d3ede2",
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    tab === item.id ? colors.primaryText : colors.textSecondary,
                },
              ]}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        key={tab}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "earn" ? (
          <CoinEarnTab coins={coins} />
        ) : tab === "spend" ? (
          <CoinSpendTab coins={coins} />
        ) : (
          <CoinHistoryTab coins={coins} />
        )}
      </ScrollView>
    </View>
  );
}

export function CoinDetailsModal({ coins }: { coins: HealthCoinsController }) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<CoinDetailsTab>("earn");
  const close = () => {
    coins.close();
    coins.cancelReward();
    setTab("earn");
  };
  return (
    <Modal
      visible={coins.visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={close}
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
          <CoinDetailsPanel
            coins={coins}
            tab={tab}
            onTabChange={setTab}
            onClose={close}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  tabs: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  scroll: { flex: 1 },
});
