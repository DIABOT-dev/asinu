/**
 * FamilyLink API - Add Relative
 *
 * POST /api/relative/add
 * Body: { relative_id: uuid, relation_type: string, role: 'viewer' | 'editor' }
 *
 * Feature flag: RELATIVE_ENABLED (OFF by default for QA Freeze 0.9.0)
 * When OFF: Returns 404
 */

import { NextRequest, NextResponse } from "next/server";
import { featureGate } from "@/lib/middleware/featureGate";
import { getSession } from "@/infrastructure/auth/session";
import { familyService } from "@/modules/family/service";

export async function POST(req: NextRequest) {
  // Feature gate: return 404 if RELATIVE_ENABLED is OFF
  const gateResult = featureGate('RELATIVE_ENABLED');
  if (gateResult) return gateResult;

  // Feature is enabled, proceed with logic
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { relative_id, relation_type, role = "viewer" } = body ?? {};

    if (!relative_id || typeof relative_id !== "string") {
      return NextResponse.json({ error: "relative_id is required" }, { status: 400 });
    }

    const relation = String(relation_type ?? "other");
    const resolvedRole = String(role ?? "viewer");

    await familyService.addRelative(session.user_id, relative_id, relation as any, resolvedRole as any);

    const relatives = await familyService.listRelatives(session.user_id);
    return NextResponse.json({
      success: true,
      data: relatives,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in /api/relative/add:', error);
    if (error instanceof Error && "status" in error && typeof (error as any).status === "number") {
      return NextResponse.json({ error: error.message }, { status: (error as any).status });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
