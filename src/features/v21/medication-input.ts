export const validMedicationTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const medicationTextHasNoDose = (text: string) =>
  !/(?:\d\s*(?:mg|mcg|µg|ml|iu|g|u|units?)\b|\b(?:liều|dosage)\b|\d\s*(?:viên|tablets?|capsules?)\b)/iu.test(
    text
  );

export const validMedicationNote = (text: string) =>
  text.trim().length <= 60 && medicationTextHasNoDose(text);

export function medicationQuickNames(conditions: unknown): string[] {
  const declared = JSON.stringify(conditions ?? []);
  return [
    ...(/diabet|tiểu đường/i.test(declared) ? ["medicine_diabetes"] : []),
    ...(/hypertension|huyết áp/i.test(declared) ? ["medicine_pressure"] : []),
    ...(/lipid|cholesterol|mỡ máu|mo mau/i.test(declared)
      ? ["medicine_lipids"]
      : []),
    ...(/cardio|heart|tim mạch/i.test(declared) ? ["medicine_heart"] : []),
    "medicine_generic",
    "supplement",
    "medicine_other",
  ];
}
