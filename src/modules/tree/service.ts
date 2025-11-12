import { isFeatureEnabled } from "../../../config/feature-flags";
import { getPool, query } from "@/lib/db_client";
import type { AwardTreePointsInput, TreeState } from "./types";

const LEVEL_THRESHOLDS = [
  { level: 1, threshold: 0 },
  { level: 2, threshold: 50 },
  { level: 3, threshold: 150 },
  { level: 4, threshold: 300 },
  { level: 5, threshold: 500 },
  { level: 6, threshold: 800 },
  { level: 7, threshold: 1100 },
  { level: 8, threshold: 1500 },
  { level: 9, threshold: 2000 },
  { level: 10, threshold: 2500 },
];

export const TREE_DAILY_TARGET = 60;

export function resolveTreeLevel(totalPoints: number): number {
  let level = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalPoints >= threshold.threshold) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
}

function nextLevelThreshold(totalPoints: number): number {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalPoints < threshold.threshold) {
      return threshold.threshold;
    }
  }
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last.threshold;
}

function isSameDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function isPreviousDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  const prev = new Date(b);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return isSameDay(a, prev);
}

function mapStateRow(userId: string, row?: any): TreeState {
  const totalPoints = row?.total_points ?? 0;
  const level = row?.level ?? resolveTreeLevel(totalPoints);
  const eDay = row?.e_day ?? 0;
  const streak = row?.streak ?? 0;
  const lastEventAt = row?.last_event_at ? new Date(row.last_event_at).toISOString() : null;
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : null;
  return {
    user_id: userId,
    level,
    total_points: totalPoints,
    e_day: eDay,
    streak,
    last_event_at: lastEventAt,
    updated_at: updatedAt,
    next_level_points: nextLevelThreshold(totalPoints),
    daily_target: TREE_DAILY_TARGET,
  };
}

export async function getTreeState(userId: string): Promise<TreeState> {
  const res = await query(
    `SELECT total_points, level, e_day, streak, last_event_at, updated_at
     FROM asinu_app.tree_state WHERE user_id = $1`,
    [userId],
  );
  return mapStateRow(userId, res.rows[0]);
}

export async function awardTreePoints(input: AwardTreePointsInput): Promise<TreeState | null> {
  if (!isFeatureEnabled("TREE_ENABLED")) return null;
  if (input.delta <= 0) return null;

  const pool = getPool();
  const client = await pool.connect();
  const now = new Date();
  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `INSERT INTO asinu_app.tree_events (user_id, event_type, amount, meta, idempotency_key)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        input.userId,
        input.reason,
        input.delta,
        JSON.stringify(input.meta ?? {}),
        input.idempotencyKey ?? null,
      ],
    );

    if (input.idempotencyKey && eventResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return await getTreeState(input.userId);
    }

    const eventId = eventResult.rows[0]?.id ?? null;

    const ledgerResult = await client.query(
      `INSERT INTO asinu_app.points_ledger (user_id, delta, reason, event_id, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        input.userId,
        input.delta,
        input.reason,
        eventId,
        input.idempotencyKey ?? null,
      ],
    );

    if (input.idempotencyKey && ledgerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return await getTreeState(input.userId);
    }

    const stateRes = await client.query(
      `SELECT total_points, level, e_day, streak, last_event_at
       FROM asinu_app.tree_state
       WHERE user_id = $1
       FOR UPDATE`,
      [input.userId],
    );
    const existing = stateRes.rows[0];

    const totalPoints = (existing?.total_points ?? 0) + input.delta;
    const level = resolveTreeLevel(totalPoints);
    const lastEvent = existing?.last_event_at ? new Date(existing.last_event_at) : null;
    const sameDay = isSameDay(lastEvent, now);
    const prevDay = isPreviousDay(lastEvent, now);
    const previousEDay = existing?.e_day ?? 0;
    let newEDay = sameDay ? previousEDay + input.delta : input.delta;
    if (newEDay < 0) newEDay = 0;
    let newStreak = existing?.streak ?? 0;
    if (!sameDay) {
      if (prevDay && previousEDay >= TREE_DAILY_TARGET) {
        newStreak += 1;
      } else {
        newStreak = 0;
      }
    }

    await client.query(
      `INSERT INTO asinu_app.tree_state (
         user_id, total_points, level, e_day, streak, last_event_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         total_points = EXCLUDED.total_points,
         level = EXCLUDED.level,
         e_day = EXCLUDED.e_day,
         streak = EXCLUDED.streak,
         last_event_at = EXCLUDED.last_event_at,
         updated_at = EXCLUDED.updated_at`,
      [
        input.userId,
        totalPoints,
        level,
        newEDay,
        newStreak,
        now.toISOString(),
        now.toISOString(),
      ],
    );

    await client.query("COMMIT");
    return mapStateRow(input.userId, {
      total_points: totalPoints,
      level,
      e_day: newEDay,
      streak: newStreak,
      last_event_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
