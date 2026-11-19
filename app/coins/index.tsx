import { useState } from "react";
import { RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { Action, Note, V21Layout } from "../../src/features/v21/V21Layout";
import { HealthCoinJourney } from "../../src/features/v21/HealthCoinJourney";
import {
  CoinDetailsModal,
  CoinHistoryButton,
} from "../../src/features/v21/CoinDetailsModal";
import { useHealthCoins } from "../../src/features/v21/useHealthCoins";

export default function CoinsScreen() {
  const { t } = useTranslation("v21");
  const coins = useHealthCoins({
    includeRedemption: false,
    historyScope: "earned",
  });
  const [section, setSection] = useState<"earn" | "earned">("earn");
  const openSection = (next: "earn" | "earned") => {
    setSection(next);
    coins.open();
  };
  return (
    <V21Layout
      title={t("coinsTitle")}
      headerAction={
        coins.data && (
          <CoinHistoryButton
            label={t("coinEarnHistory")}
            onPress={() => openSection("earned")}
          />
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={coins.loading}
          onRefresh={() => void coins.refresh()}
        />
      }
    >
      {coins.data ? (
        <HealthCoinJourney
          data={coins.data}
          onOpenDetails={() => openSection("earn")}
        />
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
      {coins.data && <CoinDetailsModal coins={coins} section={section} />}
    </V21Layout>
  );
}
