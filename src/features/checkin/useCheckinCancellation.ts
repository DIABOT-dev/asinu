import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppAlert } from "../../components/AppAlertModal";
import { tokenStore } from "../../lib/tokenStore";
import { checkinApi, type CheckinSession } from "./checkin.api";
import { cancelCheckinProgress } from "./checkin-progress";

export function useCheckinCancellation(context: {
  account: string | number | undefined;
  session: CheckinSession | null;
  onConfirmed: () => void;
  onCancelled: () => void;
  onRecover: () => void;
}) {
  const { t } = useTranslation("home");
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const perform = async (target: typeof context) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const token = tokenStore.getToken();
    target.onConfirmed();
    let leaving = false;
    try {
      await cancelCheckinProgress(checkinApi, target.account, target.session);
      if (live.current && tokenStore.getToken() === token) {
        target.onCancelled();
        leaving = true;
      }
    } catch {
      if (live.current && tokenStore.getToken() === token) {
        target.onRecover();
        showAlert(t("checkinCancelFailedTitle"), t("checkinCancelFailed"));
      }
    } finally {
      // router.replace commits on a later render. Re-enabling the mounted
      // location form here would autosave the draft we just deleted.
      running.current = leaving;
      if (live.current && !leaving) setBusy(false);
    }
  };
  const request = () => {
    if (running.current) return;
    const target = context;
    showAlert(t("checkinCancelTitle"), t("checkinCancelDescription"), [
      { text: t("checkinKeepAnswering"), style: "cancel" },
      {
        text: t("checkinCancel"),
        style: "destructive",
        onPress: () => {
          void perform(target);
        },
      },
    ]);
  };
  return { busy, request, alertState, dismissAlert };
}
