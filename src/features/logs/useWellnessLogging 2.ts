/**
 * Hook để tích hợp wellness logging vào health measurements
 * Sử dụng trong các màn hình logs để tự động ghi lại activity
 */

import { useCallback } from 'react';
import { useWellnessStore } from '../wellness/store/wellness.store';

/**
 * Hook để log health measurements vào wellness system
 */
export function useWellnessLogging() {
  const recordActivity = useWellnessStore((s) => s.recordActivity);

  /**
   * Log đo đường huyết
   */
  const logGlucose = useCallback(async (value: number) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'glucose', value });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log glucose:', e);
    }
  }, [recordActivity]);

  /**
   * Log đo huyết áp
   */
  const logBloodPressure = useCallback(async (systolic: number, diastolic: number) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'blood_pressure', systolic, diastolic });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log blood pressure:', e);
    }
  }, [recordActivity]);

  /**
   * Log cân nặng
   */
  const logWeight = useCallback(async (value: number) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'weight', value });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log weight:', e);
    }
  }, [recordActivity]);

  /**
   * Log uống nước
   */
  const logWater = useCallback(async (volumeMl: number) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'water', volume_ml: volumeMl });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log water:', e);
    }
  }, [recordActivity]);

  /**
   * Log thuốc
   */
  const logMedication = useCallback(async (medName: string) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'medication', med_name: medName });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log medication:', e);
    }
  }, [recordActivity]);

  /**
   * Log insulin
   */
  const logInsulin = useCallback(async (doseUnits: number, insulinType?: string) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'insulin', dose_units: doseUnits, insulin_type: insulinType });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log insulin:', e);
    }
  }, [recordActivity]);

  /**
   * Log bữa ăn
   */
  const logMeal = useCallback(async (calories?: number) => {
    try {
      await recordActivity('HEALTH_MEASUREMENT', { type: 'meal', calories });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log meal:', e);
    }
  }, [recordActivity]);

  /**
   * Log trả lời câu hỏi
   */
  const logQuestionAnswered = useCallback(async (questionId?: string) => {
    try {
      await recordActivity('QUESTION_ANSWERED', { question_id: questionId });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log question answered:', e);
    }
  }, [recordActivity]);

  /**
   * Log bỏ qua câu hỏi
   */
  const logQuestionSkipped = useCallback(async (questionId?: string) => {
    try {
      await recordActivity('QUESTION_SKIPPED', { question_id: questionId });
    } catch (e) {
      console.warn('[WellnessLogging] Failed to log question skipped:', e);
    }
  }, [recordActivity]);

  return {
    logGlucose,
    logBloodPressure,
    logWeight,
    logWater,
    logMedication,
    logInsulin,
    logMeal,
    logQuestionAnswered,
    logQuestionSkipped
  };
}
