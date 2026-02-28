import { create } from 'zustand';
import i18n from '../../i18n';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { logError } from '../../lib/logger';
import { missionsApi } from './missions.api';

export type Mission = {
  id: string;
  missionKey: string;
  title: string;
  description?: string;
  status: 'active' | 'completed';
  progress: number;
  goal: number;
  updatedAt: string;
};

export type MissionRecord = {
  mission_key: string;
  title?: string;        // Backend now provides title
  description?: string;  // Backend now provides description
  status: 'active' | 'completed';
  progress: number;
  goal: number;
  updated_at: string;
  id?: string;          // Backend now provides unique id
};

type ErrorState = 'none' | 'remote-failed' | 'no-data';

type MissionsState = {
  missions: Mission[];
  status: 'idle' | 'loading' | 'success' | 'error';
  isStale: boolean;
  errorState: ErrorState;
  fetchMissions: (signal?: AbortSignal) => Promise<void>;
};

const getMissionMeta = (): Record<string, { title: string; description?: string }> => ({
  DAILY_CHECKIN: {
    title: i18n.t('missions:dailyCheckIn'),
    description: i18n.t('missions:dailyCheckInDesc')
  },
  log_glucose: {
    title: i18n.t('missions:measureGlucose'),
    description: i18n.t('missions:measureGlucoseDesc')
  },
  log_bp: {
    title: i18n.t('missions:measureBP'),
    description: i18n.t('missions:measureBPDesc')
  },
  log_weight: {
    title: i18n.t('missions:weightMission'),
    description: i18n.t('missions:weightMissionDesc')
  },
  log_water: {
    title: i18n.t('missions:waterIntake'),
    description: i18n.t('missions:waterIntakeDesc')
  },
  log_meal: {
    title: i18n.t('missions:logMeal'),
    description: i18n.t('missions:logMealDesc')
  },
  log_insulin: {
    title: i18n.t('missions:logInsulin'),
    description: i18n.t('missions:logInsulinDesc')
  },
  log_medication: {
    title: i18n.t('missions:logMedication'),
    description: i18n.t('missions:logMedicationDesc')
  },
  connect_caregiver: {
    title: i18n.t('missions:connectFamily'),
    description: i18n.t('missions:connectFamilyDesc')
  }
});

const mapMission = (mission: MissionRecord): Mission => {
  // Use backend-provided title/description, or fallback to local meta
  const missionMeta = getMissionMeta();
  const meta = missionMeta[mission.mission_key] || { title: mission.mission_key };
  return {
    id: mission.id || mission.mission_key,  // Use backend id if available
    missionKey: mission.mission_key,
    title: mission.title || meta.title,     // Prefer backend title
    description: mission.description || meta.description,
    status: mission.status,
    progress: mission.progress,
    goal: mission.goal,
    updatedAt: mission.updated_at
  };
};

const getFallbackMissions = (): Mission[] => {
  const meta = getMissionMeta();
  return [
    {
      id: 'log_glucose',
      missionKey: 'log_glucose',
      title: meta.log_glucose.title,
      description: meta.log_glucose.description,
      status: 'active',
      progress: 0,
      goal: 2,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'log_bp',
      missionKey: 'log_bp',
      title: meta.log_bp.title,
      description: meta.log_bp.description,
      status: 'active',
      progress: 0,
      goal: 2,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'log_water',
      missionKey: 'log_water',
      title: meta.log_water.title,
      description: meta.log_water.description,
      status: 'active',
      progress: 0,
      goal: 4,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'log_meal',
      missionKey: 'log_meal',
      title: meta.log_meal.title,
      description: meta.log_meal.description,
      status: 'active',
      progress: 0,
      goal: 3,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'daily_checkin',
      missionKey: 'daily_checkin',
      title: meta.DAILY_CHECKIN.title,
      description: meta.DAILY_CHECKIN.description,
      status: 'active',
      progress: 0,
      goal: 1,
      updatedAt: new Date().toISOString()
    }
  ];
};

export const useMissionsStore = create<MissionsState>((set) => ({
  missions: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  async fetchMissions(signal) {
    if (featureFlags.devBypassAuth) {
      set({ missions: getFallbackMissions(), status: 'success', isStale: false, errorState: 'none' });
      return;
    }
    let usedCache = false;
    const cached = await localCache.getCached<Mission[]>(CACHE_KEYS.MISSIONS, '1');
    if (cached) {
      set({ missions: cached, status: 'success', isStale: true, errorState: 'none' });
      usedCache = true;
    } else {
      set({ status: 'loading', errorState: 'none', isStale: false });
    }
    try {
      const missionRecords = await missionsApi.fetchMissions({ signal });
      console.log('[missions] Raw backend response:', missionRecords);
      const missions = missionRecords.map(mapMission);
      console.log('[missions] Mapped missions:', missions);
      set({ missions, status: 'success', isStale: false, errorState: 'none' });
      await localCache.setCached(CACHE_KEYS.MISSIONS, '1', missions);
    } catch (error) {
      // Ignore AbortError - it's expected when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't change state, just return silently
        return;
      }
      
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
      } else {
        set({ status: 'error', errorState: 'no-data', isStale: false, missions: [] });
      }
      logError(error, { store: 'missions', action: 'fetchMissions', usedCache });
    }
  }
}));
