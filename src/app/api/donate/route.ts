import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/getUserId";
import { featureGateAll } from "@/lib/middleware/featureGate";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { recordDonation } from "@/modules/rewards/service";
import { RewardServiceError } from "@/modules/rewards/errors";
import { emitBridgeEvent } from "@/lib/bridge";

const BodySchema = z.object({
  provider: z.string().min(2).max(64),
  amount_points: z.number().int().min(0).optional().default(0),
  amount_vnd: z.number().int().min(0).optional().default(0),
  campaign: z.string().min(1).max(120).optional(),
  note: z.string().min(1).max(240).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const gate = featureGateAll("REWARDS_ENABLED", "DONATION_ENABLED");
  if (gate) return gate;

  const userId = await requireAuth(req).catch(() => null);
  if (!userId) {
    return jsonError("UNAUTHORIZED", { request: req });
  }

  const payload = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", { request: req, details: parsed.error.flatten() });
  }

  try {
    const donation = await recordDonation(userId, {
      provider: parsed.data.provider,
      amountPoints: parsed.data.amount_points,
      amountVnd: parsed.data.amount_vnd,
      campaign: parsed.data.campaign,
      note: parsed.data.note,
    });

    emitBridgeEvent("donate", {
      user_id: userId,
      provider: donation.provider,
      amount_points: donation.amount_points,
      amount_vnd: donation.amount_vnd,
      campaign: donation.campaign,
      ts: donation.created_at,
    }).catch((error) => {
      console.warn("[donate] bridge emit failed", error);
    });

    return jsonSuccess(donation, { request: req, cacheControl: "no-store", status: 201 });
  } catch (error: any) {
    if (error instanceof RewardServiceError) {
      const code =
        error.code === "INSUFFICIENT_POINTS" ? "CONFLICT" : error.code === "INVALID_DONATION" ? "BAD_REQUEST" : "BAD_REQUEST";
      return jsonError(code as any, {
        request: req,
        message: error.message,
        status: error.status,
        details: error.meta,
      });
    }
    console.error("[donate] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}
