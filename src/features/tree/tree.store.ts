import { create } from 'zustand';
import i18n from '../../i18n';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { logError } from '../../lib/logger';
import { treeApi } from './tree.api';

export type TreeSummary = {
  score: number;
  streakDays: number;
  completedThisWeek: number;
  totalMissions?: number;
};

export type TreeHistoryPoint = {
  label: string;
  value: number;
};

type ErrorState = 'none' | 'remote-failed' | 'no-data';

type TreeState = {
  summary: TreeSummary | null;
  history: TreeHistoryPoint[];
  status: 'idle' | 'loading' | 'success' | 'error';
  isStale: boolean;
  errorState: ErrorState;
  fetchTree: (signal?: AbortSignal) => Promise<void>;
};

const fallbackSummary: TreeSummary = {
  score: 0.68,
  streakDays: 6,
  completedThisWeek: 9,
  totalMissions: 12
};

const getFallbackHistory = (): TreeHistoryPoint[] => {
  const t = (key: string) => i18n.t(key, { ns: 'tree' });
  return [
    { label: t('dayMon'), value: 62 },
    { label: t('dayTue'), value: 68 },
    { label: t('dayWed'), value: 70 },
    { label: t('dayThu'), value: 66 },
    { label: t('dayFri'), value: 74 },
    { label: t('daySat'), value: 72 },
    { label: t('daySun'), value: 75 }
  ];
};

export const useTreeStore = create<TreeState>((set) => ({
  summary: null,
  history: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  async fetchTree(signal) {
    if (featureFlags.devBypassAuth) {
      set({ summary: fallbackSummary, history: getFallbackHistory(), status: 'success', isStale: false, errorState: 'none' });
      return;
    }

    let usedCache = false;
    const cached = await localCache.getCached<{ summary: TreeSummary; history: TreeHistoryPoint[] }>(CACHE_KEYS.TREE, '1');
    if (cached) {
      set({ summary: cached.summary, history: cached.history, status: 'success', isStale: true, errorState: 'none' });
      usedCache = true;
    } else {
      set({ status: 'loading', errorState: 'none', isStale: false });
    }

    try {
      const [summary, history] = await Promise.all([
        treeApi.fetchSummary({ signal }),
        treeApi.fetchHistory({ signal })
      ]);
      set({ summary, history, status: 'success', isStale: false, errorState: 'none' });
      await localCache.setCached(CACHE_KEYS.TREE, '1', { summary, history });
    } catch (error) {
      // Ignore AbortError - it's expected when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't change state, just return silently
        return;
      }
      
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
      } else {
        set({ summary: fallbackSummary, history: getFallbackHistory(), status: 'error', isStale: false, errorState: 'no-data' });
      }
      logError(error, { store: 'tree', action: 'fetchTree', usedCache });
    }
  }
}));
