import { addDays, format, startOfDay } from "date-fns";
import type { MissionProgress, MissionStatus, MissionSummary } from "./types";

const DATE_FORMAT = "yyyy-MM-dd";
export const DUPLICATE_WINDOW_SECONDS = 30;

export function getDateKey(date = new Date()): { key: string; start: Date; end: Date } {
  const start = startOfDay(date);
  const end = addDays(start, 1);
  return {
    key: format(start, DATE_FORMAT),
    start,
    end,
  };
}

export function isDuplicateCheckin(
  lastTs: Date | null,
  now: Date,
  windowSeconds = DUPLICATE_WINDOW_SECONDS,
): boolean {
  if (!lastTs) return false;
  const diffMs = Math.abs(now.getTime() - lastTs.getTime());
  return diffMs <= windowSeconds * 1000;
}

export function determineMissionStatus(count: number, maxPerDay: number): MissionStatus {
  return count >= maxPerDay ? "done" : "pending";
}

export function summarizeMissions(missions: MissionProgress[], date: string): MissionSummary {
  const total = missions.length;
  const completed = missions.filter((mission) => mission.status === "done").length;
  const energyEarned = missions.reduce(
    (sum, mission) => sum + (mission.status === "done" ? mission.energy : 0),
    0,
  );
  const energyAvailable = missions.reduce((sum, mission) => sum + mission.energy, 0);
  return {
    date,
    completed,
    total,
    energy_earned: energyEarned,
    energy_available: energyAvailable,
  };
}
