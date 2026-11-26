import { File as NativeFile } from "expo-file-system";
import { Platform } from "react-native";
import { apiClient } from "../../lib/apiClient";
import { tokenStore } from "../../lib/tokenStore";
export const answerAudioKey = (questionId: string, optionId: string) =>
  `selected:${questionId}:${optionId}`;
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
  doctor_reply_video?: { url: string | null };
  content: { greeting: string; closing: string; questions: IvrQuestion[] };
  answers: Array<{
    question_id: string;
    answer_type: string;
    stt_status: string;
  }>;
};
export const hasDoctorIvrReply = (session: IvrSession) =>
  Boolean(session.doctor_reply || session.doctor_reply_video);
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
  answerAudio: (id: string, question: string, option: string) =>
    request<{ base64: string; mimeType: string }>(
      `sessions/${encodeURIComponent(id)}/audio/${encodeURIComponent(question)}/answers/${encodeURIComponent(option)}`
    ),
  closingAudio: (id: string) =>
    request<{ base64: string; mimeType: string }>(
      `sessions/${encodeURIComponent(id)}/closing-audio`
    ),
  voice: async (id: string, fields: Record<string, string>, uri: string) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      if (!response.ok) throw new Error("Cannot read saved recording");
      const webm = uri.endsWith(".webm");
      form.append("file", new globalThis.File(
        [await response.blob()],
        webm ? "answer.webm" : "answer.m4a",
        { type: webm ? "audio/webm" : "audio/mp4" },
      ));
    } else {
      // Expo Fetch reads the file bytes through File, including on a retry.
      form.append("file", new NativeFile(uri));
    }
    return request<IvrSession>(
      `sessions/${encodeURIComponent(id)}/voice`,
      form
    );
  },
};
