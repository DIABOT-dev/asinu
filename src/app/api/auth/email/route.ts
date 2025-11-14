import type { NextRequest } from "next/server";
import { handleEmailAction } from "@/modules/auth/http/email";
import { jsonError } from "@/lib/http/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handleEmailAction(req);
}

export function GET(req: NextRequest) {
  return jsonError("METHOD_NOT_ALLOWED", { request: req, status: 405 });
}
