import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import { useThemeColors } from "../../hooks/useThemeColors";
import { HealthCoinIcon } from "./HealthCoinIcon";
import type { Reward, RewardCatalog } from "./v21.api";

const ticketArtwork = require("../../../assets/images/rewards/product-photos-v2/reward-ticket-photo-v2.png");

export function CoinRewardsCatalog({
  balance,
  catalog,
  busy,
  onEarnMore,
  onSelect,
  onCoinRules,
  onDrawRules,
}: {
  balance: number;
  catalog: RewardCatalog;
  busy: boolean;
  onEarnMore: () => void;
  onSelect: (reward: Reward) => void;
  onCoinRules: () => void;
  onDrawRules: () => void;
}) {
  const { t, i18n } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const { width } = useWindowDimensions();
  const scaledSize = useScaledFontSize(100);
  const compact = width < 360 || scaledSize > 115;
  const format = new Intl.NumberFormat(i18n.language);
  const lowestCost = Math.min(...catalog.items.map((item) => item.cost));
  const shortfall = catalog.items.length ? lowestCost - balance : 0;
  const drawRulesInTile =
    Boolean(catalog.drawPeriodId) &&
    catalog.items.some(
      (item) => item.code === "DRAW_TICKET" && item.cost > balance
    );
  const shortcuts = [
    ...(catalog.drawPeriodId && !drawRulesInTile
      ? [{ label: t("drawRules"), onPress: onDrawRules }]
      : []),
    { label: t("rules"), onPress: onCoinRules },
  ];

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
        <View
          style={[
            styles.balanceFooter,
            { borderTopColor: isDark ? "#26524d" : "#c2e6e0" },
          ]}
        >
          {shortfall > 0 && (
            <Text style={[styles.balanceHint, { color: colors.primaryText }]}>
              {t("rewardNextShortfall", { count: format.format(shortfall) })}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onEarnMore}
            style={({ pressed }) => [
              styles.earnButton,
              { backgroundColor: colors.primaryText },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.earnLabel, { color: colors.background }]}>
              {t("rewardEarnMore")}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.background}
              accessible={false}
            />
          </Pressable>
        </View>
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.textPrimary }]}
      >
        {t("rewardCatalogTitle")}
      </Text>
      {catalog.items.length ? (
        <View style={styles.grid}>
          {catalog.items.map((reward) => {
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
              : t("coinsChooseReward");

            return (
              <View
                key={reward.code}
                style={[
                  styles.tile,
                  {
                    flexBasis: compact ? "100%" : "46%",
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
                  {greeting ? (
                    <View style={styles.greetingArt} accessible={false}>
                      <View
                        style={[
                          styles.paperBehind,
                          { backgroundColor: isDark ? "#236055" : "#b7e8dd" },
                        ]}
                      />
                      <View
                        style={[
                          styles.paper,
                          { backgroundColor: isDark ? "#e7f5ee" : "#fffdf5" },
                        ]}
                      >
                        <Ionicons
                          name="heart"
                          size={25}
                          color="#248879"
                          accessible={false}
                        />
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={ticketArtwork}
                      contentFit="contain"
                      style={styles.ticketArt}
                      accessible={false}
                    />
                  )}
                  <View
                    style={[styles.price, { backgroundColor: colors.surface }]}
                  >
                    <HealthCoinIcon size={19} />
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
                    <Text
                      style={[
                        styles.status,
                        {
                          color: missing
                            ? colors.textSecondary
                            : colors.primaryText,
                        },
                      ]}
                    >
                      {missing
                        ? t("missingCoins", { count: format.format(missing) })
                        : t("rewardReady")}
                    </Text>
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
            {t("noRewards")}
          </Text>
        </View>
      )}

      <View style={[styles.links, { borderTopColor: colors.border }]}>
        {shortcuts.map(({ label, onPress }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={onPress}
            style={styles.link}
          >
            <Text style={[styles.linkLabel, { color: colors.primaryText }]}>
              {label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.primaryText}
              accessible={false}
            />
          </Pressable>
        ))}
      </View>
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
  balanceFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  balanceHint: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    flexBasis: 110,
  },
  earnButton: {
    minHeight: 44,
    marginLeft: "auto",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  earnLabel: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  heading: { fontSize: 21, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexGrow: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
  },
  art: {
    minHeight: 124,
    borderRadius: 14,
    padding: 8,
    gap: 2,
    overflow: "hidden",
  },
  greetingArt: {
    width: 82,
    height: 79,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  paperBehind: {
    position: "absolute",
    width: 60,
    height: 44,
    borderRadius: 9,
    transform: [{ rotate: "-18deg" }, { translateX: -6 }],
  },
  paper: {
    width: 63,
    height: 47,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }, { translateX: 5 }],
  },
  ticketArt: { width: 104, height: 79, alignSelf: "center" },
  price: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  tileBody: { flex: 1, paddingHorizontal: 4, paddingVertical: 7, gap: 7 },
  rewardName: { fontSize: 16, fontWeight: "700", flexGrow: 1 },
  progressGroup: { gap: 4 },
  track: { height: 5, borderRadius: 3, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 3 },
  status: { fontSize: 13, fontWeight: "600" },
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
  links: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  linkLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
