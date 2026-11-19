import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useGuardedRouter as useRouter } from "../../hooks/useGuardedRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { appendDistinctPage, SCROLL_PAGE_SIZE } from "../../hooks/useLoadOnScrollEnd";
import { v21Error } from "./V21Layout";
import {
  v21Api,
  type CoinToday,
  type CoinEntry,
  type RewardCatalog,
  type Reward,
} from "./v21.api";

function coinPage({ items, nextBefore }: { items: CoinEntry[]; nextBefore?: string | null }) {
  const page = items.slice(0, SCROLL_PAGE_SIZE);
  return { items: page, before: items.length > SCROLL_PAGE_SIZE ? page.at(-1)!.id : nextBefore ?? null };
}

export function useHealthCoins({
  includeRedemption = true,
}: { includeRedemption?: boolean } = {}) {
  const { t } = useTranslation("v21");
  const router = useRouter();
  const owner = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);
  const [snapshot, setSnapshot] = useState<{
    owner?: string;
    token?: string | null;
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historyBefore = useRef<string | null>(null);
  const focused = useRef(false);
  const generation = useRef(0);
  const operating = useRef<{ owner?: string; token: string | null } | null>(null);
  const current = useCallback(
    () => {
      const auth = useAuthStore.getState();
      return focused.current && auth.profile?.id === owner && auth.token === token;
    },
    [owner, token],
  );
  const ownsSnapshot = snapshot.owner === owner && snapshot.token === token;
  const ownsOperation = () => !!operating.current &&
    operating.current.owner === owner && operating.current.token === token;

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setHistoryError(false);
    try {
      const [data, catalog, history] = await Promise.all([
        v21Api.coins(),
        includeRedemption ? v21Api.rewards() : null,
        includeRedemption
          ? v21Api.history(undefined, SCROLL_PAGE_SIZE)
          : { items: [] },
      ]);
      if (!current() || request !== generation.current) return;
      const page = coinPage(history);
      setSnapshot({ owner, token, data, catalog, history: page.items });
      historyBefore.current = page.before;
      setHasMore(page.before !== null);
    } catch (error) {
      if (current() && request === generation.current) v21Error(error, t);
    } finally {
      if (current() && request === generation.current) setLoading(false);
    }
  }, [owner, token, current, t, includeRedemption]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setVisible(false);
      setSelected(null);
      setRecipient(null);
      setTemplate(null);
      if (operating.current?.owner !== owner || operating.current?.token !== token) {
        operating.current = null;
        setBusy(false);
        setHistoryLoading(false);
      }
      void refresh();
      return () => {
        focused.current = false;
        generation.current++;
      };
    }, [refresh, owner, token]),
  );

  const selectReward = (reward: Reward) => {
    if (ownsOperation()) return;
    setSelected(reward);
    setRecipient(null);
    setTemplate(null);
  };
  const redeem = async () => {
    if (!selected || ownsOperation() || !current()) return;
    if (
      !ownsSnapshot ||
      !snapshot.data ||
      snapshot.data.balance < selected.cost
    )
      return;
    if (selected.code === "GREETING_CARD" && (!recipient || !template)) return;
    const operation = { owner, token };
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
    const before = historyBefore.current;
    if (
      ownsOperation() ||
      loading ||
      !before ||
      !ownsSnapshot ||
      !current()
    )
      return;
    const operation = { owner, token };
    operating.current = operation;
    setHistoryLoading(true);
    setHistoryError(false);
    const request = generation.current;
    try {
      const page = coinPage(await v21Api.history(before, SCROLL_PAGE_SIZE));
      if (!current() || request !== generation.current) return;
      setSnapshot((previous) => ({
        ...previous,
        history: appendDistinctPage(previous.history, page.items),
      }));
      historyBefore.current = page.before === before ? null : page.before;
      setHasMore(historyBefore.current !== null);
    } catch {
      if (current() && request === generation.current) setHistoryError(true);
    } finally {
      if (operating.current === operation) {
        operating.current = null;
        if (current()) setHistoryLoading(false);
      }
    }
  };

  return {
    data: ownsSnapshot ? snapshot.data : null,
    catalog: ownsSnapshot ? snapshot.catalog : null,
    history: ownsSnapshot ? snapshot.history : [],
    loading,
    busy: (busy || historyLoading) && ownsOperation(),
    visible,
    selected,
    recipient,
    template,
    hasMore: ownsSnapshot && hasMore,
    historyLoading: historyLoading && ownsOperation(),
    historyError: ownsSnapshot && historyError,
    refresh,
    selectReward,
    openCard: (id: string) => {
      if (!current() || ownsOperation()) return;
      setVisible(false);
      router.push({
        pathname: "/coins/card/[cardId]",
        params: { cardId: id },
      } as any);
    },
    selectRecipient: (id: number) => {
      if (!ownsOperation()) setRecipient(id);
    },
    selectTemplate: (code: string) => {
      if (!ownsOperation()) setTemplate(code);
    },
    cancelReward: () => {
      if (!ownsOperation()) setSelected(null);
    },
    open: () => setVisible(true),
    close: () => setVisible(false),
    redeem,
    more,
    openDrawRules: () => {
      const period = ownsSnapshot && snapshot.catalog?.drawPeriodId;
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
