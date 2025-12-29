import { apiClient } from '../../lib/apiClient';

export type ChatRequest = {
  message: string;
  history?: Array<{ role: 'assistant' | 'user'; text: string }>;
};

export type ChatResponse = {
  reply?: string;
  message?: string;
  text?: string;
};

const resolveReply = (response: ChatResponse) => {
  return response.reply || response.message || response.text || '';
};

export const chatApi = {
  async sendMessage(payload: ChatRequest) {
    const response = await apiClient<ChatResponse>('/api/mobile/chat', {
      method: 'POST',
      body: payload
    });
    return { response, reply: resolveReply(response) };
  }
};
