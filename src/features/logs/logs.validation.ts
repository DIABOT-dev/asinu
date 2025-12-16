import { GlucoseLogPayload, BloodPressureLogPayload, MedicationLogPayload, WeightLogPayload, WaterLogPayload, MealLogPayload, InsulinLogPayload } from './logs.api';
import { isHalfStepNumber } from './logs.service';

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const requireNumber = (val: string) => {
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return null;
  return num;
};

export const validateGlucosePayload = (value: string, tags: string[], notes?: string): ValidationResult<GlucoseLogPayload> => {
  const num = requireNumber(value);
  if (num === null || num < 40 || num > 600) {
    return { ok: false, errors: { value: 'Giá trị đường huyết không hợp lệ (40-600 mg/dL).' } };
  }
  return { ok: true, value: { value: num, tags, notes } };
};

export const validateBloodPressurePayload = (
  systolic: string,
  diastolic: string,
  tags: string[],
  notes?: string
): ValidationResult<BloodPressureLogPayload> => {
  const sys = requireNumber(systolic);
  const dia = requireNumber(diastolic);
  if (sys === null || dia === null) {
    return { ok: false, errors: { bp: 'Cần nhập số cho tâm thu/tâm trương.' } };
  }
  if (sys < 70 || sys > 250 || dia < 40 || dia > 150 || dia >= sys) {
    return { ok: false, errors: { bp: 'Huyết áp không hợp lệ (sys 70-250, dia 40-150, dia < sys).' } };
  }
  return { ok: true, value: { systolic: sys, diastolic: dia, tags, notes } };
};

export const validateMedicationPayload = (
  medication: string,
  dose: string,
  notes?: string
): ValidationResult<MedicationLogPayload> => {
  if (!medication.trim()) return { ok: false, errors: { medication: 'Vui lòng nhập tên thuốc.' } };
  if (!dose.trim()) return { ok: false, errors: { dose: 'Vui lòng nhập liều.' } };
  return { ok: true, value: { medication: medication.trim(), dose: dose.trim(), notes } };
};

export const validateWeightPayload = (
  weight: string,
  bodyfat?: string,
  notes?: string
): ValidationResult<WeightLogPayload> => {
  const w = requireNumber(weight);
  if (w === null || w <= 0 || !isHalfStepNumber(w)) {
    return { ok: false, errors: { weight: 'Cân nặng phải là số >0 và bội số 0.5.' } };
  }
  let bf: number | undefined;
  if (bodyfat) {
    const bfNum = requireNumber(bodyfat);
    if (bfNum === null || !isHalfStepNumber(bfNum)) {
      return { ok: false, errors: { bodyfat: 'Body fat phải là bội số 0.5.' } };
    }
    bf = bfNum;
  }
  return { ok: true, value: { weight_kg: w, bodyfat_pct: bf, notes } };
};

export const validateWaterPayload = (volume: string): ValidationResult<WaterLogPayload> => {
  const vol = requireNumber(volume);
  if (vol === null || vol <= 0 || !isHalfStepNumber(vol)) {
    return { ok: false, errors: { volume: 'Lượng nước phải là bội số 0.5 và >0.' } };
  }
  return { ok: true, value: { volume_ml: vol } };
};

export const validateMealPayload = (
  title: string,
  macros?: string,
  kcal?: string,
  photo_key?: string,
  notes?: string
): ValidationResult<MealLogPayload> => {
  if (!title.trim()) {
    return { ok: false, errors: { title: 'Vui lòng nhập tên bữa ăn.' } };
  }
  let kcalNumber: number | undefined;
  if (kcal) {
    const num = requireNumber(kcal);
    if (num === null || !isHalfStepNumber(num)) {
      return { ok: false, errors: { kcal: 'Kcal phải là bội số 0.5.' } };
    }
    kcalNumber = num;
  }
  return {
    ok: true,
    value: { title: title.trim(), macros, kcal: kcalNumber, photo_key, notes }
  };
};

export const validateInsulinPayload = (
  insulin_type: string,
  dose_units: string,
  meal_id?: string,
  notes?: string
): ValidationResult<InsulinLogPayload> => {
  if (!insulin_type.trim()) return { ok: false, errors: { insulin_type: 'Vui lòng nhập loại insulin.' } };
  const dose = requireNumber(dose_units);
  if (dose === null || !isHalfStepNumber(dose)) {
    return { ok: false, errors: { dose_units: 'Liều insulin phải là bội số 0.5.' } };
  }
  return { ok: true, value: { insulin_type: insulin_type.trim(), dose_units: dose, meal_id: meal_id || undefined, notes } };
};
