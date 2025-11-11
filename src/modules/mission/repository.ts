import type { QueryResult } from "pg";
import { getPool, query as runQuery } from "@/lib/db_client";
import type { MissionDefinition, MissionProgress, MissionStatus } from "./types";

type QueryExecutor = {
  query: <T>(text: string, params?: any[]) => Promise<QueryResult<T>>;
};

export type MissionDbClient = QueryExecutor;

function getExecutor(client?: MissionDbClient): QueryExecutor {
  if (client) return client;
  return {
    query: <T>(text: string, params?: any[]): Promise<QueryResult<T>> => runQuery<T>(text, params),
  };
}

function toIso(input: Date): string {
  return input.toISOString();
}

export interface MissionRepository {
  ensureAssignmentsForDate(
    userId: string,
    missionDate: string,
    client?: MissionDbClient,
  ): Promise<void>;
  ensureAssignmentForMission(
    userId: string,
    missionId: string,
    missionDate: string,
    client?: MissionDbClient,
  ): Promise<void>;
  fetchTodayMissions(
    userId: string,
    missionDate: string,
    range: { start: Date; end: Date },
  ): Promise<MissionProgress[]>;
  getMissionById(missionId: string, client?: MissionDbClient): Promise<MissionDefinition | null>;
  getTodayLogCount(
    userId: string,
    missionId: string,
    range: { start: Date; end: Date },
    client?: MissionDbClient,
  ): Promise<number>;
  getLastLogTimestamp(
    userId: string,
    missionId: string,
    client?: MissionDbClient,
  ): Promise<Date | null>;
  insertMissionLog(
    params: { userId: string; missionId: string; ts: Date; points: number; metadata?: Record<string, unknown> },
    client?: MissionDbClient,
  ): Promise<void>;
  updateUserMissionStatus(
    params: {
      userId: string;
      missionId: string;
      missionDate: string;
      status: MissionStatus;
      completedAt: Date | null;
    },
    client?: MissionDbClient,
  ): Promise<void>;
}

export function createDbMissionRepository(): MissionRepository {
  return {
    async ensureAssignmentsForDate(userId, missionDate, client) {
      const executor = getExecutor(client);
      await executor.query(
        `INSERT INTO user_missions (user_id, mission_id, mission_date, status, created_at, updated_at)
         SELECT $1, mission_id, $2::date, 'pending', now(), now()
         FROM missions
         WHERE active_from <= $2::date
           AND (active_to IS NULL OR active_to >= $2::date)
         ON CONFLICT (user_id, mission_id, mission_date) DO NOTHING`,
        [userId, missionDate],
      );
    },

    async ensureAssignmentForMission(userId, missionId, missionDate, client) {
      const executor = getExecutor(client);
      await executor.query(
        `INSERT INTO user_missions (user_id, mission_id, mission_date, status, created_at, updated_at)
         VALUES ($1, $2, $3::date, 'pending', now(), now())
         ON CONFLICT (user_id, mission_id, mission_date) DO NOTHING`,
        [userId, missionId, missionDate],
      );
    },

    async fetchTodayMissions(userId, missionDate, range) {
      const rows = await runQuery<{
        mission_id: string;
        code: string;
        title: string;
        cluster: string;
        energy: number;
        max_per_day: number;
        status: MissionStatus | null;
        completed_at: Date | null;
        completed_count: number;
      }>(
        `WITH active AS (
           SELECT mission_id, code, title, cluster, energy, max_per_day
           FROM missions
           WHERE active_from <= $2::date
             AND (active_to IS NULL OR active_to >= $2::date)
         ),
         today_counts AS (
           SELECT mission_id, COUNT(*)::int AS completed_count
           FROM mission_log
           WHERE user_id = $1
             AND ts >= $3
             AND ts < $4
           GROUP BY mission_id
         )
         SELECT
           a.mission_id,
           a.code,
           a.title,
           a.cluster,
           a.energy,
           a.max_per_day,
           COALESCE(um.status, 'pending') AS status,
           um.completed_at,
           COALESCE(tc.completed_count, 0) AS completed_count
         FROM active a
         LEFT JOIN user_missions um
           ON um.user_id = $1
          AND um.mission_id = a.mission_id
          AND um.mission_date = $2::date
         LEFT JOIN today_counts tc
           ON tc.mission_id = a.mission_id
         ORDER BY a.code`,
        [userId, missionDate, toIso(range.start), toIso(range.end)],
      );
      return rows.rows.map((row) => ({
        mission_id: row.mission_id,
        code: row.code,
        title: row.title,
        cluster: row.cluster,
        energy: row.energy,
        max_per_day: row.max_per_day,
        status: (row.status ?? "pending") as MissionStatus,
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
        completed_count: row.completed_count,
      }));
    },

    async getMissionById(missionId, client) {
      const executor = getExecutor(client);
      const result = await executor.query<MissionDefinition>(
        `SELECT mission_id, code, title, cluster, energy, max_per_day
         FROM missions
         WHERE mission_id = $1
         LIMIT 1`,
        [missionId],
      );
      return result.rows[0] ?? null;
    },

    async getTodayLogCount(userId, missionId, range, client) {
      const executor = getExecutor(client);
      const result = await executor.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM mission_log
         WHERE user_id = $1
           AND mission_id = $2
           AND ts >= $3
           AND ts < $4`,
        [userId, missionId, toIso(range.start), toIso(range.end)],
      );
      const count = result.rows[0]?.count ?? "0";
      return Number.parseInt(count, 10);
    },

    async getLastLogTimestamp(userId, missionId, client) {
      const executor = getExecutor(client);
      const result = await executor.query<{ ts: Date }>(
        `SELECT ts
         FROM mission_log
         WHERE user_id = $1
           AND mission_id = $2
         ORDER BY ts DESC
         LIMIT 1`,
        [userId, missionId],
      );
      const ts = result.rows[0]?.ts ?? null;
      return ts ? new Date(ts) : null;
    },

    async insertMissionLog(params, client) {
      const executor = getExecutor(client);
      await executor.query(
        `INSERT INTO mission_log (user_id, mission_id, ts, points, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [
          params.userId,
          params.missionId,
          toIso(params.ts),
          params.points,
          JSON.stringify(params.metadata ?? { source: "checkin" }),
        ],
      );
    },

    async updateUserMissionStatus(params, client) {
      const executor = getExecutor(client);
      await executor.query(
        `INSERT INTO user_missions (user_id, mission_id, mission_date, status, completed_at, created_at, updated_at)
         VALUES ($1, $2, $3::date, $4, $5, now(), now())
         ON CONFLICT (user_id, mission_id, mission_date) DO UPDATE
         SET status = EXCLUDED.status,
             completed_at = CASE
               WHEN EXCLUDED.status = 'done' THEN EXCLUDED.completed_at
               ELSE user_missions.completed_at
             END,
             updated_at = now()`,
        [
          params.userId,
          params.missionId,
          params.missionDate,
          params.status,
          params.completedAt ? toIso(params.completedAt) : null,
        ],
      );
    },
  };
}

export async function getDbPoolClient() {
  const pool = getPool();
  return pool.connect();
}
