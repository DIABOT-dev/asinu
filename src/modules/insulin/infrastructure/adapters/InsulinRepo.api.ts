import { apiFetch, ApiError } from "@/lib/http";
import type { SaveInsulinLogDTO, SaveResult } from "../../domain/types";

export interface InsulinRepo {
  save(dto: SaveInsulinLogDTO): Promise<SaveResult>;
}

const TYPE_MAP: Record<SaveInsulinLogDTO["type"], string> = {
  am: "rapid",
  pm: "long",
};

const CONTEXT_LABEL: Record<SaveInsulinLogDTO["context"], string> = {
  before: "Trước ăn",
  after2h: "Sau ăn 2h",
  random: "Ngẫu nhiên",
};

export class InsulinRepoApi implements InsulinRepo {
  async save(dto: SaveInsulinLogDTO): Promise<SaveResult> {
    try {
      const payload = {
        dose_units: dto.dose,
        insulin_type: TYPE_MAP[dto.type],
        noted_at: dto.taken_at,
        notes: CONTEXT_LABEL[dto.context],
      };

      const result = await apiFetch<{ id: number } | undefined>("/api/log/insulin", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return {
        ok: true,
        status: 201,
        id: result && "id" in (result as any) ? String((result as any).id) : undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, status: error.status, error: error.message };
      }
      return { ok: false, status: 500, error: error instanceof Error ? error.message : "INSULIN_LOG_SAVE_FAILED" };
    }
  }
}
