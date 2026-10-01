import { apiClient } from "../../lib/apiClient";

export type EarlySignalSeverity = "monitor" | "see_doctor" | "urgent";
export type EarlySignalAssessment = {
  id: number;
  user_id: number;
  trigger_type: "manual" | "weekly" | "new_log" | "worsened";
  severity: EarlySignalSeverity;
  is_red_flag: boolean;
  signals: string[];
  summary: string;
  suggested_specialty: string | null;
  urgent_signs: string[];
  disclaimer: string;
  family_notified_at: string | null;
  call_episode_id: string | null;
  user_name?: string;
  user_phone?: string | null;
  created_at: string;
};

export const earlySignalApi = {
  async latest(userId?: number) {
    const path = userId
      ? `/api/early-signals/latest?user_id=${encodeURIComponent(String(userId))}`
      : "/api/early-signals/latest";
    const response = await apiClient<{
      ok: boolean;
      assessment: EarlySignalAssessment | null;
    }>(path);
    return response.assessment;
  },
  async evaluate() {
    const response = await apiClient<{
      ok: boolean;
      assessment: EarlySignalAssessment;
    }>("/api/early-signals/evaluate", { method: "POST", body: {} });
    return response.assessment;
  },
};
