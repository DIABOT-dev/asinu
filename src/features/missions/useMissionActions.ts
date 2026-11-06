import { useMissionsStore } from './missions.store';

export const useMissionActions = () => {
  const missions = useMissionsStore((state) => state.missions);
  const status = useMissionsStore((state) => state.status);
  const isStale = useMissionsStore((state) => state.isStale);
  const errorState = useMissionsStore((state) => state.errorState);
  const fetchMissions = useMissionsStore((state) => state.fetchMissions);

  return { missions, status, isStale, errorState, fetchMissions };
};
