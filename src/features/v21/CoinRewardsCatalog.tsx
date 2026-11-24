import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import { useThemeColors } from "../../hooks/useThemeColors";
import { HealthCoinIcon } from "./HealthCoinIcon";
import type { Reward, RewardCatalog } from "./v21.api";

const ticketArtwork = require("../../../assets/images/rewards/product-photos-v2/reward-ticket-photo-v2.png");
const greetingArtwork = require("../../../assets/images/rewards/family-greeting-card-cover.jpg");
const categoryLabels = {
  all: "rewardCategoryAll",
  GREETING_CARD: "rewardCategoryGreeting",
  DRAW_TICKET: "rewardCategoryDraw",
} as const;
type Category = keyof typeof categoryLabels;
const categories = Object.keys(categoryLabels) as Category[];

export function CoinRewardsCatalog({
  balance,
  catalog,
  busy,
  onSelect,
  onDrawRules,
}: {
  balance: number;
  catalog: RewardCatalog;
  busy: boolean;
  onSelect: (reward: Reward) => void;
  onDrawRules: () => void;
}) {
  const { t, i18n } = useTranslation("v21");
  const { colors } = useThemeColors();
  const [category, setCategory] = useState<Category>("all");
  const { width } = useWindowDimensions();
  const scaledSize = useScaledFontSize(100);
  const compact = width < 360 || scaledSize > 115;
  const format = new Intl.NumberFormat(i18n.language);
  const lowestCost = Math.min(...catalog.items.map((item) => item.cost));
  const shortfall = catalog.items.length ? lowestCost - balance : 0;
  const visibleRewards = catalog.items.filter(
    (item) => category === "all" || item.code === category
  );
  const drawRulesInTile =
    Boolean(catalog.drawPeriodId) &&
    catalog.items.some(
      (item) => item.code === "DRAW_TICKET" && item.cost > balance
    );

  return (
    <>
      <View
        style={[styles.balanceCard, { backgroundColor: colors.primaryLight }]}
      >
        <View style={styles.balanceRow}>
          <View style={styles.balanceCopy}>
            <Text style={[styles.balanceLabel, { color: colors.primaryText }]}>
              {t("rewardBalance")}
            </Text>
            <View style={styles.balanceAmount}>
              <Text
                style={[styles.balanceNumber, { color: colors.textPrimary }]}
              >
                {format.format(balance)}
              </Text>
              <Text style={[styles.balanceUnit, { color: colors.primaryText }]}>
                {t("rewardCoinUnit")}
              </Text>
            </View>
          </View>
          <HealthCoinIcon size={compact ? 48 : 68} />
        </View>
        {shortfall > 0 && (
          <Text style={[styles.balanceHint, { color: colors.primaryText }]}>
            {t("rewardNextShortfall", { count: format.format(shortfall) })}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        accessibilityRole="tablist"
        accessibilityLabel={t("rewardCatalogTitle")}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map((item) => {
          const selected = item === category;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={t(categoryLabels[item])}
              accessibilityState={{ selected }}
              onPress={() => setCategory(item)}
              style={({ pressed }) => [
                styles.category,
                {
                  backgroundColor: selected
                    ? colors.primaryText
                    : colors.surface,
                  borderColor: selected ? colors.primaryText : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  {
                    color: selected ? colors.background : colors.textPrimary,
                  },
                ]}
              >
                {t(categoryLabels[item])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {visibleRewards.length ? (
        <View style={styles.grid}>
          {visibleRewards.map((reward) => {
            const available = Math.max(0, Math.min(balance, reward.cost));
            const missing = reward.cost - available;
            const greeting = reward.code === "GREETING_CARD";
            const showDrawRules = !greeting && drawRulesInTile;
            const action = missing
              ? greeting
                ? t("greetingPreview")
                : showDrawRules
                ? t("rewardDrawRules")
                : null
              : t(greeting ? "greetingSend" : "coinsChooseReward");

            return (
              <View
                key={reward.code}
                style={[
                  styles.tile,
                  {
                    width: compact ? "100%" : "48%",
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.art,
                    {
                      backgroundColor: greeting
                        ? colors.primaryLight
                        : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Image
                    source={greeting ? greetingArtwork : ticketArtwork}
                    contentFit={greeting ? "cover" : "contain"}
                    style={
                      greeting ? StyleSheet.absoluteFill : styles.ticketArt
                    }
                    accessible={false}
                  />
                  <View
                    style={[styles.price, { backgroundColor: colors.surface }]}
                  >
                    <HealthCoinIcon size={21} />
                    <Text
                      style={[styles.priceLabel, { color: colors.textPrimary }]}
                    >
                      {t("cost", { count: format.format(reward.cost) })}
                    </Text>
                  </View>
                </View>
                <View style={styles.tileBody}>
                  <Text
                    style={[styles.rewardName, { color: colors.textPrimary }]}
                  >
                    {t(reward.code)}
                  </Text>
                  <View style={styles.progressGroup}>
                    <View
                      accessible
                      accessibilityRole="progressbar"
                      accessibilityLabel={t(reward.code)}
                      accessibilityValue={{
                        min: 0,
                        max: reward.cost,
                        now: available,
                      }}
                      style={[
                        styles.track,
                        { backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <View
                        style={[
                          styles.progress,
                          {
                            backgroundColor: colors.primaryText,
                            width: `${
                              reward.cost
                                ? (available / reward.cost) * 100
                                : 100
                            }%`,
                          },
                        ]}
                      />
                    </View>
                    {missing > 0 ? (
                      <View style={styles.shortfall}>
                        <Text
                          style={[
                            styles.status,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("rewardMissingLabel")}
                        </Text>
                        <Text
                          style={[
                            styles.shortfallAmount,
                            { color: colors.primaryText },
                          ]}
                        >
                          {t("cost", { count: format.format(missing) })}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[styles.status, { color: colors.primaryText }]}
                      >
                        {t("rewardReady")}
                      </Text>
                    )}
                  </View>
                  {action && (
                    <Pressable
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={action}
                      accessibilityHint={t(reward.code)}
                      accessibilityState={{ disabled: busy }}
                      onPress={
                        showDrawRules ? onDrawRules : () => onSelect(reward)
                      }
                      style={({ pressed }) => [
                        styles.selectButton,
                        { backgroundColor: colors.primaryLight },
                        (pressed || busy) && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectLabel,
                          { color: colors.primaryText },
                        ]}
                      >
                        {action}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="gift-outline"
            size={32}
            color={colors.primaryText}
            accessible={false}
          />
          <Text style={[styles.emptyLabel, { color: colors.textSecondary }]}>
            {t(category === "all" ? "noRewards" : "rewardCategoryEmpty")}
          </Text>
        </View>
      )}

      {!!catalog.drawPeriodId &&
        !drawRulesInTile &&
        visibleRewards.some((reward) => reward.code === "DRAW_TICKET") && (
          <Pressable
            accessibilityRole="button"
            onPress={onDrawRules}
            style={styles.link}
          >
            <Text style={[styles.linkLabel, { color: colors.primaryText }]}>
              {t("drawRules")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.primaryText}
              accessible={false}
            />
          </Pressable>
        )}
    </>
  );
}

const styles = StyleSheet.create({
  balanceCard: { padding: 18, borderRadius: 22, gap: 12 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  balanceCopy: { flex: 1, minWidth: 0 },
  balanceLabel: { fontSize: 15, fontWeight: "600" },
  balanceAmount: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 8,
  },
  balanceNumber: {
    fontSize: 39,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  balanceUnit: { fontSize: 17, fontWeight: "600" },
  balanceHint: {
    fontSize: 14,
    fontWeight: "600",
  },
  categories: { gap: 8 },
  category: {
    minHeight: 44,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryLabel: { fontSize: 14, fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  tile: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
  },
  art: {
    minHeight: 146,
    aspectRatio: 1.1,
    borderRadius: 14,
    padding: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  ticketArt: {
    position: "absolute",
    width: "80%",
    top: 8,
    bottom: 36,
    alignSelf: "center",
  },
  price: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 18,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  tileBody: { flex: 1, paddingHorizontal: 4, paddingVertical: 7, gap: 7 },
  rewardName: { fontSize: 16, fontWeight: "700", flexGrow: 1 },
  progressGroup: { gap: 4 },
  track: { height: 5, borderRadius: 3, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 3 },
  shortfall: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 4,
  },
  status: { fontSize: 12, fontWeight: "600" },
  shortfallAmount: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  selectButton: {
    minHeight: 44,
    borderRadius: 11,
    paddingHorizontal: 6,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  selectLabel: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.7 },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyLabel: { fontSize: 15, textAlign: "center" },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  linkLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
