import crypto, { randomUUID } from "crypto";
import { query } from "@/lib/db_client";

type BridgeEventPayload = Record<string, unknown>;

const BRIDGE_ISSUER = process.env.BRIDGE_ISSUER || "asinu.app";
const BRIDGE_AUDIENCE = process.env.BRIDGE_AUDIENCE || "dia-brain";

export type BridgeEmitResult = {
  delivered: boolean;
  skipped: boolean;
  status?: number;
};

export type MissionDoneEvent = {
  userId: string;
  missionId: string;
  missionCode?: string | null;
  points: number;
  ts: string;
};

export function emitMissionDoneEvent(event: MissionDoneEvent) {
  return emitBridgeEvent("mission_done", {
    user_id: event.userId,
    mission_id: event.missionId,
    mission_code: event.missionCode ?? null,
    points: event.points,
    ts: event.ts,
  });
}

export function isBridgeConfigured(): boolean {
  return Boolean(process.env.BRIDGE_URL && process.env.BRIDGE_KEY);
}

export async function emitBridgeEvent(event: string, payload: BridgeEventPayload): Promise<BridgeEmitResult> {
  if (!isBridgeConfigured()) {
    return { delivered: false, skipped: true };
  }

  const eventId = randomUUID();
  const userId = typeof payload.user_id === "string" ? payload.user_id : null;
  const userHash = userId ? hashUserId(userId) : null;

  const sanitizedPayload: Record<string, unknown> = {
    ...payload,
    model: payload.model ?? "mission-lite",
    temperature: payload.temperature ?? 0,
  };

  if (userHash) {
    sanitizedPayload.user_hash = userHash;
  }

  delete sanitizedPayload.user_id;

  const logId = await insertBridgeLog({
    event,
    eventId,
    userId,
    userHash,
    payload: sanitizedPayload,
  });

  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    event_id: eventId,
    event,
    payload: sanitizedPayload,
    timestamp,
  });

  try {
    const token = signBridgeJwt({
      iss: BRIDGE_ISSUER,
      aud: BRIDGE_AUDIENCE,
      sub: userHash ?? undefined,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
      jti: eventId,
      event,
    });

    const response = await fetch(process.env.BRIDGE_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      await updateBridgeLog(logId, { delivered: false, status: response.status, error: detail });
      console.warn("[bridge] failed", event, response.status, detail);
    } else {
      await updateBridgeLog(logId, { delivered: true, status: response.status });
    }

    return { delivered: response.ok, skipped: false, status: response.status };
  } catch (error) {
    console.warn("[bridge] emit failed", event, error);
    await updateBridgeLog(logId, { delivered: false, error: error instanceof Error ? error.message : String(error) });
    return { delivered: false, skipped: false };
  }
}

function hashUserId(userId: string): string {
  const secret =
    process.env.BRIDGE_HASH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "asinu.hash.secret";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}

function signBridgeJwt(claims: Record<string, unknown>): string {
  const secret = process.env.BRIDGE_KEY;
  if (!secret) {
    throw new Error("BRIDGE_KEY is required to sign bridge events");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(cleanClaims(claims)));
  const signature = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64");
  const sigB64 = signature.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function cleanClaims(claims: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(claims).filter(([, value]) => value !== undefined));
}

async function insertBridgeLog(params: {
  event: string;
  eventId: string;
  userId: string | null;
  userHash: string | null;
  payload: Record<string, unknown>;
}): Promise<number | null> {
  if (!process.env.DATABASE_URL && !process.env.DIABOT_DB_URL) {
    return null;
  }
  try {
    const result = await query<{ id: number }>(
      `INSERT INTO bridge_log (event, event_id, user_id, user_hash, payload, created_at, updated_at)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb, now(), now())
       RETURNING id`,
      [params.event, params.eventId, params.userId, params.userHash, JSON.stringify(params.payload)],
    );
    return result.rows[0]?.id ?? null;
  } catch (error) {
    console.warn("[bridge] failed to insert log", error);
    return null;
  }
}

async function updateBridgeLog(
  id: number | null,
  data: { delivered?: boolean; status?: number; error?: string | null },
) {
  if (!id) return;
  if (!process.env.DATABASE_URL && !process.env.DIABOT_DB_URL) {
    return;
  }
  try {
    await query(
      `UPDATE bridge_log
       SET delivered = COALESCE($2, delivered),
           status = COALESCE($3, status),
           error = COALESCE($4, error),
           updated_at = now()
       WHERE id = $1`,
      [id, data.delivered ?? null, data.status ?? null, data.error ?? null],
    );
  } catch (error) {
    console.warn("[bridge] failed to update log", error);
  }
}
