import { SaveInsulinLogDTO, SaveResult } from "../../domain/types";
import { validateInsulinDTO } from "../../domain/validators";
import type { InsulinRepo } from "../../infrastructure/adapters/InsulinRepo.api";

export class SaveInsulinLog {
  constructor(private repo: InsulinRepo) {}

  async execute(dto: SaveInsulinLogDTO): Promise<SaveResult> {
    const v = validateInsulinDTO(dto);
    if (!v.valid) return { ok: false, status: 400, error: (v as any).message };

    const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const res = await this.repo.save(dto);
    const latency = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

    // (Tuỳ chọn) track telemetry ở đây
    // track(res.ok ? "log_insulin_submit_success" : "log_insulin_submit_error", { ...dto, latency });

    return res;
  }
}
