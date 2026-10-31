import { useTranslation } from "react-i18next";
import { Heading, Note, V21Layout } from "../../src/features/v21/V21Layout";
export default function CoinRules() {
  const { t } = useTranslation("v21");
  return (
    <V21Layout title={t("rules")}>
      <Heading>{t("coinsTitle")}</Heading>
      <Note>{t("coinRules")}</Note>
      <Note>{t("coinExpiry")}</Note>
      <Note>{t("coinLimits")}</Note>
    </V21Layout>
  );
}
