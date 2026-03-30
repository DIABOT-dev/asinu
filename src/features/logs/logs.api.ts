import { apiClient } from '../../lib/apiClient';
import { LogEntry } from './logs.store';

// Frontend payload types - matched with database schema
type BaseLogPayload = {
  tags?: string[];
  notes?: string;
  recordedAt?: string;
};

export type GlucoseLogPayload = BaseLogPayload & {
  value: number;
  unit?: string; // default: mg/dL
  context?: 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random';
  meal_tag?: string;
};

export type BloodPressureLogPayload = BaseLogPayload & {
  systolic: number;
  diastolic: number;
  pulse?: number;
  unit?: string; // default: mmHg
};

export type MedicationLogPayload = BaseLogPayload & {
  medication: string; // maps to med_name
  dose: string; // maps to dose_text
  dose_value?: number;
  dose_unit?: string;
  frequency_text?: string;
};

export type WeightLogPayload = BaseLogPayload & {
  weight_kg: number;
  bodyfat_pct?: number; // maps to body_fat_percent
  muscle_pct?: number; // maps to muscle_percent
};

export type WaterLogPayload = BaseLogPayload & {
  volume_ml: number;
};

export type MealLogPayload = BaseLogPayload & {
  title: string; // maps to meal_text
  kcal?: number; // maps to calories_kcal
  carbs_g?: number;
  protein_g?: number;
  fat_g?: number;
  photo_key?: string; // maps to photo_url
};

export type InsulinLogPayload = BaseLogPayload & {
  insulin_type?: string;
  dose_units: number;
  unit?: string; // default: U
  timing?: 'pre_meal' | 'post_meal' | 'bedtime' | 'correction' | string;
  injection_site?: string;
};

// Map UI tag keys to backend context (using i18n keys from logs namespace)
import i18n from '../../i18n';

const getTagToContext = (): Record<string, string> => {
  const t = (key: string) => i18n.t(key, { ns: 'logs' });
  return {
    [t('ctxPreMeal')]: 'pre_meal',
    [t('ctxPostMeal')]: 'post_meal',
    [t('ctxFasting')]: 'fasting',
    [t('ctxBeforeSleep')]: 'before_sleep',
    [t('ctxRandom')]: 'random',
    [t('bpMorning')]: 'fasting',
    [t('bpEvening')]: 'before_sleep'
  };
};

type LogsResponse = {
  ok: boolean;
  logs: LogEntry[];
};

type CreateLogResponse = {
  ok: boolean;
  log_id: string;
  log_type: string;
};

// Transform frontend payload to backend format
const transformToBackendPayload = (logType: string, frontendPayload: BaseLogPayload & Record<string, any>) => {
  const now = new Date().toISOString();
  const context = frontendPayload.tags?.[0] ? getTagToContext()[frontendPayload.tags[0]] : undefined;
  
  let data: Record<string, any> = {};
  
  switch (logType) {
    case 'glucose':
      data = {
        value: frontendPayload.value,
        unit: frontendPayload.unit || 'mg/dL',
        context: frontendPayload.context || context,
        meal_tag: frontendPayload.meal_tag || frontendPayload.tags?.join(', ')
      };
      break;
    case 'bp':
      data = {
        systolic: frontendPayload.systolic,
        diastolic: frontendPayload.diastolic,
        pulse: frontendPayload.pulse,
        unit: frontendPayload.unit || 'mmHg'
      };
      break;
    case 'weight':
      data = {
        weight_kg: frontendPayload.weight_kg,
        body_fat_percent: frontendPayload.bodyfat_pct,
        muscle_percent: frontendPayload.muscle_pct
      };
      break;
    case 'water':
      data = {
        volume_ml: frontendPayload.volume_ml
      };
      break;
    case 'meal':
      data = {
        calories_kcal: frontendPayload.kcal,
        carbs_g: frontendPayload.carbs_g,
        protein_g: frontendPayload.protein_g,
        fat_g: frontendPayload.fat_g,
        meal_text: frontendPayload.title,
        photo_url: frontendPayload.photo_key
      };
      break;
    case 'insulin':
      data = {
        insulin_type: frontendPayload.insulin_type,
        dose_units: frontendPayload.dose_units,
        unit: frontendPayload.unit || 'U',
        timing: frontendPayload.timing || context,
        injection_site: frontendPayload.injection_site
      };
      break;
    case 'medication':
      data = {
        med_name: frontendPayload.medication,
        dose_text: frontendPayload.dose,
        dose_value: frontendPayload.dose_value,
        dose_unit: frontendPayload.dose_unit,
        frequency_text: frontendPayload.frequency_text
      };
      break;
  }

  return {
    log_type: logType,
    occurred_at: frontendPayload.recordedAt || now,
    source: 'manual',
    note: frontendPayload.notes || null,
    metadata: {
      tags: frontendPayload.tags || []
    },
    data
  };
};

