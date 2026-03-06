import { apiClient } from '../../lib/apiClient';
import { env } from '../../lib/env';
import { tokenStore } from '../../lib/tokenStore';

export type ChatRequest = {
  message: string;
  client_ts: number;
  context?: { lang?: string };
};

export type ChatResponse = {
  ok: boolean;
  reply: string;
  chat_id: string;
  provider: 'gemini' | 'mock';
  created_at: string;
};

export const chatApi = {
  async sendMessage(payload: Omit<ChatRequest, 'client_ts'>) {
    const response = await apiClient<ChatResponse>('/api/mobile/chat', {
      method: 'POST',
      body: { ...payload, client_ts: Date.now() },
      timeoutMs: 35000,
    });
    return { response, reply: response.reply };
  },

  async transcribeAudio(uri: string, lang: string = 'vi'): Promise<string> {
    const token = tokenStore.getToken();
    const formData = new FormData();
    formData.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any);

    const response = await fetch(`${env.apiBaseUrl}/api/mobile/chat/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': lang,
        Accept: 'application/json',
      },
      body: formData,
    });
    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error(`Server error ${response.status}`); }
    if (!data.ok) throw new Error(data.error ?? `Server error ${response.status}`);
    return data.text as string;
  }
};
