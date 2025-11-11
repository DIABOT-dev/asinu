import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/getUserId";
import { featureGate } from "@/lib/middleware/featureGate";
import { MissionLimitError, MissionNotFoundError, missionService } from "@/modules/mission/service";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { isDbUnavailableError } from "@/lib/errors/db";

const BodySchema = z.object({
  mission_id: z.string().uuid(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const gate = featureGate("FEATURE_MISSION");
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
    const result = await missionService.checkinMission(userId, parsed.data.mission_id);
    return jsonSuccess(result, { request: req, cacheControl: "no-store" });
  } catch (error: any) {
    if (error instanceof MissionNotFoundError) {
      return jsonError("NOT_FOUND", {
        request: req,
        message: "Nhiệm vụ không tồn tại hoặc đã bị tắt.",
      });
    }
    if (error instanceof MissionLimitError) {
      return jsonError("CONFLICT", {
        request: req,
        message: "Bạn đã hoàn thành nhiệm vụ này đủ số lần cho hôm nay.",
      });
    }
    if (isDbUnavailableError(error)) {
      return jsonError("DB_UNAVAILABLE", { request: req });
    }
    console.error("[missions/checkin] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}
