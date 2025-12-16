import { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { AiChatLayout, ChatBubble } from '../src/components/AiChatLayout';
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
  const avatars = useMemo(
    () => ({
      assistant: 'https://placekitten.com/200/200',
      user: 'https://placekitten.com/201/201'
    }),
    []
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

  return (
    <SafeAreaView style={styles.container}>
      <AiChatLayout messages={messages} assistantAvatar={avatars.assistant} userAvatar={avatars.user} onSend={handleSend} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});
