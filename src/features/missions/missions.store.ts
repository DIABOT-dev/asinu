import { create } from 'zustand';
import i18n from '../../i18n';
import { CACHE_KEYS } from '../../lib/cacheKeys';
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

const VISIBLE_MISSION_KEYS = new Set([
  'daily_checkin',
  'log_glucose',
  'log_bp',
  'log_weight',
  'log_water',
]);

type MissionsState = {
  missions: Mission[];
  status: 'idle' | 'loading' | 'success' | 'error';
  isStale: boolean;
  errorState: ErrorState;
  fetchMissions: (signal?: AbortSignal) => Promise<void>;
  reset: () => void;
};

const getMissionMeta = (): Record<string, { title: string; description?: string }> => ({
  daily_checkin: {
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
});

const filterVisibleMissions = (missions: MissionRecord[]) =>
  missions.filter((mission) => VISIBLE_MISSION_KEYS.has(mission.mission_key));

const mapMission = (mission: MissionRecord): Mission => {
  // Always prefer local i18n (follows user's language), backend title only as last fallback
  const missionMeta = getMissionMeta();
  const meta = missionMeta[mission.mission_key] || { title: mission.mission_key };
  return {
    id: mission.id || mission.mission_key,
    missionKey: mission.mission_key,
    title: meta.title || mission.title || mission.mission_key,
    description: meta.description || mission.description,
    status: mission.status,
    progress: mission.progress,
    goal: mission.goal,
    updatedAt: mission.updated_at
  };
};

export const useMissionsStore = create<MissionsState>((set) => ({
  missions: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  reset() {
    set({ missions: [], status: 'idle', isStale: false, errorState: 'none' });
  },
  async fetchMissions(signal) {
    const todayKey = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD' — cache hết hạn khi sang ngày mới
    let usedCache = false;
    const cachedRecords = await localCache.getCached<MissionRecord[]>(CACHE_KEYS.MISSIONS, todayKey);
    if (cachedRecords) {
      // Re-map with current language on every read (don't use cached title strings)
      set({ missions: filterVisibleMissions(cachedRecords).map(mapMission), status: 'success', isStale: true, errorState: 'none' });
      usedCache = true;
    } else {
      set({ status: 'loading', errorState: 'none', isStale: false });
    }
    try {
      const missionRecords = await missionsApi.fetchMissions({ signal });

      const missions = filterVisibleMissions(missionRecords).map(mapMission);

      set({ missions, status: 'success', isStale: false, errorState: 'none' });
      // Cache raw records (not mapped) so re-mapping always uses current language
      await localCache.setCached(CACHE_KEYS.MISSIONS, todayKey, missionRecords);
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
