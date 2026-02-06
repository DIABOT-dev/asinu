import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatApi } from '../features/chat/chat.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { navigation } from '../lib/navigation';
import { colors, spacing } from '../styles';
import { AiChatLayout, ChatBubble } from './AiChatLayout';

type ChatModalProps = {
  visible: boolean;
  onClose: () => void;
};

const H = Dimensions.get('window').height;
const SHEET_H = Math.round(H * 0.66);

const initialMessages: ChatBubble[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Xin chào, tôi là Asinu Chat. Bạn cần hỗ trợ gì?',
    timestamp: new Date().toISOString()
  }
];

const isUnauthorized = (error: unknown) => {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('401') || message.toLowerCase().includes('missing token');
};

export default function ChatModal({ visible, onClose }: ChatModalProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatBubble[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const scaledTypography = useScaledTypography();

  useEffect(() => {
    if (__DEV__) {
      const unaccented = messages.find((m) => /Chao ban|Nhap tin nhan|Gui/i.test(m.text));
      if (unaccented) {
        console.warn('UI copy is missing Vietnamese diacritics; avoid stripping accents for display.', unaccented.text);
      }
    }
  }, [messages]);

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
        text: reply || 'Xin lỗi, tôi chưa thể trả lời lúc này.',
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
        text: 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>Trò chuyện với Asinu</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Text style={[styles.closeLabel, { fontSize: scaledTypography.size.md }]}>Đóng</Text>
            </Pressable>
          </View>
          <View style={styles.chatBody}>
            <AiChatLayout messages={messages} isTyping={isTyping} onSend={handleSend} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  sheet: {
    width: '100%',
    height: SHEET_H,
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
