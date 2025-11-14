import crypto from "crypto";
import { query } from "@/lib/db_client";
import type { SessionPayload } from "@/lib/auth/session";

export type SessionRecord = SessionPayload & {
  session_id: string;
  expires_at: Date;
};

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 60 * 60);

function generateSessionId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function buildExpiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

function serializeMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "{}";
  }
  return JSON.stringify(metadata);
}

export async function createSession(
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  const expiresAt = buildExpiresAt();
  await query(
    `INSERT INTO auth_session (session_id, user_id, metadata, expires_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [sessionId, userId, serializeMetadata(metadata), expiresAt.toISOString()],
  );
  return { sessionId, expiresAt };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await query("DELETE FROM auth_session WHERE session_id = $1", [sessionId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await query("DELETE FROM auth_session WHERE expires_at <= now()");
}

export async function getUserFromSession(sessionId: string): Promise<SessionRecord | null> {
  if (!sessionId) return null;
  const result = await query<{
    session_id: string;
    user_id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    expires_at: Date;
  }>(
    `SELECT s.session_id,
            s.user_id,
            s.expires_at,
            u.email,
            u.phone,
            u.display_name
     FROM auth_session s
     JOIN app_user u ON u.user_id = s.user_id
     WHERE s.session_id = $1 AND s.expires_at > now()`,
    [sessionId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    session_id: row.session_id,
    user_id: row.user_id,
    email: row.email,
    phone: row.phone,
    display_name: row.display_name,
    expires_at: row.expires_at,
  };
}

export async function getSession(cookieValue?: string | null): Promise<SessionRecord | null> {
  if (!cookieValue) return null;
  return getUserFromSession(cookieValue);
}
