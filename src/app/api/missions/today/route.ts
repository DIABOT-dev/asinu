import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/getUserId";
import { featureGate } from "@/lib/middleware/featureGate";
import { missionService } from "@/modules/mission/service";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { isDbUnavailableError } from "@/lib/errors/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const gate = featureGate("FEATURE_MISSION");
  if (gate) return gate;

  const userId = await requireAuth(req).catch(() => null);
  if (!userId) {
    return jsonError("UNAUTHORIZED", { request: req });
  }

  try {
    const data = await missionService.getTodayMissions(userId);
    return jsonSuccess(data, { request: req, cacheControl: "no-store" });
  } catch (error: any) {
    if (isDbUnavailableError(error)) {
      return jsonError("DB_UNAVAILABLE", { request: req });
    }
    console.error("[missions/today] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}
