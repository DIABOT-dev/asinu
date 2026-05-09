import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
let _Audio: typeof import('expo-av').Audio | null = null;
async function getAudio() {
  if (!_Audio) { _Audio = (await import('expo-av')).Audio; }
  return _Audio;
}
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppAlertModal, useAppAlert } from './AppAlertModal';
import { TypingIndicator } from './TypingIndicator';
import { chatApi } from '../features/chat/chat.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useLanguageStore } from '../stores/language.store';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

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

export const AiChatLayout = ({
  messages,
  assistantAvatar,
  userAvatar,
  isTyping = false,
  isPremium = false,
  onSend,
  onUpgradePress,
}: AiChatLayoutProps) => {
  const { t } = useTranslation(['chat', 'common']);
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#faf9f5',
      overflow: 'hidden',
    },
    bgBlobTopRight: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 360,
      height: 360,
      borderRadius: 180,
      backgroundColor: colors.primary,
      opacity: 0.07,
    },
    bgBlobBottomLeft: {
      position: 'absolute',
      bottom: 80,
      left: -140,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: colors.primary,
      opacity: 0.04,
    },
    list: {
      padding: spacing.xl,
      gap: spacing.md,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: 2,
    },
    messageRowReverse: {
      flexDirection: 'row-reverse',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 12,
    },
    bubble: {
      padding: spacing.md,
      borderRadius: 24,
      maxWidth: '80%',
      gap: spacing.xs,
    },
    assistantBubble: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    userBubble: {
      backgroundColor: colors.primary,
    },
    bubbleText: {
      color: colors.textPrimary,
      lineHeight: 24,
    },
    userText: {
      color: colors.surface,
    },
    timestamp: {
      color: colors.textSecondary,
    },
    actionBar: {
      flexDirection: 'row',
      marginLeft: 40,
      marginBottom: spacing.md,
      gap: 4,
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnActive: {
      backgroundColor: colors.primaryLight,
    },
    actionBtnActiveBad: {
      backgroundColor: colors.danger + '18',
    },
    actionBtnNoted: {
      backgroundColor: colors.premiumLight,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    sendButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    sendLabel: {
      color: colors.surface,
      fontWeight: '600',
      lineHeight: 24,
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
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    modalIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.premiumLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    modalTitle: {
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalDesc: {
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
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
      color: colors.textPrimary,
      flex: 1,
    },
    upgradeBtn: {
      backgroundColor: colors.premium,
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'stretch',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    upgradeBtnText: {
      color: '#fff',
      fontWeight: '700',
    },
    cancelBtn: {
      paddingVertical: spacing.sm,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
  }), [isDark]);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<any>(null);
  const recordingStartRef = useRef<number>(0);
  const maxMeteringRef = useRef<number>(-160);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const scaledTypography = useScaledTypography();
  const { language } = useLanguageStore();
  const flatListRef = useRef<FlatList>(null);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  // Track xem user đang ở gần bottom không. Chỉ auto-scroll xuống cuối khi
  // user đã ở bottom (vd: tin mới về). Nếu user kéo lên đọc lịch sử → KHÔNG
  // được force scroll xuống.
  // initialLoadRef=true cho lần load đầu (khi mở modal, messages từ server load
  // dần) → LUÔN scroll xuống cuối bất kể ref. Sau đó set false → respect user.
  const userAtBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    // Bỏ qua scroll events trong initial load — tránh setting userAtBottom=false
    // do scroll position chưa stabilize.
    if (initialLoadRef.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    userAtBottomRef.current = distanceFromBottom < 60;
  };

  // Feedback state: messageId → 'like' | 'dislike' | null
  const [feedbacks, setFeedbacks] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());

  // Load noted IDs + like/dislike feedbacks from DB on mount
  useEffect(() => {
    chatApi.fetchNotedMessageIds()
      .then(ids => { if (ids.length) setNotedIds(new Set(ids)); })
      .catch(() => {});
    chatApi.fetchFeedbacks()
      .then(map => { if (Object.keys(map).length) setFeedbacks(map); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    // Initial load (lần đầu messages về sau khi mở modal) → LUÔN scroll xuống
    // cuối, không phụ thuộc ref. Đây là behavior expected: mở chat → thấy
    // tin mới nhất ở dưới.
    if (initialLoadRef.current) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        // Đợi scroll ổn định (~600ms) rồi mới enable tracking user scroll.
        // Tránh handleScroll chạy giữa lúc scroll programmatic và set
        // userAtBottomRef sai.
        setTimeout(() => { initialLoadRef.current = false; }, 600);
      }, 200);
      return () => clearTimeout(timer);
    }
    if (!userAtBottomRef.current) return; // Tôn trọng user nếu họ đang đọc lịch sử
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // ─── Feedback handlers ─────────────────────────────────────────────

  const handleFeedback = async (msg: ChatBubble, type: 'like' | 'dislike') => {
    const current = feedbacks[msg.id];
    const newType = current === type ? null : type;
    setFeedbacks((prev) => ({ ...prev, [msg.id]: newType }));
    try {
      await chatApi.sendFeedback(msg.id, msg.text, type);
    } catch {}
  };

  const handleCopy = async (msg: ChatBubble) => {
    Clipboard.setStringAsync(msg.text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleNote = async (msg: ChatBubble) => {
    if (notedIds.has(msg.id)) return; // already noted — do nothing
    setNotedIds((prev) => new Set(prev).add(msg.id));
    try {
      await chatApi.sendFeedback(msg.id, msg.text, 'note');
    } catch {}
  };

  // ─── Mic handler ───────────────────────────────────────────────────

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
          if (text) setDraft((prev) => (prev ? `${prev} ${text}` : text));
        } catch {
        } finally {
          setIsTranscribing(false);
        }
      } catch (e: any) {
        showAlert(t('chat:errorMic'), e?.message ?? String(e));
      }
    } else {
      try {
        if (recordingRef.current) {
          try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
          recordingRef.current = null;
        }
        const Audio = await getAudio();
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
        showAlert(t('chat:errorMic'), e?.message ?? String(e));
      }
    }
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend?.(draft.trim());
    setDraft('');
  };

  // ─── Render ────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: ChatBubble }) => {
    const isAssistant = item.role === 'assistant';
    const isGreeting = item.id === 'greeting';
    const fb = feedbacks[item.id];

    return (
      <View>
        <View style={[styles.messageRow, !isAssistant && styles.messageRowReverse]}>
          {isAssistant && assistantAvatar ? (
            <Image source={{ uri: assistantAvatar }} style={styles.avatar} />
          ) : null}
          {!isAssistant && userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : null}
          <View style={[styles.bubble, isAssistant ? styles.assistantBubble : styles.userBubble]}>
            <Text
              style={[
                styles.bubbleText,
                { fontSize: scaledTypography.size.md },
                !isAssistant && styles.userText,
              ]}
            >
              {item.text}
            </Text>
            <Text style={[styles.timestamp, { fontSize: scaledTypography.size.xs }]}>
              {(() => {
                const d = new Date(item.timestamp);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const yy = d.getFullYear();
                return `${hh}:${mm} ${dd}/${mo}/${yy}`;
              })()}
            </Text>
          </View>
        </View>

        {/* Action bar — only for AI messages, not greeting */}
        {isAssistant && !isGreeting && (
          <View style={styles.actionBar}>
            {/* Like */}
            <Pressable
              style={[styles.actionBtn, { width: scaledTypography.size.xl, height: scaledTypography.size.xl, borderRadius: scaledTypography.size.xl / 2 }, fb === 'like' && styles.actionBtnActive]}
              onPress={() => handleFeedback(item, 'like')}
            >
              <Ionicons
                name={fb === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={scaledTypography.size.md}
                color={fb === 'like' ? colors.primary : colors.textSecondary}
              />
            </Pressable>

            {/* Dislike */}
            <Pressable
              style={[styles.actionBtn, { width: scaledTypography.size.xl, height: scaledTypography.size.xl, borderRadius: scaledTypography.size.xl / 2 }, fb === 'dislike' && styles.actionBtnActiveBad]}
              onPress={() => handleFeedback(item, 'dislike')}
            >
              <Ionicons
                name={fb === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={scaledTypography.size.md}
                color={fb === 'dislike' ? colors.danger : colors.textSecondary}
              />
            </Pressable>

            {/* Copy */}
            <Pressable style={[styles.actionBtn, { width: scaledTypography.size.xl, height: scaledTypography.size.xl, borderRadius: scaledTypography.size.xl / 2 }]} onPress={() => handleCopy(item)}>
              <Ionicons
                name={copiedId === item.id ? 'checkmark' : 'copy-outline'}
                size={scaledTypography.size.md}
                color={copiedId === item.id ? colors.emerald : colors.textSecondary}
              />
            </Pressable>

            {/* Note — once noted, show filled bookmark permanently */}
            <Pressable
              style={[styles.actionBtn, { width: scaledTypography.size.xl, height: scaledTypography.size.xl, borderRadius: scaledTypography.size.xl / 2 }, notedIds.has(item.id) && styles.actionBtnNoted]}
              onPress={() => handleNote(item)}
              disabled={notedIds.has(item.id)}
            >
              <Ionicons
                name={notedIds.has(item.id) ? 'bookmark' : 'bookmark-outline'}
                size={scaledTypography.size.md}
                color={notedIds.has(item.id) ? colors.premium : colors.textSecondary}
              />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background: ấm cream → sage gradient + 2 brand-tint blobs để feel premium */}
      <LinearGradient
        colors={['#faf9f5', '#f5f8f4', '#eff5ef']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.bgBlobTopRight} pointerEvents="none" />
      <View style={styles.bgBlobBottomLeft} pointerEvents="none" />

      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <FlatList
        ref={flatListRef}
        contentContainerStyle={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onContentSizeChange={() => {
          // Initial load: luôn scroll xuống cuối (xem tin mới nhất khi mở chat).
          // Sau đó: chỉ scroll khi user đang ở bottom (tin mới đến). Nếu user
          // kéo lên đọc lịch sử → giữ nguyên vị trí.
          if (initialLoadRef.current || userAtBottomRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        renderItem={renderMessage}
        ListFooterComponent={
          isTyping ? (
            <TypingIndicator avatar={assistantAvatar} />
          ) : null
        }
      />
      <View style={styles.composer}>
        <Pressable
          onPress={handleMicPress}
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons
              name={isRecording ? 'stop-circle' : 'microphone'}
              size={scaledTypography.size.xl}
              color={isRecording ? '#fff' : colors.primary}
            />
          )}
        </Pressable>
        <TextInput
          style={[styles.input, { fontSize: scaledTypography.size.md }]}
          placeholder={t('chat:placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={[styles.sendLabel, { fontSize: scaledTypography.size.md }]}>
            {t('common:send')}
          </Text>
        </Pressable>
      </View>

      {/* Modal Premium */}
      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowUpgradeModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="crown" size={Math.round(scaledTypography.size.xl * 1.2)} color={colors.premium} />
            </View>
            <Text style={[styles.modalTitle, { fontSize: scaledTypography.size.md }]}>{t('common:voicePremiumTitle')}</Text>
            <Text style={[styles.modalDesc, { fontSize: scaledTypography.size.sm }]}>{t('common:voicePremiumDesc')}</Text>
            <View style={styles.featureList}>
              {[
                t('common:voicePremiumFeature1'),
                t('common:voicePremiumFeature2'),
                t('common:voicePremiumFeature3'),
              ].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={scaledTypography.size.sm} color={colors.emerald} />
                  <Text style={[styles.featureText, { fontSize: scaledTypography.size.sm }]}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.upgradeBtn}
              onPress={() => {
                setShowUpgradeModal(false);
                setTimeout(() => onUpgradePress?.(), 350);
              }}
            >
              <MaterialCommunityIcons name="crown" size={scaledTypography.size.md} color="#fff" />
              <Text style={[styles.upgradeBtnText, { fontSize: scaledTypography.size.sm }]}>{t('common:voiceUpgrade')}</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setShowUpgradeModal(false)}>
              <Text style={[styles.cancelBtnText, { fontSize: scaledTypography.size.sm }]}>{t('common:later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};
