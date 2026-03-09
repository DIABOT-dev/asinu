import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatApi } from '../features/chat/chat.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { apiClient } from '../lib/apiClient';
import { router } from 'expo-router';
import { navigation } from '../lib/navigation';
import { colors, spacing } from '../styles';
import { AiChatLayout, ChatBubble } from './AiChatLayout';
import { MedicalDisclaimerModal, containsMedicalKeywords } from './MedicalDisclaimerModal';

type ChatModalProps = {
  visible: boolean;
  onClose: () => void;
};

const H = Dimensions.get('window').height;
const SHEET_H = Math.round(H * 0.66);

const isUnauthorized = (error: unknown) => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('401') || message.toLowerCase().includes('missing token');
};

export default function ChatModal({ visible, onClose }: ChatModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['chat', 'common']);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const hasLoadedHistory = useRef(false);
  const lastVisibleRef = useRef(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showMedicalDisclaimer, setShowMedicalDisclaimer] = useState(false);
  const medicalDisclaimerShown = useRef(false);
  const scaledTypography = useScaledTypography();
  const hasFetchedPremium = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (hasFetchedPremium.current) return;
    hasFetchedPremium.current = true;
    apiClient<{ isPremium?: boolean }>('/api/subscriptions/status')
      .then((data) => { if (data?.isPremium) setIsPremium(true); })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      lastVisibleRef.current = false;
      return;
    }
    // Re-fetch history when modal is reopened (visible: false → true)
    // but skip if it's the very first render (already handled by hasLoadedHistory)
    const isReopen = lastVisibleRef.current === false && hasLoadedHistory.current;
    lastVisibleRef.current = true;

    if (!hasLoadedHistory.current) {
      hasLoadedHistory.current = true;
    } else if (!isReopen) {
      return;
    }

    const welcome: ChatBubble = { id: 'welcome', role: 'assistant', text: t('chat:welcome'), timestamp: new Date().toISOString() };
    chatApi.fetchHistory()
      .then((history) => {
        setMessages(prev => {
          // If user sent messages while history was loading, keep local state
          if (prev.some(m => m.id.startsWith('user-'))) return prev;
          return history.length > 0 ? history : [welcome];
        });
      })
      .catch(() => {
        setMessages(prev => {
          if (prev.some(m => m.id.startsWith('user-'))) return prev;
          return [welcome];
        });
      });
  }, [visible]);

  const handleSend = async (text: string) => {
    const now = Date.now();
    const userMessage: ChatBubble = {
      id: `user-${now}`,
      role: 'user',
      text,
      timestamp: new Date(now).toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const { reply } = await chatApi.sendMessage({ message: text, context: { lang: 'vi' } });
      const assistantMessage: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: reply || t('chat:errorReply'),
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (!medicalDisclaimerShown.current &&
          (containsMedicalKeywords(text) || containsMedicalKeywords(reply || ''))) {
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
        text: t('chat:systemBusy'),
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>{t('chat:title')}</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Text style={[styles.closeLabel, { fontSize: scaledTypography.size.md }]}>{t('common:close')}</Text>
            </Pressable>
          </View>
          <View style={styles.chatBody}>
            <AiChatLayout
              messages={messages}
              isTyping={isTyping}
              isPremium={isPremium}
              onSend={handleSend}
              onUpgradePress={() => { onClose(); router.push('/subscription'); }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <MedicalDisclaimerModal
        visible={showMedicalDisclaimer}
        onClose={() => setShowMedicalDisclaimer(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay
  },
  sheet: {
    width: '100%',
    flex: 1,
    maxHeight: SHEET_H,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary
  },
  closeLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    lineHeight: 24
  },
  chatBody: {
    flex: 1
  }
});
