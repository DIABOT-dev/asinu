import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { AiChatLayout, ChatBubble } from '../src/components/AiChatLayout';
import { chatApi } from '../src/features/chat/chat.api';
import { apiClient } from '../src/lib/apiClient';
import { navigation } from '../src/lib/navigation';
import { colors } from '../src/styles';

export default function AiChatScreen() {
  const { t } = useTranslation('chat');
  const router = useRouter();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    apiClient<{ isPremium: boolean }>('/api/subscriptions/status')
      .then((res) => setIsPremium(res.isPremium))
      .catch(() => {});
  }, []);

  const initialMessages: ChatBubble[] = useMemo(() => [
    {
      id: '1',
      role: 'assistant',
      text: t('initialGreeting'),
      timestamp: new Date().toISOString()
    },
    { id: '2', role: 'user', text: t('sampleUserMessage'), timestamp: new Date().toISOString() }
  ], [t]);

  const [messages, setMessages] = useState<ChatBubble[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const avatars = useMemo(
    () => ({
      assistant: 'https://placekitten.com/200/200',
      user: 'https://placekitten.com/201/201'
    }),
    []
  );

  const isUnauthorized = (error: unknown) => {
    if (!error) return false;
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('401') || message.toLowerCase().includes('missing token');
  };

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
      const { reply } = await chatApi.sendMessage({ message: text, context: { lang: 'vi' } });
      const assistantText = reply || t('errorReply');
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      if (isUnauthorized(error)) {
        navigation.goToLogin();
        setIsTyping(false);
        return;
      }
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: t('systemBusy'),
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const screenOptions = useMemo(() => ({
    headerShown: true,
    title: t('title') || 'Asinu AI',
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginLeft: 0 }}>
        <Ionicons name="arrow-back" size={26} color={colors.primary} />
      </TouchableOpacity>
    ),
  }), [router, t]);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <SafeAreaView style={styles.container}>
      <AiChatLayout
        messages={messages}
        assistantAvatar={avatars.assistant}
        userAvatar={avatars.user}
        isTyping={isTyping}
        isPremium={isPremium}
        onSend={handleSend}
        onUpgradePress={() => router.push('/subscription')}
      />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});
