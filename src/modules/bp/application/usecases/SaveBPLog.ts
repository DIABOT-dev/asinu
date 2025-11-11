import { BPRepo } from "../../infrastructure/adapters/BPRepo.api"
import { validateBP } from "../../domain/validators"
import { BPLog } from "../../domain/types"

export async function SaveBPLog(log: BPLog) {
  const err = validateBP(log)
  if (err) throw new Error(err)
  return BPRepo.insert(log)
}
