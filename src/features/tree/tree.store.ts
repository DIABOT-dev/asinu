import { create } from 'zustand';
import { treeApi } from './tree.api';
import { featureFlags } from '../../lib/featureFlags';
import { localCache } from '../../lib/localCache';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { logError } from '../../lib/logger';

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

const fallbackHistory: TreeHistoryPoint[] = [
  { label: 'T2', value: 62 },
  { label: 'T3', value: 68 },
  { label: 'T4', value: 70 },
  { label: 'T5', value: 66 },
  { label: 'T6', value: 74 },
  { label: 'T7', value: 72 },
  { label: 'CN', value: 75 }
];

export const useTreeStore = create<TreeState>((set) => ({
  summary: null,
  history: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  async fetchTree(signal) {
    if (featureFlags.devBypassAuth) {
      set({ summary: fallbackSummary, history: fallbackHistory, status: 'success', isStale: false, errorState: 'none' });
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
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
      } else {
        set({ summary: fallbackSummary, history: fallbackHistory, status: 'error', isStale: false, errorState: 'no-data' });
      }
      logError(error, { store: 'tree', action: 'fetchTree', usedCache });
    }
  }
}));
