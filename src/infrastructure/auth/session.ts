import type { NextRequest } from "next/server";
import { cookies as nextCookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from "@/lib/auth/session";
import {
  createSession,
  deleteSession,
  getSession as getSessionRecord,
} from "@/lib/session";

const SESSION_COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_COOKIE_SECURE = process.env.NODE_ENV === "production";
const SESSION_COOKIE_SAMESITE = (process.env.SAMESITE || "Lax").toLowerCase() as
  | "lax"
  | "strict"
  | "none";
const SESSION_MAX_AGE = Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 60 * 60);
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readSessionId(req?: NextRequest) {
  if (req) {
    return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  }
  try {
    return nextCookies().get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

function writeCookie(res: any, value: string, maxAge: number) {
  res.cookies.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    path: "/",
    domain: SESSION_COOKIE_DOMAIN,
    maxAge,
  });
}

export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  const sessionId = readSessionId(req);
  if (!sessionId) return null;
  const record = await getSessionRecord(sessionId);
  if (!record) return null;
  return {
    user_id: record.user_id,
    email: record.email ?? null,
    phone: record.phone ?? null,
    display_name: record.display_name ?? null,
  };
}

export async function setSession(
  res: any,
  session: SessionPayload,
  metadata?: Record<string, unknown>,
) {
  const { sessionId } = await createSession(session.user_id, metadata);
  writeCookie(res, sessionId, SESSION_MAX_AGE);
}

export async function clearSession(res: any, req?: NextRequest) {
  const sessionId = readSessionId(req);
  if (sessionId) {
    await deleteSession(sessionId);
  }
  writeCookie(res, "", 0);
}

export function hasSessionCookie(req: NextRequest) {
  const value = readSessionId(req);
  if (!value) return false;
  return SESSION_ID_PATTERN.test(value);
}
