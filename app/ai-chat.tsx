import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { AiChatLayout, ChatBubble } from '../src/components/AiChatLayout';
import { MedicalDisclaimerModal, containsMedicalKeywords } from '../src/components/MedicalDisclaimerModal';
import { chatApi } from '../src/features/chat/chat.api';
import { apiClient } from '../src/lib/apiClient';
import { navigation } from '../src/lib/navigation';
import { colors } from '../src/styles';
import { useThemeColors } from '../src/hooks/useThemeColors';

export default function AiChatScreen() {
  const { t } = useTranslation('chat');
  const router = useRouter();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiClient<{ isPremium: boolean }>('/api/subscriptions/status', { signal: controller.signal })
      .then((res) => setIsPremium(res.isPremium))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const greetingMessage: ChatBubble = useMemo(() => ({
    id: 'greeting',
    role: 'assistant',
    text: t('initialGreeting'),
    timestamp: new Date().toISOString()
  }), [t]);

  const [messages, setMessages] = useState<ChatBubble[]>([greetingMessage]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch chat history on mount
  const greetingRef = useRef(greetingMessage);
  greetingRef.current = greetingMessage;
  useEffect(() => {
    chatApi.fetchHistory()
      .then((history) => {
        if (history.length > 0) {
          const mapped: ChatBubble[] = history.map((m, i) => ({
            id: `history-${i}`,
            role: m.role as 'assistant' | 'user',
            text: m.text,
            timestamp: m.timestamp || new Date().toISOString(),
          }));
          setMessages([greetingRef.current, ...mapped]);
        }
      })
      .catch(() => {});
  }, []);

  const [showMedicalDisclaimer, setShowMedicalDisclaimer] = useState(false);
  const medicalDisclaimerShown = useRef(false);

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
      const { reply } = await chatApi.sendMessage({ message: text, context: {} });
      const assistantText = reply || t('errorReply');
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (!medicalDisclaimerShown.current && containsMedicalKeywords(text)) {
        medicalDisclaimerShown.current = true;
        setShowMedicalDisclaimer(true);
      }
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

  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  }), [isDark]);
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
  }), [router, t, isDark]);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
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
      </KeyboardAvoidingView>

      <MedicalDisclaimerModal
        visible={showMedicalDisclaimer}
        onClose={() => setShowMedicalDisclaimer(false)}
      />
    </>
  );
}

