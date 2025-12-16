import { useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type ChatBubble = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
};

export type AiChatLayoutProps = {
  messages: ChatBubble[];
  assistantAvatar?: string;
  userAvatar?: string;
  isTyping?: boolean;
  onSend?: (message: string) => void;
};

export const AiChatLayout = ({ messages, assistantAvatar, userAvatar, isTyping = false, onSend }: AiChatLayoutProps) => {
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend?.(draft.trim());
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        contentContainerStyle={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.role === 'user' ? styles.messageRowReverse : null]}>
            {item.role === 'assistant' && assistantAvatar ? <Image source={{ uri: assistantAvatar }} style={styles.avatar} /> : null}
            {item.role === 'user' && userAvatar ? <Image source={{ uri: userAvatar }} style={styles.avatar} /> : null}
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : undefined]}>{item.text}</Text>
              <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={isTyping ? <Text style={styles.typing}>Assistant is typing…</Text> : null}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a prompt"
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  list: {
    padding: spacing.xl,
    gap: spacing.md
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  messageRowReverse: {
    flexDirection: 'row-reverse'
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12
  },
  bubble: {
    padding: spacing.md,
    borderRadius: 24,
    maxWidth: '80%',
    gap: spacing.xs
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  userBubble: {
    backgroundColor: colors.primary
  },
  bubbleText: {
    color: colors.textPrimary
  },
  userText: {
    color: colors.surface
  },
  timestamp: {
    fontSize: 10,
    color: colors.textSecondary
  },
  typing: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.md
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  input: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.primary
  },
  sendLabel: {
    color: colors.surface,
    fontWeight: '600'
  }
});