// Transform backend response to frontend format
const transformToFrontendLogs = (backendLogs: any[]): LogEntry[] => {

  if (backendLogs.length > 0) {

  }
  
  return backendLogs.map((log, idx) => {
    const detail = log.detail || {};

    const baseEntry: LogEntry = {
      id: log.id,
      type: (log.log_type === 'bp' || log.log_type === 'blood_pressure') ? 'blood-pressure' : log.log_type,
      recordedAt: log.occurred_at,
      notes: log.note,
      tags: Array.isArray(log.metadata?.tags) ? log.metadata.tags : []
    };

    switch (log.log_type) {
      case 'glucose':
        return { 
          ...baseEntry, 
          value: typeof detail.value === 'string' ? parseFloat(detail.value) : detail.value,
          unit: detail.unit,
          context: detail.context,
          meal_tag: detail.meal_tag
        };
      case 'bp':
      case 'blood_pressure':
        return {
          ...baseEntry,
          systolic: typeof detail.systolic === 'string' ? parseInt(detail.systolic, 10) : detail.systolic,
          diastolic: typeof detail.diastolic === 'string' ? parseInt(detail.diastolic, 10) : detail.diastolic,
          pulse: detail.pulse ? (typeof detail.pulse === 'string' ? parseInt(detail.pulse, 10) : detail.pulse) : null,
          unit: detail.unit
        };
      case 'weight':
        return { 
          ...baseEntry, 
          weight_kg: typeof detail.weight_kg === 'string' ? parseFloat(detail.weight_kg) : detail.weight_kg, 
          bodyfat_pct: detail.body_fat_percent ? (typeof detail.body_fat_percent === 'string' ? parseFloat(detail.body_fat_percent) : detail.body_fat_percent) : null,
          muscle_pct: detail.muscle_percent ? (typeof detail.muscle_percent === 'string' ? parseFloat(detail.muscle_percent) : detail.muscle_percent) : null
        };
      case 'water':
        return { ...baseEntry, volume_ml: typeof detail.volume_ml === 'string' ? parseInt(detail.volume_ml, 10) : detail.volume_ml };
      case 'meal':
        return { 
          ...baseEntry, 
          title: detail.meal_text, 
          kcal: detail.calories_kcal,
          carbs_g: detail.carbs_g,
          protein_g: detail.protein_g,
          fat_g: detail.fat_g,
          photo_key: detail.photo_url 
        };
      case 'insulin':
        return { 
          ...baseEntry, 
          insulin_type: detail.insulin_type, 
          dose_units: detail.dose_units,
          unit: detail.unit,
          timing: detail.timing,
          injection_site: detail.injection_site
        };
      case 'medication':
        return { 
          ...baseEntry, 
          medication: detail.med_name, 
          dose: detail.dose_text,
          dose_value: detail.dose_value,
          dose_unit: detail.dose_unit,
          frequency_text: detail.frequency_text
        };
      default:
        return baseEntry;
    }
  });
};

export const logsApi = {
  async fetchRecent(options?: { signal?: AbortSignal }) {
    const response = await apiClient<LogsResponse>('/api/mobile/logs', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
    // Transform backend format to frontend format
    return transformToFrontendLogs(response.logs || []);
  },
  async fetchLatestByType(logType: string, options?: { signal?: AbortSignal }): Promise<LogEntry | null> {
    try {
      const response = await apiClient<LogsResponse>(`/api/mobile/logs?type=${logType}&limit=1`, {
        retry: { attempts: 1, initialDelayMs: 300 },
        signal: options?.signal
      });
      const logs = transformToFrontendLogs(response.logs || []);
      return logs.length > 0 ? logs[0] : null;
    } catch {
      return null;
    }
  },
  createGlucose(payload: GlucoseLogPayload) {
    const backendPayload = transformToBackendPayload('glucose', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createBloodPressure(payload: BloodPressureLogPayload) {
    const backendPayload = transformToBackendPayload('bp', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createMedication(payload: MedicationLogPayload) {
    const backendPayload = transformToBackendPayload('medication', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createWeight(payload: WeightLogPayload) {
    const backendPayload = transformToBackendPayload('weight', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createWater(payload: WaterLogPayload) {
    const backendPayload = transformToBackendPayload('water', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createMeal(payload: MealLogPayload) {
    const backendPayload = transformToBackendPayload('meal', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  },
  createInsulin(payload: InsulinLogPayload) {
    const backendPayload = transformToBackendPayload('insulin', payload);
    return apiClient<CreateLogResponse>('/api/mobile/logs', {
      method: 'POST',
      body: backendPayload
    });
  }
};
