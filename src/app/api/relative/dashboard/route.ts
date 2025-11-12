import { NextRequest, NextResponse } from "next/server";
import { featureGate } from "@/lib/middleware/featureGate";
import { getSession } from "@/infrastructure/auth/session";
import { familyService } from "@/modules/family/service";
import { query } from "@/lib/db_client";
import type { RangeOption } from "@/modules/chart/domain/types";

const RANGE_DAYS: Record<RangeOption, number> = {
  "7d": 7,
  "30d": 30,
};

export async function GET(req: NextRequest) {
  const gate = featureGate("RELATIVE_ENABLED");
  if (gate) return gate;

  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("user_id") ?? session.user_id;
    const rangeParam = (url.searchParams.get("range") as RangeOption) || "7d";
    const range: RangeOption = rangeParam === "30d" ? "30d" : "7d";

    if (targetUserId !== session.user_id) {
      await familyService.assertViewer(session.user_id, targetUserId);
    }

    const data = await fetchDashboardData(targetUserId, range);
    return NextResponse.json({ success: true, user_id: targetUserId, data });
  } catch (error) {
    console.error("[relative/dashboard] failed", error);
    if (error instanceof Error && "status" in error) {
      return NextResponse.json({ error: error.message }, { status: (error as any).status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type ChartDay = {
  date: string;
  bg_avg?: number;
  bp_sys_avg?: number;
  bp_dia_avg?: number;
  weight_kg?: number;
  water_ml?: number;
  insulin_units?: number;
  meals_count?: number;
};

async function fetchDashboardData(userId: string, range: RangeOption) {
  const daysCount = RANGE_DAYS[range];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (daysCount - 1));
  const startIso = start.toISOString();

  const [bg, bp, water, weight, insulin, meals] = await Promise.all([
    query(
      `SELECT date_trunc('day', noted_at)::date AS day, AVG(value_mgdl)::float AS avg_bg
       FROM log_bg
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, startIso],
    ),
    query(
      `SELECT date_trunc('day', noted_at)::date AS day,
              AVG(sys)::float  AS sys_avg,
              AVG(dia)::float  AS dia_avg
       FROM log_bp
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, startIso],
    ),
    query(
      `SELECT date_trunc('day', noted_at)::date AS day, SUM(volume_ml)::float AS total_ml
       FROM log_water
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, startIso],
    ),
    query(
      `SELECT DISTINCT ON (date_trunc('day', noted_at)::date)
              date_trunc('day', noted_at)::date AS day,
              weight_kg
       FROM log_weight
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY date_trunc('day', noted_at)::date, noted_at DESC`,
      [userId, startIso],
    ),
    query(
      `SELECT date_trunc('day', noted_at)::date AS day, SUM(dose_units)::float AS total_units
       FROM log_insulin
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, startIso],
    ),
    query(
      `SELECT date_trunc('day', noted_at)::date AS day, COUNT(*)::int AS total_meals
       FROM log_meal
       WHERE user_id = $1 AND noted_at >= $2
       GROUP BY 1`,
      [userId, startIso],
    ),
  ]);

  const dayMap = buildDayMap(start, daysCount);
  apply(dayMap, bg.rows, (day, row: any) => {
    day.bg_avg = row.avg_bg ?? undefined;
  });
  apply(dayMap, bp.rows, (day, row: any) => {
    day.bp_sys_avg = row.sys_avg ?? undefined;
    day.bp_dia_avg = row.dia_avg ?? undefined;
  });
  apply(dayMap, water.rows, (day, row: any) => {
    day.water_ml = row.total_ml ?? undefined;
  });
  apply(dayMap, weight.rows, (day, row: any) => {
    day.weight_kg = row.weight_kg ?? undefined;
  });
  apply(dayMap, insulin.rows, (day, row: any) => {
    day.insulin_units = row.total_units ?? undefined;
  });
  apply(dayMap, meals.rows, (day, row: any) => {
    day.meals_count = row.total_meals ?? undefined;
  });

  const collection = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const latestBg = latestNumber(collection, (d) => d.bg_avg);
  const latestBp = [...collection]
    .reverse()
    .find((d) => typeof d.bp_sys_avg === "number" && typeof d.bp_dia_avg === "number");
  const latestWater = latestNumber(collection, (d) => d.water_ml);
  const latestWeight = latestNumber(collection, (d) => d.weight_kg);
  const latestInsulin = latestNumber(collection, (d) => d.insulin_units);

  return {
    glucose: {
      latest: latestBg ?? null,
      avg_7d: average(collection.slice(-7).map((d) => d.bg_avg)),
      readings: collection,
    },
    meals: {
      today: collection.slice(-1)[0]?.meals_count ?? 0,
      avg_calories: null,
      recent: [],
    },
    water: {
      today_ml: latestWater ?? 0,
      goal_ml: 2000,
      percentage: latestWater ? Math.min(100, Math.round((latestWater / 2000) * 100)) : 0,
    },
    bp: {
      latest: latestBp ? { systolic: latestBp.bp_sys_avg, diastolic: latestBp.bp_dia_avg } : null,
      trend: null,
    },
    weight: {
      latest_kg: latestWeight ?? null,
      trend: null,
    },
    insulin: {
      today_units: latestInsulin ?? 0,
      doses: [],
    },
  };
}

function buildDayMap(start: Date, days: number): Map<string, ChartDay> {
  const map = new Map<string, ChartDay>();
  for (let i = 0; i < days; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    const key = current.toISOString().slice(0, 10);
    map.set(key, { date: key });
  }
  return map;
}

function apply(map: Map<string, ChartDay>, rows: any[], assign: (day: ChartDay, row: any) => void) {
  rows.forEach((row) => {
    const date =
      row.day instanceof Date ? row.day.toISOString().slice(0, 10) : typeof row.day === "string" ? row.day.slice(0, 10) : null;
    if (!date) return;
    const entry = map.get(date);
    if (entry) assign(entry, row);
  });
}

function average(values: (number | undefined)[]) {
  const filtered = values.filter((v): v is number => typeof v === "number");
  if (!filtered.length) return null;
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return Number((sum / filtered.length).toFixed(1));
}

function latestNumber(collection: ChartDay[], selector: (day: ChartDay) => number | undefined) {
  for (let i = collection.length - 1; i >= 0; i -= 1) {
    const value = selector(collection[i]);
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}
