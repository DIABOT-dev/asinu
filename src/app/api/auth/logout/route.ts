import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/infrastructure/auth/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ code: "LOGOUT_SUCCESS" }, { status: 200 });
  await clearSession(res, req);
  return res;
}

export async function DELETE(req: NextRequest) {
  return POST(req);
}
