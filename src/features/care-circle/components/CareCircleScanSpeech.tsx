import React from "react";
import { useTranslation } from "react-i18next";
import { MascotSpeechBubble } from "../../../components/MascotSpeechBubble";

export function CareCircleScanSpeech() {
  const { t } = useTranslation("careCircle");
  return <MascotSpeechBubble text={t("qrConnectFamilyNow")} decorative />;
}
