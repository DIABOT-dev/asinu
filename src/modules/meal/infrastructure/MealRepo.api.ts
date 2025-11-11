import { apiFetch, ApiError } from "@/lib/http";
import type { SaveMealLogDTO } from "../domain/types";

export class MealRepo {
  async insert(dto: SaveMealLogDTO, _userId: string) {
    try {
      const payload = {
        meal_type: dto.meal_type,
        title: dto.text || dto.meal_type,
        notes: dto.text ?? undefined,
        portion: dto.portion,
        noted_at: dto.ts,
        photo_key: dto.image_url,
      };

      return await apiFetch("/api/log/meal", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw error instanceof Error ? error : new Error("MEAL_LOG_SAVE_FAILED");
    }
  }
}
