import { NextRequest, NextResponse } from "next/server";
import { featureGate } from "@/lib/middleware/featureGate";
import { getSession } from "@/infrastructure/auth/session";
import { getTreeState } from "@/modules/tree/service";

export async function GET(req: NextRequest) {
  const gate = featureGate("TREE_ENABLED");
  if (gate) return gate;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getTreeState(session.user_id);
  return NextResponse.json({ success: true, data: state });
}
