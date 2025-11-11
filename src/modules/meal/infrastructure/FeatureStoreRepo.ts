// src/modules/meal/infrastructure/FeatureStoreRepo.ts
// Query Feature Store tables (user_daily_features, user_meal_patterns, user_habit_scores)
import { query } from "@/lib/db_client";

export interface DailyFeatures {
  date: string;
  carb_g_total: number;
  protein_g_total: number;
  fat_g_total: number;
  dinner_pct: number;
  late_meal_count: number;
  fried_count: number;
  steamed_count: number;
  water_ml: number;
  water_target_pct: number;
}

export interface MealPattern {
  meal_type: string;
  dish: string;
  portion_avg: number;
  freq_7d: number;
}

export interface HabitScore {
  date: string;
  cluster: string;
  score: number;
}

/**
 * Feature Store Repository
 * Reads from ETL-generated tables, with fallback to raw logs
 */
export class FeatureStoreRepo {
  /**
   * Get daily features for a specific date
   * With timeout guard (150ms)
   */
  async getDailyFeatures(userId: string, date: string): Promise<DailyFeatures | null> {
    try {
      return await runWithTimeout(async () => {
        const result = await query<DailyFeatures & { date: Date }>(
          `SELECT date::date, carb_g_total, protein_g_total, fat_g_total, dinner_pct, late_meal_count,
                  fried_count, steamed_count, water_ml, water_target_pct
           FROM user_daily_features
           WHERE user_id = $1 AND date::date = $2::date
           LIMIT 1`,
          [userId, date],
        );
        const row = result.rows[0];
        if (!row) return null;
        return {
          ...row,
          date: toDateKey(row.date),
        };
      });
    } catch (error) {
      console.error("Error fetching daily features:", error);
      return null;
    }
  }

  /**
   * Get daily features for yesterday
   */
  async getYesterdayFeatures(userId: string): Promise<DailyFeatures | null> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    return this.getDailyFeatures(userId, dateStr);
  }

  /**
   * Get meal patterns for last 7 days
   * With timeout guard (150ms) and explicit limits
   */
  async getMealPatterns(userId: string, mealType?: string): Promise<MealPattern[]> {
    try {
      return await runWithTimeout(async () => {
        const params: any[] = [userId];
        let filterClause = "";
        if (mealType) {
          filterClause = "AND meal_type = $2";
          params.push(mealType);
        }

        const result = await query<MealPattern>(
          `SELECT meal_type, dish, portion_avg, freq_7d
           FROM user_meal_patterns
           WHERE user_id = $1 ${filterClause}
           ORDER BY freq_7d DESC
           LIMIT 10`,
          params,
        );
        return result.rows || [];
      });
    } catch (error) {
      console.error("Error fetching meal patterns:", error);
      return [];
    }
  }

  /**
   * Get latest habit scores
   */
  async getHabitScores(userId: string): Promise<HabitScore[]> {
    try {
      return await runWithTimeout(async () => {
        const result = await query<HabitScore & { date: Date }>(
          `SELECT date::date, cluster, score
           FROM user_habit_scores
           WHERE user_id = $1
           ORDER BY date DESC
           LIMIT 7`,
          [userId],
        );
        return (result.rows || []).map((row) => ({
          ...row,
          date: toDateKey(row.date),
        }));
      });
    } catch (error) {
      console.error("Error fetching habit scores:", error);
      return [];
    }
  }

  /**
   * Fallback: compute features from raw meal_logs if Feature Store is empty
   */
  async computeFeaturesFromLogs(userId: string, daysBack: number = 1): Promise<Partial<DailyFeatures>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const result = await query<{
        carb_g: number | null;
        protein_g: number | null;
        fat_g: number | null;
        notes: string | null;
      }>(
        `SELECT carb_g, protein_g, fat_g, notes
         FROM log_meal
         WHERE user_id = $1 AND noted_at >= $2`,
        [userId, startDate.toISOString()],
      );

      if (!result.rows || result.rows.length === 0) return {};

      let totalCarb = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let friedCount = 0;

      for (const log of result.rows) {
        totalCarb += log.carb_g ?? 0;
        totalProtein += log.protein_g ?? 0;
        totalFat += log.fat_g ?? 0;
        if (log.notes && /fried/i.test(log.notes)) {
          friedCount += 1;
        }
      }

      return {
        carb_g_total: totalCarb,
        protein_g_total: totalProtein,
        fat_g_total: totalFat,
        fried_count: friedCount,
      };
    } catch (error) {
      console.error("Error computing features from logs:", error);
      return {};
    }
  }

  /**
   * Get features with automatic fallback
   */
  async getFeaturesWithFallback(userId: string): Promise<Partial<DailyFeatures>> {
    // Try Feature Store first
    const features = await this.getYesterdayFeatures(userId);
    if (features) return features;

    // Fallback to raw logs
    console.warn('Feature Store empty, computing from raw logs');
    return this.computeFeaturesFromLogs(userId, 1);
  }
}

const DEFAULT_TIMEOUT_MS = 150;

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race<T>([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
  ]);
}

function toDateKey(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}
