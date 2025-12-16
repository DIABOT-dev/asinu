import { apiClient } from '../../lib/apiClient';
import { Mission } from './missions.store';

export const missionsApi = {
  fetchMissions(options?: { signal?: AbortSignal }) {
    return apiClient<Mission[]>('/api/mobile/missions', {
      retry: { attempts: 2, initialDelayMs: 500 },
      signal: options?.signal
    });
  },
  completeMission(id: string) {
    return apiClient<Mission>(`/api/mobile/missions/${id}/complete`, { method: 'POST' });
  }
};
