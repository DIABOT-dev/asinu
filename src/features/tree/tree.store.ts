import { create } from 'zustand';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { localCache } from '../../lib/localCache';
import { logError } from '../../lib/logger';
import { treeApi } from './tree.api';

export type TreeSummary = {
  score: number;
  streakDays: number;
  completedToday: number;
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
  reset: () => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  summary: null,
  history: [],
  status: 'idle',
  isStale: false,
  errorState: 'none',
  reset() {
    set({ summary: null, history: [], status: 'idle', isStale: false, errorState: 'none' });
  },
  async fetchTree(signal) {
    const todayKey = new Date().toISOString().slice(0, 10);
    let usedCache = false;
    const cached = await localCache.getCached<{ summary: TreeSummary; history: TreeHistoryPoint[] }>(CACHE_KEYS.TREE, todayKey);
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
      await localCache.setCached(CACHE_KEYS.TREE, todayKey, { summary, history });
    } catch (error) {
      // Ignore AbortError - it's expected when component unmounts
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't change state, just return silently
        return;
      }
      
      if (usedCache) {
        set({ status: 'success', isStale: true, errorState: 'remote-failed' });
      } else {
        set({ summary: null, history: [], status: 'error', isStale: false, errorState: 'no-data' });
      }
      logError(error, { store: 'tree', action: 'fetchTree', usedCache });
    }
  }
}));
