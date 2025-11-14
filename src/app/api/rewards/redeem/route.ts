import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/getUserId";
import { featureGateAll } from "@/lib/middleware/featureGate";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { redeemRewardItem } from "@/modules/rewards/service";
import { RewardServiceError } from "@/modules/rewards/errors";

const BodySchema = z.object({
  item_id: z.string().uuid(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mapRewardError(error: RewardServiceError, req: NextRequest) {
  switch (error.code) {
    case "ITEM_NOT_FOUND":
      return jsonError("NOT_FOUND", { request: req, message: error.message, status: error.status });
    case "OUT_OF_STOCK":
    case "INSUFFICIENT_POINTS":
      return jsonError("CONFLICT", { request: req, message: error.message, status: error.status });
    default:
      return jsonError("BAD_REQUEST", { request: req, message: error.message, status: error.status });
  }
}

export async function POST(req: NextRequest) {
  const gate = featureGateAll("TREE_ENABLED", "REWARDS_ENABLED");
  if (gate) return gate;

  const userId = await requireAuth(req).catch(() => null);
  if (!userId) {
    return jsonError("UNAUTHORIZED", { request: req });
  }

  const payload = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", {
      request: req,
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await redeemRewardItem(userId, parsed.data.item_id);
    return jsonSuccess(result, { request: req, cacheControl: "no-store" });
  } catch (error: any) {
    if (error instanceof RewardServiceError) {
      return mapRewardError(error, req);
    }
    console.error("[rewards/redeem] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}
