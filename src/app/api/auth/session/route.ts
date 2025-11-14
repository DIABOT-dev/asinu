import { NextRequest } from "next/server";
import { clearSession, getSession } from "@/infrastructure/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/response";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return jsonError("UNAUTHORIZED", { request: req });
  }
  return jsonSuccess(
    {
      user_id: session.user_id,
      email: session.email ?? null,
      phone: session.phone ?? null,
      display_name: session.display_name ?? null,
    },
    { request: req, cacheControl: "no-store" },
  );
}

export async function DELETE(req: NextRequest) {
  const res = jsonSuccess(
    { code: "SESSION_CLEARED" },
    { request: req, cacheControl: "no-store" },
  );
  await clearSession(res, req);
  return res;
}

export async function POST(req: NextRequest) {
  return jsonError("METHOD_NOT_ALLOWED", { request: req });
}
