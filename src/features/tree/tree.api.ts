import { apiClient } from '../../lib/apiClient';
import { TreeSummary, TreeHistoryPoint } from './tree.store';

export const treeApi = {
  fetchSummary(options?: { signal?: AbortSignal }) {
    return apiClient<TreeSummary>('/api/mobile/tree', { retry: { attempts: 2, initialDelayMs: 500 }, signal: options?.signal });
  },
  fetchHistory(options?: { signal?: AbortSignal }) {
    return apiClient<TreeHistoryPoint[]>('/api/mobile/tree/history', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
  }
};
