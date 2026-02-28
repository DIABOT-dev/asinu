import i18n from '../../i18n';
import { BloodPressureLogPayload, GlucoseLogPayload, InsulinLogPayload, MealLogPayload, MedicationLogPayload, WaterLogPayload, WeightLogPayload } from './logs.api';
import { isHalfStepNumber } from './logs.service';

const t = (key: string) => i18n.t(key, { ns: 'logs' });

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const requireNumber = (val: string) => {
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return null;
  return num;
};

export const validateGlucosePayload = (value: string, tags: string[], notes?: string): ValidationResult<GlucoseLogPayload> => {
  const num = requireNumber(value);
  if (num === null || num < 40 || num > 600) {
    return { ok: false, errors: { value: t('errGlucoseRange') } };
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
    return { ok: false, errors: { bp: t('errBpNumbers') } };
  }
  if (sys < 70 || sys > 250 || dia < 40 || dia > 150 || dia >= sys) {
    return { ok: false, errors: { bp: t('errBpRange') } };
  }
  return { ok: true, value: { systolic: sys, diastolic: dia, tags, notes } };
};

export const validateMedicationPayload = (
  medication: string,
  dose: string,
  notes?: string
): ValidationResult<MedicationLogPayload> => {
  if (!medication.trim()) return { ok: false, errors: { medication: t('errMedName') } };
  if (!dose.trim()) return { ok: false, errors: { dose: t('errMedDose') } };
  return { ok: true, value: { medication: medication.trim(), dose: dose.trim(), notes } };
};

export const validateWeightPayload = (
  weight: string,
  bodyfat?: string,
  notes?: string
): ValidationResult<WeightLogPayload> => {
  const w = requireNumber(weight);
  if (w === null || w <= 0 || !isHalfStepNumber(w)) {
    return { ok: false, errors: { weight: t('errWeightStep') } };
  }
  let bf: number | undefined;
  if (bodyfat) {
    const bfNum = requireNumber(bodyfat);
    if (bfNum === null || !isHalfStepNumber(bfNum)) {
      return { ok: false, errors: { bodyfat: t('errBodyfatStep') } };
    }
    bf = bfNum;
  }
  return { ok: true, value: { weight_kg: w, bodyfat_pct: bf, notes } };
};

export const validateWaterPayload = (volume: string): ValidationResult<WaterLogPayload> => {
  const vol = requireNumber(volume);
  if (vol === null || vol <= 0 || !isHalfStepNumber(vol)) {
    return { ok: false, errors: { volume: t('errWaterStep') } };
  }
  return { ok: true, value: { volume_ml: vol } };
};

export const validateMealPayload = (
  title: string,
  kcal?: string,
  photo_key?: string,
  notes?: string
): ValidationResult<MealLogPayload> => {
  if (!title.trim()) {
    return { ok: false, errors: { title: t('errMealTitle') } };
  }
  let kcalNumber: number | undefined;
  if (kcal) {
    const num = requireNumber(kcal);
    if (num === null || num < 0) {
      return { ok: false, errors: { kcal: t('errKcalInvalid') } };
    }
    kcalNumber = num;
  }
  return {
    ok: true,
    value: { title: title.trim(), kcal: kcalNumber, photo_key, notes }
  };
};

export const validateInsulinPayload = (
  insulin_type: string,
  dose_units: string,
  timing?: string,
  notes?: string
): ValidationResult<InsulinLogPayload> => {
  const dose = requireNumber(dose_units);
  if (dose === null || dose < 0.1 || !isHalfStepNumber(dose)) {
    return { ok: false, errors: { dose_units: t('errInsulinDose') } };
  }
  // insulin_type is optional per backend schema
  const type = insulin_type.trim() || undefined;
  return { ok: true, value: { insulin_type: type, dose_units: dose, timing: timing || undefined, notes } };
};
