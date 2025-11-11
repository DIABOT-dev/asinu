import { query } from "@/lib/db_client";

export type UserContext = {
  bg_latest?: { value: number; unit: string; time_ago: string };
  water_today_ml?: number;
  last_meal?: { brief: string; ts: string } | null;
  weight_latest?: { kg: number; ts: string } | null;
  bp_latest?: { systolic: number; diastolic: number; ts: string } | null;
  streaks?: { bg_days: number };
  tz: string;
};

export async function buildUserContext(userId: string): Promise<UserContext> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [bgRes, waterRes, mealRes, weightRes, bpRes, streakRes] = await Promise.all([
    query<{ value_mgdl: number; noted_at: Date }>(
      `SELECT value_mgdl, noted_at
       FROM log_bg
       WHERE user_id = $1
       ORDER BY noted_at DESC
       LIMIT 1`,
      [userId],
    ),
    query<{ total_ml: number | null }>(
      `SELECT SUM(volume_ml)::float AS total_ml
       FROM log_water
       WHERE user_id = $1 AND noted_at >= $2`,
      [userId, startOfDay.toISOString()],
    ),
    query<{ title: string | null; meal_type: string | null; portion: string | null; noted_at: Date }>(
      `SELECT title, meal_type, portion, noted_at
       FROM log_meal
       WHERE user_id = $1
       ORDER BY noted_at DESC
       LIMIT 1`,
      [userId],
    ),
    query<{ weight_kg: number; noted_at: Date }>(
      `SELECT weight_kg, noted_at
       FROM log_weight
       WHERE user_id = $1
       ORDER BY noted_at DESC
       LIMIT 1`,
      [userId],
    ),
    query<{ sys: number; dia: number; noted_at: Date }>(
      `SELECT sys, dia, noted_at
       FROM log_bp
       WHERE user_id = $1
       ORDER BY noted_at DESC
       LIMIT 1`,
      [userId],
    ),
    query<{ day: Date }>(
      `SELECT date_trunc('day', noted_at)::date AS day
       FROM log_bg
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, thirtyDaysAgo.toISOString()],
    ),
  ]);

  const bgRow = bgRes.rows?.[0];
  const bg_latest = bgRow
    ? {
        value: Number(bgRow.value_mgdl),
        unit: "mg/dL",
        time_ago: timeAgo(bgRow.noted_at),
      }
    : undefined;

  const water_today_ml = waterRes.rows?.[0]?.total_ml ? Math.round(Number(waterRes.rows[0].total_ml)) : 0;

  const mealRow = mealRes.rows?.[0];
  const last_meal = mealRow
    ? {
        brief: buildMealBrief(mealRow),
        ts: mealRow.noted_at.toISOString(),
      }
    : null;

  const weightRow = weightRes.rows?.[0];
  const weight_latest = weightRow
    ? {
        kg: Number(weightRow.weight_kg),
        ts: weightRow.noted_at.toISOString(),
      }
    : null;

  const bpRow = bpRes.rows?.[0];
  const bp_latest = bpRow
    ? {
        systolic: Number(bpRow.sys),
        diastolic: Number(bpRow.dia),
        ts: bpRow.noted_at.toISOString(),
      }
    : null;

  const streakDays = computeBgStreak(streakRes.rows?.map((row) => row.day) || []);

  return {
    bg_latest,
    water_today_ml,
    last_meal,
    weight_latest,
    bp_latest,
    streaks: { bg_days: streakDays },
    tz: "Asia/Bangkok",
  };
}

function timeAgo(ts: Date): string {
  const diffMs = Date.now() - ts.getTime();
  const hours = Math.floor(diffMs / 3.6e6);
  if (hours < 1) return "vừa xong";
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function buildMealBrief(row: { title: string | null; meal_type: string | null; portion: string | null }): string {
  const parts = [];
  if (row.meal_type) parts.push(row.meal_type);
  if (row.title) parts.push(row.title);
  const base = parts.join(": ") || "Bữa gần nhất";
  if (row.portion) return `${base} (khẩu phần: ${row.portion})`;
  return base;
}

function computeBgStreak(days: Date[]): number {
  const dayKeys = new Set(days.map((day) => day.toISOString().slice(0, 10)));
  let streak = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    if (dayKeys.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
