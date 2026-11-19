import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/apiClient';
import { useAuthStore } from '../auth/auth.store';
import { v21Api, type V21Flags } from '../v21/v21.api';
import { careCircleApi, type MemberHealthOverview } from './care-circle.api';

type HealthState = {
  owner: string;
  memberId: string;
  revision: number;
  status: 'ready' | 'denied' | 'error';
  data?: MemberHealthOverview;
};

export function useFamilyFeatures(active: boolean, revision: number) {
  const token = useAuthStore(state => state.token);
  const [features, setFeatures] = useState<{ owner: string; revision: number; flags: V21Flags }>();

  useEffect(() => {
    if (!token || !active) return;
    let current = true;
    void v21Api.flags().then(flags => {
      if (current) setFeatures({ owner: token, revision, flags });
    }).catch(() => {
      if (current) setFeatures(undefined);
    });
    return () => { current = false; };
  }, [active, revision, token]);
  return active && features?.owner === token && features.revision === revision ? features.flags : undefined;
}

export function useMemberOverview(memberId: string | undefined, active: boolean, canRead: boolean, revision: number) {
  const token = useAuthStore(state => state.token);
  const [health, setHealth] = useState<HealthState>();
  const flags = useFamilyFeatures(active, revision);
  useEffect(() => {
    if (!token || !memberId || !active || !canRead) {
      setHealth(undefined);
      return;
    }
    const abort = new AbortController();
    const scope = { owner: token, memberId, revision };
    void careCircleApi.getMemberHealthOverview(memberId, abort.signal).then(data => {
      if (!abort.signal.aborted) setHealth({ ...scope, status: 'ready', data });
    }).catch(error => {
      if (abort.signal.aborted) return;
      const status = error instanceof ApiError && error.statusCode === 403 ? 'denied' : 'error';
      setHealth({ ...scope, status });
    });
    return () => abort.abort();
  }, [active, canRead, memberId, revision, token]);

  const visibleHealth = active && canRead && health?.owner === token &&
    health.memberId === memberId && health.revision === revision ? health : undefined;

  return {
    data: visibleHealth?.data,
    status: canRead ? visibleHealth?.status ?? 'loading' as const : 'denied' as const,
    canManageMedication: !!memberId && !!flags?.medication && flags.patients.some(person => String(person.id) === memberId),
  };
}
