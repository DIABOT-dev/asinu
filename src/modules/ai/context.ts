import { query } from "@/lib/db_client";
import type { AIContext, MetricPoint, BPPoint } from "./types";

export type { AIContext } from "./types";

export type CompressedAIContext = {
  bg?: { latest?: number; avg7d?: number; trend?: "up" | "down" | "flat" };
  water?: { latestMl?: number; avg7dMl?: number; trend?: "up" | "down" | "flat" };
  weight?: { latestKg?: number; avg7dKg?: number; trend?: "up" | "down" | "flat" };
  bp?: { latest?: { sys: number; dia: number }; avg7d?: { sys: number; dia: number }; trend?: "up" | "down" | "flat" };
  meal?: { lastMeal: string; lastPortion?: string | null };
  notes?: string[];
};

const contextCache = new Map<string, { data: AIContext; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const LOOKBACK_DAYS = 7;
const MAX_ROWS = 200;

type MealRow = {
  title: string | null;
  notes: string | null;
  meal_type: string | null;
  portion: string | null;
  noted_at: Date;
};

type MetricLoadResult = {
  bg: MetricPoint[];
  water: MetricPoint[];
  weight: MetricPoint[];
  bp: BPPoint[];
  insulin: MetricPoint[];
  totalLogs: number;
  latest: {
    bg?: number;
    bp?: { sys: number; dia: number };
    weight?: number;
  };
  lastMeal: { brief: string; portion?: string | null } | null;
};

export async function buildContext(userId: string): Promise<AIContext> {
  const cached = contextCache.get(userId);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  try {
    const metrics = await loadRecentMetrics(userId);

    const summaryParts: string[] = [];
    if (metrics.latest.bg) summaryParts.push(`BG gần nhất: ${metrics.latest.bg} mg/dL`);
    if (metrics.latest.bp) summaryParts.push(`BP: ${metrics.latest.bp.sys}/${metrics.latest.bp.dia} mmHg`);
    if (metrics.latest.weight) summaryParts.push(`Cân nặng: ${metrics.latest.weight} kg`);
    summaryParts.push(`${metrics.totalLogs} bản ghi trong ${LOOKBACK_DAYS} ngày`);
    if (metrics.water.length) {
      const avg = Math.round(metrics.water.reduce((sum, row) => sum + row.value, 0) / LOOKBACK_DAYS);
      summaryParts.push(`Nước TB: ${avg} ml/ngày`);
    }
    const summary = `${summaryParts.join(". ")}.`;

    const context: AIContext = {
      userId,
      windowDays: LOOKBACK_DAYS,
      summary,
      metrics: {
        bg: metrics.bg,
        water: metrics.water,
        weight: metrics.weight,
        bp: metrics.bp,
        insulin: metrics.insulin,
        latest: metrics.latest,
      },
    };

    contextCache.set(userId, { data: context, expires: Date.now() + CACHE_TTL });
    return context;
  } catch (error) {
    console.error("Error building user context:", error);
    return {
      userId,
      windowDays: LOOKBACK_DAYS,
      summary: "Không thể tải dữ liệu người dùng. Vui lòng thử lại sau.",
      metrics: { bg: [], water: [], weight: [], bp: [], insulin: [], latest: {} },
    };
  }
}

export async function buildCompressedContext(userId: string): Promise<CompressedAIContext> {
  const context: CompressedAIContext = {};

  try {
    const metrics = await loadRecentMetrics(userId);

    if (metrics.bg.length) {
      const values = metrics.bg.map((item) => item.value);
      const stats = calculateMetricStats(values, metrics.bg[0].value);
      context.bg = { latest: metrics.bg[0].value, avg7d: stats.avg7d, trend: stats.trend };
    }

    if (metrics.water.length) {
      const values = metrics.water.map((item) => item.value);
      const stats = calculateMetricStats(values, metrics.water[0].value);
      context.water = { latestMl: metrics.water[0].value, avg7dMl: stats.avg7d, trend: stats.trend };
    }

    if (metrics.weight.length) {
      const values = metrics.weight.map((item) => item.value);
      const stats = calculateMetricStats(values, metrics.weight[0].value);
      context.weight = { latestKg: metrics.weight[0].value, avg7dKg: stats.avg7d, trend: stats.trend };
    }

    if (metrics.bp.length) {
      const latest = metrics.bp[0];
      const avgSys = Math.round(metrics.bp.reduce((sum, row) => sum + row.sys, 0) / metrics.bp.length);
      const avgDia = Math.round(metrics.bp.reduce((sum, row) => sum + row.dia, 0) / metrics.bp.length);
      context.bp = { latest: { sys: latest.sys, dia: latest.dia }, avg7d: { sys: avgSys, dia: avgDia } };
    }

    if (metrics.lastMeal) {
      context.meal = {
        lastMeal: metrics.lastMeal.brief,
        lastPortion: metrics.lastMeal.portion,
      };
    }
  } catch (error) {
    console.error("Error building compressed context:", error);
  }

  return context;
}

function calculateMetricStats(values: number[], latestValue?: number): { avg7d?: number; trend?: "up" | "down" | "flat" } {
  if (!values.length) return {};
  const avg7d = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (latestValue === undefined) return { avg7d };
  const diff = latestValue - avg7d;
  if (diff > avg7d * 0.05) return { avg7d, trend: "up" };
  if (diff < -avg7d * 0.05) return { avg7d, trend: "down" };
  return { avg7d, trend: "flat" };
}

async function loadRecentMetrics(userId: string): Promise<MetricLoadResult> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const sinceIso = since.toISOString();

  const [bgRes, waterRes, weightRes, bpRes, insulinRes, mealRes] = await Promise.all([
    query<{ value_mgdl: number; noted_at: Date }>(
      `SELECT value_mgdl, noted_at
       FROM log_bg
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY noted_at DESC
       LIMIT ${MAX_ROWS}`,
      [userId, sinceIso],
    ),
    query<{ volume_ml: number; noted_at: Date }>(
      `SELECT volume_ml, noted_at
       FROM log_water
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY noted_at DESC
       LIMIT ${MAX_ROWS}`,
      [userId, sinceIso],
    ),
    query<{ weight_kg: number; noted_at: Date }>(
      `SELECT weight_kg, noted_at
       FROM log_weight
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY noted_at DESC
       LIMIT ${MAX_ROWS}`,
      [userId, sinceIso],
    ),
    query<{ sys: number; dia: number; noted_at: Date }>(
      `SELECT sys, dia, noted_at
       FROM log_bp
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY noted_at DESC
       LIMIT ${MAX_ROWS}`,
      [userId, sinceIso],
    ),
    query<{ dose_units: number; noted_at: Date }>(
      `SELECT dose_units, noted_at
       FROM log_insulin
       WHERE user_id = $1 AND noted_at >= $2
       ORDER BY noted_at DESC
       LIMIT ${MAX_ROWS}`,
      [userId, sinceIso],
    ),
    query<MealRow>(
      `SELECT title, notes, meal_type, portion, noted_at
       FROM log_meal
       WHERE user_id = $1
       ORDER BY noted_at DESC
       LIMIT 1`,
      [userId],
    ),
  ]);

  const bg = (bgRes.rows || []).map<MetricPoint>((row) => ({
    ts: toIso(row.noted_at),
    value: Number(row.value_mgdl),
  }));
  const water = (waterRes.rows || []).map<MetricPoint>((row) => ({
    ts: toIso(row.noted_at),
    value: Number(row.volume_ml),
  }));
  const weight = (weightRes.rows || []).map<MetricPoint>((row) => ({
    ts: toIso(row.noted_at),
    value: Number(row.weight_kg),
  }));
  const bp = (bpRes.rows || []).map<BPPoint>((row) => ({
    ts: toIso(row.noted_at),
    sys: Number(row.sys),
    dia: Number(row.dia),
  }));
  const insulin = (insulinRes.rows || []).map<MetricPoint>((row) => ({
    ts: toIso(row.noted_at),
    value: Number(row.dose_units),
  }));

  const totalLogs = bg.length + water.length + weight.length + bp.length + insulin.length;
  const latest = {
    bg: bg[0]?.value,
    bp: bp[0] ? { sys: bp[0].sys, dia: bp[0].dia } : undefined,
    weight: weight[0]?.value,
  };

  const meal = mealRes.rows?.[0] ?? null;
  const lastMeal = meal
    ? {
      brief: buildMealSummary(meal),
      portion: meal.portion,
    }
    : null;

  return { bg, water, weight, bp, insulin, totalLogs, latest, lastMeal };
}

function buildMealSummary(meal: MealRow): string {
  const parts = [];
  if (meal.meal_type) parts.push(meal.meal_type);
  if (meal.title) parts.push(meal.title);
  const base = parts.join(": ") || "Bữa gần nhất";
  if (meal.notes) return `${base} (${truncate(meal.notes, 60)})`;
  return base;
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}
