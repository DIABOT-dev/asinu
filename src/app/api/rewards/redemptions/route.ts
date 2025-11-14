import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/getUserId";
import { featureGateAll } from "@/lib/middleware/featureGate";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { listRedemptions } from "@/modules/rewards/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const gate = featureGateAll("TREE_ENABLED", "REWARDS_ENABLED");
  if (gate) return gate;

  const userId = await requireAuth(req).catch(() => null);
  if (!userId) {
    return jsonError("UNAUTHORIZED", { request: req });
  }

  try {
    const history = await listRedemptions(userId);
    return jsonSuccess({ items: history }, { request: req, cacheControl: "no-store" });
  } catch (error) {
    console.error("[rewards/redemptions] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}
