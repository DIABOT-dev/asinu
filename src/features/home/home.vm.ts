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

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const getDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getDayLabel = (date: Date): string => {
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  return date.toLocaleDateString(locale, { weekday: 'short', timeZone: VN_TIME_ZONE });
};

// Build one point per VN calendar day, using the latest valid glucose reading.
const createGlucoseTrendFromLogs = (logs: LogEntry[]): TreeHistoryPoint[] => {
  const todayKey = getDateKey(new Date());
  const today = new Date(`${todayKey}T12:00:00.000Z`);
  const latestByDay = new Map<string, LogEntry>();

  logs.forEach((log) => {
    if (log.type !== 'glucose' || !log.recordedAt) return;
    const value = Number(log.value);
    const recordedAt = new Date(log.recordedAt);
    if (!Number.isFinite(value) || value <= 0 || Number.isNaN(recordedAt.getTime())) return;

    const dateKey = getDateKey(recordedAt);
    const previous = latestByDay.get(dateKey);
    if (!previous || new Date(previous.recordedAt || 0).getTime() < recordedAt.getTime()) {
      latestByDay.set(dateKey, { ...log, value });
    }
  });

  const days: TreeHistoryPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dateKey = getDateKey(d);
    const log = latestByDay.get(dateKey);

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
    // Find the latest weight recorded today and total today's water intake.
    const latestWeight = logs.find((log) => log.type === 'weight' && isToday(log.recordedAt));
    const waterTotal = logs
      .filter((log) => log.type === 'water' && isToday(log.recordedAt))
      .reduce((total, log) => total + (Number(log.volume_ml) || 0), 0);
    
    const glucoseValue = latestGlucose ? getLogValue(latestGlucose, 'value') : null;
    const systolicValue = latestBloodPressure ? getLogValue(latestBloodPressure, 'systolic') : null;
    const diastolicValue = latestBloodPressure ? getLogValue(latestBloodPressure, 'diastolic') : null;
    const weightValue = latestWeight?.weight_kg;
    
    return {
      glucose: typeof glucoseValue === 'number' && Number.isFinite(glucoseValue) ? glucoseValue : '--',
      bloodPressure: typeof systolicValue === 'number' && typeof diastolicValue === 'number'
        ? `${systolicValue}/${diastolicValue}`
        : '--',
      weight: typeof weightValue === 'number' && Number.isFinite(weightValue) ? weightValue : '--',
      water: waterTotal > 0 ? waterTotal : '--',
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
