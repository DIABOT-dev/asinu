import { NextRequest, NextResponse } from "next/server";
import { featureGate } from "@/lib/middleware/featureGate";
import { getSession } from "@/infrastructure/auth/session";
import { familyService } from "@/modules/family/service";

export async function DELETE(req: NextRequest) {
  const gate = featureGate("RELATIVE_ENABLED");
  if (gate) return gate;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const relativeId = body?.relative_id;
    if (!relativeId || typeof relativeId !== "string") {
      return NextResponse.json({ error: "relative_id is required" }, { status: 400 });
    }

    await familyService.removeRelative(session.user_id, relativeId);
    const relatives = await familyService.listRelatives(session.user_id);
    return NextResponse.json({ success: true, data: relatives });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return NextResponse.json({ error: error.message }, { status: (error as any).status });
    }
    console.error("[relative/remove] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
