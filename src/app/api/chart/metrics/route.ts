import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/getUserId";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { query } from "@/lib/db_client";
import type { ChartDay, KPI, RangeOption } from "@/modules/chart/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type BgRow = { day: Date; avg_bg: number | null };
type BpRow = { day: Date; sys_avg: number | null; dia_avg: number | null };
type WaterRow = { day: Date; total_ml: number | null };
type WeightRow = { day: Date; weight_kg: number | null };
type InsulinRow = { day: Date; total_units: number | null };
type MealRow = { day: Date; total_meals: number | null };

const RANGE_DAYS: Record<RangeOption, number> = {
  "7d": 7,
  "30d": 30,
};

export async function GET(req: NextRequest) {
  const userId = await requireAuth(req).catch(() => null);
  if (!userId) {
    return jsonError("UNAUTHORIZED", { request: req });
  }

  const url = new URL(req.url);
  const rangeParam = (url.searchParams.get("range") as RangeOption) || "7d";
  const range: RangeOption = rangeParam === "30d" ? "30d" : "7d";
  const days = RANGE_DAYS[range];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (days - 1));

  const startIso = start.toISOString();

  try {
    const [bg, bp, water, weight, insulin, meals] = await Promise.all([
      query<BgRow>(
        `SELECT date_trunc('day', noted_at)::date AS day, AVG(value_mgdl)::float AS avg_bg
         FROM log_bg
         WHERE user_id = $1 AND noted_at >= $2
         GROUP BY 1`,
        [userId, startIso],
      ),
      query<BpRow>(
        `SELECT date_trunc('day', noted_at)::date AS day,
                AVG(sys)::float  AS sys_avg,
                AVG(dia)::float  AS dia_avg
         FROM log_bp
         WHERE user_id = $1 AND noted_at >= $2
         GROUP BY 1`,
        [userId, startIso],
      ),
      query<WaterRow>(
        `SELECT date_trunc('day', noted_at)::date AS day, SUM(volume_ml)::float AS total_ml
         FROM log_water
         WHERE user_id = $1 AND noted_at >= $2
         GROUP BY 1`,
        [userId, startIso],
      ),
      query<WeightRow>(
        `SELECT DISTINCT ON (date_trunc('day', noted_at)::date)
                date_trunc('day', noted_at)::date AS day,
                weight_kg
         FROM log_weight
         WHERE user_id = $1 AND noted_at >= $2
         ORDER BY date_trunc('day', noted_at)::date, noted_at DESC`,
        [userId, startIso],
      ),
      query<InsulinRow>(
        `SELECT date_trunc('day', noted_at)::date AS day, SUM(dose_units)::float AS total_units
         FROM log_insulin
         WHERE user_id = $1 AND noted_at >= $2
         GROUP BY 1`,
        [userId, startIso],
      ),
      query<MealRow>(
        `SELECT date_trunc('day', noted_at)::date AS day, COUNT(*)::int AS total_meals
         FROM log_meal
         WHERE user_id = $1 AND noted_at >= $2
         GROUP BY 1`,
        [userId, startIso],
      ),
    ]);

    const daysMap = buildDayMap(start, days);
    applyMetric(daysMap, bg.rows, (day, row) => {
      day.bg_avg = row.avg_bg ?? undefined;
    });
    applyMetric(daysMap, bp.rows, (day, row) => {
      day.bp_sys_avg = row.sys_avg ?? undefined;
      day.bp_dia_avg = row.dia_avg ?? undefined;
    });
    applyMetric(daysMap, water.rows, (day, row) => {
      day.water_ml = row.total_ml ?? undefined;
    });
    applyMetric(daysMap, weight.rows, (day, row) => {
      day.weight_kg = row.weight_kg ?? undefined;
    });
    applyMetric(daysMap, insulin.rows, (day, row) => {
      day.insulin_units = row.total_units ?? undefined;
    });
    applyMetric(daysMap, meals.rows, (day, row) => {
      day.meals_count = row.total_meals ?? undefined;
    });

    const collection = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const kpi = computeKpi(collection);

    return jsonSuccess(
      {
        range,
        days: collection,
        kpi,
      },
      { request: req, cacheControl: "no-store" },
    );
  } catch (error) {
    console.error("[api/chart/metrics] failed", error);
    return jsonError("INTERNAL_ERROR", { request: req });
  }
}

function buildDayMap(start: Date, days: number): Map<string, ChartDay> {
  const result = new Map<string, ChartDay>();
  for (let i = 0; i < days; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    const key = current.toISOString().slice(0, 10);
    result.set(key, { date: key });
  }
  return result;
}

function applyMetric<T>(
  map: Map<string, ChartDay>,
  rows: T[],
  assign: (day: ChartDay, row: T) => void,
) {
  rows.forEach((row: any) => {
    const date =
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : typeof row.day === "string"
          ? row.day.slice(0, 10)
          : null;
    if (!date) return;
    const entry = map.get(date);
    if (entry) assign(entry, row);
  });
}

function computeKpi(days: ChartDay[]): KPI {
  const last7 = days.slice(-7);
  const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
  const avg = (values: number[]) => (values.length ? sum(values) / values.length : undefined);

  const getValues = (selector: (day: ChartDay) => number | undefined) =>
    last7.map(selector).filter((value): value is number => typeof value === "number");

  const bgValues = getValues((day) => day.bg_avg);
  const bpSysValues = getValues((day) => day.bp_sys_avg);
  const bpDiaValues = getValues((day) => day.bp_dia_avg);
  const waterValues = getValues((day) => day.water_ml);
  const insulinValues = getValues((day) => day.insulin_units);
  const mealValues = getValues((day) => day.meals_count);

  const latestWeight = [...days].reverse().find((day) => typeof day.weight_kg === "number")?.weight_kg;
  const weightDelta =
    days.length >= 8
      ? (() => {
          const current = days[days.length - 1].weight_kg;
          const prev = days[days.length - 8].weight_kg;
          if (typeof current === "number" && typeof prev === "number") {
            return Number((current - prev).toFixed(1));
          }
          return undefined;
        })()
      : undefined;

  return {
    bg_avg_7d: avg(bgValues),
    bg_days_above_target_pct: null,
    bp_sys_avg_7d: avg(bpSysValues),
    bp_dia_avg_7d: avg(bpDiaValues),
    weight_current: latestWeight,
    weight_delta_7d: weightDelta,
    water_ml_avg_7d: avg(waterValues),
    insulin_units_sum_7d: insulinValues.length ? sum(insulinValues) : undefined,
    insulin_units_avg_daily: avg(insulinValues),
    meal_count_avg_7d: avg(mealValues),
  };
}
