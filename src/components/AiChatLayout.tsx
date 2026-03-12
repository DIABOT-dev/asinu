import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { chatApi } from '../features/chat/chat.api';
import { useModal } from '../hooks/useModal';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useLanguageStore } from '../stores/language.store';
import { colors, spacing } from '../styles';
import { ScaledText } from './ScaledText';

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
  const { showInfo, modal: appModal } = useModal();
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null); // shows brief confirmation
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
      setShowUpgradeModal(true);
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
        showInfo(t('chat:errorMic'), e?.message ?? String(e));
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
        showInfo(t('chat:errorMic'), e?.message ?? String(e));
      }
    }
  };

  const showFlash = (id: string) => {
    setFlashId(id);
    setTimeout(() => setFlashId(f => f === id ? null : f), 1500);
  };

  const handleFeedback = async (item: ChatBubble, type: 'like' | 'dislike') => {
    const current = feedbacks[item.id];
    const next = current === type ? null : type;
    setFeedbacks(prev => ({ ...prev, [item.id]: next }));
    chatApi.saveFeedback({ messageId: item.id, messageText: item.text, feedbackType: type }).catch(() => {
      setFeedbacks(prev => ({ ...prev, [item.id]: current ?? null }));
    });
  };

  const handleCopy = async (item: ChatBubble) => {
    try {
      // Try expo-clipboard first (install with: npx expo install expo-clipboard)
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(item.text);
    } catch {
      // Fallback: native share sheet
      await Share.share({ message: item.text }).catch(() => {});
    }
    showFlash(`copy-${item.id}`);
  };

  const handleNote = async (item: ChatBubble) => {
    if (savedNotes.has(item.id)) return;
    setSavedNotes(prev => new Set([...prev, item.id]));
    showFlash(`note-${item.id}`);
    chatApi.saveFeedback({ messageId: item.id, messageText: item.text, feedbackType: 'note' }).catch(() => {
      setSavedNotes(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    });
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend?.(draft.trim());
    setDraft('');
  };

  return (
    <View style={styles.container}>
      {appModal}
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
            <View style={item.role === 'assistant' ? styles.bubbleCol : undefined}>
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <ScaledText style={[styles.bubbleText, item.role === 'user' ? styles.userText : undefined]}>{item.text}</ScaledText>
                <ScaledText style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ScaledText>
              </View>
              {item.role === 'assistant' && (
                <View style={styles.actionRow}>
                  {/* Like */}
                  <Pressable
                    onPress={() => handleFeedback(item, 'like')}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={feedbacks[item.id] === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={16}
                      color={feedbacks[item.id] === 'like' ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                  {/* Dislike */}
                  <Pressable
                    onPress={() => handleFeedback(item, 'dislike')}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={feedbacks[item.id] === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={16}
                      color={feedbacks[item.id] === 'dislike' ? colors.danger : colors.textSecondary}
                    />
                  </Pressable>
                  {/* Copy */}
                  <Pressable
                    onPress={() => handleCopy(item)}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    {flashId === `copy-${item.id}`
                      ? <ScaledText style={styles.flashLabel}>{t('chat:actionCopied')}</ScaledText>
                      : <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                    }
                  </Pressable>
                  {/* Note/Bookmark */}
                  <Pressable
                    onPress={() => handleNote(item)}
                    style={styles.actionBtn}
                    hitSlop={6}
                  >
                    {flashId === `note-${item.id}`
                      ? <ScaledText style={styles.flashLabel}>{t('chat:actionNoteSaved')}</ScaledText>
                      : <Ionicons
                          name={savedNotes.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                          size={16}
                          color={savedNotes.has(item.id) ? colors.primary : colors.textSecondary}
                        />
                    }
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
        ListFooterComponent={isTyping ? <ScaledText style={styles.typing}>{t('chat:typing')}</ScaledText> : null}
      />
      {/* Premium upgrade modal for mic */}
      <Modal visible={showUpgradeModal} transparent animationType="fade" onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUpgradeModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="crown" size={36} color={colors.premium} />
            </View>
            <ScaledText style={styles.modalTitle}>{t('chat:micUpgradeTitle')}</ScaledText>
            <ScaledText style={styles.modalDesc}>{t('chat:micUpgradeDesc')}</ScaledText>
            <View style={styles.featureList}>
              {(['micUpgradeFeature1', 'micUpgradeFeature2', 'micUpgradeFeature3'] as const).map(key => (
                <View key={key} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <ScaledText style={styles.featureText}>{t(`chat:${key}`)}</ScaledText>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.upgradeBtn}
              onPress={() => { setShowUpgradeModal(false); onUpgradePress?.(); }}
            >
              <MaterialCommunityIcons name="crown" size={18} color="#fff" />
              <ScaledText style={styles.upgradeBtnText}>{t('chat:micUpgradeBtn')}</ScaledText>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setShowUpgradeModal(false)}>
              <ScaledText style={styles.cancelBtnText}>{t('chat:micUpgradeLater')}</ScaledText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.composer}>
        <Pressable
          onPress={handleMicPress}
          style={[styles.micButton, isRecording && styles.micButtonActive, !isPremium && styles.micButtonLocked]}
          disabled={isTranscribing}
        >
          {isTranscribing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <MaterialCommunityIcons
                name={isRecording ? 'stop-circle' : 'microphone'}
                size={26}
                color={isRecording ? '#fff' : isPremium ? colors.primary : colors.textSecondary}
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
          <ScaledText style={styles.sendLabel}>{t('common:send')}</ScaledText>
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
    fontSize: 15,
  },
  userText: {
    color: colors.surface
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  typing: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontSize: 13,
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
    fontSize: 15,
  },
  bubbleCol: {
    maxWidth: '82%',
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 4,
  },
  actionBtn: {
    padding: 4,
    borderRadius: 6,
  },
  flashLabel: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.premiumLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureList: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  upgradeBtn: {
    backgroundColor: colors.premium,
    borderRadius: 999,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
