import { useMemo, useState } from 'react';
import { AiChatLayout, ChatBubble } from '@/ui/layouts/AiChatLayout';
import { useDemoData } from '@/lib/hooks/useDemoData';

export const AiChatScreen = () => {
  const data = useDemoData();
  const [messages, setMessages] = useState<ChatBubble[]>(data.chatPreset.initialMessages);
  const avatars = useMemo(
    () => ({ assistant: data.chatPreset.assistantAvatar, user: data.chatPreset.userAvatar }),
    [data.chatPreset.assistantAvatar, data.chatPreset.userAvatar]
  );

  const handleSend = (text: string) => {
    const newMessage: ChatBubble = {
      id: `local-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  return <AiChatLayout messages={messages} assistantAvatar={avatars.assistant} userAvatar={avatars.user} onSend={handleSend} />;
};
