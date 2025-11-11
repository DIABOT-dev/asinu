import { apiFetch, ApiError } from "@/lib/http";
import type { BGLogDTO, SaveResult } from "../../domain/types";
import type { BGRepo } from "../../application/ports/BGRepo";

const CONTEXT_MAP: Record<BGLogDTO["context"], "pre_meal" | "post_meal" | "random"> = {
  before: "pre_meal",
  after2h: "post_meal",
  random: "random",
};

const UNIT_MAP: Record<BGLogDTO["unit"], "mg/dl" | "mmol"> = {
  "mg/dL": "mg/dl",
  "mmol/L": "mmol",
};

export class BGRepoApi implements BGRepo {
  async save(dto: BGLogDTO): Promise<SaveResult> {
    try {
      const payload = {
        value: dto.value,
        unit: UNIT_MAP[dto.unit],
        context: CONTEXT_MAP[dto.context],
        noted_at: dto.taken_at,
      };

      const result = await apiFetch<{ id: number } | undefined>("/api/log/bg", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return {
        ok: true,
        status: 201,
        id: result && "id" in result ? String(result.id) : undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, status: error.status, error: error.message };
      }
      return { ok: false, status: 500, error: error instanceof Error ? error.message : "BG_LOG_SAVE_FAILED" };
    }
  }
}
