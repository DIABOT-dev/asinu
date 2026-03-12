import { useCallback, useEffect, useMemo } from 'react';
import { LogEntry, useLogsStore } from '../logs/logs.store';
import { useMissionsStore } from '../missions/missions.store';
import { TreeHistoryPoint, useTreeStore } from '../tree/tree.store';

// Helper to get value from log entry
const getLogValue = (log: LogEntry, field: 'value' | 'systolic' | 'diastolic' | 'volume_ml') => {
  return log[field];
};

// Helper to create trend data from logs
const createGlucoseTrendFromLogs = (logs: LogEntry[]): TreeHistoryPoint[] => {
  const glucoseLogs = logs
    .filter(log => log.type === 'glucose' && log.value !== undefined)
    .slice(0, 7)
    .reverse(); // Oldest first
  
  if (glucoseLogs.length === 0) return [];
  
  return glucoseLogs.map((log, index) => {
    const date = log.recordedAt ? new Date(log.recordedAt) : new Date();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return {
      label: dayNames[date.getDay()],
      value: log.value || 0
    };
  });
};

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
  const treeHistory = useTreeStore((state) => state.history);
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
    // Find latest glucose
    const latestGlucose = logs.find((log) => log.type === 'glucose');
    // Find latest blood pressure
    const latestBloodPressure = logs.find((log) => log.type === 'blood-pressure');
    
    const glucoseValue = latestGlucose ? getLogValue(latestGlucose, 'value') : null;
    const systolicValue = latestBloodPressure ? getLogValue(latestBloodPressure, 'systolic') : null;
    const diastolicValue = latestBloodPressure ? getLogValue(latestBloodPressure, 'diastolic') : null;
    
    return {
      glucose: glucoseValue !== null ? glucoseValue : '--',
      bloodPressure: systolicValue && diastolicValue
        ? `${systolicValue}/${diastolicValue}`
        : '--'
    };
  }, [logs]);

  // Tạo dữ liệu biểu đồ từ logs thực tế
  const glucoseTrendData = useMemo(() => {
    return createGlucoseTrendFromLogs(logs);
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
    treeHistory,
    glucoseTrendData,
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
