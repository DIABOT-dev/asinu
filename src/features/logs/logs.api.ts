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

export const logsApi = {
  fetchRecent(options?: { signal?: AbortSignal }) {
    return apiClient<LogEntry[]>('/api/mobile/logs', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
  },
  createGlucose(payload: GlucoseLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/glucose', { method: 'POST', body: payload });
  },
  createBloodPressure(payload: BloodPressureLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/blood-pressure', { method: 'POST', body: payload });
  },
  createMedication(payload: MedicationLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/medication', { method: 'POST', body: payload });
  },
  createWeight(payload: WeightLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/weight', { method: 'POST', body: payload });
  },
  createWater(payload: WaterLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/water', { method: 'POST', body: payload });
  },
  createMeal(payload: MealLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/meal', { method: 'POST', body: payload });
  },
  createInsulin(payload: InsulinLogPayload) {
    return apiClient<LogEntry>('/api/mobile/logs/insulin', { method: 'POST', body: payload });
  }
};
