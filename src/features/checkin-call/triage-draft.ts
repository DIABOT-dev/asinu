import type { CheckinCallTriageContext } from "./checkin-call.api";

export function restoreTriageDraft(
  raw: string | null,
  context: CheckinCallTriageContext,
  now = Date.now()
) {
  try {
    const draft = JSON.parse(raw || "null");
    if (!draft || !Number.isFinite(draft.expiresAt) || draft.expiresAt <= now)
      return null;
    const location = context.locations.find(
      (item) => item.key === draft.location
    );
    if (!location) return null;
    const symptom =
      location.symptoms.find((item) => item.key === draft.symptom) || null;
    return {
      location,
      symptom,
      step: symptom ? ("intensity" as const) : ("symptom" as const),
    };
  } catch {
    return null;
  }
}
