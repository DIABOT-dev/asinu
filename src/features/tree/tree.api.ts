import { apiClient } from '../../lib/apiClient';
import { TreeHistoryPoint, TreeSummary } from './tree.store';

type TreeSummaryResponse = {
  ok: boolean;
  score: number;
  streakDays: number;
  completedThisWeek: number;
  totalMissions?: number;
};

export const treeApi = {
  fetchSummary(options?: { signal?: AbortSignal }) {
    return apiClient<TreeSummaryResponse>('/api/mobile/tree', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    }).then(res => ({
      score: res.score,
      streakDays: res.streakDays,
      completedThisWeek: res.completedThisWeek,
      totalMissions: res.totalMissions
    } as TreeSummary));
  },
  fetchHistory(options?: { signal?: AbortSignal }) {
    return apiClient<TreeHistoryPoint[]>('/api/mobile/tree/history', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
  }
};
