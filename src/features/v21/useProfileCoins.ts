import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "../auth/auth.store";
import { subscribeHealthAction } from "../../lib/health-action-events";
import { v21Api, type CoinEntry } from "./v21.api";

const EARNING_REASONS = new Set([
  "CHECKIN",
  "MED_ANSWER",
  "VITAL",
  "GIFT_OPEN",
  "WEEKLY",
]);
const vietnamDate = (entry: CoinEntry) => {
  const time = Date.parse(entry.created_at);
  return Number.isFinite(time)
    ? new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : "";
};

async function dailyEarnings(
  firstPage: { items: CoinEntry[] },
  serverDate: string,
  isCurrent: () => boolean
) {
  let page = firstPage;
  let total = 0;
  const cursors = new Set<string>();
  while (isCurrent()) {
    total += page.items.reduce(
      (sum, entry) =>
        vietnamDate(entry) === serverDate &&
        entry.delta > 0 &&
        EARNING_REASONS.has(entry.reason)
          ? sum + entry.delta
          : sum,
      0
    );
    const last = page.items.at(-1);
    if (page.items.length < 30 || !last || vietnamDate(last) < serverDate)
      return total;
    // History is paginated by ledger ID. Avoid showing an incomplete daily total.
    if (cursors.has(last.id)) return null;
    cursors.add(last.id);
    page = await v21Api.history(last.id);
  }
  return null;
}

export function useProfileCoins() {
  const userId = useAuthStore((state) => state.profile?.id);
  const [summary, setSummary] = useState<{
    owner?: string;
    enabled: boolean;
    balance: number | null;
    earnedToday: number | null;
  }>({ enabled: false, balance: null, earnedToday: null });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let latest = 0;
      const load = async () => {
        const request = ++latest;
        try {
          const flags = await v21Api.flags();
          if (!active || request !== latest) return;
          if (!flags.coins) {
            setSummary({
              owner: userId,
              enabled: false,
              balance: null,
              earnedToday: null,
            });
            return;
          }
          const [today, history] = await Promise.all([
            v21Api.coins(),
            v21Api.history().catch(() => null),
          ]);
          const earnedToday = history
            ? await dailyEarnings(
                history,
                today.serverDate,
                () => active && request === latest
              ).catch(() => null)
            : null;
          if (active && request === latest)
            setSummary({
              owner: userId,
              enabled: true,
              balance: today.balance,
              earnedToday,
            });
        } catch {
          // Retain the last confirmed balance for this account.
        }
      };
      if (userId) void load();
      const unsubscribe = subscribeHealthAction(() => {
        void load();
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }, [userId])
  );
  return summary.owner === userId
    ? summary
    : { enabled: false, balance: null, earnedToday: null };
}
