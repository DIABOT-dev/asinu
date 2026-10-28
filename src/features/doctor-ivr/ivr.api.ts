import { apiClient } from "../../lib/apiClient";
import { tokenStore } from "../../lib/tokenStore";
export type IvrOption = {
  id: string;
  key: number;
  label: string;
  type: "option" | "voice";
  max_record_s?: number;
  unknown?: boolean;
};
export type IvrQuestion = {
  id: string;
  text: string;
  fixed?: boolean;
  speech_text?: string;
  options: IvrOption[];
};
export type IvrSession = {
  id: string;
  task_id: string;
  doctor_name: string;
  status: string;
  current_question_id: string | null;
  revision: number;
  updated_at?: string;
  expires_at: string | null;
  remind_at: string | null;
  safety_notice: string | null;
  response_timeout_seconds?: number;
  channel?: "app" | "call" | "both";
  doctor_reply: string | null;
  content: { greeting: string; closing: string; questions: IvrQuestion[] };
  answers: Array<{
    question_id: string;
    answer_type: string;
    stt_status: string;
  }>;
};
async function request<T>(path: string, body?: unknown) {
  const token = tokenStore.getToken() || (await tokenStore.loadToken());
  if (!token) throw new Error("Authentication required");
  const response = await apiClient<{ ok: boolean; data: T }>(
    `/api/doctor/ivr/${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      ...(body ? { method: "POST" as const, body } : {}),
    }
  );
  if (token !== tokenStore.getToken()) throw new Error("Session changed");
  return response.data;
}
export const ivrApi = {
  async enabled() {
    const value = await apiClient<{ enabled: boolean }>(
      "/api/doctor/ivr/config"
    );
    return value.enabled === true;
  },
  list: (tenant: string, task: string) =>
    request<{ sessions: IvrSession[] }>(
      `sessions?tenant_id=${encodeURIComponent(
        tenant
      )}&task_id=${encodeURIComponent(task)}`
    ),
  get: (id: string) =>
    request<IvrSession>(`sessions/${encodeURIComponent(id)}`),
  act: (id: string, body: Record<string, unknown>) =>
    request<IvrSession>(`sessions/${encodeURIComponent(id)}/action`, body),
  audio: (id: string, question: string) =>
    request<{ base64: string; mimeType: string }>(
      `sessions/${encodeURIComponent(id)}/audio/${encodeURIComponent(question)}`
    ),
  voice: (id: string, fields: Record<string, string>, uri: string) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append("file", {
      uri,
      type: uri.endsWith(".webm") ? "audio/webm" : "audio/mp4",
      name: uri.endsWith(".webm") ? "answer.webm" : "answer.m4a",
    } as unknown as Blob);
    return request<IvrSession>(
      `sessions/${encodeURIComponent(id)}/voice`,
      form
    );
  },
};
