import { NextRequest } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { jsonError, jsonSuccess } from "@/lib/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export function POST(req: NextRequest) {
  return jsonError("METHOD_NOT_ALLOWED", { request: req, status: 405 });
}

export function PUT(req: NextRequest) {
  return jsonError("METHOD_NOT_ALLOWED", { request: req, status: 405 });
}

export function DELETE(req: NextRequest) {
  return jsonError("METHOD_NOT_ALLOWED", { request: req, status: 405 });
}
