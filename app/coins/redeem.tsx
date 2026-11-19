import { useState } from "react";
import { RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import {
  CoinDetailsModal,
  CoinHistoryButton,
} from "../../src/features/v21/CoinDetailsModal";
import {
  CoinRewardSelection,
  type CoinRewardStep,
} from "../../src/features/v21/CoinDetailsContent";
import { CoinRewardsCatalog } from "../../src/features/v21/CoinRewardsCatalog";
import { useHealthCoins } from "../../src/features/v21/useHealthCoins";
import type { Reward } from "../../src/features/v21/v21.api";
import { Action, Note, V21Layout } from "../../src/features/v21/V21Layout";
import { useGuardedRouter } from "../../src/hooks/useGuardedRouter";
import { useThemeColors } from "../../src/hooks/useThemeColors";

export default function RedeemCoinsScreen() {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const router = useGuardedRouter();
  const coins = useHealthCoins({ historyScope: "usage" });
  const [step, setStep] = useState<CoinRewardStep>("select");
  const reward = coins.selected;
  const selectReward = (item: Reward) => {
    setStep("select");
    coins.selectReward(item);
  };
  const goBack = () => {
    if (reward) {
      if (coins.busy) return;
      if (step === "select") coins.cancelReward();
      else
        setStep(
          step === "review" && reward.code === "GREETING_CARD"
            ? "message"
            : "select"
        );
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/operations");
  };

  return (
    <V21Layout
      key={reward ? `${reward.code}:${step}` : "catalog"}
      title={t(
        reward?.code === "GREETING_CARD" && step === "review"
          ? "greetingTitle"
          : "rewardsTitle"
      )}
      solidBackground
      onBack={goBack}
      headerAction={
        coins.data && !reward ? (
          <CoinHistoryButton
            label={t("coinUsageHistory")}
            onPress={coins.open}
          />
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
          <CoinRewardSelection
            reward={reward}
            coins={coins}
            step={step}
            onStepChange={setStep}
          />
        ) : (
          <>
            <CoinRewardsCatalog
              balance={coins.data.balance}
              catalog={coins.catalog}
              busy={coins.busy}
              onSelect={selectReward}
              onDrawRules={coins.openDrawRules}
            />
            <CoinDetailsModal section="usage" coins={coins} />
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
