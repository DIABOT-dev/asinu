import { WeightLogDTO } from "../../domain/types";
import { validateWeightLog } from "../../domain/validators";
import { WeightRepo } from "../../infrastructure/adapters/WeightRepo.api";

export async function SaveWeightLog(dto: WeightLogDTO) {
  const error = validateWeightLog(dto);
  if (error) throw new Error(error);
  return await WeightRepo.insert(dto);
}
