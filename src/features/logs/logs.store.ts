import { create } from 'zustand';
import {
  logsApi,
  GlucoseLogPayload,
  BloodPressureLogPayload,
  MedicationLogPayload,
  WeightLogPayload,
  WaterLogPayload,
  MealLogPayload,
  InsulinLogPayload
} from './logs.api';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { logError } from '../../lib/logger';

export type LogEntry = {
  id: string;
  type: 'glucose' | 'blood-pressure' | 'medication' | 'weight' | 'water' | 'meal' | 'insulin';
  value?: number;
  systolic?: number;
  diastolic?: number;
  medication?: string;
  dose?: string;
  weight_kg?: number;
  bodyfat_pct?: number;
  volume_ml?: number;
  title?: string;
  macros?: string;
  kcal?: number;
  photo_key?: string;
  insulin_type?: string;
  dose_units?: number;
  meal_id?: string;
  tags?: string[];
  notes?: string;
  recordedAt?: string;
};

type ErrorState = 'none' | 'remote-failed' | 'no-data';

type LogsState = {
  recent: LogEntry[];
  status: 'idle' | 'loading' | 'success' | 'error';
  isStale: boolean;
  errorState: ErrorState;
  fetchRecent: (signal?: AbortSignal) => Promise<void>;
  createGlucose: (payload: GlucoseLogPayload) => Promise<LogEntry>;
  createBloodPressure: (payload: BloodPressureLogPayload) => Promise<LogEntry>;
  createMedication: (payload: MedicationLogPayload) => Promise<LogEntry>;
  createWeight: (payload: WeightLogPayload) => Promise<LogEntry>;
  createWater: (payload: WaterLogPayload) => Promise<LogEntry>;
  createMeal: (payload: MealLogPayload) => Promise<LogEntry>;
  createInsulin: (payload: InsulinLogPayload) => Promise<LogEntry>;
};

const fallbackRecent: LogEntry[] = [
  {
    id: 'log-1',
    type: 'glucose',
    value: 125,
    tags: ['Trước ăn'],
    recordedAt: new Date().toISOString()
  },
  {
    id: 'log-2',
    type: 'blood-pressure',
    systolic: 125,
    diastolic: 78,
    tags: ['Buổi sáng'],
    recordedAt: new Date().toISOString()
  },
  {
    id: 'log-3',
    type: 'water',
    volume_ml: 250,
    recordedAt: new Date().toISOString()
  }
];

export const useLogsStore = create<LogsState>((set, get) => ({
  recent: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  async fetchRecent(signal) {
    if (featureFlags.devBypassAuth) {
      set({ recent: fallbackRecent, status: 'success', isStale: false, errorState: 'none' });
      return;
    }

    let usedCache = false;
    const cached = await localCache.getCached<LogEntry[]>(CACHE_KEYS.RECENT_LOGS, '1');
    if (cached) {
      set({ recent: cached, status: 'success', isStale: true, errorState: 'none' });
      usedCache = true;
    } else {
      set({ status: 'loading', errorState: 'none', isStale: false });
    }

    try {
      const recent = await logsApi.fetchRecent({ signal });
      set({ recent, status: 'success', isStale: false, errorState: 'none' });
      await localCache.setCached(CACHE_KEYS.RECENT_LOGS, '1', recent);
    } catch (error) {
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
        logError(error, { store: 'logs', action: 'fetchRecent', usedCache: true });
      } else {
        set({ status: 'error', errorState: 'no-data', isStale: false });
        logError(error, { store: 'logs', action: 'fetchRecent', usedCache: false });
      }
    }
  },
  async createGlucose(payload) {
    const optimistic: LogEntry = {
      id: `glucose-${Date.now()}`,
      type: 'glucose',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      value: payload.value,
      tags: payload.tags,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createGlucose(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createGlucose' });
      throw error;
    }
  },
  async createBloodPressure(payload) {
    const optimistic: LogEntry = {
      id: `bp-${Date.now()}`,
      type: 'blood-pressure',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      systolic: payload.systolic,
      diastolic: payload.diastolic,
      tags: payload.tags,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createBloodPressure(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createBloodPressure' });
      throw error;
    }
  },
  async createMedication(payload) {
    const optimistic: LogEntry = {
      id: `med-${Date.now()}`,
      type: 'medication',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      medication: payload.medication,
      dose: payload.dose,
      tags: payload.tags,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createMedication(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createMedication' });
      throw error;
    }
  },
  async createWeight(payload) {
    const optimistic: LogEntry = {
      id: `weight-${Date.now()}`,
      type: 'weight',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      weight_kg: payload.weight_kg,
      bodyfat_pct: payload.bodyfat_pct,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createWeight(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createWeight' });
      throw error;
    }
  },
  async createWater(payload) {
    const optimistic: LogEntry = {
      id: `water-${Date.now()}`,
      type: 'water',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      volume_ml: payload.volume_ml
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createWater(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createWater' });
      throw error;
    }
  },
  async createMeal(payload) {
    const optimistic: LogEntry = {
      id: `meal-${Date.now()}`,
      type: 'meal',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      title: payload.title,
      macros: payload.macros,
      kcal: payload.kcal,
      photo_key: payload.photo_key,
      meal_id: payload.meal_id,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createMeal(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createMeal' });
      throw error;
    }
  },
  async createInsulin(payload) {
    const optimistic: LogEntry = {
      id: `insulin-${Date.now()}`,
      type: 'insulin',
      recordedAt: payload.recordedAt || new Date().toISOString(),
      insulin_type: payload.insulin_type,
      dose_units: payload.dose_units,
      meal_id: payload.meal_id,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      const saved = await logsApi.createInsulin(payload);
      set({ recent: [saved, ...get().recent] });
      return saved;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createInsulin' });
      throw error;
    }
  }
}));
