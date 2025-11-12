import { NextRequest, NextResponse } from "next/server";
import { featureGate } from "@/lib/middleware/featureGate";
import { getSession } from "@/infrastructure/auth/session";
import { familyService } from "@/modules/family/service";

export async function GET(req: NextRequest) {
  const gate = featureGate("RELATIVE_ENABLED");
  if (gate) return gate;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const relatives = await familyService.listRelatives(session.user_id);
  return NextResponse.json({ success: true, data: relatives });
}
