import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  CoinDetailsModal,
  type CoinDetailsSection,
} from "../../src/features/v21/CoinDetailsModal";
import { CoinRewardSelection } from "../../src/features/v21/CoinDetailsContent";
import { CoinRewardsCatalog } from "../../src/features/v21/CoinRewardsCatalog";
import { useHealthCoins } from "../../src/features/v21/useHealthCoins";
import { Action, Note, V21Layout } from "../../src/features/v21/V21Layout";
import { useGuardedRouter } from "../../src/hooks/useGuardedRouter";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function RedeemCoinsScreen() {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const coins = useHealthCoins();
  const [section, setSection] = useState<CoinDetailsSection>("earn");
  const reward = coins.selected;
  const openDetails = (details: CoinDetailsSection) => {
    setSection(details);
    coins.open();
  };
  const goBack = () => {
    if (reward) coins.cancelReward();
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/operations");
  };

  return (
    <V21Layout
      key={reward?.code ?? "catalog"}
      title={t("rewardsTitle")}
      solidBackground
      onBack={goBack}
      headerAction={
        coins.data && !reward ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("history")}
            onPress={() => openDetails("history")}
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
              name="time-outline"
              size={23}
              color={colors.primaryText}
            />
          </Pressable>
        ) : undefined
      }
      refreshControl={
        !reward ? (
          <RefreshControl
            refreshing={coins.loading}
            onRefresh={() => void coins.refresh()}
            tintColor={colors.primaryText}
            colors={[colors.primaryText]}
          />
        ) : undefined
      }
    >
      {coins.data && coins.catalog ? (
        reward ? (
          <CoinRewardSelection reward={reward} coins={coins} />
        ) : (
          <>
            <CoinRewardsCatalog
              balance={coins.data.balance}
              catalog={coins.catalog}
              busy={coins.busy}
              onEarnMore={() => openDetails("earn")}
              onSelect={coins.selectReward}
              onCoinRules={() => router.push("/coins/rules")}
              onDrawRules={coins.openDrawRules}
            />
            <CoinDetailsModal section={section} coins={coins} />
          </>
        )
      ) : (
        <>
          <Note>{t(coins.loading ? "loading" : "featureUnavailable")}</Note>
          {!coins.loading && (
            <Action
              secondary
              label={t("retry")}
              onPress={() => void coins.refresh()}
            />
          )}
        </>
      )}
    </V21Layout>
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
});
