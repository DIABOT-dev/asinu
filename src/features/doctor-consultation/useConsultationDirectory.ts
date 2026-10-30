import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { isExpertConsultationEnabled } from '../../lib/appEnv';

export type DoctorSpecialty = { code: string; name: string };
export type DoctorRecommendation = {
  doctorId: string;
  fullName: string;
  avatarUrl?: string | null;
  specialties: string[];
  reputation: number;
  ratingCount?: number;
  estimatedWaitMinutes: number;
  preferred: boolean;
  routingTenantId?: string;
  availability?: 'online' | 'busy' | 'offline';
};

const initial = {
  specialties: [] as DoctorSpecialty[],
  recommendations: [] as DoctorRecommendation[],
  selectedSpecialty: '',
  preferredDoctorId: null as string | null,
  estimatedWaitMinutes: null as number | null,
  loading: true,
  error: false,
};

export function useConsultationDirectory() {
  const [state, setState] = useState(initial);
  const latest = useRef(state);
  latest.current = state;
  const version = useRef(0);

  const publish = useCallback((change: Partial<typeof initial>) => {
    latest.current = { ...latest.current, ...change };
    setState(latest.current);
  }, []);

  const loadSpecialists = useCallback(
    async (specialty: string, request: number) => {
      if (!isExpertConsultationEnabled) {
        return;
      }
      const response = await apiClient<{
        data?: {
          items: DoctorRecommendation[];
          estimatedWaitMinutes: number | null;
        };
      }>('/api/doctor/specialists', {
        method: 'POST',
        body: {
          specialty,
          service_flow: 'clinical',
          priority: 'normal',
          limit: 6,
        },
      });
      if (request !== version.current) {
        return;
      }
      const items = response.data?.items ?? [];
      publish({
        recommendations: items,
        estimatedWaitMinutes: response.data?.estimatedWaitMinutes ?? null,
        preferredDoctorId: items.some(
          (item) => item.doctorId === latest.current.preferredDoctorId,
        )
          ? latest.current.preferredDoctorId
          : null,
      });
    },
    [publish],
  );

  const refresh = useCallback(async () => {
    if (!isExpertConsultationEnabled) {
      publish({ loading: false });
      return;
    }
    const request = ++version.current;
    publish({ loading: true, error: false });
    try {
      const response = await apiClient<{ data?: { items: DoctorSpecialty[] } }>(
        '/api/doctor/specialty-options',
      );
      if (request !== version.current) {
        return;
      }
      const items = response.data?.items ?? [];
      const specialty = items.some(
        (item) => item.code === latest.current.selectedSpecialty,
      )
        ? latest.current.selectedSpecialty
        : items[0]?.code || '';
      const changed = specialty !== latest.current.selectedSpecialty;
      publish({
        specialties: items,
        selectedSpecialty: specialty,
        ...(changed || !specialty
          ? {
              recommendations: [],
              preferredDoctorId: null,
              estimatedWaitMinutes: null,
            }
          : {}),
      });
      if (specialty) {
        await loadSpecialists(specialty, request);
      }
    } catch {
      if (request === version.current) {
        publish({ error: true });
      }
    } finally {
      if (request === version.current) {
        publish({ loading: false });
      }
    }
  }, [loadSpecialists, publish]);

  const selectSpecialty = useCallback(
    (specialty: string) => {
      if (specialty === latest.current.selectedSpecialty) {
        return;
      }
      const request = ++version.current;
      publish({
        selectedSpecialty: specialty,
        recommendations: [],
        preferredDoctorId: null,
        estimatedWaitMinutes: null,
        loading: true,
        error: false,
      });
      loadSpecialists(specialty, request)
        .catch(() => {
          if (request === version.current) {
            publish({ error: true });
          }
        })
        .finally(() => {
          if (request === version.current) {
            publish({ loading: false });
          }
        });
    },
    [loadSpecialists, publish],
  );

  const selectDoctor = useCallback(
    (doctorId: string | null) => {
      publish({ preferredDoctorId: doctorId });
    },
    [publish],
  );

  const cancelRequests = useCallback(() => {
    version.current++;
  }, []);
  useEffect(() => {
    refresh();
    return cancelRequests;
  }, [refresh, cancelRequests]);

  return { ...state, refresh, selectSpecialty, selectDoctor };
}
