// src/modules/meal/application/usecases/SaveMealLog.ts
import { SaveMealLogDTO } from "../../domain/types";
import { validateMealLog } from "../../domain/validators";
import { MealRepo } from "../../infrastructure/MealRepo.api";

export async function SaveMealLog(dto: SaveMealLogDTO, userId: string) {
  validateMealLog(dto);
  const repo = new MealRepo();
  return await repo.insert(dto, userId);
}
