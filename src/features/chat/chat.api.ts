import { monitoredFetch } from '../../observability/sentry';
import i18n from '../../i18n';
import { ApiError, apiClient } from '../../lib/apiClient';
import { env } from '../../lib/env';
import { tokenStore } from '../../lib/tokenStore';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

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

export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

export const chatApi = {
  async fetchHistory(): Promise<ChatHistoryMessage[]> {
    const response = await apiClient<{ ok: boolean; messages: ChatHistoryMessage[] }>('/api/mobile/chat/history');
    return response.messages ?? [];
  },

  async sendMessage(payload: Omit<ChatRequest, 'client_ts'>) {
    const response = await apiClient<ChatResponse>('/api/mobile/chat', {
      method: 'POST',
      body: { ...payload, client_ts: Date.now() },
      timeoutMs: 35000,
    });
    return { response, reply: response.reply };
  },

  async sendFeedback(messageId: string, messageText: string, feedbackType: 'like' | 'dislike' | 'note') {
    return apiClient<{ ok: boolean; action: string }>('/api/mobile/chat/feedback', {
      method: 'POST',
      body: { messageId, messageText, feedbackType },
    });
  },

  async fetchNotes(page = 1, limit = 20): Promise<{
    notes: Array<{ id: number; message_text: string; created_at: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  }> {
    const res = await apiClient<{
      ok: boolean;
      notes: Array<{ id: number; message_text: string; created_at: string }>;
      pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
    }>(`/api/mobile/chat/notes?page=${page}&limit=${limit}`);
    return {
      notes: res.notes ?? [],
      pagination: res.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    };
  },

  async deleteNote(id: number) {
    return apiClient<{ ok: boolean }>(`/api/mobile/chat/notes/${id}`, { method: 'DELETE' });
  },

  async fetchNotedMessageIds(): Promise<string[]> {
    const res = await apiClient<{ ok: boolean; ids: string[] }>('/api/mobile/chat/noted-ids');
    return res.ids ?? [];
  },

  async fetchFeedbacks(): Promise<Record<string, 'like' | 'dislike'>> {
    const res = await apiClient<{ ok: boolean; feedbacks: Record<string, 'like' | 'dislike'> }>('/api/mobile/chat/feedbacks');
    return res.feedbacks ?? {};
  },

  async transcribeAudio(uri: string, lang: string = 'vi', purpose: 'chat' | 'checkin' = 'chat'): Promise<string> {
    const token = tokenStore.getToken();
    const formData = new FormData();
    // SDK 57's fetch encoder needs the file bytes. A legacy { uri, type, name }
    // part throws before an HTTP request can reach the transcription endpoint.
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('RECORDING_FILE_UNAVAILABLE');
      }
      const blob = await response.blob();
      const extension = blob.type.includes('mp4') ? 'm4a'
        : blob.type.includes('wav') ? 'wav'
        : blob.type.includes('ogg') ? 'ogg' : 'webm';
      // @ts-expect-error React Native's typings omit the browser filename argument.
      formData.append('audio', blob, `voice.${extension}`);
    } else {
      formData.append('audio', new File(uri));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const endpoint = purpose === 'checkin' ? '/api/mobile/checkin/transcribe' : '/api/mobile/chat/transcribe';
    try {
      const response = await monitoredFetch(`${env.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Language': lang,
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(
          i18n.t('errorServer', { ns: 'common' }),
          response.status,
        );
      }
      if (!response.ok || !data.ok) {
        throw new ApiError(
          data.error || i18n.t('errorServer', { ns: 'common' }),
          response.status,
          { code: typeof data.code === 'string' ? data.code : undefined, data },
        );
      }
      return typeof data.text === 'string' ? data.text.trim() : '';
    } finally {
      clearTimeout(timeout);
    }
  },
};
