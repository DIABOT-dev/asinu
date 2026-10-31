import { apiClient } from "../../lib/apiClient";
export type Patient = { id: number; name: string };
export type V21Flags = {
  medication: boolean;
  coins: boolean;
  scan: boolean;
  nativeCall: boolean;
  patients: Patient[];
};
export type CoinTask = {
  task_code: "CHECKIN" | "MED_ANSWER" | "VITAL" | "GIFT_OPEN" | "WEEKLY";
  coins: number;
  daily_limit: number;
  weekly_limit: number;
  done: number;
};
export type CoinToday = {
  balance: number;
  tasks: CoinTask[];
  weeklyDays: number;
  serverDate: string;
};
export type Reward = {
  code: "GREETING_CARD" | "DRAW_TICKET";
  cost: number;
  daily_limit: number;
  monthly_limit: number;
};
export type RewardCatalog = {
  items: Reward[];
  templates: { code: string; title: string; title_en: string }[];
  recipients: Patient[];
  drawPeriodId?: string | null;
};
export type CoinEntry = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
  expires_at?: string;
  ref_id: string;
  ticket_no?: string;
  reward_status?: string;
};
export type MedKind = "MEDICINE" | "SUPPLEMENT";
export type Anchor =
  | "before_breakfast"
  | "after_breakfast"
  | "after_lunch"
  | "after_dinner"
  | "bedtime";
export type Meals = {
  breakfast: string;
  lunch: string;
  dinner: string;
  bedtime: string;
};
export type MedItem = {
  id: string;
  display_name: string;
  printed_name?: string | null;
  kind: MedKind;
  source: "PHOTO_AI" | "CHIP" | "VOICE";
  photo_media_id?: string | null;
  photoUrl?: string | null;
};
export type MedSchedule = {
  id: string;
  time_local: string;
  consent_state: "PENDING" | "ACTIVE" | "DECLINED";
  item_ids: string[];
  active: boolean;
  pushOnly: boolean;
  revision: number;
  meal_anchor?: Anchor | null;
};
export type MedOverview = {
  patientId: number;
  items: MedItem[];
  schedules: MedSchedule[];
  meals: Meals;
  conditions: string[];
  self: boolean;
  flags: V21Flags;
  remindersEnabled?: boolean;
  problemsOnly?: boolean;
};
export type ScanItem = {
  printed_name: string;
  display_name: string | null;
  kind: MedKind | null;
  suggested_slots: string[];
  needs_name_review: boolean;
  confirmed: boolean;
};
export type ScanResult = {
  jobId: string;
  mediaId: string;
  photoUrl: string;
  readable: boolean;
  partial?: boolean;
  items: ScanItem[];
  manualFallback?: boolean;
};
export type MedDose = {
  id: string;
  state:
    | "SCHEDULED"
    | "CALLING"
    | "TAKEN"
    | "SKIPPED"
    | "OUT_OF_MEDS"
    | "UNCONFIRMED"
    | "SKIPPED_NO_DEVICE"
    | "CANCELLED";
  scheduled_at: string;
  time_local: string;
  checkin_pending: boolean;
  checkin_id?: number;
};
export type MedDetail = {
  needsCheckin?: boolean;
  checkinDoseId?: string;
  event: MedDose;
  attempt?: {
    id: string;
    group_id: string;
    deadline: string;
    state: string;
    channel: string;
  };
  items: MedItem[];
  canAnswer: boolean;
};
export type MedAnswer = {
  event: MedDose;
  needsCheckin: boolean;
  checkinDoseId?: string;
  alreadyAnswered?: boolean;
  answerWindowClosed?: boolean;
};
export const v21Api = {
  consentMany: (schedule_ids: string[], accept: boolean) =>
    apiClient("/api/mobile/medication/consents", {
      method: "POST",
      body: { schedule_ids, accept },
    }),
  flags: () => apiClient<V21Flags>("/api/mobile/v21/config"),
  coins: () => apiClient<CoinToday>("/api/mobile/coins/today"),
  history: (before?: string) =>
    apiClient<{ items: CoinEntry[] }>(
      `/api/mobile/coins/history?before=${encodeURIComponent(before || "")}`
    ),
  rewards: () => apiClient<RewardCatalog>("/api/mobile/rewards"),
  redeem: (
    code: string,
    request_id: string,
    payload: Record<string, unknown>
  ) =>
    apiClient<{ redemption: { id: string; status: string }; balance?: number }>(
      `/api/mobile/rewards/${encodeURIComponent(code)}/redeem`,
      { method: "POST", body: { request_id, payload } }
    ),
  weekly: (patient?: number) =>
    apiClient<{
      report: { taken: number; total: number; skipped: number; coins: number };
    }>(`/api/mobile/medication/weekly-report?patientId=${patient || ""}`),
  overview: (patient?: number) =>
    apiClient<MedOverview>(
      `/api/mobile/med-schedules?patientId=${patient || ""}`
    ),
  setup: (patient: number, body: unknown) =>
    apiClient<{ pendingConsent: boolean; schedules: MedSchedule[] }>(
      `/api/mobile/medication/setup?patientId=${patient || ""}`,
      { method: "POST", body, timeoutMs: 30000 }
    ),
  saveSchedule: (patient: number, id: string, body: unknown) =>
    apiClient(
      `/api/mobile/med-schedules/${encodeURIComponent(id)}?patientId=${
        patient || ""
      }`,
      { method: "PUT", body }
    ),
  remove: (patient: number, id: string) =>
    apiClient(
      `/api/mobile/med-schedules/${encodeURIComponent(id)}?patientId=${
        patient || ""
      }`,
      { method: "DELETE" }
    ),
  consent: (id: string, accept: boolean) =>
    apiClient(
      "/api/mobile/med-schedules/" + encodeURIComponent(id) + "/consent",
      { method: "POST", body: { accept } }
    ),
  preferences: (patient: number, problems_only: boolean) =>
    apiClient(
      `/api/mobile/medication/family-preferences?patientId=${patient || ""}`,
      { method: "PUT", body: { problems_only } }
    ),
  doses: (patient?: number) =>
    apiClient<{ items: MedDose[] }>(
      `/api/mobile/med-doses/today?patientId=${patient || ""}`
    ),
  dose: (id: string) =>
    apiClient<MedDetail>("/api/mobile/med-doses/" + encodeURIComponent(id)),
  answer: (id: string, button: number, request_id: string) =>
    apiClient<MedAnswer>(
      "/api/mobile/med-doses/" + encodeURIComponent(id) + "/answer",
      { method: "POST", body: { button, request_id } }
    ),
  checkin: (id: string, status: "fine" | "tired" | "very_tired") =>
    apiClient<{ checkinId: number }>(
      "/api/mobile/med-doses/" + encodeURIComponent(id) + "/checkin",
      { method: "POST", body: { status } }
    ),
  scan: (patient: number, body: FormData) =>
    apiClient<ScanResult>(
      `/api/mobile/med-items/scan?patientId=${patient || ""}`,
      { method: "POST", body, timeoutMs: 60000 }
    ),
  transcribe: (patient: number, body: FormData) =>
    apiClient<{ text: string }>(
      `/api/mobile/med-items/transcribe?patientId=${patient || ""}`,
      { method: "POST", body, timeoutMs: 45000 }
    ),
};
