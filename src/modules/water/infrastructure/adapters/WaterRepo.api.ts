import { apiFetch, ApiError } from "@/lib/http";
import type { SaveWaterLogDTO } from "../../domain/types";

export const WaterRepo = {
  async create(dto: SaveWaterLogDTO) {
    try {
      const result = await apiFetch<{ id: number } | undefined>("/api/log/water", {
        method: "POST",
        body: JSON.stringify({
          volume_ml: dto.amount_ml,
          noted_at: dto.taken_at,
        }),
      });
      return { id: result && "id" in (result as any) ? (result as any).id : null };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw error instanceof Error ? error : new Error("WATER_LOG_SAVE_FAILED");
    }
  },
};
