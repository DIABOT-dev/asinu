import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { v21Error } from "./V21Layout";
import {
  v21Api,
  type CoinToday,
  type CoinEntry,
  type RewardCatalog,
  type Reward,
} from "./v21.api";

export function useHealthCoins() {
  const { t } = useTranslation("v21");
  const router = useRouter();
  const owner = useAuthStore((state) => state.profile?.id);
  const [snapshot, setSnapshot] = useState<{
    owner?: string;
    data: CoinToday | null;
    catalog: RewardCatalog | null;
    history: CoinEntry[];
  }>({ data: null, catalog: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Reward | null>(null);
  const [recipient, setRecipient] = useState<number | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const focused = useRef(false);
  const generation = useRef(0);
  const operating = useRef<{ owner?: string } | null>(null);
  const current = useCallback(
    () => focused.current && useAuthStore.getState().profile?.id === owner,
    [owner]
  );

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, catalog, history] = await Promise.all([
        v21Api.coins(),
        v21Api.rewards(),
        v21Api.history(),
      ]);
      if (!current() || request !== generation.current) return;
      setSnapshot({ owner, data, catalog, history: history.items });
      setHasMore(history.items.length >= 30);
    } catch (error) {
      if (current() && request === generation.current) v21Error(error, t);
    } finally {
      if (current() && request === generation.current) setLoading(false);
    }
  }, [owner, current, t]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setVisible(false);
      setSelected(null);
      setRecipient(null);
      setTemplate(null);
      if (operating.current?.owner !== owner) {
        operating.current = null;
        setBusy(false);
      }
      void refresh();
      return () => {
        focused.current = false;
        generation.current++;
      };
    }, [refresh, owner])
  );

  const selectReward = (reward: Reward) => {
    if (operating.current?.owner === owner) return;
    setSelected(reward);
    setRecipient(null);
    setTemplate(null);
  };
  const redeem = async () => {
    if (!selected || operating.current?.owner === owner || !current()) return;
    if (
      snapshot.owner !== owner ||
      !snapshot.data ||
      snapshot.data.balance < selected.cost
    )
      return;
    if (selected.code === "GREETING_CARD" && (!recipient || !template)) return;
    const operation = { owner };
    operating.current = operation;
    setBusy(true);
    const reward = selected;
    try {
      const key = `@v21/redeem/${owner}`;
      const payload =
        reward.code === "GREETING_CARD"
          ? { recipientId: recipient, templateCode: template }
          : {};
      const fingerprint = JSON.stringify({ code: reward.code, payload });
      let pending: { fingerprint: string; id: string } | null = null;
      try {
        pending = JSON.parse((await AsyncStorage.getItem(key)) || "null");
      } catch {}
      if (!current()) return;
      const id =
        pending?.fingerprint === fingerprint ? pending.id : randomUUID();
      await AsyncStorage.setItem(key, JSON.stringify({ fingerprint, id }));
      if (!current()) return;
      await v21Api.redeem(reward.code, id, payload);
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      setSelected(null);
      useToastStore.getState().show(t("redeemed"), "success");
      await refresh();
    } catch (error) {
      if (current()) v21Error(error, t);
    } finally {
      if (operating.current === operation) {
        operating.current = null;
        if (current()) setBusy(false);
      }
    }
  };
  const more = async () => {
    if (
      operating.current?.owner === owner ||
      !hasMore ||
      snapshot.owner !== owner ||
      !current()
    )
      return;
    const operation = { owner };
    operating.current = operation;
    setBusy(true);
    const request = generation.current;
    try {
      const page = await v21Api.history(snapshot.history.at(-1)?.id);
      if (!current() || request !== generation.current) return;
      setSnapshot((previous) => ({
        ...previous,
        history: [
          ...previous.history,
          ...page.items.filter(
            (entry) => !previous.history.some((old) => old.id === entry.id)
          ),
        ],
      }));
      setHasMore(page.items.length >= 30);
    } catch (error) {
      if (current()) v21Error(error, t);
    } finally {
      if (operating.current === operation) {
        operating.current = null;
        if (current()) setBusy(false);
      }
    }
  };

  return {
    data: snapshot.owner === owner ? snapshot.data : null,
    catalog: snapshot.owner === owner ? snapshot.catalog : null,
    history: snapshot.owner === owner ? snapshot.history : [],
    loading,
    busy: busy && operating.current?.owner === owner,
    visible,
    selected,
    recipient,
    template,
    hasMore,
    refresh,
    selectReward,
    selectRecipient: (id: number) => {
      if (operating.current?.owner !== owner) setRecipient(id);
    },
    selectTemplate: (code: string) => {
      if (operating.current?.owner !== owner) setTemplate(code);
    },
    cancelReward: () => {
      if (operating.current?.owner !== owner) setSelected(null);
    },
    open: () => setVisible(true),
    close: () => setVisible(false),
    redeem,
    more,
    openDrawRules: () => {
      const period = snapshot.owner === owner && snapshot.catalog?.drawPeriodId;
      if (!period) return;
      setVisible(false);
      router.push({
        pathname: "/checkin-rewards/rules",
        params: { period },
      } as any);
    },
  };
}

export type HealthCoinsController = ReturnType<typeof useHealthCoins>;
