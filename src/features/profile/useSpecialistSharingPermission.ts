import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { isDoctorFeaturesEnabled } from "../../lib/appEnv";
import { showToast } from "../../stores/toast.store";
import { useAuthStore } from "../auth/auth.store";
import {
  newSharingRequestId,
  sameSharingIdentity,
  specialistSharingApi,
  type SharingIdentity,
} from "./specialist-sharing.api";

type Decision = { enabled: boolean; version: number; requestId: string };
export function useSpecialistSharingPermission() {
  const { t } = useTranslation("settings");
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.profile?.id);
  const consentVersion = useAuthStore((state) => state.profile?.consentVersion);
  const identity =
    token && userId
      ? { token, userId, consentVersion: consentVersion || "v1.0.0" }
      : null;
  const identityRef = useRef<SharingIdentity | null>(identity);
  identityRef.current = identity;
  const [snapshot, setSnapshot] = useState<{
    token?: string;
    userId?: string;
    enabled: boolean | null;
    loading: boolean;
    failed: boolean;
  }>({ enabled: null, loading: true, failed: false });
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const focused = useRef(false),
    version = useRef(0),
    latestRead = useRef(0);
  const requested = useRef<Decision | null>(null),
    saving = useRef<Decision | null>(null);
  const current = useCallback(
    (expected: number) => {
      const owner = identityRef.current;
      return (
        isDoctorFeaturesEnabled &&
        focused.current &&
        version.current === expected &&
        owner?.token === token &&
        owner.userId === userId &&
        sameSharingIdentity(owner)
      );
    },
    [token, userId]
  );

  const refresh = useCallback(async () => {
    const expected = version.current,
      read = ++latestRead.current,
      owner = identityRef.current;
    if (!owner || !current(expected)) return null;
    setSnapshot({
      token: owner.token,
      userId: owner.userId,
      enabled: null,
      loading: true,
      failed: false,
    });
    try {
      const enabled = await specialistSharingApi.read(owner);
      if (!current(expected) || read !== latestRead.current) return null;
      if (enabled === null)
        throw new Error("Specialist sharing status unavailable");
      setSnapshot({
        token: owner.token,
        userId: owner.userId,
        enabled,
        loading: false,
        failed: false,
      });
      return enabled;
    } catch {
      if (current(expected) && read === latestRead.current)
        setSnapshot({
          token: owner.token,
          userId: owner.userId,
          enabled: null,
          loading: false,
          failed: true,
        });
      return null;
    }
  }, [current]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      version.current++;
      requested.current = null;
      saving.current = null;
      setDecision(null);
      setBusy(false);
      setSaveError(false);
      void refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && !saving.current && !requested.current)
          void refresh();
      });
      return () => {
        focused.current = false;
        version.current++;
        latestRead.current++;
        requested.current = null;
        saving.current = null;
        subscription.remove();
      };
    }, [refresh])
  );

  const owned = snapshot.token === token && snapshot.userId === userId;
  const enabled = owned ? snapshot.enabled : null;
  const loading = !owned || snapshot.loading;
  const failed = owned && snapshot.failed;
  const request = (next: boolean) => {
    if (
      !current(version.current) ||
      loading ||
      failed ||
      enabled === null ||
      next === enabled ||
      requested.current ||
      saving.current
    )
      return;
    const nextDecision = {
      enabled: next,
      version: version.current,
      requestId: newSharingRequestId(),
    };
    requested.current = nextDecision;
    setDecision(nextDecision);
    setSaveError(false);
  };
  const cancel = () => {
    if (saving.current) return;
    requested.current = null;
    setDecision(null);
    setSaveError(false);
  };
  const confirm = async () => {
    const owner = identityRef.current;
    if (
      !decision ||
      !owner ||
      requested.current !== decision ||
      saving.current ||
      !current(decision.version)
    )
      return;
    saving.current = decision;
    setBusy(true);
    setSaveError(false);
    latestRead.current++;
    try {
      const accepted = await specialistSharingApi.save(
        owner,
        decision.enabled,
        decision.requestId
      );
      if (!current(decision.version) || saving.current !== decision) return;
      if (!accepted) throw new Error("Specialist sharing request unsuccessful");
      const saved = await refresh();
      if (!current(decision.version) || saving.current !== decision) return;
      if (saved === null || saved !== decision.enabled)
        throw new Error("Specialist sharing status unavailable");
      requested.current = null;
      setDecision(null);
      showToast(
        t(
          decision.enabled
            ? "privacySuccess_grant_consent"
            : "privacySuccess_withdraw_consent"
        ),
        "success"
      );
    } catch {
      if (current(decision.version) && saving.current === decision)
        setSaveError(true);
    } finally {
      if (saving.current === decision) {
        saving.current = null;
        if (current(decision.version)) setBusy(false);
      }
    }
  };
  return {
    enabled,
    loading,
    failed,
    busy,
    decision:
      decision?.version === version.current && current(decision.version)
        ? decision
        : null,
    saveError,
    refresh,
    request,
    cancel,
    confirm,
  };
}
