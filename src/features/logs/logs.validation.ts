import i18n from '../../i18n';
import { BloodPressureLogPayload, GlucoseLogPayload, InsulinLogPayload, MealLogPayload, MedicationLogPayload, WaterLogPayload } from './logs.api';
import { isHalfStepNumber } from './logs.service';
import { validateBloodPressure } from '../../lib/blood-pressure';

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
  const result = validateBloodPressure(systolic, diastolic);
  if (!result.ok) {
    const key = result.error === 'numbers' ? 'errBpNumbers' : result.error === 'order' ? 'errBpOrder' : 'errBpRange';
    return { ok: false, errors: { bp: t(key) } };
  }
  return { ok: true, value: { systolic: result.systolic, diastolic: result.diastolic, tags, notes } };
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
