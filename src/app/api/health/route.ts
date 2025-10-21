import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "anora",
    version: process.env.APP_VERSION ?? "dev",
    time: new Date().toISOString(),
  });
}
