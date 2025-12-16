import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiChatLayout, ChatBubble } from './AiChatLayout';
import { colors, spacing, typography } from '../styles';

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

export default function ChatModal({ visible, onClose }: ChatModalProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatBubble[]>(initialMessages);

  useEffect(() => {
    if (__DEV__) {
      const unaccented = messages.find((m) => /Chao ban|Nhap tin nhan|Gui/i.test(m.text));
      if (unaccented) {
        console.warn('UI copy is missing Vietnamese diacritics; avoid stripping accents for display.', unaccented.text);
      }
    }
  }, [messages]);

  const handleSend = (text: string) => {
    const now = Date.now();
    const userMessage: ChatBubble = {
      id: `user-${now}`,
      role: 'user',
      text,
      timestamp: new Date(now).toISOString()
    };

    const assistantReply: ChatBubble = {
      id: `assistant-${now}`,
      role: 'assistant',
      text: 'Đã ghi nhận, tính năng chat đang được hoàn thiện.',
      timestamp: new Date(now + 1000).toISOString()
    };

    setMessages((prev) => [...prev, userMessage, assistantReply]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Asinu Chat</Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Text style={styles.closeLabel}>Đóng</Text>
            </Pressable>
          </View>
          <View style={styles.chatBody}>
            <AiChatLayout messages={messages} onSend={handleSend} />
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
    fontSize: Math.max(typography.size.lg, 20),
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary
  },
  closeLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: Math.max(typography.size.md, 17),
    lineHeight: 24
  },
  chatBody: {
    flex: 1
  }
});
