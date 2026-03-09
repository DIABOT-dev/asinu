import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  isPremium?: boolean;
  onSend?: (message: string) => void;
  onUpgradePress?: () => void;
};

export const AiChatLayout = ({ messages, assistantAvatar, userAvatar, isTyping = false, isPremium = false, onSend, onUpgradePress }: AiChatLayoutProps) => {
  const { t } = useTranslation(['chat', 'common']);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<any>(null);
  const recordingStartRef = useRef<number>(0);
  const maxMeteringRef = useRef<number>(-160);
  const scaledTypography = useScaledTypography();
  const { language } = useLanguageStore();
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when messages or typing indicator change
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const handleMicPress = async () => {
    if (!isPremium) {
      onUpgradePress?.();
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      try {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI();
        recordingRef.current = null;
        if (!uri) return;
        if (Date.now() - recordingStartRef.current < 1500) return;
        if (maxMeteringRef.current < -40) return;
        setIsTranscribing(true);
        try {
          const text = await chatApi.transcribeAudio(uri, language);
          if (text) setDraft(prev => prev ? `${prev} ${text}` : text);
        } catch {
        } finally {
          setIsTranscribing(false);
        }
      } catch (e: any) {
        Alert.alert(t('chat:errorMic'), e?.message ?? String(e));
      }
    } else {
      try {
        if (recordingRef.current) {
          try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
          recordingRef.current = null;
        }
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        maxMeteringRef.current = -160;
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
          (status) => {
            if (status.metering != null && status.metering > maxMeteringRef.current) {
              maxMeteringRef.current = status.metering;
            }
          },
          100
        );
        recordingRef.current = recording;
        recordingStartRef.current = Date.now();
        setIsRecording(true);
      } catch (e: any) {
        Alert.alert(t('chat:errorMic'), e?.message ?? String(e));
      }
    }
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend?.(draft.trim());
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        contentContainerStyle={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
          style={[styles.micButton, isRecording && styles.micButtonActive, !isPremium && styles.micButtonLocked]}
          disabled={isTranscribing}
        >
          {isTranscribing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : !isPremium
            ? <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
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
    </View>
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
  },
  micButtonLocked: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.75,
  },
});
