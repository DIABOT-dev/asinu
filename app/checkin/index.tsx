/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → triage 3-5 questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
let _Audio: typeof import('expo-av').Audio | null = null;
async function getAudio() {
  if (!_Audio) { _Audio = (await import('expo-av')).Audio; }
  return _Audio;
}
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { DoctorConnectButton } from '../../src/components/DoctorConnectButton';
import { checkinApi, type CheckinStatus, type CheckinSession, type TriageSummaryView, type TriageOptionGroup } from '../../src/features/checkin/checkin.api';
import { chatApi } from '../../src/features/chat/chat.api';
import { usePremium } from '../../src/hooks/usePremium';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const MAX_TRIAGE_QUESTIONS = 8;

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

type Screen = 'status' | 'location' | 'triage' | 'done';

// T2 Body Location options — match backend body-location.js BODY_LOCATIONS enum
type BodyLocation = 'head' | 'chest' | 'abdomen' | 'limbs' | 'skin' | 'whole_body' | 'mental';

// MaterialCommunityIcons vector — outline style, không có background filled.
// Mỗi icon match ngữ nghĩa vùng cơ thể.
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const BODY_LOCATION_OPTIONS: Array<{ key: BodyLocation; icon: MciName; vi: { label: string; desc: string }; en: { label: string; desc: string } }> = [
  { key: 'head',       icon: 'head-outline',          vi: { label: 'Đầu',       desc: 'Đau đầu, chóng mặt, hoa mắt' },     en: { label: 'Head',       desc: 'Headache, dizziness, vision' } },
  { key: 'chest',      icon: 'heart-pulse',           vi: { label: 'Ngực',      desc: 'Khó thở, đau ngực, hồi hộp' },      en: { label: 'Chest',      desc: 'Breathing, chest pain, palpitations' } },
  { key: 'abdomen',    icon: 'stomach',               vi: { label: 'Bụng',      desc: 'Đau bụng, buồn nôn, tiêu hoá' },    en: { label: 'Abdomen',    desc: 'Stomach pain, nausea, digestion' } },
  { key: 'limbs',      icon: 'arm-flex-outline',      vi: { label: 'Tay chân',  desc: 'Tê, đau khớp, yếu cơ' },            en: { label: 'Limbs',      desc: 'Numbness, joint pain, weakness' } },
  { key: 'skin',       icon: 'hand-back-right-outline', vi: { label: 'Da',      desc: 'Ngứa, phát ban, vết bầm' },         en: { label: 'Skin',       desc: 'Itching, rash, bruising' } },
  { key: 'whole_body', icon: 'human',                 vi: { label: 'Toàn thân', desc: 'Sốt, mệt mỏi, ớn lạnh' },           en: { label: 'Whole body', desc: 'Fever, fatigue, chills' } },
  { key: 'mental',     icon: 'brain',                 vi: { label: 'Tinh thần', desc: 'Lo âu, mất ngủ, buồn bã' },         en: { label: 'Mental',     desc: 'Anxiety, insomnia, sadness' } },
];

