import type { SaveWaterLogDTO } from "../../domain/types";
import { validateWater } from "../../domain/validators";
import { WaterRepo } from "../../infrastructure/adapters/WaterRepo.api";

export async function SaveWaterLog(dto: SaveWaterLogDTO) {
  const v = validateWater(dto);
  if (!v.ok) throw new Error(`VALIDATION_ERROR:${v.errors.join(",")}`);
  return WaterRepo.create(dto);
}
