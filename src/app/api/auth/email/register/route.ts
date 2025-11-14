import type { NextRequest } from "next/server";
import { handleEmailRegister } from "@/modules/auth/http/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handleEmailRegister(req);
}
