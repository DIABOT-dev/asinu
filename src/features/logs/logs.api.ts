import { apiClient } from '../../lib/apiClient';
import { LogEntry } from './logs.store';

type BaseLogPayload = {
  tags?: string[];
  notes?: string;
  recordedAt?: string;
};

export type GlucoseLogPayload = BaseLogPayload & {
  value: number;
};

export type BloodPressureLogPayload = BaseLogPayload & {
  systolic: number;
  diastolic: number;
};

export type MedicationLogPayload = BaseLogPayload & {
  medication: string;
  dose: string;
};

export type WeightLogPayload = BaseLogPayload & {
  weight_kg: number;
  bodyfat_pct?: number;
};

export type WaterLogPayload = BaseLogPayload & {
  volume_ml: number;
};

export type MealLogPayload = BaseLogPayload & {
  title: string;
  macros?: string;
  kcal?: number;
  photo_key?: string;
  meal_id?: string;
};

export type InsulinLogPayload = BaseLogPayload & {
  insulin_type: string;
  dose_units: number;
  meal_id?: string;
};

type LogType = 'glucose' | 'blood-pressure' | 'medication' | 'weight' | 'water' | 'meal' | 'insulin';

const createLog = <T extends BaseLogPayload>(type: LogType, payload: T) => {
  return apiClient<LogEntry>('/api/mobile/logs', {
    method: 'POST',
    body: { type, ...payload }
  });
};

export const logsApi = {
  fetchRecent(options?: { signal?: AbortSignal }) {
    return apiClient<LogEntry[]>('/api/mobile/logs', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
  },
  createGlucose(payload: GlucoseLogPayload) {
    return createLog('glucose', payload);
  },
  createBloodPressure(payload: BloodPressureLogPayload) {
    return createLog('blood-pressure', payload);
  },
  createMedication(payload: MedicationLogPayload) {
    return createLog('medication', payload);
  },
  createWeight(payload: WeightLogPayload) {
    return createLog('weight', payload);
  },
  createWater(payload: WaterLogPayload) {
    return createLog('water', payload);
  },
  createMeal(payload: MealLogPayload) {
    return createLog('meal', payload);
  },
  createInsulin(payload: InsulinLogPayload) {
    return createLog('insulin', payload);
  }
};
