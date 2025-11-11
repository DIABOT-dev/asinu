import { apiFetch, ApiError } from "@/lib/http";
import type { WeightLogDTO } from "../../domain/types";

export const WeightRepo = {
  async insert(dto: WeightLogDTO) {
    try {
      const result = await apiFetch<{ id: number } | undefined>("/api/log/weight", {
        method: "POST",
        body: JSON.stringify({
          weight_kg: dto.weight_kg,
          noted_at: dto.taken_at,
        }),
      });
      return { id: result && "id" in (result as any) ? (result as any).id : null, status: 201 as const };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw error instanceof Error ? error : new Error("WEIGHT_LOG_SAVE_FAILED");
    }
  },
};
