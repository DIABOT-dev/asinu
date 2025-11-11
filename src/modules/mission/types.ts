export type MissionStatus = "pending" | "done";

export interface MissionDefinition {
  mission_id: string;
  code: string;
  title: string;
  cluster: string;
  energy: number;
  max_per_day: number;
}

export interface MissionProgress extends MissionDefinition {
  status: MissionStatus;
  completed_count: number;
  completed_at: string | null;
}

export interface MissionSummary {
  date: string;
  completed: number;
  total: number;
  energy_earned: number;
  energy_available: number;
}

export interface MissionTodayPayload {
  missions: MissionProgress[];
  summary: MissionSummary;
}

export interface MissionCheckinResult {
  mission_id: string;
  added: number;
  status: MissionStatus;
  today_summary: MissionSummary;
}
