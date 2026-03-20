/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → triage 3-5 questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { checkinApi, type CheckinStatus, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { chatApi } from '../../src/features/chat/chat.api';
import { usePremium } from '../../src/hooks/usePremium';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

const MAX_TRIAGE_QUESTIONS = 5;

// ─── Local fallback questions (when network itself fails) ────────────────────

const LOCAL_FALLBACK_INITIAL = [
  { question: 'Mức độ mệt của bạn hiện tại thế nào?', questionEn: 'How severe is your tiredness right now?', options: ['nhẹ', 'trung bình', 'khá nặng', 'rất nặng'], optionsEn: ['mild', 'moderate', 'quite severe', 'very severe'], multiSelect: false },
  { question: 'Bạn đang gặp triệu chứng nào?', questionEn: 'What symptoms are you experiencing?', options: ['mệt mỏi', 'chóng mặt', 'đau đầu', 'buồn nôn', 'khát nước', 'không rõ'], optionsEn: ['fatigue', 'dizziness', 'headache', 'nausea', 'thirst', 'not sure'], multiSelect: true },
  { question: 'Tình trạng này bắt đầu từ khi nào?', questionEn: 'When did this start?', options: ['vừa mới', 'vài giờ trước', 'từ sáng', 'từ hôm qua'], optionsEn: ['just now', 'a few hours ago', 'since morning', 'since yesterday'], multiSelect: false },
  { question: 'Bạn nghĩ điều gì có thể dẫn đến tình trạng này?', questionEn: 'What might have caused this?', options: ['ngủ ít', 'bỏ bữa', 'căng thẳng', 'quên uống thuốc', 'không rõ'], optionsEn: ['lack of sleep', 'skipped meals', 'stress', 'missed medication', 'not sure'], multiSelect: true },
  { question: 'Bạn đã làm gì để cải thiện chưa?', questionEn: 'Have you done anything to feel better?', options: ['nghỉ ngơi', 'ăn uống', 'uống nước', 'uống thuốc', 'chưa làm gì'], optionsEn: ['rested', 'ate something', 'drank water', 'took medication', 'nothing yet'], multiSelect: true },
];

const LOCAL_FALLBACK_FOLLOWUP = [
  { question: 'So với lần trước, bạn cảm thấy thế nào?', questionEn: 'Compared to before, how are you feeling now?', options: ['đã đỡ hơn', 'vẫn như cũ', 'mệt hơn trước'], optionsEn: ['better', 'about the same', 'worse'], multiSelect: false },
  { question: 'Bạn có thêm triệu chứng nào mới không?', questionEn: 'Do you have any new symptoms?', options: ['đau đầu', 'chóng mặt', 'buồn nôn', 'khó thở', 'không có gì thêm'], optionsEn: ['headache', 'dizziness', 'nausea', 'shortness of breath', 'nothing new'], multiSelect: true },
  { question: 'Bạn đã nghỉ ngơi hoặc ăn uống gì chưa?', questionEn: 'Have you rested or eaten anything?', options: ['đã nghỉ ngơi', 'đã ăn uống', 'đã uống thuốc', 'chưa làm gì'], optionsEn: ['rested', 'ate something', 'took medication', 'nothing yet'], multiSelect: true },
];

function getLocalFallbackQuestion(answerCount: number, isFollowUp: boolean, lang: string = 'vi') {
  const bank = isFollowUp ? LOCAL_FALLBACK_FOLLOWUP : LOCAL_FALLBACK_INITIAL;
  const isEn = lang === 'en';

  if (answerCount < bank.length) {
    const q = bank[answerCount];
    return {
      isDone: false,
      question: isEn ? q.questionEn : q.question,
      options: isEn ? q.optionsEn : q.options,
      multiSelect: q.multiSelect,
      _fallback: true,
    };
  }

  // All exhausted → done
  return {
    isDone: true,
    summary: isEn ? 'Asinu has recorded your condition.' : 'Asinu đã ghi nhận tình trạng của bạn.',
    severity: 'medium' as const,
    recommendation: isEn ? 'Please rest and monitor. Asinu will check back later.' : 'Hãy nghỉ ngơi và theo dõi thêm. Asinu sẽ hỏi lại sau nhé.',
    needsDoctor: false,
    _fallback: true,
  };
}

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  labelKey: string;
  sublabelKey: string;
  color: string;
  bg: string;
  gradient: [string, string];
}> = [
  {
    status: 'fine',
    icon: 'emoticon-happy-outline',
    labelKey: 'checkinFine',
    sublabelKey: 'checkinFineSub',
    color: '#16a34a',
    bg: '#f0fdf4',
    gradient: ['#dcfce7', '#f0fdf4'],
  },
  {
    status: 'tired',
    icon: 'emoticon-sad-outline',
    labelKey: 'checkinTired',
    sublabelKey: 'checkinTiredSub',
    color: '#d97706',
    bg: '#fffbeb',
    gradient: ['#fef3c7', '#fffbeb'],
  },
  {
    status: 'very_tired',
    icon: 'emoticon-cry-outline',
    labelKey: 'checkinVeryTired',
    sublabelKey: 'checkinVeryTiredSub',
    color: '#dc2626',
    bg: '#fef2f2',
    gradient: ['#fee2e2', '#fef2f2'],
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

type Screen = 'status' | 'triage' | 'done';

export default function CheckinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const { language } = useLanguageStore();
  const params = useLocalSearchParams<{ checkin_id?: string; mode?: string }>();
  const isFollowUp = params.mode === 'followup';
  const existingCheckinId = params.checkin_id ? parseInt(params.checkin_id) : null;

  const [screen, setScreen]       = useState<Screen>('status');
  const [loading, setLoading]     = useState(false);
  const [session, setSession]     = useState<CheckinSession | null>(null);

  // Triage state
  const [answers, setAnswers]      = useState<Array<{ question: string; answer: string }>>([]);
  const [currentQ, setCurrentQ]    = useState<string>('');
  const [currentOpts, setCurrentOpts] = useState<string[]>([]);
  const [currentMultiSelect, setCurrentMultiSelect] = useState(true);
  const [customAnswer, setCustomAnswer] = useState('');
  const [triageSummary, setTriageSummary] = useState<{
    summary: string; severity: string; recommendation: string; needsDoctor: boolean;
  } | null>(null);

  // ─── Status select ─────────────────────────────────────────────────────────

  const handleStatusSelect = useCallback(async (status: CheckinStatus) => {
    setLoading(true);
    try {
      let sess: CheckinSession;

      if (isFollowUp && existingCheckinId) {
        const res = await checkinApi.followUp(existingCheckinId, status);
        sess = res.session;
      } else {
        const res = await checkinApi.start(status);
        sess = res.session;
      }

      setSession(sess);

      if (status === 'fine' && !isFollowUp) {
        // Morning check-in "fine" → done immediately
        setScreen('done');
        return;
      }

      if (status === 'fine' && isFollowUp) {
        // Evening follow-up "fine" → done immediately
        setScreen('done');
        return;
      }

      // Start triage for tired/very_tired
      await fetchNextQuestion(sess, []);
      setScreen('triage');
    } catch (err: any) {
      console.error('[Checkin] handleStatusSelect error:', err?.message || err);
      showAlert(t('error', { ns: 'common' }), t('checkinError'));
    } finally {
      setLoading(false);
    }
  }, [isFollowUp, existingCheckinId]);

  // ─── Triage ────────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: typeof answers) => {
    setLoading(true);
    try {
      const result = await checkinApi.triage(sess.id, prevAnswers);
      console.log('[Checkin] triage result:', JSON.stringify(result));
      if (result.isDone) {
        setTriageSummary({
          summary: result.summary || '',
          severity: result.severity || 'medium',
          recommendation: result.recommendation || '',
          needsDoctor: result.needsDoctor ?? false,
        });
        setScreen('done');
      } else {
        setCurrentQ(result.question || '');
        setCurrentOpts(result.options || []);
        // If AI specifies multiSelect, use it. Otherwise auto-detect:
        // Single-select: severity/frequency/yes-no type questions (few exclusive options)
        // Multi-select: symptom lists, activities, body areas (many combinable options)
        if (result.multiSelect !== undefined) {
          setCurrentMultiSelect(result.multiSelect);
        } else {
          const opts = result.options || [];
          const q = (result.question || '').toLowerCase();
          const isSingleSelect =
            opts.length <= 4 && (
              q.includes('mức độ') || q.includes('severity') ||
              q.includes('bao lâu') || q.includes('how long') ||
              q.includes('có không') || q.includes('không?') ||
              q.includes('thường xuyên') || q.includes('frequency') ||
              q.includes('khi nào') || q.includes('when')
            );
          setCurrentMultiSelect(!isSingleSelect);
        }
        setCustomAnswer('');
      }
    } catch (err: any) {
      console.error('[Checkin] fetchNextQuestion error, using local fallback:', err?.message || err);
      const fallback = getLocalFallbackQuestion(prevAnswers.length, isFollowUp, language);
      if (fallback.isDone) {
        setTriageSummary({
          summary: fallback.summary || '',
          severity: (fallback as any).severity || 'medium',
          recommendation: (fallback as any).recommendation || '',
          needsDoctor: (fallback as any).needsDoctor ?? false,
        });
        setScreen('done');
      } else {
        setCurrentQ(fallback.question || '');
        setCurrentOpts(fallback.options || []);
        setCurrentMultiSelect(fallback.multiSelect ?? false);
        setCustomAnswer('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!session || !answer.trim()) return;
    const newAnswers = [...answers, { question: currentQ, answer: answer.trim() }];
    setAnswers(newAnswers);

    // Evening wrap-up: if this was the evening question for "fine" flow
    const eveningGoodAnswers = [t('checkinEveningGreat'), t('checkinEveningOk')];
    const eveningBadAnswers = [t('checkinEveningTired'), t('checkinEveningBad')];
    if (currentQ === t('checkinEveningQuestion')) {
      if (eveningGoodAnswers.includes(answer.trim())) {
        // Good evening → done
        setTriageSummary({
          summary: answer.trim(),
          severity: 'low',
          recommendation: t('checkinDoneFineSub'),
          needsDoctor: false,
        });
        setScreen('done');
        return;
      }
      if (eveningBadAnswers.includes(answer.trim())) {
        // Not good evening → start real triage
        await fetchNextQuestion(session, newAnswers);
        return;
      }
    }

    // Hard limit on frontend — force done if we've asked enough
    if (newAnswers.length >= MAX_TRIAGE_QUESTIONS) {
      setTriageSummary({
        summary: '',
        severity: 'medium',
        recommendation: '',
        needsDoctor: false,
      });
      setScreen('done');
      // Still send final answers to backend to save
      checkinApi.triage(session.id, newAnswers).catch(() => {});
      return;
    }

    await fetchNextQuestion(session, newAnswers);
  };

  // ─── Render screens ────────────────────────────────────────────────────────

  if (loading && screen === 'status') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: isFollowUp ? t('checkinHeaderFollowUp') : t('checkinHeaderTitle'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      }} />
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.background }}
            contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            {screen === 'status' && <StatusScreen styles={styles} onSelect={handleStatusSelect} isFollowUp={isFollowUp} />}
            {screen === 'triage' && (
              <TriageScreen
                styles={styles}
                question={currentQ}
                options={currentOpts}
                multiSelect={currentMultiSelect}
                answers={answers}
                loading={loading}
                onAnswer={handleAnswer}
              />
            )}
            {screen === 'done' && (
              <DoneScreen
                styles={styles}
                session={session}
                triageSummary={triageSummary}
                isFollowUp={isFollowUp}
                onClose={() => router.back()}
              />
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Status screen ────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

function StatusScreen({
  styles,
  onSelect,
  isFollowUp,
}: {
  styles: Styles;
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
}) {
  const { t } = useTranslation('home');

  const getGreeting = () => {
    if (isFollowUp) return t('checkinGreetingFollowUp');
    const h = new Date().getHours();
    if (h < 12) return t('checkinGreetingMorning');
    if (h < 18) return t('checkinGreetingAfternoon');
    return t('checkinGreetingEvening');
  };

  return (
    <View style={styles.section}>
      {/* Asinu avatar */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.statusAvatarWrap}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.statusAvatar}
        >
          <Ionicons name="heart" size={28} color="#fff" />
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Text style={styles.heading}>{getGreeting()}</Text>
        <Text style={styles.subheading}>{t('checkinSubheading')}</Text>
      </Animated.View>

      <View style={styles.optionList}>
        {STATUS_OPTIONS.map((opt, idx) => (
          <Animated.View key={opt.status} entering={FadeInDown.delay(200 + idx * 80).duration(400)}>
            <Pressable
              style={({ pressed }) => [
                styles.statusCard,
                { borderColor: opt.color + '44' },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => onSelect(opt.status)}
            >
              <LinearGradient
                colors={opt.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.statusIconCircle, { backgroundColor: opt.color + '1a' }]}>
                <MaterialCommunityIcons name={opt.icon} size={28} color={opt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: opt.color }]}>{t(opt.labelKey)}</Text>
                <Text style={styles.statusSub}>{t(opt.sublabelKey)}</Text>
              </View>
              <View style={[styles.statusArrow, { backgroundColor: opt.color + '15' }]}>
                <Ionicons name="chevron-forward" size={18} color={opt.color} />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── Triage screen ────────────────────────────────────────────────────────────

function TriageScreen({
  styles,
  question,
  options,
  multiSelect,
  answers,
  loading,
  onAnswer,
}: {
  styles: Styles;
  question: string;
  options: string[];
  multiSelect: boolean;
  answers: Array<{ question: string; answer: string }>;
  loading: boolean;
  onAnswer: (a: string) => void;
}) {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');
  const [custom, setCustom] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // Voice recording
  const { isPremium } = usePremium();
  const { language } = useLanguageStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const recordingRef = useRef<any>(null);
  const recordingStartRef = useRef<number>(0);
  const maxMeteringRef = useRef<number>(-160);

  const handleMicPress = async () => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }
    if (isRecording) {
      // Stop recording
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
          if (text) setCustom((prev) => (prev ? `${prev} ${text}` : text));
        } catch {}
        setIsTranscribing(false);
      } catch {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
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
      } catch {}
    }
  };

  const progress = (answers.length + 1) / MAX_TRIAGE_QUESTIONS;

  const handleOptionTap = (opt: string) => {
    if (multiSelect) {
      // Multi-select: toggle checkbox
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        return next;
      });
    } else {
      // Single-select: send immediately
      onAnswer(opt);
      setSelected(new Set());
      setCustom('');
    }
  };

  const handleConfirm = () => {
    const parts: string[] = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    if (parts.length === 0) return;
    const combined = parts.join(', ');
    onAnswer(combined);
    setSelected(new Set());
    setCustom('');
  };

  const hasSelection = selected.size > 0 || custom.trim().length > 0;

  return (
    <View style={styles.section}>
      {/* Slim progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
        />
      </View>

      {/* Conversation history */}
      <View style={styles.chatArea}>
        {answers.map((a, i) => (
          <View key={i}>
            {/* AI question */}
            <Animated.View entering={FadeInLeft.delay(i * 30).duration(300)} style={styles.aiMsgRow}>
              <View style={styles.aiAvatarSmall}>
                <Ionicons name="heart" size={12} color="#fff" />
              </View>
              <View style={styles.aiBubble}>
                <Text style={styles.aiBubbleText}>{a.question}</Text>
              </View>
            </Animated.View>
            {/* User answer */}
            <Animated.View entering={FadeInRight.delay(i * 30 + 50).duration(300)} style={styles.userMsgRow}>
              <View style={styles.userAnswerCard}>
                {a.answer.split(', ').map((item, j) => (
                  <View key={j} style={styles.userAnswerTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.userAnswerTagText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        ))}

        {loading ? (
          <Animated.View entering={FadeInLeft.duration(300)} style={styles.aiMsgRow}>
            <View style={styles.aiAvatarSmall}>
              <Ionicons name="heart" size={12} color="#fff" />
            </View>
            <View style={styles.aiBubble}>
              <View style={styles.typingRow}>
                <View style={[styles.typingDot, { opacity: 0.8 }]} />
                <View style={[styles.typingDot, { opacity: 0.5 }]} />
                <View style={[styles.typingDot, { opacity: 0.3 }]} />
              </View>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Current AI question */}
            <Animated.View entering={FadeInLeft.duration(400)} style={styles.aiMsgRow}>
              <View style={styles.aiAvatar}>
                <Ionicons name="heart" size={16} color="#fff" />
              </View>
              <View style={styles.currentQuestionBubble}>
                <Text style={styles.currentQuestionText}>{question}</Text>
              </View>
            </Animated.View>

            {/* Hint — show for multi-select when has options */}
            {multiSelect && options.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.selectHintWrap}>
                <Ionicons name="hand-left-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.selectHintText}>{t('checkinSelectHint')}</Text>
              </Animated.View>
            )}

            {/* Option cards — only when options exist */}
            {options.length > 0 && <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.optionsWrap}>
              {options.map((opt) => {
                const isSelected = selected.has(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => handleOptionTap(opt)}
                  >
                    {multiSelect ? (
                      <View style={[styles.optionCheckbox, isSelected && styles.optionCheckboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    ) : (
                      <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                        {isSelected && <View style={styles.optionRadioDot} />}
                      </View>
                    )}
                    <Text style={[styles.optionCardText, isSelected && styles.optionCardTextSelected]}>{opt}</Text>
                    {!multiSelect && (
                      <Ionicons name="chevron-forward" size={16} color={colors.primary + '66'} />
                    )}
                  </Pressable>
                );
              })}
            </Animated.View>}

            {/* Custom text input + mic — show when multi-select OR no options */}
            {(multiSelect || options.length === 0) && <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.inputRow}>
              <Pressable
                onPress={handleMicPress}
                style={[styles.micBtn, isRecording && styles.micBtnActive]}
                disabled={isTranscribing}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop-circle' : 'microphone'}
                    size={22}
                    color={isRecording ? '#fff' : isPremium ? colors.primary : colors.textSecondary}
                  />
                )}
                {!isPremium && !isRecording && !isTranscribing && (
                  <View style={styles.micPremiumBadge}>
                    <MaterialCommunityIcons name="crown" size={8} color="#fff" />
                  </View>
                )}
              </Pressable>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder={isTranscribing ? '...' : t('checkinCustomPlaceholder')}
                  placeholderTextColor={colors.textSecondary + '77'}
                  value={custom}
                  onChangeText={setCustom}
                  returnKeyType="done"
                  editable={!isTranscribing}
                />
              </View>
            </Animated.View>}

            {/* Confirm button — show when multi-select OR no options (text-only input) */}
            {(multiSelect || options.length === 0) && <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.confirmWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !hasSelection && styles.confirmBtnDisabled,
                  pressed && hasSelection && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
                disabled={!hasSelection}
                onPress={handleConfirm}
              >
                <LinearGradient
                  colors={hasSelection ? [colors.primary, colors.primaryDark] : [colors.border, colors.border]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmBtnGradient}
                >
                  <Text style={[styles.confirmBtnText, !hasSelection && { color: colors.textSecondary }]}>
                    {t('checkinConfirmSelection')}
                    {selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={hasSelection ? '#fff' : colors.textSecondary}
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>}
          </>
        )}
      </View>

      {/* Premium upgrade modal for voice */}
      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUpgradeModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="microphone" size={32} color={colors.premium} />
            </View>
            <Text style={styles.modalTitle}>{tc('voicePremiumTitle')}</Text>
            <Text style={styles.modalDesc}>{tc('voicePremiumDesc')}</Text>
            <Pressable
              style={styles.modalUpgradeBtn}
              onPress={() => setShowUpgradeModal(false)}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#fff" />
              <Text style={styles.modalUpgradeText}>{tc('voiceUpgrade')}</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.modalCancelText}>{tc('later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({
  styles,
  session,
  triageSummary,
  isFollowUp,
  onClose,
}: {
  styles: Styles;
  session: CheckinSession | null;
  triageSummary: { summary: string; severity: string; recommendation: string; needsDoctor: boolean } | null;
  isFollowUp: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('home');
  const isFine = session?.current_status === 'fine';

  const severityColor = triageSummary?.severity === 'high' ? '#dc2626'
    : triageSummary?.severity === 'medium' ? '#d97706' : '#16a34a';
  const severityIcon = triageSummary?.severity === 'high' ? 'alert-circle' : triageSummary?.severity === 'medium' ? 'information-circle' : 'checkmark-circle';
  const severityBg = triageSummary?.severity === 'high' ? '#fef2f2' : triageSummary?.severity === 'medium' ? '#fffbeb' : '#f0fdf4';

  return (
    <View style={styles.section}>
      {/* Hero icon */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.doneHero}>
        <View style={[styles.doneCircleOuter, { backgroundColor: isFine ? '#dcfce7' : severityBg }]}>
          <View style={[styles.doneCircleInner, { backgroundColor: isFine ? '#16a34a' : severityColor }]}>
            {isFine
              ? <Ionicons name="checkmark" size={36} color="#fff" />
              : <Ionicons name={severityIcon as any} size={36} color="#fff" />
            }
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <Text style={styles.heading}>
          {isFine ? t('checkinDoneGreat') : t('checkinDoneNoted')}
        </Text>
      </Animated.View>

      {isFine ? (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.fineCard}>
          <View style={styles.fineIconWrap}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.fineCardText}>
            {isFollowUp ? t('checkinDoneEveningSub') : t('checkinDoneFineSub')}
          </Text>
        </Animated.View>
      ) : triageSummary && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <View style={[styles.resultCard, { borderColor: severityColor + '33' }]}>
            {/* Severity strip */}
            <View style={[styles.severityStrip, { backgroundColor: severityColor }]} />

            <View style={styles.resultBody}>
              {/* Badge */}
              <View style={[styles.severityBadge, { backgroundColor: severityBg }]}>
                <Ionicons name={severityIcon as any} size={14} color={severityColor} />
                <Text style={[styles.severityBadgeText, { color: severityColor }]}>
                  {triageSummary.severity === 'high' ? t('checkinSeverityHigh')
                    : triageSummary.severity === 'medium' ? t('checkinSeverityMedium') : t('checkinSeverityLow')}
                </Text>
              </View>

              {/* Summary */}
              {triageSummary.summary ? (
                <Text style={styles.resultSummary}>{triageSummary.summary}</Text>
              ) : null}

              {/* Recommendation */}
              {triageSummary.recommendation ? (
                <View style={styles.adviceWrap}>
                  <View style={styles.adviceHeader}>
                    <Ionicons name="bulb-outline" size={16} color={colors.premium} />
                    <Text style={styles.adviceLabel}>{t('checkinAdvice')}</Text>
                  </View>
                  <Text style={styles.adviceText}>{triageSummary.recommendation}</Text>
                </View>
              ) : null}

              {/* Doctor banner */}
              {triageSummary.needsDoctor && (
                <View style={styles.doctorBanner}>
                  <View style={styles.doctorIcon}>
                    <Ionicons name="medical" size={14} color="#fff" />
                  </View>
                  <Text style={styles.doctorText}>{t('checkinSeeDoctor')}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {!isFine && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.followCard}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.followText}>
            {session?.flow_state === 'high_alert'
              ? t('checkinFollowUpHigh')
              : t('checkinFollowUpNormal')}
          </Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={onClose}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.doneBtnGradient}
          >
            <Text style={styles.doneBtnText}>{t('checkinClose')}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    container: { padding: spacing.xl },
    section: { gap: spacing.lg },

    heading: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subheading: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 4,
    },

    optionList: { gap: spacing.md, marginTop: spacing.sm },

    // ── Status screen ──
    statusAvatarWrap: { alignItems: 'center' },
    statusAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      gap: spacing.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    statusIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusLabel: { fontSize: typography.size.md, fontWeight: '700' },
    statusSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    statusArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Triage / chat ──
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border + '55',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: colors.primary,
    },

    chatArea: { gap: spacing.sm },

    // AI messages (left)
    aiMsgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      maxWidth: '88%',
    },
    aiAvatarSmall: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + '88',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiBubble: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderTopLeftRadius: 4,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    aiBubbleText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // User messages (right)
    userMsgRow: {
      alignItems: 'flex-end',
      marginLeft: 36,
    },
    userAnswerCard: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderBottomRightRadius: 4,
      maxWidth: '90%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    userAnswerTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    userAnswerTagText: {
      fontSize: typography.size.xs,
      color: '#fff',
      fontWeight: '600',
      lineHeight: 18,
    },

    // Typing indicator
    typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
    typingDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.primary,
    },

    // Current question (bigger, emphasized)
    currentQuestionBubble: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.xl,
      borderTopLeftRadius: 4,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    currentQuestionText: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 26,
    },

    // Select hint
    selectHintWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 40,
      marginTop: 2,
    },
    selectHintText: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },

    // Multi-select option cards
    optionsWrap: {
      gap: spacing.sm,
      marginTop: spacing.xs,
      paddingLeft: 36,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    optionCardSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.1,
    },
    optionCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionCheckboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionRadio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionRadioSelected: {
      borderColor: colors.primary,
    },
    optionRadioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    optionCardText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    optionCardTextSelected: {
      color: colors.primary,
    },

    // Custom text input + mic
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingLeft: 36,
    },
    micBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtnActive: {
      backgroundColor: colors.danger,
    },
    micPremiumBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.premium,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    inputWrap: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    input: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },

    // Premium modal
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
    },
    modalIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.premiumLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalDesc: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
    modalUpgradeBtn: {
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
    modalUpgradeText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    modalCancelBtn: {
      paddingVertical: spacing.sm,
    },
    modalCancelText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: '600',
    },

    // Confirm button
    confirmWrap: {
      paddingLeft: 36,
      marginTop: spacing.sm,
    },
    confirmBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    confirmBtnDisabled: {
      shadowOpacity: 0,
    },
    confirmBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: spacing.md,
    },
    confirmBtnText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },

    // ── Done screen ──
    doneHero: { alignItems: 'center' },
    doneCircleOuter: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneCircleInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    fineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + '28',
    },
    fineIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '1a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fineCardText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },

    // Result card with side strip
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    severityStrip: {
      height: 4,
      width: '100%',
    },
    resultBody: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    severityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    severityBadgeText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    resultSummary: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 22,
    },
    adviceWrap: {
      backgroundColor: '#fffbeb',
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 4,
    },
    adviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adviceLabel: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    adviceText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      lineHeight: 22,
      marginLeft: 22,
    },

    doctorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: '#fee2e2',
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    doctorIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#dc2626',
      alignItems: 'center',
      justifyContent: 'center',
    },
    doctorText: { fontSize: typography.size.xs, color: '#991b1b', fontWeight: '700', flex: 1 },

    followCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '22',
    },
    followText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },

    doneBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      marginTop: spacing.xs,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    doneBtnGradient: {
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
    },
    doneBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },
  });
}