export default function CheckinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const { language } = useLanguageStore();
  const params = useLocalSearchParams<{ checkin_id?: string; mode?: string; preset_status?: string }>();
  const isFollowUp = params.mode === 'followup';
  const isRandom = params.mode === 'random';
  const existingCheckinId = params.checkin_id ? parseInt(params.checkin_id) : null;
  const presetStatus = params.preset_status as 'tired' | 'very_tired' | undefined;

  const [screen, setScreen]       = useState<Screen>('status');
  const [loading, setLoading]     = useState(!isFollowUp && !existingCheckinId && !isRandom);
  const [session, setSession]     = useState<CheckinSession | null>(null);

  // Auto-detect: đã check-in hôm nay chưa? Nếu rồi → redirect đúng mode
  // Random mode: bỏ qua check, luôn cho check-in
  useEffect(() => {
    if (isFollowUp || existingCheckinId || isRandom) { setLoading(false); return; }
    let mounted = true;
    checkinApi.getToday()
      .then(res => {
        if (!mounted) return;
        if (res.session) {
          const s = res.session;
          if (s.initial_status === 'fine' || s.flow_state === 'resolved') {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
            return;
          } else if (s.triage_completed_at) {
            router.replace({ pathname: '/checkin', params: { checkin_id: String(s.id), mode: 'followup' } });
            return;
          }
        }
        setLoading(false);
      })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Auto-start nếu có preset_status từ FAB
  const presetHandled = useRef(false);
  useEffect(() => {
    if (!presetStatus || presetHandled.current || loading) return;
    presetHandled.current = true;
    handleStatusSelect(presetStatus);
  }, [presetStatus, loading]);

  // Triage state
  const [answers, setAnswers]      = useState<Array<{ question: string; answer: string }>>([]);
  const [currentQ, setCurrentQ]    = useState<string>('');
  const [currentOpts, setCurrentOpts] = useState<string[]>([]);
  const [currentOptsGrouped, setCurrentOptsGrouped] = useState<TriageOptionGroup[] | null>(null);
  const [currentMultiSelect, setCurrentMultiSelect] = useState(true);
  const [currentAllowFreeText, setCurrentAllowFreeText] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');
  const mainScrollRef = useRef<ScrollView>(null);
  const [triageSummary, setTriageSummary] = useState<TriageSummaryView | null>(null);
  // Track user scroll position để chỉ auto scrollToEnd khi user đang ở bottom
  // (vd: tin AI mới về). KHÔNG đẩy xuống nếu user đang đọc options ở giữa list.
  const userAtBottomRef = useRef(true);
  const lastQuestionIdRef = useRef<string>('');
  const handleMainScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    userAtBottomRef.current = distanceFromBottom < 80;
  };

  // Illusion layer state
  const [currentEmpathy, setCurrentEmpathy] = useState<{ text: string; templateId: string } | null>(null);
  const [currentContinuity, setCurrentContinuity] = useState<{ text: string; templateId: string } | null>(null);
  const [currentGreeting, setCurrentGreeting] = useState<{ displayText: string; templateId: string } | null>(null);

  // ─── Status select ─────────────────────────────────────────────────────────

  // T1 status pick — không INSERT DB ngay, chỉ giữ pending để T2 location quyết
  // định body_location trước khi commit. Trừ trường hợp 'fine' (skip T2) hoặc
  // followup (đã có session).
  const [pendingStatus, setPendingStatus] = useState<CheckinStatus | null>(null);

  const handleStatusSelect = useCallback(async (status: CheckinStatus) => {
    // Followup: vẫn flow cũ (đã có session)
    if (isFollowUp && existingCheckinId) {
      setLoading(true);
      try {
        const res = await checkinApi.followUp(existingCheckinId, status);
        setSession(res.session);
        if (status === 'fine') {
          setScreen('done');
          setLoading(false);
          return;
        }
        setScreen('triage');
        await fetchNextQuestion(res.session, [], true);
      } catch (err: any) {
        if (__DEV__) console.warn('[Checkin] handleStatusSelect followup:', err?.message || err);
        showAlert(t('error', { ns: 'common' }), t('checkinError'));
        setLoading(false);
      }
      return;
    }

    // Initial: 'fine' → start ngay, skip T2 location
    if (status === 'fine') {
      setLoading(true);
      try {
        const res = await checkinApi.start(status);
        setSession(res.session);
        setScreen('done');
        setLoading(false);
      } catch (err: any) {
        if (__DEV__) console.warn('[Checkin] handleStatusSelect fine:', err?.message || err);
        showAlert(t('error', { ns: 'common' }), t('checkinError'));
        setLoading(false);
      }
      return;
    }

    // Initial 'tired' / 'very_tired' → đi sang T2 Location, KHÔNG INSERT DB ngay
    setPendingStatus(status);
    setScreen('location');
  }, [isFollowUp, existingCheckinId]);

  const handleLocationsConfirm = useCallback(async (locs: BodyLocation[], other: string) => {
    if (!pendingStatus) return;
    if (locs.length === 0 && !other.trim()) {
      showAlert(t('error', { ns: 'common' }), language === 'vi' ? 'Chọn ít nhất 1 vùng hoặc gõ mô tả' : 'Pick at least 1 area or describe');
      return;
    }
    setLoading(true);
    try {
      const res = await checkinApi.start(pendingStatus, locs, other.trim() || null);
      setSession(res.session);
      setScreen('triage');
      await fetchNextQuestion(res.session, [], true);
    } catch (err: any) {
      if (__DEV__) console.warn('[Checkin] handleLocationsConfirm:', err?.message || err);
      showAlert(t('error', { ns: 'common' }), t('checkinError'));
      setLoading(false);
    }
  }, [pendingStatus, language]);

  // ─── Triage ────────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: typeof answers, skipLoadingStart = false) => {
    if (!skipLoadingStart) setLoading(true);
    try {
      const result = await checkinApi.triage(sess.id, prevAnswers);
      if (__DEV__) console.log('[Checkin] triage result:', JSON.stringify(result));
      if ((result as any).ok === false) {
        throw new Error((result as any).error || 'Triage API error');
      }
      if (result.isDone) {
        setTriageSummary({
          summary: result.summary || '',
          severity: result.severity || 'medium',
          recommendation: result.recommendation || '',
          needsDoctor: result.needsDoctor ?? false,
          _progress: result._progress,
        });
        setScreen('done');
      } else {
        // Illusion layer fields
        setCurrentEmpathy(result._empathy || null);
        setCurrentContinuity(result._continuity || null);
        setCurrentGreeting(result._greeting || null);
        const newQ = result.question || '';
        // Khi câu hỏi MỚI về (khác câu trước) → reset userAtBottom=true để
        // onContentSizeChange tự scroll xuống tin mới (user thường muốn xem).
        if (newQ !== lastQuestionIdRef.current) {
          userAtBottomRef.current = true;
          lastQuestionIdRef.current = newQ;
        }
        setCurrentQ(newQ);
        setCurrentOpts(result.options || []);
        setCurrentOptsGrouped(result.optionsGrouped || null);
        // If AI specifies multiSelect, use it. Otherwise auto-detect:
        // Single-select: severity/frequency/yes-no type questions (few exclusive options)
        // Multi-select: symptom lists, activities, body areas (many combinable options)
        const opts = result.options || [];
        const q = (result.question || '').toLowerCase();
        // Override: câu hỏi gom triệu chứng phải luôn multi-select bất kể BE trả gì.
        // User thường gặp nhiều triệu chứng cùng lúc, ép multi để khớp UX thực tế.
        const isSymptomCollect =
          opts.length > 4 &&
          (/triệu chứng.*(gì|nào)|gặp.*triệu chứng|đang.*bị/.test(q) ||
            /symptom.*(what|which)|experiencing/.test(q));
        if (isSymptomCollect) {
          setCurrentMultiSelect(true);
        } else if (result.multiSelect !== undefined) {
          setCurrentMultiSelect(result.multiSelect);
        } else {
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
        setCurrentAllowFreeText(result.allowFreeText === true);
        setCustomAnswer('');
      }
    } catch (err: any) {
      if (__DEV__) console.warn('[Checkin] triage fallback:', err?.message || err);
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
        setCurrentOptsGrouped(null);
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
            <Ionicons name="close" size={24} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />

      <ScrollView
        ref={mainScrollRef}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        bounces={false}
        overScrollMode="never"
        onScroll={handleMainScroll}
        scrollEventThrottle={120}
        onContentSizeChange={() => {
          // CHỈ auto scrollToEnd khi:
          //   - đang ở triage screen, VÀ
          //   - user đang ở gần bottom (vd: AI vừa trả tin mới)
          // Nếu user đang scroll lên đọc options ở giữa → KHÔNG đẩy xuống.
          if (screen === 'triage' && userAtBottomRef.current) {
            mainScrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        {screen === 'status' && <StatusScreen styles={styles} onSelect={handleStatusSelect} isFollowUp={isFollowUp} />}
        {screen === 'location' && (
          <LocationScreen
            styles={styles}
            language={language}
            onConfirm={handleLocationsConfirm}
            onBack={() => { setPendingStatus(null); setScreen('status'); }}
            loading={loading}
          />
        )}
        {screen === 'triage' && (
          <TriageScreen
            styles={styles}
            question={currentQ}
            options={currentOpts}
            optionsGrouped={currentOptsGrouped}
            multiSelect={currentMultiSelect}
            allowFreeText={currentAllowFreeText}
            answers={answers}
            loading={loading}
            onAnswer={handleAnswer}
            empathy={currentEmpathy}
            continuity={currentContinuity}
            greeting={currentGreeting}
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
    if (h < 14) return t('checkinGreetingAfternoon');
    if (h < 18) return t('checkinGreetingEvening2');
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
                pointerEvents="none"
              />
              <MaterialCommunityIcons name={opt.icon} size={28} color={opt.color} />
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

// ─── T2 Location screen ──────────────────────────────────────────────────────

function LocationScreen({
  styles,
  language,
  onConfirm,
  onBack,
  loading,
}: {
  styles: Styles;
  language: string;
  onConfirm: (locs: BodyLocation[], other: string) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const isVi = language === 'vi';
  const [selected, setSelected] = useState<Set<BodyLocation>>(new Set());
  const [other, setOther] = useState('');

  const toggle = (key: BodyLocation) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const count = selected.size + (other.trim() ? 1 : 0);
  const canConfirm = count > 0 && !loading;
  const confirmLabel = isVi
    ? (count > 0 ? `Tiếp tục (${count} mục đã chọn)` : 'Tiếp tục')
    : (count > 0 ? `Continue (${count} selected)` : 'Continue');

  return (
    <View style={styles.section}>
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs }}>
          {isVi ? 'Khó chịu ở đâu?' : 'Where is the discomfort?'}
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          {isVi
            ? 'Chọn 1 hoặc nhiều vùng. Có thể gõ thêm nếu chưa thấy mục phù hợp.'
            : 'Pick one or more areas. You can also type a custom one below.'}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {BODY_LOCATION_OPTIONS.map((opt) => {
          const meta = isVi ? opt.vi : opt.en;
          const isSelected = selected.has(opt.key);
          return (
            <Pressable
              key={opt.key}
              onPress={() => !loading && toggle(opt.key)}
              disabled={loading}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  borderRadius: 16,
                  backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primary : colors.border,
                  gap: spacing.md,
                  opacity: pressed || loading ? 0.7 : 1,
                },
              ]}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              {/* Vector icon từ MaterialCommunityIcons — outline, không background. */}
              <MaterialCommunityIcons
                name={opt.icon}
                size={28}
                color={isSelected ? colors.primary : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 }}>
                  {meta.label}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {meta.desc}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Free-text "Khác" — user gõ vùng tự do */}
      <View style={{ marginTop: spacing.lg }}>
        <Text style={{ color: colors.textSecondary, marginBottom: spacing.xs, fontSize: 13 }}>
          {isVi ? 'Hoặc gõ vùng khác (vd: lưng dưới, môi, gối...)' : 'Or type other area (e.g. lower back, lips, knee...)'}
        </Text>
        <TextInput
          value={other}
          onChangeText={setOther}
          placeholder={isVi ? 'Vùng khác...' : 'Other area...'}
          placeholderTextColor={colors.textSecondary}
          editable={!loading}
          maxLength={200}
          style={{
            borderWidth: 1.5,
            borderColor: other.trim() ? colors.primary : colors.border,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            fontSize: 15,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <Pressable
        onPress={() => onConfirm(Array.from(selected), other)}
        disabled={!canConfirm}
        style={({ pressed }) => [{
          marginTop: spacing.lg,
          backgroundColor: canConfirm ? colors.primary : colors.border,
          paddingVertical: spacing.md,
          borderRadius: 14,
          alignItems: 'center',
          opacity: pressed ? 0.85 : 1,
        }]}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
          {confirmLabel}
        </Text>
      </Pressable>

      <Pressable
        onPress={onBack}
        disabled={loading}
        style={{ marginTop: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm }}
      >
        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
          {isVi ? '← Quay lại' : '← Back'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Triage screen ────────────────────────────────────────────────────────────

function TriageScreen({
  styles,
  question,
  options,
  optionsGrouped,
  multiSelect,
  allowFreeText,
  answers,
  loading,
  onAnswer,
  empathy,
  continuity,
  greeting,
}: {
  styles: Styles;
  question: string;
  options: string[];
  optionsGrouped?: TriageOptionGroup[] | null;
  multiSelect: boolean;
  allowFreeText?: boolean;
  answers: Array<{ question: string; answer: string }>;
  loading: boolean;
  onAnswer: (a: string) => void;
  empathy?: { text: string; templateId: string } | null;
  continuity?: { text: string; templateId: string } | null;
  greeting?: { displayText: string; templateId: string } | null;
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

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

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
            {/* AI question — no entering animation, already answered */}
            <View style={styles.aiMsgRow}>
              <View style={styles.aiAvatarSmall}>
                <Ionicons name="heart" size={12} color="#fff" />
              </View>
              <View style={styles.aiBubble}>
                <Text style={styles.aiBubbleText}>{a.question}</Text>
              </View>
            </View>
            {/* User answer */}
            <View style={styles.userMsgRow}>
              <View style={styles.userAnswerCard}>
                {a.answer.split(', ').map((item, j) => (
                  <View key={j} style={styles.userAnswerTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.userAnswerTagText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
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
            {/* Greeting (first question only) */}
            {greeting && answers.length === 0 && (
              <Animated.View entering={FadeInLeft.duration(300)} style={styles.aiMsgRow}>
                <View style={styles.aiAvatarSmall}>
                  <Ionicons name="heart" size={12} color="#fff" />
                </View>
                <View style={[styles.aiBubble, { backgroundColor: '#e0f2f1' }]}>
                  <Text style={[styles.aiBubbleText, { color: '#00695c' }]}>{greeting.displayText}</Text>
                </View>
              </Animated.View>
            )}

            {/* Continuity prefix (first question only) */}
            {continuity && answers.length === 0 && (
              <Animated.View entering={FadeInLeft.delay(100).duration(300)} style={styles.aiMsgRow}>
                <View style={{ width: 28 }} />
                <View style={[styles.aiBubble, { backgroundColor: '#e3f2fd', paddingVertical: 8 }]}>
                  <Text style={[styles.aiBubbleText, { color: '#1565c0', fontStyle: 'italic', fontSize: 13 }]}>{continuity.text}</Text>
                </View>
              </Animated.View>
            )}

            {/* Empathy response (after first answer) */}
            {empathy && answers.length > 0 && (
              <Animated.View entering={FadeInLeft.delay(50).duration(300)} style={styles.aiMsgRow}>
                <View style={{ width: 28 }} />
                <View style={[styles.aiBubble, { backgroundColor: '#fce4ec', paddingVertical: 8 }]}>
                  <Text style={[styles.aiBubbleText, { color: '#c62828', fontSize: 13 }]}>{empathy.text}</Text>
                </View>
              </Animated.View>
            )}

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

            {/* Option cards — render grouped theo location nếu có optionsGrouped (T3
                aware T2). Else render flat list như cũ. */}
            {optionsGrouped && optionsGrouped.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.optionsWrap}>
                {optionsGrouped.map((group) => (
                  <View key={group.key} style={{ marginBottom: spacing.md }}>
                    {/* Section header — vùng cơ thể */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      marginBottom: spacing.xs,
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                        {group.label}
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>
                    {group.items.map((opt) => {
                      const isSelected = selected.has(opt);
                      return (
                        <Pressable
                          key={`${group.key}-${opt}`}
                          style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                          onPress={() => handleOptionTap(opt)}
                        >
                          <View style={[styles.optionCheckbox, isSelected && styles.optionCheckboxSelected]}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <Text style={[styles.optionCardText, isSelected && styles.optionCardTextSelected]}>{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </Animated.View>
            ) : options.length > 0 && (
              <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.optionsWrap}>
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
              </Animated.View>
            )}

            {/* Custom text input + mic — show when multi-select, allowFreeText, or no options */}
            {(multiSelect || allowFreeText || options.length === 0) && <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.inputRow}>
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
            {(multiSelect || options.length === 0) && <View style={styles.confirmWrap}>
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
            </View>}
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
            <MaterialCommunityIcons name="microphone" size={32} color={colors.premium} />
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
  triageSummary: TriageSummaryView | null;
  isFollowUp: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('home');
  const isFine = session?.current_status === 'fine';

  const isEmergency = triageSummary?.severity === 'emergency';
  const severityColor = isEmergency ? '#991b1b'
    : triageSummary?.severity === 'high' ? '#dc2626'
    : triageSummary?.severity === 'medium' ? '#d97706' : '#16a34a';
  const severityIcon = isEmergency ? 'warning'
    : triageSummary?.severity === 'high' ? 'alert-circle'
    : triageSummary?.severity === 'medium' ? 'information-circle' : 'checkmark-circle';
  const severityBg = isEmergency ? '#fee2e2'
    : triageSummary?.severity === 'high' ? '#fef2f2'
    : triageSummary?.severity === 'medium' ? '#fffbeb' : '#f0fdf4';

  const handleCall115 = () => {
    Linking.openURL('tel:115').catch(() => {});
  };

  return (
    <View style={styles.section}>
      {/* Hero icon */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.doneHero}>
        {isFine
          ? <Ionicons name="checkmark-circle" size={64} color={colors.emerald} />
          : <Ionicons name={severityIcon as any} size={64} color={severityColor} />
        }
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <Text style={styles.heading}>
          {isFine ? t('checkinDoneGreat') : t('checkinDoneNoted')}
        </Text>
      </Animated.View>

      {isFine ? (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.fineCard}>
          <Ionicons name="time-outline" size={22} color={colors.primary} />
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
                  {isEmergency ? '🚨 KHẨN CẤP'
                    : triageSummary.severity === 'high' ? t('checkinSeverityHigh')
                    : triageSummary.severity === 'medium' ? t('checkinSeverityMedium') : t('checkinSeverityLow')}
                </Text>
              </View>

              {/* Emergency call-to-action: nút gọi 115 nổi bật */}
              {isEmergency && (
                <Pressable
                  onPress={handleCall115}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#dc2626',
                      paddingVertical: spacing.lg,
                      paddingHorizontal: spacing.xl,
                      borderRadius: 16,
                      gap: spacing.sm,
                      marginTop: spacing.md,
                      shadowColor: '#dc2626',
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name="call" size={24} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
                    GỌI 115 NGAY
                  </Text>
                </Pressable>
              )}

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

              {/* Progress feedback (Illusion Layer Phase 4) */}
              {triageSummary._progress && (
                <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="trending-up" size={16} color="#2e7d32" />
                    <Text style={{ color: '#2e7d32', fontWeight: '700', fontSize: 13 }}>Tiến triển</Text>
                  </View>
                  <Text style={{ color: '#1b5e20', fontSize: 14, lineHeight: 20 }}>{triageSummary._progress.text}</Text>
                </View>
              )}

              {/* Doctor banner */}
              {triageSummary.needsDoctor && (
                <View style={styles.doctorBanner}>
                  <View style={styles.doctorIcon}>
                    <Ionicons name="medical" size={14} color="#fff" />
                  </View>
                  <Text style={styles.doctorText}>{t('checkinSeeDoctor')}</Text>
                </View>
              )}

              {/* Connect doctor CTA — animated pulse + glow giống AsinuChatSticker để hút mắt.
                  Hiện cho mọi severity != 'low' (medium / high / emergency).
                  TODO(future): wire onPress mở booking screen. */}
              {triageSummary.severity && triageSummary.severity !== 'low' && (
                <View style={{ marginTop: spacing.md }}>
                  <DoctorConnectButton
                    variant={isEmergency || triageSummary.severity === 'high' ? 'urgent' : 'default'}
                    text="Bạn có muốn kết nối với bác sĩ không?"
                    onPress={() => {
                      // Placeholder cho tính năng tương lai.
                    }}
                  />
                </View>
              )}

              {/* Family-alert banner — chỉ hiện khi server thực sự đã thử
                  alert (severity=high). Phân biệt 3 case: đã notify N người,
                  chưa có caregiver, hoặc đã notify lần trước rồi. */}
              {triageSummary.familyAlertResult?.attempted && (
                triageSummary.familyAlertResult.caregiversNotified > 0 ? (
                  <View style={[styles.doctorBanner, { backgroundColor: '#dcfce7' }]}>
                    <View style={[styles.doctorIcon, { backgroundColor: '#16a34a' }]}>
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    </View>
                    <Text style={[styles.doctorText, { color: '#166534' }]}>
                      {t('checkinFamilyNotified', { count: triageSummary.familyAlertResult.caregiversNotified })}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.doctorBanner, { backgroundColor: '#fef3c7' }]}>
                    <View style={[styles.doctorIcon, { backgroundColor: '#d97706' }]}>
                      <Ionicons name="warning" size={14} color="#fff" />
                    </View>
                    <Text style={[styles.doctorText, { color: '#92400e' }]}>
                      {t('checkinFamilyNoCaregiver')}
                    </Text>
                  </View>
                )
              )}
              {triageSummary.familyAlertResult?.alreadyAlerted && (
                <View style={[styles.doctorBanner, { backgroundColor: '#e0f2fe' }]}>
                  <View style={[styles.doctorIcon, { backgroundColor: '#0284c7' }]}>
                    <Ionicons name="information-circle" size={14} color="#fff" />
                  </View>
                  <Text style={[styles.doctorText, { color: '#075985' }]}>
                    {t('checkinFamilyAlreadyNotified')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Follow-up hint — drive text theo severity (consistent với backend timing).
          Emergency: KHÔNG show hint "đợi N tiếng" vì user phải gọi 115 NGAY,
          context đã có nút "GỌI 115" rồi. Show hint "đợi" sẽ confuse user. */}
      {!isFine && triageSummary?.severity !== 'emergency' && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.followCard}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.followText}>
            {triageSummary?.severity === 'high'
              ? t('checkinFollowUpHigh')        // 1-2 tiếng
              : t('checkinFollowUpNormal')}     // 3-6 tiếng
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
      borderWidth: 1.5,
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
      borderWidth: 1.5,
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
      borderWidth: 1.5,
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

    fineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.primary + '28',
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
      backgroundColor: colors.premiumLight,
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
      backgroundColor: colors.danger + '22',
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
      borderWidth: 1.5,
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
