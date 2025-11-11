import { apiFetch, ApiError } from "@/lib/http";
import type { BPLog } from "../../domain/types";

export const BPRepo = {
  async insert(dto: BPLog) {
    try {
      const result = await apiFetch<{ id: number } | undefined>("/api/log/bp", {
        method: "POST",
        body: JSON.stringify({
          sys: dto.systolic,
          dia: dto.diastolic,
          pulse: dto.pulse ?? undefined,
          noted_at: dto.taken_at,
        }),
      });
      return { id: result && "id" in (result as any) ? (result as any).id : null, status: 201 as const };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw error instanceof Error ? error : new Error("BP_LOG_SAVE_FAILED");
    }
  },
};
