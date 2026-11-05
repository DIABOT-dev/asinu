import type { MedDose } from "./v21.api";

export const MEDICATION_SOON_MS = 5 * 60 * 1000;
export function medicationDoseNeedsRefresh(
  dose: Pick<MedDose, "state" | "scheduled_at">,
  now: number,
) {
  const remaining = Date.parse(dose.scheduled_at) - now;
  return (
    dose.state === "CALLING" ||
    (dose.state === "SCHEDULED" &&
      remaining <= MEDICATION_SOON_MS &&
      remaining >= -2 * 60 * 60 * 1000)
  );
}
export function medicationDoseStatusKey(
  dose: Pick<MedDose, "state" | "scheduled_at">,
  now = Date.now(),
  remindersEnabled = true,
): string {
  if (dose.state !== "SCHEDULED") return dose.state;
  if (!remindersEnabled) return "medicationReminderPaused";
  const time = Date.parse(dose.scheduled_at);
  if (!Number.isFinite(time)) return "medicationPlanned";
  const remaining = time - now;
  if (remaining > MEDICATION_SOON_MS) return "medicationLater";
  if (remaining > 0) return "SCHEDULED";
  return remaining >= -60_000 ? "medicationDueNow" : "medicationOverdue";
}
