import { requireSession } from "../context";
import { smokeFetch, parseJson } from "../http";
import type { SmokeContext, SmokeResult } from "../types";

type CatalogResponse = {
  ok: boolean;
  data?: {
    balance: number;
    items: Array<{ id: string; title: string; cost: number }>;
  };
};

export async function runRewardsSmoke(ctx: SmokeContext): Promise<SmokeResult> {
  requireSession(ctx, "Rewards");

  const catalogRes = await smokeFetch(ctx, { path: "/api/rewards/catalog" });
  if (catalogRes.status === 404) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "skip",
      details: "REWARDS_ENABLED/TREE_ENABLED disabled (404).",
    };
  }

  if (!catalogRes.ok) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "fail",
      error: new Error(`Catalog request failed (${catalogRes.status}).`),
    };
  }

  const catalogBody = (await parseJson(catalogRes)) as CatalogResponse;
  if (!catalogBody.ok || !catalogBody.data) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "fail",
      error: new Error("Invalid rewards catalog payload."),
    };
  }

  const itemCount = catalogBody.data.items?.length ?? 0;
  const balance = catalogBody.data.balance ?? 0;

  if (!ctx.allowWrites) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "pass",
      details: `catalog items=${itemCount}, balance=${balance} (writes disabled)`,
    };
  }

  const targetItemId =
    process.env.SMOKE_REDEEM_ITEM_ID || catalogBody.data.items?.[0]?.id;

  if (!targetItemId) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "pass",
      details: "Catalog empty; skipping redemption.",
    };
  }

  const redeemRes = await smokeFetch(ctx, {
    path: "/api/rewards/redeem",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ item_id: targetItemId }),
  });

  if (redeemRes.status === 409) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "skip",
      details: "Not enough points / item unavailable (409).",
    };
  }

  if (!redeemRes.ok) {
    return {
      id: "D",
      name: "Rewards + Donate",
      status: "fail",
      error: new Error(`Redeem failed (${redeemRes.status}).`),
    };
  }

  return {
    id: "D",
    name: "Rewards + Donate",
    status: "pass",
    details: `Redeemed item ${targetItemId}`,
  };
}
