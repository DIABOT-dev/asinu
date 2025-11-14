import type { NextRequest } from "next/server";
import { handleEmailLogin } from "@/modules/auth/http/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handleEmailLogin(req);
}
