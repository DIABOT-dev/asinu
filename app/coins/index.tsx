import { useCallback, useState } from "react";
import { Alert, RefreshControl, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/features/auth/auth.store";
import {
  v21Api,
  CoinToday,
  RewardCatalog,
  CoinEntry,
  Reward,
} from "../../src/features/v21/v21.api";
import {
  Action,
  Choice,
  Heading,
  Note,
  V21Layout,
  v21Error,
} from "../../src/features/v21/V21Layout";
import { useToastStore } from "../../src/stores/toast.store";

export default function CoinsScreen() {
  const { t, i18n } = useTranslation("v21"),
    router = useRouter(),
    user = useAuthStore((s) => s.profile?.id);
  const [data, setData] = useState<CoinToday | null>(null),
    [catalog, setCatalog] = useState<RewardCatalog | null>(null),
    [history, setHistory] = useState<CoinEntry[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<Reward | null>(null),
    [recipient, setRecipient] = useState<number | null>(null),
    [template, setTemplate] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        v21Api.coins(),
        v21Api.rewards(),
        v21Api.history(),
      ]);
      setData(a);
      setCatalog(b);
      setHistory(c.items);
    } catch (e) {
      v21Error(e, t);
    } finally {
      setLoading(false);
    }
  }, [t]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const redeem = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const key = `@v21/redeem/${user}`,
        payload =
          selected.code === "GREETING_CARD"
            ? { recipientId: recipient, templateCode: template }
            : {};
      const fingerprint = JSON.stringify({ code: selected.code, payload });
      let pending: { fingerprint: string; id: string } | null = null;
      try {
        pending = JSON.parse((await AsyncStorage.getItem(key)) || "null");
      } catch {}
      const id =
        pending?.fingerprint === fingerprint ? pending.id : randomUUID();
      await AsyncStorage.setItem(key, JSON.stringify({ fingerprint, id }));
      await v21Api.redeem(selected.code, id, payload);
      await AsyncStorage.removeItem(key);
      setSelected(null);
      useToastStore.getState().show(t("redeemed"), "success");
      await refresh();
    } catch (e) {
      v21Error(e, t);
    } finally {
      setBusy(false);
    }
  };
  if (!data && !loading)
    return (
      <V21Layout title={t("coinsTitle")}>
        <Note>{t("featureUnavailable")}</Note>
        <Action secondary label={t("retry")} onPress={() => void refresh()} />
      </V21Layout>
    );
  return (
    <V21Layout
      title={t("coinsTitle")}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
      }
    >
      <Heading>
        {data ? t("balance", { count: data.balance }) : t("loading")}
      </Heading>
      <Note>{t("coinRules")}</Note>
      {data?.tasks.map((x) => (
        <View key={x.task_code} style={{ gap: 6 }}>
          <Heading>{t(x.task_code)}</Heading>
          <Note>
            {x.task_code === "WEEKLY"
              ? t("weeklyProgress", { count: data.weeklyDays })
              : t("rewardProgress", {
                  done: x.done,
                  limit: x.daily_limit,
                  coins: x.coins,
                })}
          </Note>
        </View>
      ))}
      <Heading>{t("rewardsTitle")}</Heading>
      {!catalog?.items.length && <Note>{t("noRewards")}</Note>}
      {catalog?.items.map((x) => (
        <Action
          key={x.code}
          secondary
          label={`${t(x.code)} · ${t("cost", { count: x.cost })}`}
          disabled={busy}
          onPress={() => {
            setSelected(x);
            setTemplate(null);
            setRecipient(null);
          }}
        />
      ))}
      {catalog?.drawPeriodId && (
        <Action
          secondary
          label={t("drawRules")}
          onPress={() =>
            router.push({
              pathname: "/checkin-rewards/rules",
              params: { period: catalog.drawPeriodId },
            } as any)
          }
        />
      )}
      {selected && (
        <View style={{ gap: 14 }}>
          <Heading>{t("redeemConfirm", { count: selected.cost })}</Heading>
          {data && data.balance < selected.cost && (
            <Note>
              {t("missingCoins", { count: selected.cost - data.balance })}
            </Note>
          )}
          {selected.code === "GREETING_CARD" && (
            <>
              <Note>{t("chooseRecipient")}</Note>
              {catalog?.recipients.map((x) => (
                <Choice
                  key={x.id}
                  selected={recipient === x.id}
                  label={x.name}
                  onPress={() => setRecipient(x.id)}
                  disabled={busy}
                />
              ))}
              <Note>{t("chooseTemplate")}</Note>
              {catalog?.templates.map((x) => (
                <Choice
                  key={x.code}
                  selected={template === x.code}
                  label={i18n.language.startsWith("en") ? x.title_en : x.title}
                  onPress={() => setTemplate(x.code)}
                  disabled={busy}
                />
              ))}
            </>
          )}
          <Action
            label={t("redeem")}
            disabled={
              busy ||
              !data ||
              data.balance < selected.cost ||
              (selected.code === "GREETING_CARD" && (!recipient || !template))
            }
            onPress={() =>
              Alert.alert(
                t("confirm"),
                t("redeemConfirm", { count: selected.cost }),
                [
                  { text: t("cancel"), style: "cancel" },
                  { text: t("redeem"), onPress: () => void redeem() },
                ],
              )
            }
          />
          <Action
            secondary
            label={t("cancel")}
            disabled={busy}
            onPress={() => setSelected(null)}
          />
        </View>
      )}
      <Action
        secondary
        label={t("rules")}
        onPress={() => router.push("/coins/rules" as any)}
      />
      <Heading>{t("history")}</Heading>
      {!history.length && <Note>{t("emptyHistory")}</Note>}
      {history.map((x) => (
        <View key={x.id} style={{ gap: 5 }}>
          <Note>
            {t(x.reason)} · {x.delta > 0 ? "+" : ""}
            {x.delta} ·{" "}
            {new Date(x.created_at).toLocaleDateString(i18n.language)}
          </Note>
          {x.reward_status && <Note>{t(x.reward_status)}</Note>}
          {x.ticket_no && (
            <Note>{t("ticketNumber", { number: x.ticket_no })}</Note>
          )}
        </View>
      ))}
      {history.length >= 30 && (
        <Action
          secondary
          label={t("more")}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void v21Api
              .history(history.at(-1)?.id)
              .then((r) => setHistory((h) => [...h, ...r.items]))
              .catch((e) => v21Error(e, t))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </V21Layout>
  );
}
