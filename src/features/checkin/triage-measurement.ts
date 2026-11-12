export type MeasurementInput = {
  type: 'huyet_ap' | 'duong_huyet';
  label: string;
  unit: 'mmHg' | 'mg/dL';
  whenSelected?: string;
};

export function bloodPressureAnswer(upper: string, lower: string) {
  if (!/^\d{2,3}$/.test(upper) || !/^\d{2,3}$/.test(lower) || Number(upper) <= Number(lower) || Number(lower) <= 0) return null;
  return `${Number(upper)}/${Number(lower)} mmHg`;
}

export function glucoseAnswer(value: string, unit: 'mg/dL' | 'mmol/L' = 'mg/dL') {
  if (!/^\d{1,4}(?:[.,]\d{1,2})?$/.test(value) || Number(value.replace(',', '.')) <= 0) return null;
  return `${Number(value.replace(',', '.'))} ${unit}`;
}

/** Only an unambiguous complete reading populates fields. Never scale 12/8,
 * swap top/bottom, choose between several readings, or infer a spoken unit. */
export function parseMeasurementSpeech(text: string, type: MeasurementInput['type'], selectedUnit: 'mg/dL' | 'mmol/L' = 'mg/dL'):
  { upper: string; lower: string; kind: 'bp' } | { value: string; unit: 'mg/dL' | 'mmol/L'; kind: 'glucose' } | null {
  const cleaned = text.trim().replace(/[.!]$/, '').replace(/^(?:huyết áp|blood pressure|đường huyết|blood glucose)\s*(?:là|is)?\s*/iu, '');
  if (type === 'huyet_ap') {
    const match = /^(\d{2,3})\s*(?:\/|trên|over|và|and|\s)\s*(\d{2,3})\s*(?:mmhg)?$/iu.exec(cleaned);
    return match && bloodPressureAnswer(match[1], match[2]) ? { upper: match[1], lower: match[2], kind: 'bp' } : null;
  }
  const match = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*(mg\s*\/\s*dl|mmol\s*\/\s*l)?$/iu.exec(cleaned);
  if (!match) return null;
  const unit = match[2] ? /^mmol/iu.test(match[2]) ? 'mmol/L' : 'mg/dL' : selectedUnit;
  return glucoseAnswer(match[1], unit) ? { value: match[1], unit, kind: 'glucose' } : null;
}
