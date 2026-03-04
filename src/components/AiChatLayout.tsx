import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { chatApi } from '../features/chat/chat.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useLanguageStore } from '../stores/language.store';
import { colors, spacing } from '../styles';

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
  const { t } = useTranslation(['chat', 'common']);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scaledTypography = useScaledTypography();
  const { language } = useLanguageStore();

  const handleMicPress = async () => {
    if (isRecording) {
      setIsRecording(false);
      await recordingRef.current?.stopAndUnloadAsync();
      const uri = recordingRef.current?.getURI();
      recordingRef.current = null;
      if (!uri) return;

      setIsTranscribing(true);
      try {
        const text = await chatApi.transcribeAudio(uri, language);
        if (text) setDraft(prev => prev ? `${prev} ${text}` : text);
      } catch (e) {
        console.error('[voice] transcribe failed:', e);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
    }
  };

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
              <Text style={[styles.bubbleText, { fontSize: scaledTypography.size.md }, item.role === 'user' ? styles.userText : undefined]}>{item.text}</Text>
              <Text style={[styles.timestamp, { fontSize: scaledTypography.size.xs }]}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={isTyping ? <Text style={[styles.typing, { fontSize: scaledTypography.size.sm }]}>{t('chat:typing')}</Text> : null}
      />
      <View style={styles.composer}>
        <Pressable
          onPress={handleMicPress}
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          disabled={isTranscribing}
        >
          {isTranscribing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <MaterialCommunityIcons
                name={isRecording ? 'stop-circle' : 'microphone'}
                size={26}
                color={isRecording ? '#fff' : colors.primary}
              />
          }
        </Pressable>
        <TextInput
          style={[styles.input, { fontSize: scaledTypography.size.md }]}
          placeholder={t('chat:placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={[styles.sendLabel, { fontSize: scaledTypography.size.md }]}>{t('common:send')}</Text>
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
    color: colors.textPrimary,
    lineHeight: 24
  },
  userText: {
    color: colors.surface
  },
  timestamp: {
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
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    lineHeight: 24
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.primary
  },
  sendLabel: {
    color: colors.surface,
    fontWeight: '600',
    lineHeight: 24
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: colors.danger,
  }
});
