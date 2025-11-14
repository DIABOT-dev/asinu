import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STATE_TTL = 5 * 60; // seconds

function cookieName(provider: string) {
  return `oauth_state_${provider}`;
}

export function createState(): string {
  return crypto.randomUUID();
}

export function attachStateCookie(res: NextResponse, provider: string, state: string) {
  res.cookies.set(cookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL,
  });
}

export function readStateCookie(req: NextRequest, provider: string): string | null {
  return req.cookies.get(cookieName(provider))?.value ?? null;
}

export function clearStateCookie(res: NextResponse, provider: string) {
  res.cookies.set(cookieName(provider), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function buildRedirectTarget(req: NextRequest, fallbackPath: string) {
  const url = new URL(req.url);
  url.pathname = fallbackPath;
  url.search = "";
  return url;
}
