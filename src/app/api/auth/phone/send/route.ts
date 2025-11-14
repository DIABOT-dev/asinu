import type { NextRequest } from "next/server";
import { handlePhoneSend } from "@/modules/auth/http/phone";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handlePhoneSend(req);
}
