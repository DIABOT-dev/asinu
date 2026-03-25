import { create } from 'zustand';
import i18n from '../../i18n';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { logError } from '../../lib/logger';
import { logActivity } from '../wellness/api/wellness.api';

// Debounced fetchRecent - prevents multiple concurrent calls
// Also clears tree localCache so tree/home screen doesn't show stale mission counts
let _fetchRecentTimer: ReturnType<typeof setTimeout> | null = null;
let _fetchRecentAbort: AbortController | null = null;
function debouncedFetchRecent(fetchFn: (signal?: AbortSignal) => Promise<void>, delay = 500) {
  if (_fetchRecentTimer) clearTimeout(_fetchRecentTimer);
  if (_fetchRecentAbort) _fetchRecentAbort.abort();
  _fetchRecentAbort = new AbortController();
  const signal = _fetchRecentAbort.signal;
  // Invalidate tree localCache so next navigation shows fresh mission count
  localCache.removeCached(CACHE_KEYS.TREE).catch(() => {});
  _fetchRecentTimer = setTimeout(() => { fetchFn(signal).catch(() => {}); }, delay);
}
import {
    BloodPressureLogPayload,
    GlucoseLogPayload,
    InsulinLogPayload,
    logsApi,
    MealLogPayload,
    MedicationLogPayload,
    WaterLogPayload,
    WeightLogPayload
} from './logs.api';

export type LogEntry = {
  id: string;
  type: 'glucose' | 'blood-pressure' | 'medication' | 'weight' | 'water' | 'meal' | 'insulin';
  // Glucose fields
  value?: number;
  unit?: string;
  context?: string;
  meal_tag?: string;
  // Blood pressure fields
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  // Medication fields
  medication?: string;
  dose?: string;
  dose_value?: number;
  dose_unit?: string;
  frequency_text?: string;
  // Weight fields
  weight_kg?: number;
  bodyfat_pct?: number;
  muscle_pct?: number;
  // Water fields
  volume_ml?: number;
  // Meal fields
  title?: string;
  kcal?: number;
  carbs_g?: number;
  protein_g?: number;
  fat_g?: number;
  photo_key?: string;
  // Insulin fields
  insulin_type?: string;
  dose_units?: number;
  timing?: string;
  injection_site?: string;
  // Common fields
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
    tags: [i18n.t('ctxPreMeal', { ns: 'logs' })],
    recordedAt: new Date().toISOString()
  },
  {
    id: 'log-2',
    type: 'blood-pressure',
    systolic: 125,
    diastolic: 78,
    tags: [i18n.t('bpMorning', { ns: 'logs' })],
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

      if (recent.length > 0) {

      }
      set({ recent, status: 'success', isStale: false, errorState: 'none' });
      await localCache.setCached(CACHE_KEYS.RECENT_LOGS, '1', recent);
    } catch (error) {
      // Ignore AbortError - it's expected when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't change state, just return silently
        return;
      }
      
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
      await logsApi.createGlucose(payload);
      // Log wellness activity
      logActivity('HEALTH_MEASUREMENT', { type: 'glucose', value: payload.value }).catch(() => {});
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      await logsApi.createBloodPressure(payload);
      // Log wellness activity
      logActivity('HEALTH_MEASUREMENT', { type: 'blood_pressure', systolic: payload.systolic, diastolic: payload.diastolic }).catch(() => {});
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      await logsApi.createMedication(payload);
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      await logsApi.createWeight(payload);
      // Log wellness activity
      logActivity('HEALTH_MEASUREMENT', { type: 'weight', value: payload.weight_kg }).catch(() => {});
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      volume_ml: payload.volume_ml,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      await logsApi.createWater(payload);
      // Log wellness activity
      logActivity('HEALTH_MEASUREMENT', { type: 'water', volume_ml: payload.volume_ml }).catch(() => {});
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      kcal: payload.kcal,
      carbs_g: payload.carbs_g,
      protein_g: payload.protein_g,
      fat_g: payload.fat_g,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      await logsApi.createMeal(payload);
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
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
      timing: payload.timing,
      notes: payload.notes
    };
    set({ recent: [optimistic, ...get().recent] });
    try {
      await logsApi.createInsulin(payload);
      debouncedFetchRecent((s) => get().fetchRecent(s));
      return optimistic;
    } catch (error) {
      set({ recent: get().recent.filter((log) => log.id !== optimistic.id) });
      logError(error, { store: 'logs', action: 'createInsulin' });
      throw error;
    }
  }
}));
