import { create } from 'zustand';
import { missionsApi } from './missions.api';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { logError } from '../../lib/logger';

export type Mission = {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  completed: boolean;
  points?: number;
  category?: string;
};

type ErrorState = 'none' | 'remote-failed' | 'no-data';

type MissionsState = {
  missions: Mission[];
  status: 'idle' | 'loading' | 'success' | 'error';
  isStale: boolean;
  errorState: ErrorState;
  fetchMissions: (signal?: AbortSignal) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
};

const fallbackMissions: Mission[] = [
  {
    id: 'mission-1',
    title: 'Nhắc đo đường huyết sáng nay',
    description: 'Trước ăn sáng, ghi log glucose',
    scheduledAt: new Date().toISOString(),
    completed: false,
    points: 10,
    category: 'glucose'
  },
  {
    id: 'mission-2',
    title: 'Đi bộ 15 phút',
    description: 'Cùng bố đi bộ nhé',
    scheduledAt: new Date().toISOString(),
    completed: false,
    points: 8,
    category: 'activity'
  },
  {
    id: 'mission-3',
    title: 'Uống thuốc huyết áp',
    description: 'Nhắc uống đúng giờ',
    scheduledAt: new Date().toISOString(),
    completed: true,
    points: 5,
    category: 'medication'
  }
];

export const useMissionsStore = create<MissionsState>((set, get) => ({
  missions: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  async fetchMissions(signal) {
    if (featureFlags.devBypassAuth) {
      set({ missions: fallbackMissions, status: 'success', isStale: false, errorState: 'none' });
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
      const missions = await missionsApi.fetchMissions({ signal });
      set({ missions, status: 'success', isStale: false, errorState: 'none' });
      await localCache.setCached(CACHE_KEYS.MISSIONS, '1', missions);
    } catch (error) {
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
      } else {
        set({ status: 'error', errorState: 'no-data', isStale: false, missions: fallbackMissions });
      }
      logError(error, { store: 'missions', action: 'fetchMissions', usedCache });
    }
  },
  async toggleComplete(id) {
    const previous = get().missions;
    const updated = previous.map((mission) => (mission.id === id ? { ...mission, completed: !mission.completed } : mission));
    set({ missions: updated });
    try {
      await missionsApi.completeMission(id);
    } catch (error) {
      console.warn('Mission complete failed, rolling back', error);
      set({ missions: previous });
      throw error;
    }
  }
}));
