import i18n from '../../i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogEntry, useLogsStore } from '../logs/logs.store';
import { useMissionsStore } from '../missions/missions.store';
import { TreeHistoryPoint, useTreeStore } from '../tree/tree.store';
import { checkinApi } from '../checkin/checkin.api';

// Helper to get value from log entry
const getLogValue = (log: LogEntry, field: 'value' | 'systolic' | 'diastolic' | 'volume_ml') => {
  return log[field];
};

const getDayLabel = (date: Date): string => {
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  return date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
};

// Helper to create trend data from logs — luôn trả về đủ 7 ngày, ngày không đo = 0
const createGlucoseTrendFromLogs = (logs: LogEntry[]): TreeHistoryPoint[] => {
  const today = new Date();
  const days: TreeHistoryPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD

    // Lấy log đường huyết mới nhất trong ngày đó
    const log = logs.find(l => {
      if (l.type !== 'glucose' || l.value === undefined) return false;
      const logDate = l.recordedAt
        ? new Date(l.recordedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
        : null;
      return logDate === dateStr;
    });

    days.push({
      label: getDayLabel(d),
      value: log?.value ?? 0,
    });
  }

  return days;
};

export const useHomeViewModel = () => {
  const [healthScore, setHealthScore] = useState<{ level: 'ok' | 'monitor' | 'danger'; factors: string[]; checkinDone: boolean } | null>(null);

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

  // Data fetching moved to useFocusEffect in home screen to avoid double-fetch

  const quickMetrics = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isToday = (iso?: string) => {
      if (!iso) return false;
      return new Date(iso).getTime() >= todayStart.getTime();
    };
    // Find latest glucose recorded TODAY only
    const latestGlucose = logs.find((log) => log.type === 'glucose' && isToday(log.recordedAt));
    // Find latest blood pressure recorded TODAY only
    const latestBloodPressure = logs.find((log) => log.type === 'blood-pressure' && isToday(log.recordedAt));
    
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

  const fetchHealthScore = useCallback(() => {
    checkinApi.getHealthScore().then(res => setHealthScore(res)).catch(() => {});
  }, []);

  const refreshAll = useCallback(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    fetchMissions(controller.signal);
    fetchTree(controller.signal);
    fetchHealthScore();
    return () => controller.abort();
  }, [fetchLogs, fetchMissions, fetchTree, fetchHealthScore]);

  const isOffline = logsError === 'remote-failed' || missionsError === 'remote-failed' || treeError === 'remote-failed';

  return {
    logs,
    missions: missions.slice(0, 3),
    treeSummary,
    treeHistory,
    glucoseTrendData,
    quickMetrics,
    healthScore,
    logsStatus,
    missionsStatus,
    treeStatus,
    logsError,
    missionsError,
    treeError,
    isOffline,
    refreshAll
  };
};
