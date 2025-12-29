import { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { AiChatLayout, ChatBubble } from '../src/components/AiChatLayout';
import { chatApi } from '../src/features/chat/chat.api';
import { colors } from '../src/styles';

const initialMessages: ChatBubble[] = [
  {
    id: '1',
    role: 'assistant',
    text: 'Xin chào, tôi là Asinu Chat. Bạn cần hỗ trợ gì?',
    timestamp: new Date().toISOString()
  },
  { id: '2', role: 'user', text: 'Tôi muốn theo dõi sức khỏe hằng ngày.', timestamp: new Date().toISOString() }
];

export default function AiChatScreen() {
  const [messages, setMessages] = useState<ChatBubble[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const avatars = useMemo(
    () => ({
      assistant: 'https://placekitten.com/200/200',
      user: 'https://placekitten.com/201/201'
    }),
    []
  );

  const handleSend = async (text: string) => {
    const userMessage: ChatBubble = {
      id: `local-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const history = [...messages, userMessage]
        .slice(-6)
        .map(({ role, text: entryText }) => ({ role, text: entryText }));
      const { reply } = await chatApi.sendMessage({ message: text, history });
      const assistantText = reply || 'Xin lỗi, tôi chưa thể trả lời lúc này.';
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AiChatLayout
        messages={messages}
        assistantAvatar={avatars.assistant}
        userAvatar={avatars.user}
        isTyping={isTyping}
        onSend={handleSend}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});
