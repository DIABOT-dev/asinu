import { useEffect, useMemo, useCallback } from 'react';
import { useLogsStore } from '../logs/logs.store';
import { useMissionsStore } from '../missions/missions.store';
import { useTreeStore } from '../tree/tree.store';

export const useHomeViewModel = () => {
  const logs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const logsStatus = useLogsStore((state) => state.status);
  const logsIsStale = useLogsStore((state) => state.isStale);
  const logsError = useLogsStore((state) => state.errorState);

  const missions = useMissionsStore((state) => state.missions);
  const fetchMissions = useMissionsStore((state) => state.fetchMissions);
  const missionsStatus = useMissionsStore((state) => state.status);
  const missionsIsStale = useMissionsStore((state) => state.isStale);
  const missionsError = useMissionsStore((state) => state.errorState);

  const treeSummary = useTreeStore((state) => state.summary);
  const fetchTree = useTreeStore((state) => state.fetchTree);
  const treeStatus = useTreeStore((state) => state.status);
  const treeIsStale = useTreeStore((state) => state.isStale);
  const treeError = useTreeStore((state) => state.errorState);

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    fetchMissions(controller.signal);
    fetchTree(controller.signal);
    return () => controller.abort();
  }, [fetchLogs, fetchMissions, fetchTree]);

  const quickMetrics = useMemo(() => {
    const latestGlucose = logs.find((log) => log.type === 'glucose');
    const latestBloodPressure = logs.find((log) => log.type === 'blood-pressure');
    return {
      glucose: latestGlucose?.value ?? 118,
      bloodPressure: latestBloodPressure
        ? `${latestBloodPressure.systolic}/${latestBloodPressure.diastolic}`
        : '124/78'
    };
  }, [logs]);

  const refreshAll = useCallback(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    fetchMissions(controller.signal);
    fetchTree(controller.signal);
    return () => controller.abort();
  }, [fetchLogs, fetchMissions, fetchTree]);

  const anyStale = logsIsStale || missionsIsStale || treeIsStale || logsError === 'remote-failed' || missionsError === 'remote-failed' || treeError === 'remote-failed';

  return {
    logs,
    missions: missions.slice(0, 3),
    treeSummary,
    quickMetrics,
    logsStatus,
    missionsStatus,
    treeStatus,
    logsError,
    missionsError,
    treeError,
    anyStale,
    refreshAll
  };
};
