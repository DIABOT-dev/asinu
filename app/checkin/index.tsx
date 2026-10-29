import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → triage 3-5 questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from '@/lib/audio';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { AiDataConsentModal, hasAiDataConsent } from '../../src/components/AiDataConsentModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as TextInput } from '../../src/components/ScaledTextInput';
import { isDoctorFeaturesEnabled } from '../../src/lib/appEnv';
import type { CheckinUiPreviewId } from '../../src/features/checkin/checkin-ui-gallery';
import { CheckinGiftModal } from '../../src/features/checkin-rewards/CheckinGiftModal';
import { CheckinGiftCloseButton } from '../../src/features/checkin-rewards/CheckinGiftCloseButton';
import { offerCheckinGiftOnHome } from '../../src/features/checkin-rewards/checkin-gift-handoff';
import { checkinApi, type CheckinStatus, type CheckinSession, type TriageAnswer, type TriageSummaryView, type TriageOptionGroup } from '../../src/features/checkin/checkin.api';
import { useCheckinCallAudio } from '../../src/features/checkin-call/useCheckinCallAudio';
import { CHECKIN_STATUS_CHOICES, CheckinStatusChoice } from '../../src/features/checkin/CheckinStatusChoice';
import { formatTriageOptionLabel, getTriageOptionIcon } from '../../src/features/checkin/triage-option-display';
import { chatApi } from '../../src/features/chat/chat.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useLanguageStore } from '../../src/stores/language.store';
import { showToast } from '../../src/stores/toast.store';
import { colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { GuidePracticeScope, GuideScrollScope, GuideTarget, useGuideAcknowledgement } from '../../src/features/guidance/GuidanceProvider';
import { useReviewGuidance } from '../../src/features/guidance/GuidanceSettings';
import { useGuidanceStore } from '../../src/features/guidance/guidance.store';
import { VoiceAnswerButton } from '../../src/features/guidance/VoiceAnswerButton';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { createCheckinPractice } from '../../src/features/guidance/checkin.practice';
import { guidanceAudio } from '../../src/features/guidance/guidance.audio';
import { guideColors as guideColors } from '../../src/features/guidance/guidance.model';

const MAX_TRIAGE_QUESTIONS = 4;
const asinuChatSticker = require('../../assets/asinu_chat_sticker.png');

// ─── Local fallback questions (when network itself fails) ────────────────────

const LOCAL_FALLBACK_INITIAL = [
  { step: 'symptoms', questionKey: 'checkinFallbackInitial2Question', optionsKey: 'checkinFallbackInitial2Options', multiSelect: true },
  { step: 'onset', questionKey: 'checkinFallbackInitial3Question', optionsKey: 'checkinFallbackInitial3Options', multiSelect: false },
  { step: 'progression', questionKey: 'checkinFallbackProgressionQuestion', optionsKey: 'checkinFallbackProgressionOptions', multiSelect: false },
  { step: 'red_flags', questionKey: 'checkinFallbackRedFlagsQuestion', optionsKey: 'checkinFallbackRedFlagsOptions', multiSelect: true },
];

const LOCAL_FALLBACK_FOLLOWUP = [
  { step: 'followup_status', questionKey: 'checkinFallbackFollowup1Question', optionsKey: 'checkinFallbackFollowup1Options', multiSelect: false },
  { step: 'followup_detail', questionKey: 'checkinFallbackFollowup2Question', optionsKey: 'checkinFallbackFollowup2Options', multiSelect: true },
];

function getLocalFallbackQuestion(
  answerCount: number,
  isFollowUp: boolean,
  translate: (key: string, options?: Record<string, unknown>) => unknown,
) {
  const bank = isFollowUp ? LOCAL_FALLBACK_FOLLOWUP : LOCAL_FALLBACK_INITIAL;

  if (answerCount < bank.length) {
    const q = bank[answerCount];
    return {
      isDone: false,
      step: q.step,
      question: String(translate(q.questionKey)),
      options: translate(q.optionsKey, { returnObjects: true }) as string[],
      multiSelect: q.multiSelect,
      _fallback: true,
    };
  }

  // All exhausted → done
  return {
    isDone: true,
    summary: String(translate('checkinFallbackSummary')),
    severity: 'medium' as const,
    recommendation: String(translate('checkinFallbackRecommendation')),
    needsDoctor: false,
    _fallback: true,
  };
}

// ─── Status options ────────────────────────────────────────────────────────────

// ─── Main component ────────────────────────────────────────────────────────────

type Screen = 'status' | 'location' | 'triage' | 'done';

const createResultPreviewSession = (question: string, symptoms: string): CheckinSession => {
  const now = new Date().toISOString();
  return {
    id: -1,
    user_id: -1,
    session_date: now.slice(0, 10),
    initial_status: 'tired',
    current_status: 'tired',
    flow_state: 'monitoring',
    triage_messages: [{ question, answer: symptoms }],
    triage_summary: symptoms,
    triage_severity: 'medium',
    triage_completed_at: now,
    next_checkin_at: null,
    no_response_count: 0,
    family_alerted: false,
    emergency_triggered: false,
    resolved_at: null,
    created_at: now,
  };
};

// T2 Body Location options — match backend body-location.js BODY_LOCATIONS enum
type BodyLocation = 'head' | 'chest' | 'abdomen' | 'limbs' | 'skin' | 'whole_body' | 'mental';

// MaterialCommunityIcons vector — outline style, không có background filled.
// Mỗi icon match ngữ nghĩa vùng cơ thể.
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const BODY_LOCATION_OPTIONS: Array<{ key: BodyLocation; icon: MciName; labelKey: string; descKey: string }> = [
  { key: 'head', icon: 'head-outline', labelKey: 'checkinLocationHead', descKey: 'checkinLocationHeadDesc' },
  { key: 'chest', icon: 'heart-pulse', labelKey: 'checkinLocationChest', descKey: 'checkinLocationChestDesc' },
  { key: 'abdomen', icon: 'stomach', labelKey: 'checkinLocationAbdomen', descKey: 'checkinLocationAbdomenDesc' },
  { key: 'limbs', icon: 'arm-flex-outline', labelKey: 'checkinLocationLimbs', descKey: 'checkinLocationLimbsDesc' },
  { key: 'skin', icon: 'hand-back-right-outline', labelKey: 'checkinLocationSkin', descKey: 'checkinLocationSkinDesc' },
  { key: 'whole_body', icon: 'human', labelKey: 'checkinLocationWholeBody', descKey: 'checkinLocationWholeBodyDesc' },
  { key: 'mental', icon: 'brain', labelKey: 'checkinLocationMental', descKey: 'checkinLocationMentalDesc' },
];

export default function CheckinRoute() {
  const params = useLocalSearchParams<{ mode?: string; checkin_id?: string; guide?: string }>();
  return <CheckinScreen key={`${params.mode || 'daily'}:${params.checkin_id || ''}:${params.guide || ''}`} />;
}

function CheckinScreen() {
  const reviewGuidance = useReviewGuidance('checkin');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const { t: tg } = useTranslation('onboarding');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const userId = useAuthStore((state) => state.profile?.id);
  const guidanceReady = useGuidanceStore(state => state.ready);
  const { language } = useLanguageStore();
  const params = useLocalSearchParams<{
    checkin_id?: string;
    mode?: string;
    preset_status?: string;
    guide?: string;
    guide_followup?: string;
  }>();
  const isPractice = params.mode === 'guide';
  const practiceRunKey = useRef(`checkin-practice:${Date.now()}:${Math.random()}`).current;
  const checkinClient = useMemo(() => isPractice ? createCheckinPractice(t) : checkinApi, [isPractice, t]);
  const [practiceFollowup, setPracticeFollowup] = useState(params.guide_followup === '1');
  const [practiceRevision, setPracticeRevision] = useState(0);
  const isFollowUp = isPractice ? practiceFollowup : params.mode === 'followup';
  const isRandom = params.mode === 'random';
  const isResultPreview = params.mode === 'result_preview';
  const existingCheckinId = isPractice ? (practiceFollowup ? -1 : null)
    : params.checkin_id ? parseInt(params.checkin_id) : null;
  const presetStatus = params.preset_status as CheckinStatus | undefined;

  const [screen, setScreen] = useState<Screen>(isResultPreview ? 'done' : 'status');
  const [loading, setLoading] = useState(
    !isPractice && !isResultPreview && !isFollowUp && !existingCheckinId && !isRandom,
  );
  const [session, setSession] = useState<CheckinSession | null>(() =>
    isResultPreview
      ? createResultPreviewSession(
          String(t('checkinResultPreviewQuestion')),
          String(t('checkinResultPreviewSymptoms')),
        )
      : null,
  );

  useEffect(() => {
    if (!isPractice || !guidanceReady) return;
    const guidance = useGuidanceStore.getState();
    if (guidance.account === String(userId) && !guidance.progress.completed.includes('checkin.practice')) {
      // Remember the first visit even if Back closes the guide before its end.
      // Only tour metadata is saved, never example answers or health results.
      guidance.update({ completed: ['checkin.practice'] });
    }
  }, [guidanceReady, isPractice, userId]);

  // Auto-detect: đã check-in hôm nay chưa? Nếu rồi → redirect đúng mode
  // Random mode: bỏ qua check, luôn cho check-in
  useEffect(() => {
    if (isPractice || isResultPreview || isFollowUp || existingCheckinId || isRandom) { setLoading(false); return; }
    let mounted = true;
    checkinClient.getToday()
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
  }, [checkinClient, existingCheckinId, isFollowUp, isPractice, isRandom, isResultPreview, router]);

  useEffect(() => {
    if (screen !== 'done' || isPractice || isResultPreview || !session || session.id <= 0) return;
    const guidance = useGuidanceStore.getState();
    if (guidance.account === String(userId) && !guidance.progress.firstCheckin) {
      guidance.update({ firstCheckin: true });
    }
  }, [guidanceReady, isPractice, isResultPreview, screen, session, userId]);

  // Auto-start nếu có preset_status từ FAB
  const presetHandled = useRef(false);
  useEffect(() => {
    if (!presetStatus || presetHandled.current || loading) return;
    presetHandled.current = true;
    handleStatusSelect(presetStatus);
  }, [presetStatus, loading]);

  // Triage state
  const [answers, setAnswers] = useState<TriageAnswer[]>(() =>
    isResultPreview
      ? [
          {
            question: String(t('checkinResultPreviewQuestion')),
            answer: String(t('checkinResultPreviewSymptoms')),
          },
        ]
      : [],
  );
  const [currentQ, setCurrentQ]    = useState<string>('');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [currentOpts, setCurrentOpts] = useState<string[]>([]);
  const [currentOptsGrouped, setCurrentOptsGrouped] = useState<TriageOptionGroup[] | null>(null);
  const [currentMultiSelect, setCurrentMultiSelect] = useState(true);
  const [currentAllowFreeText, setCurrentAllowFreeText] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');
  const mainScrollRef = useRef<ScrollView>(null);
  const guideScrollOffset = useRef(0);
  const [triageSummary, setTriageSummary] = useState<TriageSummaryView | null>(() =>
    isResultPreview
      ? {
          summary: String(t('checkinResultPreviewSymptoms')),
          severity: 'medium',
          recommendation: String(t('checkinMonitorAdvice')),
          needsDoctor: false,
        }
      : null,
  );
  // Track user scroll position để chỉ auto scrollToEnd khi user đang ở bottom
  // (vd: tin AI mới về). KHÔNG đẩy xuống nếu user đang đọc options ở giữa list.
  const userAtBottomRef = useRef(true);
  const lastQuestionIdRef = useRef<string>('');
  const handleMainScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    guideScrollOffset.current = contentOffset.y;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    userAtBottomRef.current = distanceFromBottom < 80;
  };

  // Illusion layer state
  const [currentEmpathy, setCurrentEmpathy] = useState<{ text: string; templateId: string } | null>(null);
  const [currentContinuity, setCurrentContinuity] = useState<{ text: string; templateId: string } | null>(null);
  const [currentGreeting, setCurrentGreeting] = useState<{ displayText: string; templateId: string } | null>(null);
  const [showAiConsent, setShowAiConsent] = useState(false);
  const pendingAiActionRef = useRef<null | (() => void | Promise<void>)>(null);
  const requestAiConsent = useCallback(async (
    resumeAfterConsent?: () => void | Promise<void>,
  ): Promise<boolean> => {
    if (isPractice) return true; // No health details, audio or examples leave the device.
    if (await hasAiDataConsent()) return true;
    pendingAiActionRef.current = resumeAfterConsent || null;
    setShowAiConsent(true);
    return false;
  }, [isPractice]);

  const handleAiConsentAgree = useCallback(() => {
    setShowAiConsent(false);
    const pendingAction = pendingAiActionRef.current;
    pendingAiActionRef.current = null;
    if (pendingAction) {
      Promise.resolve(pendingAction()).catch(() => {});
    }
  }, []);

  const handleAiConsentDecline = useCallback(() => {
    pendingAiActionRef.current = null;
    setShowAiConsent(false);
  }, []);

  // ─── Status select ─────────────────────────────────────────────────────────

  // T1 status pick — không INSERT DB ngay, chỉ giữ pending để T2 location quyết
  // định body_location trước khi commit. Trừ trường hợp 'fine' (skip T2) hoặc
  // followup (đã có session).
  const [pendingStatus, setPendingStatus] = useState<CheckinStatus | null>(null);

  const handleStatusSelect = useCallback(async (status: CheckinStatus) => {
    // Followup: vẫn flow cũ (đã có session)
    if (isFollowUp && existingCheckinId) {
      if (
        status !== 'fine' &&
        !(await requestAiConsent(() => handleStatusSelect(status)))
      ) return;
      setLoading(true);
      try {
        const res = await checkinClient.followUp(existingCheckinId, status);
        setSession(res.session);
        if (status === 'fine') {
          setScreen('done');
          showToast(isPractice ? tg('guidance.practiceSaved') : t('checkinSaved'), 'success');
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

    // "Tôi ổn" completes immediately without sending health details to AI.
    if (status === 'fine') {
      setLoading(true);
      try {
        const res = await checkinClient.start(status, null, null, isRandom);
        setSession(res.session);
        setScreen('done');
        showToast(isPractice ? tg('guidance.practiceSaved') : t('checkinSaved'), 'success');
        setLoading(false);
      } catch (err: any) {
        if (__DEV__) console.warn('[Checkin] handleStatusSelect fine:', err?.message || err);
        showAlert(t('error', { ns: 'common' }), t('checkinError'));
        setLoading(false);
      }
      return;
    }

    // A specific concern starts with the symptom question. Requiring a body
    // location first made the path longer and did not fit concerns such as
    // dizziness, fatigue or a general change in condition.
    if (status === 'specific_concern') {
      if (!(await requestAiConsent(() => handleStatusSelect(status)))) return;
      setLoading(true);
      try {
        const res = await checkinClient.start(status, null, null, isRandom);
        setSession(res.session);
        setScreen('triage');
        await fetchNextQuestion(res.session, [], true);
      } catch (err: any) {
        if (__DEV__) console.warn('[Checkin] handleStatusSelect concern:', err?.message || err);
        showAlert(t('error', { ns: 'common' }), t('checkinError'));
        setLoading(false);
      }
      return;
    }

    // "Hơi mệt" / "Rất mệt" keep the body-location shortcut.
    setPendingStatus(status);
    setScreen('location');
  }, [checkinClient, isPractice, isFollowUp, existingCheckinId, requestAiConsent]);

  const handleLocationsConfirm = useCallback(async (locs: BodyLocation[], other: string) => {
    if (!pendingStatus) return;
    if (locs.length === 0 && !other.trim()) {
      showAlert(t('error', { ns: 'common' }), t('checkinLocationRequired'));
      return;
    }
    if (!(await requestAiConsent(() => handleLocationsConfirm(locs, other)))) return;
    setLoading(true);
    try {
      const res = await checkinClient.start(
        pendingStatus,
        locs,
        other.trim() || null,
        isRandom,
      );
      setSession(res.session);
      setScreen('triage');
      await fetchNextQuestion(res.session, [], true);
    } catch (err: any) {
      if (__DEV__) console.warn('[Checkin] handleLocationsConfirm:', err?.message || err);
      showAlert(t('error', { ns: 'common' }), t('checkinError'));
      setLoading(false);
    }
  }, [checkinClient, pendingStatus, language, requestAiConsent]);

  // ─── Triage ────────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: TriageAnswer[], skipLoadingStart = false) => {
    if (!(await requestAiConsent(() => fetchNextQuestion(sess, prevAnswers, skipLoadingStart)))) {
      setLoading(false);
      return;
    }
    if (!skipLoadingStart) setLoading(true);
    try {
      const result = await checkinClient.triage(sess.id, prevAnswers);
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
          caregiver_status: result.caregiver_status,
          needs_caregiver_cta: result.needs_caregiver_cta,
          show_urgent_caregiver_warning: result.show_urgent_caregiver_warning,
        });
        setScreen('done');
      } else {
        // Illusion layer fields
        setCurrentEmpathy(result._empathy || null);
        setCurrentContinuity(result._continuity || null);
        setCurrentGreeting(result._greeting || null);
        const newQ = result.question || '';
        setCurrentStep(result.step || `legacy_${prevAnswers.length + 1}`);
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
      const fallback = getLocalFallbackQuestion(prevAnswers.length, isFollowUp, t);
      if (fallback.isDone) {
        const retryAnswers = prevAnswers.slice(0, -1);
        const retryFallback = getLocalFallbackQuestion(retryAnswers.length, isFollowUp, t);
        setAnswers(retryAnswers);
        if (!retryFallback.isDone) {
          setCurrentStep(retryFallback.step || `fallback_${retryAnswers.length + 1}`);
          setCurrentQ(retryFallback.question || '');
          setCurrentOpts(retryFallback.options || []);
          setCurrentOptsGrouped(null);
          setCurrentMultiSelect(retryFallback.multiSelect ?? false);
        }
        showAlert(t('error', { ns: 'common' }), t('checkinSyncError'));
      } else {
        setCurrentStep(fallback.step || `fallback_${prevAnswers.length + 1}`);
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
    const trimmedAnswer = answer.trim();

    // Evening wrap-up: if this was the evening question for "fine" flow
    const eveningGoodAnswers = [t('checkinEveningGreat'), t('checkinEveningOk')];
    const eveningBadAnswers = [t('checkinEveningTired'), t('checkinEveningBad')];
    const isEveningGood = currentQ === t('checkinEveningQuestion') && eveningGoodAnswers.includes(trimmedAnswer);
    if (
      !isEveningGood &&
      !(await requestAiConsent(() => handleAnswer(trimmedAnswer)))
    ) return;

    const newAnswers = [
      ...answers,
      { step: currentStep || undefined, question: currentQ, answer: trimmedAnswer },
    ];
    setAnswers(newAnswers);

    if (currentQ === t('checkinEveningQuestion')) {
      if (isEveningGood) {
        // Good evening → done
        setTriageSummary({
          summary: trimmedAnswer,
          severity: 'low',
          recommendation: t('checkinDoneFineSub'),
          needsDoctor: false,
        });
        setScreen('done');
        return;
      }
      if (eveningBadAnswers.includes(trimmedAnswer)) {
        // Not good evening → start real triage
        await fetchNextQuestion(session, newAnswers);
        return;
      }
    }

    // Backend enforces the question limit and returns the persisted severity.
    // Always await it so an emergency in the final answer cannot be shown as medium.
    await fetchNextQuestion(session, newAnswers);
  };

  // ─── Render screens ────────────────────────────────────────────────────────
  const repeatPractice = (followup = false) => {
    void guidanceAudio.stop();
    setPracticeRevision(value => value + 1);
    setPracticeFollowup(followup); setSession(null); setAnswers([]); setTriageSummary(null);
    setPendingStatus(null); setScreen('status'); setLoading(false);
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const closeCheckin = () => {
    void guidanceAudio.stop();
    if (isPractice && screen === 'done') useGuidanceStore.getState().acknowledge('checkin.finished');
    if (!isPractice && !isResultPreview && screen === 'done' && session && session.id > 0) {
      offerCheckinGiftOnHome(userId, session.id, session.gift?.id);
      router.replace('/(tabs)/home');
      return;
    }
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/home');
  };

  if (loading && screen === 'status') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GuidePracticeScope runKey={`${practiceRunKey}:${params.guide || ''}:${practiceRevision}`} enabled={isPractice}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: '#f3fbf8',
        }}
      >
        <ScreenBackButton
          onPress={() => {
            if (screen === 'location') {
              setPendingStatus(null);
              setScreen('status');
            } else {
              router.back();
            }
          }}
        />
        {isPractice ? <GuideTarget step="checkin.practice" style={{ flex: 1, marginHorizontal: 12 }}>
          <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: guideColors.ink, textAlign: 'center' }}>
            {tg('guidance.practiceTitle')}
          </Text>
        </GuideTarget> : <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: '#0F172A',
            textAlign: 'center',
            flex: 1,
            marginHorizontal: 12,
          }}
          numberOfLines={1}
        >
          {isResultPreview
            ? t('checkinResultPreviewHeader')
            : isFollowUp
              ? t('checkinHeaderFollowUp')
              : screen === 'status'
                ? t('checkinSelectStatusTitle')
                : t('checkinHeaderTitle')}
        </Text>}
        <Pressable
          accessibilityLabel={t('checkinGuide.badge')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void reviewGuidance()}
          style={{
            alignItems: 'center',
            borderRadius: 20,
            height: 40,
            justifyContent: 'center',
            width: 40,
          }}
        >
          <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <AiDataConsentModal
        visible={showAiConsent}
        onAgree={handleAiConsentAgree}
        onDecline={handleAiConsentDecline}
      />
      <GuideScrollScope scrollRef={mainScrollRef} offset={guideScrollOffset}>
      <ScrollView
        ref={mainScrollRef}
        style={{ flex: 1, backgroundColor: '#f3fbf8' }}
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
        {screen === 'status' && <StatusScreen styles={styles} onSelect={handleStatusSelect} isFollowUp={isFollowUp} practice={isPractice} />}
        {screen === 'location' && (
          <LocationScreen
            styles={styles}
            onConfirm={handleLocationsConfirm}
            onBack={() => { setPendingStatus(null); setScreen('status'); }}
            loading={loading}
            onBeforeAi={requestAiConsent}
            practice={isPractice}
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
            onBeforeAi={requestAiConsent}
            practice={isPractice}
          />
        )}
        {screen === 'done' && (
          <DoneScreen
            styles={styles}
            session={session}
            triageSummary={triageSummary}
            isFollowUp={isFollowUp}
            answers={answers}
            onClose={closeCheckin}
            practice={isPractice}
            onRepeatPractice={repeatPractice}
          />
        )}
      </ScrollView>
      </GuideScrollScope>
    </GuidePracticeScope>
  );
}

// ─── Status screen ────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof createStyles>;

/** Renders the same UI as check-in without mounting its API/consent/guide controller. */
export function CheckinUiPreview({ id }: { id: CheckinUiPreviewId }) {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const styles = useMemo(() => createStyles(typography), [typography]);
  const ignore = () => {};
  const denyAi = async () => false;

  if (id === 'checkin-gift') {
    return <CheckinGiftModal visible readOnly onClose={ignore} onOpen={async () => { throw new Error('Read-only preview'); }} />;
  }

  if (id === 'checkin-status' || id === 'checkin-followup') {
    return <StatusScreen styles={styles} onSelect={ignore} isFollowUp={id === 'checkin-followup'} readOnly />;
  }
  if (id === 'checkin-location') {
    return <LocationScreen styles={styles} onConfirm={ignore} onBack={ignore} loading={false} onBeforeAi={denyAi} readOnly />;
  }
  if (['checkin-multiple', 'checkin-grouped', 'checkin-single', 'checkin-text', 'checkin-loading'].includes(id)) {
    if (id === 'checkin-loading') {
      return <ConclusionLoadingView styles={styles} />;
    }
    const single = id === 'checkin-single';
    const textOnly = id === 'checkin-text';
    const question = t(single ? 'checkinFallbackInitial3Question' : 'checkinFallbackInitial2Question');
    const options = t(single ? 'checkinFallbackInitial3Options' : 'checkinFallbackInitial2Options', { returnObjects: true }) as string[];
    return <TriageScreen
      styles={styles}
      question={question}
      options={textOnly ? [] : options}
      optionsGrouped={id === 'checkin-grouped' ? [{ key: 'head', label: t('checkinLocationHead'), icon: '', items: options }] : null}
      multiSelect={!single}
      allowFreeText={textOnly}
      answers={single ? [{ question: t('checkinResultPreviewQuestion'), answer: t('checkinResultPreviewSymptoms') }] : []}
      loading={false}
      onAnswer={ignore}
      onBeforeAi={denyAi}
      readOnly
    />;
  }

  const fine = id === 'checkin-result-fine' || id === 'checkin-result-followup';
  const noCaregiver = id === 'checkin-result-no-caregiver';
  const severity = id === 'checkin-result-emergency' ? 'emergency'
    : id === 'checkin-result-high' || noCaregiver ? 'high'
    : id === 'checkin-result-medium' ? 'medium' : 'low';
  const session = createResultPreviewSession(t('checkinResultPreviewQuestion'), t('checkinResultPreviewSymptoms'));
  if (fine) { session.initial_status = 'fine'; session.current_status = 'fine'; }
  return <DoneScreen
    styles={styles}
    session={session}
    triageSummary={fine ? null : {
      summary: t('checkinResultPreviewSymptoms'),
      severity,
      recommendation: t(severity === 'emergency' ? 'checkinEmergencyAdvice' : 'checkinMonitorAdvice'),
      needsDoctor: severity === 'high' || severity === 'emergency',
      familyAlertResult: severity === 'high' ? { attempted: true, caregiversNotified: noCaregiver ? 0 : 2 } : undefined,
      show_urgent_caregiver_warning: noCaregiver,
    }}
    isFollowUp={id === 'checkin-result-followup'}
    onClose={ignore}
    readOnly
  />;
}

function StatusScreen({
  styles,
  onSelect,
  isFollowUp,
  practice = false,
  readOnly = false,
}: {
  styles: Styles;
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
  practice?: boolean;
  readOnly?: boolean;
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
    <View style={styles.statusSection}>
      {/* Decorative Upper Hero Section */}
      <View style={styles.heroDecorativeRow}>
        <Svg width={110} height={120} viewBox="0 0 110 120" fill="none" style={styles.heroTopLeftBranch} pointerEvents="none">
          <Path
            d="M-10 120 C20 100 35 60 30 10"
            stroke="#a4e8df"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Path
            d="M30 10 C32 26 20 38 12 34 C6 30 16 16 30 10 Z"
            fill="#cdeee7"
            opacity={0.5}
          />
          <Path
            d="M26 45 C42 42 46 56 36 62 C28 66 22 52 26 45 Z"
            fill="#6ddcd0"
            opacity={0.4}
          />
          <Path
            d="M16 80 C30 76 36 90 26 96 C18 100 12 88 16 80 Z"
            fill="#b2ebe3"
            opacity={0.45}
          />
        </Svg>

        {/* Left cursive slogan */}
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.heroSideWrapLeft}>
          <Text style={styles.heroSideText}>{t('checkinHeroSloganLeft')}</Text>
        </Animated.View>

        {/* Center circular heart ECG badge */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroCenterBadgeWrap}>
          <Svg width={112} height={104} viewBox="0 0 112 104" fill="none" style={styles.heroCenterBadgeDecor} pointerEvents="none">
            {/* Floating primary crosses */}
            <Path d="M12 28H17V23H19V28H24V30H19V35H17V30H12V28Z" fill="#08b8a2" opacity={0.65} />
            <Path d="M92 34H97V29H99V34H104V36H99V41H97V36H92V34Z" fill="#08b8a2" opacity={0.65} />
            {/* Soft glowing primaryLight aura circle */}
            <Path d="M56 10 A42 42 0 1 0 56 94 A42 42 0 1 0 56 10 Z" fill="#e6faf8" opacity={0.95} />
            {/* Delicate leaves on bottom-left and bottom-right of badge */}
            <Path d="M26 64C22 58 24 50 30 48C32 54 30 62 26 64Z" fill="#6ddcd0" opacity={0.75} />
            <Path d="M22 70C18 66 19 60 24 59C26 64 24 69 22 70Z" fill="#08b8a2" opacity={0.6} />
            <Path d="M86 64C90 58 88 50 82 48C80 54 82 62 86 64Z" fill="#6ddcd0" opacity={0.75} />
            <Path d="M90 70C94 66 93 60 88 59C86 64 88 69 90 70Z" fill="#08b8a2" opacity={0.6} />
          </Svg>
          {/* Center app brand heart with white ECG line */}
          <View style={styles.heroCenterHeartBadge}>
            <Svg width={54} height={48} viewBox="0 0 54 48" fill="none">
              <Path
                d="M27 45C27 45 4 30 4 14C4 6.5 10 1 18 1C22.5 1 25.5 3.5 27 6C28.5 3.5 31.5 1 36 1C44 1 50 6.5 50 14C50 30 27 45 27 45Z"
                fill="#08b8a2"
              />
              <Path
                d="M7 23H17L21 14L26 34L31 16L34 25L37 23H47"
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Animated.View>

        {/* Right cursive slogan */}
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.heroSideWrapRight}>
          <Text style={styles.heroSideText}>{t('checkinHeroSloganRight')}</Text>
        </Animated.View>
      </View>

      {/* Greeting & Subheading */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.heroHeadingWrap}>
        <Text style={styles.heroHeading}>{!practice && !isFollowUp ? t('checkinGift.question') : getGreeting()}</Text>
        <Text style={styles.heroSubheading}>{t('checkinSubheading')}</Text>
        <View style={styles.heroIndicatorPill} />
      </Animated.View>

      {/* 3 Status Cards */}
      <GuideTarget step="checkin.status" style={styles.optionList} enabled={practice}>
        {CHECKIN_STATUS_CHOICES.map((choice, idx) => (
          <Animated.View key={choice.status} entering={FadeInDown.delay(200 + idx * 80).duration(400)}>
            <CheckinStatusChoice choice={practice ? choice : { ...choice, labelKey: `checkinGift.status_${choice.status}` }} onSelect={readOnly ? undefined : onSelect} />
          </Animated.View>
        ))}
      </GuideTarget>

      {/* Bottom Footer Section */}
      {!practice && <Text style={{ fontSize: 18, lineHeight: 27, textAlign: 'center', color: colors.textSecondary }}>{t('checkinGift.afterCheckin')}</Text>}
      <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.footerBrandWrap}>
        <View style={styles.footerBrandLeft}>
          <Text style={styles.footerBrandWord}>{t('checkinFooterBrand1')}</Text>
          <Text style={styles.footerBrandWord}>{t('checkinFooterBrand2')}</Text>
          <Text style={styles.footerBrandWord}>{t('checkinFooterBrand3')}</Text>
          <View style={styles.footerBrandUnderline} />
        </View>

        <View style={styles.footerBrandRight}>
          <Svg width={110} height={36} viewBox="0 0 110 36" fill="none">
            <Path
              d="M26 30 C15 22 10 16 10 10 C10 4.5 14.5 1 20 1 C23.5 1 26.5 3 28 5.5 C29.5 3 32.5 1 36 1 C41.5 1 46 4.5 46 10 C46 16 41 22 30 30 Z"
              stroke="#08b8a2"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M45 20 H56 L61 9 L66 29 L71 13 L75 24 L78 20 H106"
              stroke="#08b8a2"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.footerBrandTagline}>{t('checkinFooterTagline')}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── T2 Location screen ──────────────────────────────────────────────────────

function LocationScreen({
  styles,
  onConfirm,
  onBack,
  loading,
  onBeforeAi,
  practice = false,
  readOnly = false,
}: {
  styles: Styles;
  onConfirm: (locs: BodyLocation[], other: string) => void;
  onBack: () => void;
  loading: boolean;
  onBeforeAi: () => Promise<boolean>;
  practice?: boolean;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('home');
  const { t: tg } = useTranslation('onboarding');
  const acknowledgeGuide = useGuideAcknowledgement();
  const [selected, setSelected] = useState<Set<BodyLocation>>(
    readOnly ? new Set([BODY_LOCATION_OPTIONS[0].key]) : new Set()
  );
  const [other, setOther] = useState('');

  const toggle = (key: BodyLocation) => {
    if (readOnly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const count = selected.size + (other.trim() ? 1 : 0);
  const canConfirm = count > 0 && !loading;
  const confirmLabel = count > 0
    ? t('checkinLocationContinueCount', { count })
    : t('checkinLocationContinue');

  return (
    <View style={styles.section}>
      {/* Top progress bar & step counter */}
      <View style={styles.triageProgressRow}>
        <View style={styles.triageProgressTrack}>
          <View style={[styles.triageProgressFill, { width: '20%' }]} />
        </View>
        <Text style={styles.triageProgressText}>1/5</Text>
      </View>

      {/* Companion Mascot sticker + Speech bubble */}
      <Animated.View entering={FadeInLeft.duration(350)} style={styles.mascotRow}>
        <Image
          source={asinuChatSticker}
          style={styles.mascotSticker}
          resizeMode="contain"
        />
        <View style={styles.mascotBubble}>
          <Text style={styles.mascotBubbleText}>
            {t('checkinLocationMascotBubble')}
          </Text>
        </View>
      </Animated.View>

      {/* Question section: Pulse icon + Title + Subtitle */}
      <Animated.View entering={FadeInLeft.duration(400)} style={styles.questionSection}>
        <View style={styles.questionHeaderRow}>
          <MaterialCommunityIcons name="pulse" size={26} color="#08b8a2" style={styles.questionPulseIcon} />
          <Text allowFontScaling style={[styles.questionHeaderTitle, practice && { fontSize: 22, lineHeight: 30 }]}>
            {t('checkinLocationTitle')}
          </Text>
        </View>
        <Text style={styles.questionSubtitle}>
          {t('checkinLocationDescription')}
        </Text>
      </Animated.View>

      {/* Body location options */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.triageOptionsList}>
        {BODY_LOCATION_OPTIONS.map((opt, optionIndex) => {
          const isSelected = selected.has(opt.key);
          return (
            <GuideTarget key={opt.key} step="checkin.location" enabled={practice && optionIndex === 0 && !loading}>
              <Pressable
                key={opt.key}
                onPress={() => !loading && toggle(opt.key)}
                disabled={loading || readOnly}
                style={({ pressed }) => [
                  styles.triageOptionCard,
                  isSelected && styles.triageOptionCardSelected,
                  (pressed || loading) && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.triageCheckbox, isSelected && styles.triageCheckboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                </View>
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={24}
                  color={isSelected ? '#08b8a2' : '#64748b'}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text allowFontScaling style={[styles.triageOptionTitle, isSelected && styles.triageOptionTitleSelected]}>
                    {t(opt.labelKey)}
                  </Text>
                  <Text style={styles.triageOptionSubtitle}>
                    {t(opt.descKey)}
                  </Text>
                </View>
              </Pressable>
            </GuideTarget>
          );
        })}
      </Animated.View>

      {/* Free-text "Khác" / voice input */}
      <GuideTarget step="checkin.location_other" enabled={practice && !loading}>
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          {practice ? (
            <Text allowFontScaling style={{ color: colors.textPrimary, marginBottom: spacing.xs, fontSize: 18, fontWeight: '700' }}>
              {tg('guidance.otherAnswer')}
            </Text>
          ) : null}
          <View style={styles.triageInputCard}>
            <GuideTarget step="checkin.voice" enabled={practice && !loading} acknowledgeOnTouch={false}>
              <VoiceAnswerButton
                onText={text => { setOther(previous => `${previous} ${text}`.trim()); acknowledgeGuide('checkin.voice'); }}
                onBeforeAi={onBeforeAi}
                disabled={loading || readOnly}
                practice={practice}
              />
            </GuideTarget>
            <TextInput
              allowFontScaling
              value={other}
              onChangeText={readOnly ? undefined : setOther}
              placeholder={t('checkinLocationOtherPlaceholder')}
              placeholderTextColor="#94a3b8"
              editable={!loading && !readOnly}
              maxLength={200}
              style={[styles.triageTextInput, practice && { fontSize: 20 }]}
            />
          </View>
        </Animated.View>
      </GuideTarget>

      {/* Action / Continue button */}
      <GuideTarget step="checkin.location_confirm" enabled={practice && canConfirm}>
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Pressable
            onPress={() => { if (!readOnly) onConfirm(Array.from(selected), other); }}
            disabled={!canConfirm || readOnly}
            style={({ pressed }) => [
              styles.triagePillBtn,
              !canConfirm && styles.triagePillBtnDisabled,
              pressed && canConfirm && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text allowFontScaling style={[styles.triagePillBtnText, !canConfirm && styles.triagePillBtnTextDisabled, practice && { fontSize: 20 }]}>
              {confirmLabel}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={canConfirm ? '#ffffff' : '#94a3b8'}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </Animated.View>
      </GuideTarget>

      {/* Bottom watermark decoration */}
      <View style={styles.bottomWatermarkWrap} pointerEvents="none">
        <Svg width={200} height={160} viewBox="0 0 200 160" fill="none">
          <Path d="M0 110 C60 75 120 95 200 55 L200 160 L0 160 Z" fill="#e6faf8" opacity={0.5} />
          <Path d="M25 130 C85 100 145 115 200 95 L200 160 L25 160 Z" fill="#d8f6f1" opacity={0.4} />
          <Path d="M165 95 H177 V83 C177 81 178.8 79.5 181 79.5 C183.2 79.5 185 81 185 83 V95 H197 C199 95 200.5 96.8 200.5 99 C200.5 101.2 199 103 197 103 H185 V115 C185 117 183.2 118.5 181 118.5 C178.8 118.5 177 117 177 115 V103 H165 C163 103 161.5 101.2 161.5 99 C161.5 96.8 163 95 165 95 Z" fill="#08b8a2" opacity={0.2} />
          <Path d="M173 124 C160 129 157 142 163 152 C174 150 182 138 173 124 Z" fill="#08b8a2" opacity={0.2} />
          <Path d="M185 120 C192 128 194 144 186 151 C177 146 177 133 185 120 Z" fill="#08b8a2" opacity={0.16} />
        </Svg>
      </View>
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
  onBeforeAi,
  empathy,
  continuity,
  greeting,
  practice = false,
  readOnly = false,
}: {
  styles: Styles;
  question: string;
  options: string[];
  optionsGrouped?: TriageOptionGroup[] | null;
  multiSelect: boolean;
  allowFreeText?: boolean;
  answers: TriageAnswer[];
  loading: boolean;
  onAnswer: (a: string) => void;
  onBeforeAi: () => Promise<boolean>;
  empathy?: { text: string; templateId: string } | null;
  continuity?: { text: string; templateId: string } | null;
  greeting?: { displayText: string; templateId: string } | null;
  practice?: boolean;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('home');
  const { t: tg } = useTranslation('onboarding');
  const acknowledgeGuide = useGuideAcknowledgement();
  const [custom, setCustom] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    readOnly && !multiSelect && options.length > 0 ? new Set([options[0]]) : new Set()
  );
  const scrollRef = useRef<ScrollView>(null);

  // Voice recording
  const { language } = useLanguageStore();
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

  const handleMicPress = async () => {
    if (readOnly) return;
    await guidanceAudio.stop();
    if (practice) {
      if (isRecording) {
        setIsRecording(false);
        setCustom(tg('guidance.practiceVoiceExample'));
        acknowledgeGuide('checkin.voice');
        showToast(tg('guidance.practiceVoiceNotice'), 'info');
      } else {
        setIsRecording(true);
      }
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
        if (!(await onBeforeAi())) return;
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
        if (!(await onBeforeAi())) return;
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
    if (readOnly) return;
    if (multiSelect) {
      // Multi-select: toggle selection
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
    if (readOnly) return;
    const parts: string[] = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    if (parts.length === 0) return;
    const combined = parts.join(', ');
    onAnswer(combined);
    setSelected(new Set());
    setCustom('');
  };

  const hasSelection = selected.size > 0 || custom.trim().length > 0;
  const firstOptionGroupIndex = optionsGrouped?.findIndex(group => group.items.length > 0) ?? -1;
  const hasAnswerChoices = firstOptionGroupIndex >= 0 || options.length > 0;

  const bubbleMessage =
    continuity?.text ||
    (greeting && answers.length === 0 ? greeting.displayText : null) ||
    (empathy && answers.length > 0 ? empathy.text : null) ||
    t('checkinTriageMascotBubble');

  const confirmLabel = selected.size > 0 && multiSelect
    ? `${t('checkinLocationContinue')} (${selected.size})`
    : t('checkinLocationContinue');

  return (
    <View style={styles.section}>
      {/* Slim progress bar & step counter */}
      <View style={styles.triageProgressRow}>
        <View style={styles.triageProgressTrack}>
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[styles.triageProgressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
          />
        </View>
        <Text style={styles.triageProgressText}>
          {`${Math.min(answers.length + 1, MAX_TRIAGE_QUESTIONS)}/${MAX_TRIAGE_QUESTIONS}`}
        </Text>
      </View>

      {/* Answered history if any */}
      {answers.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          {answers.map((a, i) => (
            <View key={i} style={styles.historyAnswerRow}>
              <View style={styles.historyQuestionTag}>
                <Text style={styles.historyQuestionText}>{a.question}</Text>
              </View>
              <View style={styles.historyAnswerCard}>
                <Ionicons name="checkmark-circle" size={14} color="#08b8a2" />
                <Text style={styles.historyAnswerText}>{a.answer}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <Animated.View entering={FadeInLeft.duration(300)} style={styles.mascotRow}>
          <Image source={asinuChatSticker} style={styles.mascotSticker} resizeMode="contain" />
          <View style={styles.mascotBubble}>
            <View style={styles.typingRow}>
              <View style={[styles.typingDot, { opacity: 0.8 }]} />
              <View style={[styles.typingDot, { opacity: 0.5 }]} />
              <View style={[styles.typingDot, { opacity: 0.3 }]} />
            </View>
          </View>
        </Animated.View>
      ) : (
        <>
          {/* Companion Mascot sticker + Speech bubble */}
          <Animated.View entering={FadeInLeft.duration(350)} style={styles.mascotRow}>
            <Image
              source={asinuChatSticker}
              style={styles.mascotSticker}
              resizeMode="contain"
            />
            <View style={styles.mascotBubble}>
              <Text style={styles.mascotBubbleText}>{bubbleMessage}</Text>
            </View>
          </Animated.View>

          {/* Current Question section: Pulse icon + Title + Subtitle */}
          <Animated.View entering={FadeInLeft.duration(400)} style={styles.questionSection}>
            <View style={styles.questionHeaderRow}>
              <MaterialCommunityIcons name="pulse" size={26} color="#08b8a2" style={styles.questionPulseIcon} />
              <Text allowFontScaling style={[styles.questionHeaderTitle, practice && { fontSize: 22, lineHeight: 30 }]}>
                {question}
              </Text>
            </View>
            <Text style={styles.questionSubtitle}>
              {multiSelect ? t('checkinSelectHint') : t('checkinSelectSingleHint')}
            </Text>
          </Animated.View>

          {/* Option cards */}
          {optionsGrouped && firstOptionGroupIndex >= 0 ? (
            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.triageOptionsList}>
              {optionsGrouped.map((group, groupIndex) => (
                <View key={group.key} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.groupHeaderRow}>
                    <Text style={styles.groupHeaderText}>{group.label}</Text>
                    <View style={styles.groupHeaderLine} />
                  </View>
                  {group.items.map((opt, optionIndex) => {
                    const isSelected = selected.has(opt);
                    return (
                      <GuideTarget key={`${group.key}-${opt}`} step="checkin.choices" enabled={practice && groupIndex === firstOptionGroupIndex && optionIndex === 0 && !loading}>
                        <GuideTarget step={multiSelect ? 'checkin.multiple' : 'checkin.single'} enabled={practice && groupIndex === firstOptionGroupIndex && optionIndex === 0 && !loading}>
                          <Pressable
                            key={`${group.key}-${opt}`}
                            style={({ pressed }) => [
                              styles.triageOptionCard,
                              isSelected && styles.triageOptionCardSelected,
                              (pressed || loading) && { opacity: 0.85 },
                            ]}
                            disabled={readOnly}
                            onPress={() => handleOptionTap(opt)}
                            accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                            accessibilityLabel={formatTriageOptionLabel(opt)}
                            accessibilityState={{ checked: isSelected, disabled: readOnly }}
                          >
                            {multiSelect ? (
                              <View style={[styles.triageCheckbox, isSelected && styles.triageCheckboxSelected]}>
                                {isSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                              </View>
                            ) : (
                              <View style={[styles.triageRadio, isSelected && styles.triageRadioSelected]}>
                                {isSelected && <View style={styles.triageRadioDot} />}
                              </View>
                            )}
                            <MaterialCommunityIcons name={getTriageOptionIcon(opt)} size={24} color={colors.primary} accessible={false} />
                            <Text allowFontScaling style={[styles.triageOptionTitle, isSelected && styles.triageOptionTitleSelected]}>
                              {formatTriageOptionLabel(opt)}
                            </Text>
                          </Pressable>
                        </GuideTarget>
                      </GuideTarget>
                    );
                  })}
                </View>
              ))}
            </Animated.View>
          ) : options.length > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.triageOptionsList}>
              {options.map((opt, optionIndex) => {
                const isSelected = selected.has(opt);
                return (
                  <GuideTarget key={opt} step="checkin.choices" enabled={practice && optionIndex === 0 && !loading}>
                    <GuideTarget step={multiSelect ? 'checkin.multiple' : 'checkin.single'} enabled={practice && optionIndex === 0 && !loading}>
                      <Pressable
                        key={opt}
                        style={({ pressed }) => [
                          styles.triageOptionCard,
                          isSelected && styles.triageOptionCardSelected,
                          (pressed || loading) && { opacity: 0.85 },
                        ]}
                        disabled={readOnly}
                        onPress={() => handleOptionTap(opt)}
                        accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                        accessibilityLabel={formatTriageOptionLabel(opt)}
                        accessibilityState={{ checked: isSelected, disabled: readOnly }}
                      >
                        {multiSelect ? (
                          <View style={[styles.triageCheckbox, isSelected && styles.triageCheckboxSelected]}>
                            {isSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                          </View>
                        ) : (
                          <View style={[styles.triageRadio, isSelected && styles.triageRadioSelected]}>
                            {isSelected && <View style={styles.triageRadioDot} />}
                          </View>
                        )}
                        <MaterialCommunityIcons name={getTriageOptionIcon(opt)} size={24} color={colors.primary} accessible={false} />
                        <Text allowFontScaling style={[styles.triageOptionTitle, isSelected && styles.triageOptionTitleSelected]}>
                          {formatTriageOptionLabel(opt)}
                        </Text>
                      </Pressable>
                    </GuideTarget>
                  </GuideTarget>
                );
              })}
            </Animated.View>
          )}

          {/* Custom text input + mic */}
          {(multiSelect || allowFreeText || options.length === 0) && (
            <GuideTarget step="checkin.other" enabled={practice && !loading} withoutChoices={!hasAnswerChoices}>
              <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.triageInputCard}>
                <GuideTarget step="checkin.voice" enabled={practice && !loading} acknowledgeOnTouch={false}>
                  {practice ? (
                    <VoiceAnswerButton
                      practice
                      onBeforeAi={onBeforeAi}
                      onText={text => { setCustom(text); acknowledgeGuide('checkin.voice'); }}
                    />
                  ) : (
                    <Pressable
                      onPress={handleMicPress}
                      style={styles.triageMicBtn}
                      disabled={isTranscribing || readOnly}
                    >
                      {isTranscribing ? (
                        <ActivityIndicator size="small" color="#08b8a2" />
                      ) : (
                        <MaterialCommunityIcons
                          name={isRecording ? 'stop-circle' : 'microphone'}
                          size={22}
                          color={isRecording ? colors.danger : '#08b8a2'}
                        />
                      )}
                    </Pressable>
                  )}
                </GuideTarget>
                <TextInput
                  allowFontScaling
                  style={[styles.triageTextInput, { fontSize: practice ? 20 : 15 }]}
                  placeholder={isTranscribing ? '...' : t('checkinCustomPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  value={custom}
                  onChangeText={readOnly ? undefined : setCustom}
                  returnKeyType="done"
                  editable={!isTranscribing && !readOnly}
                />
              </Animated.View>
            </GuideTarget>
          )}

          {/* Confirm / Continue button */}
          {(multiSelect || options.length === 0 || (allowFreeText && custom.trim().length > 0) || selected.size > 0 || (readOnly && !multiSelect)) && (
            <GuideTarget step="checkin.confirm" enabled={practice && hasSelection && !loading}>
              <Animated.View entering={FadeInDown.delay(220).duration(400)}>
                <Pressable
                  style={({ pressed }) => [
                    styles.triagePillBtn,
                    !hasSelection && styles.triagePillBtnDisabled,
                    pressed && hasSelection && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  disabled={!hasSelection || readOnly}
                  onPress={handleConfirm}
                >
                  <Text allowFontScaling style={[styles.triagePillBtnText, !hasSelection && styles.triagePillBtnTextDisabled, practice && { fontSize: 20 }]}>
                    {confirmLabel}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={hasSelection ? '#ffffff' : '#94a3b8'}
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>
              </Animated.View>
            </GuideTarget>
          )}

          {/* Bottom watermark decoration */}
          <View style={styles.bottomWatermarkWrap} pointerEvents="none">
            <Svg width={200} height={160} viewBox="0 0 200 160" fill="none">
              <Path d="M0 110 C60 75 120 95 200 55 L200 160 L0 160 Z" fill="#e6faf8" opacity={0.5} />
              <Path d="M25 130 C85 100 145 115 200 95 L200 160 L25 160 Z" fill="#d8f6f1" opacity={0.4} />
              <Path d="M165 95 H177 V83 C177 81 178.8 79.5 181 79.5 C183.2 79.5 185 81 185 83 V95 H197 C199 95 200.5 96.8 200.5 99 C200.5 101.2 199 103 197 103 H185 V115 C185 117 183.2 118.5 181 118.5 C178.8 118.5 177 117 177 115 V103 H165 C163 103 161.5 101.2 161.5 99 C161.5 96.8 163 95 165 95 Z" fill="#08b8a2" opacity={0.2} />
              <Path d="M173 124 C160 129 157 142 163 152 C174 150 182 138 173 124 Z" fill="#08b8a2" opacity={0.2} />
              <Path d="M185 120 C192 128 194 144 186 151 C177 146 177 133 185 120 Z" fill="#08b8a2" opacity={0.16} />
            </Svg>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Conclusion loading screen ──────────────────────────────────────────────

function ConclusionLoadingView({ styles }: { styles: Styles }) {
  const { t } = useTranslation('home');

  return (
    <View style={styles.loadingContainer}>
      {/* Center Aura & Mascot */}
      <View style={styles.loadingMascotWrap}>
        <View style={styles.loadingAuraCircle}>
          <Svg width={250} height={250} viewBox="0 0 250 250" fill="none" style={styles.loadingArcSvg} pointerEvents="none">
            {/* Guide circle track */}
            <Path
              d="M125 15 A110 110 0 1 1 124.9 15"
              stroke="#bce7df"
              strokeWidth={1.8}
              strokeDasharray="4 6"
              fill="none"
              opacity={0.45}
            />
            {/* Active circular progress arc */}
            <Path
              d="M125 15 A110 110 0 0 1 220 70"
              stroke="#08b8a2"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            {/* Glowing dot at the end of arc */}
            <Circle cx={220} cy={70} r={5.5} fill="#08b8a2" />
            <Circle cx={220} cy={70} r={2.5} fill="#ffffff" />
          </Svg>
          <Image
            source={asinuChatSticker}
            style={styles.loadingMascotImage}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Main Title & Subtitle */}
      <Text style={styles.loadingTitle}>{t('checkinSynthesizingTitle')}</Text>
      <Text style={styles.loadingSubtitle}>{t('checkinSynthesizingSubtitle')}</Text>

      {/* 3 Pulsing dots */}
      <View style={styles.loadingDotsRow}>
        <View style={[styles.loadingDot, { opacity: 1 }]} />
        <View style={[styles.loadingDot, { opacity: 0.65 }]} />
        <View style={[styles.loadingDot, { opacity: 0.35 }]} />
      </View>

      {/* Footer Tagline */}
      <View style={styles.loadingFooterRow}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
        <Text style={styles.loadingFooterText}>{t('checkinCompanionFooter')}</Text>
      </View>

      {/* Subtle bottom decorative wave */}
      <View style={styles.bottomWatermarkWrap} pointerEvents="none">
        <Svg width={220} height={160} viewBox="0 0 220 160" fill="none">
          <Path d="M0 120 C70 80 140 100 220 60 L220 160 L0 160 Z" fill="#e6faf8" opacity={0.5} />
          <Path d="M25 140 C95 105 160 125 220 100 L220 160 L25 160 Z" fill="#d8f6f1" opacity={0.4} />
        </Svg>
      </View>
    </View>
  );
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractRecordedSymptoms(
  session: CheckinSession | null,
  answers?: TriageAnswer[],
  isFine?: boolean,
  translate?: (key: string) => string,
): string {
  if (isFine) {
    return translate?.('checkinSymptomsStable') || '';
  }

  const foundSymptoms: string[] = [];

  if (answers && answers.length > 0) {
    for (const a of answers) {
      const q = (a.question || '').toLowerCase();
      if (
        q.includes('triệu chứng') ||
        q.includes('symptom') ||
        q.includes('khó chịu') ||
        q.includes('vấn đề')
      ) {
        const parts = (a.answer || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const lower = p.toLowerCase();
          if (
            !foundSymptoms.includes(p) &&
            !lower.includes('không có gì') &&
            !lower.includes('không rõ') &&
            !lower.includes('bình thường')
          ) {
            foundSymptoms.push(p);
          }
        }
      }
    }
  }

  if (foundSymptoms.length === 0 && session?.triage_messages) {
    for (const m of session.triage_messages) {
      const q = (m.question || '').toLowerCase();
      if (q.includes('triệu chứng') || q.includes('symptom') || q.includes('khó chịu')) {
        const parts = (m.answer || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const lower = p.toLowerCase();
          if (
            !foundSymptoms.includes(p) &&
            !lower.includes('không có gì') &&
            !lower.includes('không rõ')
          ) {
            foundSymptoms.push(p);
          }
        }
      }
    }
  }

  if (foundSymptoms.length > 0) {
    return stripEmojis(foundSymptoms.join(', '));
  }

  if (session?.current_status === 'tired') {
    return translate?.('checkinSymptomsTired') || '';
  }
  if (session?.current_status === 'very_tired') {
    return translate?.('checkinSymptomsUrgentFallback') || '';
  }

  return translate?.('checkinSymptomsUrgentFallback') || '';
}

function CheckinHeroBadge({
  severity,
  isFine,
}: {
  severity?: string;
  isFine: boolean;
}) {
  const isEmergency = severity === 'emergency';
  const isHigh = severity === 'high';
  const isMedium = severity === 'medium';

  const accentColor = isEmergency || isHigh
    ? '#DC2626'
    : isMedium
    ? '#D97706'
    : '#08b8a2';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 10 }}>
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        {isFine ? (
          <Ionicons name="checkmark-circle" size={52} color={accentColor} />
        ) : isEmergency || isHigh ? (
          <Ionicons name="warning" size={52} color={accentColor} />
        ) : (
          <Ionicons name="information-circle" size={52} color={accentColor} />
        )}
      </View>
    </View>
  );
}

function DoneScreen({
  styles,
  session,
  triageSummary,
  isFollowUp,
  answers,
  onClose,
  practice = false,
  readOnly = false,
  onRepeatPractice,
  forceLoading = false,
}: {
  styles: Styles;
  session: CheckinSession | null;
  triageSummary: TriageSummaryView | null;
  isFollowUp: boolean;
  answers?: TriageAnswer[];
  onClose: () => void;
  practice?: boolean;
  readOnly?: boolean;
  onRepeatPractice?: (followup?: boolean) => void;
  forceLoading?: boolean;
}) {
  const { t, i18n } = useTranslation('home');
  const { t: tg } = useTranslation('onboarding');
  const router = useRouter();
  const [practiceSeverity, setPracticeSeverity] = useState<'low' | 'medium' | 'high' | 'emergency' | null>(null);
  const conclusionSpeechPlayedRef = useRef(false);
  const [speechReplayKey, setSpeechReplayKey] = useState(0);
  const [audioReady, setAudioReady] = useState(practice || readOnly);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi';
  const { audio: conclusionAudio, play: playConclusionAudio, stopAudio: stopConclusionAudio } =
    useCheckinCallAudio(null, language, t, undefined, !readOnly);
  const isSpeakingConclusion = ['loading', 'playing'].includes(conclusionAudio.phase);
  const isFine = practice && practiceSeverity ? practiceSeverity === 'low'
    : session?.current_status === 'fine' || (!triageSummary && session?.initial_status === 'fine');

  const severity = practice && practiceSeverity ? practiceSeverity : triageSummary?.severity;
  const practiceText = practice ? { fontSize: 22, lineHeight: 32, color: guideColors.ink } : undefined;
  const isEmergency = severity === 'emergency';
  const isHigh = severity === 'high';
  const isMedium = severity === 'medium';

  // Severity configurations
  const pillBg = isEmergency
    ? '#FEE2E2'
    : isHigh
    ? '#FFEDD5'
    : isMedium
    ? '#FEF3C7'
    : '#F0FBF8';

  const pillColor = isEmergency
    ? '#DC2626'
    : isHigh
    ? '#EA580C'
    : isMedium
    ? '#D97706'
    : '#08b8a2';

  const pillText = isEmergency
    ? t('checkinStatusEmergency')
    : isHigh
    ? t('checkinStatusHigh')
    : isMedium
    ? t('checkinStatusMedium')
    : t('checkinStatusFine');

  const pillIcon = isEmergency
    ? 'warning'
    : isHigh
    ? 'alert-circle'
    : isMedium
    ? 'information-circle'
    : 'checkmark-circle';

  const handleCall115 = () => {
    if (readOnly) return;
    if (practice) { showToast(tg('guidance.practiceActionNotice'), 'info'); return; }
    Linking.openURL('tel:115').catch(() => {});
  };

  const recordedSymptoms = extractRecordedSymptoms(session, answers, isFine, t);

  const cleanAdvice = stripEmojis(
    isEmergency
      ? t('checkinEmergencyAdvice')
      : triageSummary?.recommendation
      ? triageSummary.recommendation
      : isFine
      ? (isFollowUp ? t('checkinDoneEveningSub') : t('checkinFineAdvice'))
      : t('checkinMonitorAdvice')
  );

  const cleanSubtitle = stripEmojis(
    isEmergency
      ? t('checkinEmergencySubtitle')
      : isHigh
      ? t('checkinHighSubtitle')
      : isMedium
      ? t('checkinMediumSubtitle')
      : t('checkinFineSubtitle')
  );

  const doctorNoticeText = stripEmojis(
    isEmergency || isHigh || triageSummary?.needsDoctor
      ? t('checkinSeeDoctor')
      : isFine
      ? t('checkinDoctorNoticeFine')
      : t('checkinDoctorNoticeDefault')
  );
  const cleanSummary = stripEmojis(triageSummary?.summary || '');
  const shouldReadSummary = cleanSummary && cleanSummary !== recordedSymptoms;

  const conclusionSpeechText = [
    t('checkinDoneNoted'),
    pillText,
    cleanSubtitle,
    shouldReadSummary ? `${t('checkinResultSummaryLabel')}: ${cleanSummary}` : '',
    `${t('checkinRecordedSymptoms')}: ${recordedSymptoms}`,
    `${t('checkinAdvice')}: ${cleanAdvice}`,
    doctorNoticeText,
  ]
    .map((part) => stripEmojis(String(part)).replace(/[.!?]+$/g, '').trim())
    .filter(Boolean)
    .join('. ') + '.';

  useEffect(() => {
    if (practice || readOnly) return; // The bundled coach recordings explain example results offline.
    if (conclusionSpeechPlayedRef.current || !conclusionSpeechText) {
      return;
    }
    conclusionSpeechPlayedRef.current = true;
    void playConclusionAudio('conclusion', conclusionSpeechText);

    return () => {
      void stopConclusionAudio();
    };
  }, [practice, readOnly, conclusionSpeechText, language, session?.id, speechReplayKey, playConclusionAudio, stopConclusionAudio]);

  useEffect(() => {
    if (practice || readOnly || audioReady) return;
    if (conclusionAudio.phase === 'playing' || conclusionAudio.phase === 'finished' || conclusionAudio.phase === 'error' || conclusionAudio.fallback) {
      setAudioReady(true);
      return;
    }
    const safetyTimer = setTimeout(() => {
      setAudioReady(true);
    }, 4500);
    return () => clearTimeout(safetyTimer);
  }, [practice, readOnly, audioReady, conclusionAudio.phase]);

  const replayConclusionSpeech = () => {
    if (readOnly) return;
    if (practice) { void guidanceAudio.speak('practice_result', language, true); return; }
    conclusionSpeechPlayedRef.current = false;
    setSpeechReplayKey((value) => value + 1);
  };

  if (forceLoading || (!audioReady && !practice && !readOnly)) {
    return <ConclusionLoadingView styles={styles} />;
  }

  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 11,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor: '#E2E8F0',
        }}
      >
        <Ionicons
          name={isSpeakingConclusion ? 'volume-high' : 'volume-high-outline'}
          size={21}
          color="#08b8a2"
        />
        <Text
          style={[{
            flex: 1,
            color: '#0F2942',
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '600',
          }, practiceText]}
        >
          {practice ? tg('guidance.practiceResultTitle') : t('checkinResultPreviewNotice')}
        </Text>
        <GuideTarget step="checkin.result_replay" enabled={practice}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkinReplaySound')}
          accessibilityState={{ busy: isSpeakingConclusion }}
          hitSlop={8}
          disabled={readOnly}
          onPress={replayConclusionSpeech}
          style={({ pressed }) => ({
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 22,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="refresh" size={21} color="#08b8a2" />
        </Pressable>
        </GuideTarget>
      </View>

      {conclusionAudio.phase === 'error' && (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
          {t('checkinSpeechUnavailable')}
        </Text>
      )}

      {/* Background watermark cross top right */}
      <View style={{ position: 'absolute', top: -16, right: -10 }} pointerEvents="none">
        <Svg width={76} height={76} viewBox="0 0 24 24">
          <Path
            d="M9 3 C9 2.45 9.45 2 10 2 L14 2 C14.55 2 15 2.45 15 3 L15 9 L21 9 C21.55 9 22 9.45 22 10 L22 14 C22 14.55 21.55 15 21 15 L15 15 L15 21 C15 21.55 14.55 22 14 22 L10 22 C9.45 22 9 21.55 9 21 L9 15 L3 15 C2.45 15 2 14.55 2 14 L2 10 C2 9.45 2.45 9 3 9 L9 9 Z"
            fill="#08b8a2"
            opacity={0.08}
          />
        </Svg>
      </View>

      {/* Hero Badge with radiating burst rays */}
      <Animated.View entering={FadeIn.duration(450)}>
        <CheckinHeroBadge severity={severity} isFine={isFine} />
      </Animated.View>

      {/* Title & Verdict Subtitle */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ alignItems: 'center', paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', letterSpacing: -0.3 }}>
          {practice ? tg('guidance.practiceResultTitle') : t('checkinDoneNoted')}
        </Text>
        <Text allowFontScaling style={[{ fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21, marginTop: 6, maxWidth: 330 }, practiceText]}>
          {cleanSubtitle}
        </Text>
      </Animated.View>

      {/* Main White Card matching mockup */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            gap: 16,
          }}
        >
          {/* Status Pill */}
          <GuideTarget step="checkin.result_status" enabled={practice}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: pillBg,
            }}
          >
            <Ionicons name={pillIcon as any} size={14} color={pillColor} />
            <Text allowFontScaling style={[{ fontSize: 12, fontWeight: '800', color: pillColor, letterSpacing: 0.4 }, practiceText]}>
              {pillText}
            </Text>
          </View>
          </GuideTarget>

          {/* Emergency Call Button (Only for Emergency) */}
          {isEmergency && (
            <GuideTarget step="checkin.result_emergency" enabled={practice}>
            <View>
              <Pressable
                disabled={readOnly}
                onPress={handleCall115}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#DC2626',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderRadius: 16,
                    shadowColor: '#DC2626',
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 5,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <Ionicons name="call" size={22} color="#FFFFFF" />
                <Text allowFontScaling style={[{ flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.4, lineHeight: 24, textAlign: 'center' }, practice && { fontSize: 22, lineHeight: 32 }]}>
                  {t('checkinCallEmergency')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </Pressable>
              <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 12, marginTop: 6 }}>
                {t('checkinCallEmergencyHint')}
              </Text>
            </View>
            </GuideTarget>
          )}

          {/* Triệu chứng đã ghi nhận */}
          <GuideTarget step="checkin.result_symptoms" enabled={practice}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name="pulse"
                size={18}
                color={isEmergency || isHigh ? '#DC2626' : '#08b8a2'}
              />
              <Text allowFontScaling style={[{ flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' }, practiceText]}>
                {t('checkinRecordedSymptoms')}
              </Text>
            </View>
            <Text allowFontScaling style={[{ fontSize: 14, color: '#334155', lineHeight: 22 }, practiceText]}>
              {recordedSymptoms}
            </Text>
          </View>
          </GuideTarget>

          {/* Lời khuyên box */}
          <GuideTarget step="checkin.result_advice" enabled={practice}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              backgroundColor: isFine ? '#F8FDFB' : '#FFFDF7',
              borderRadius: 16,
              padding: 14,
              borderWidth: 1.5,
              borderColor: isFine ? '#E2F4F0' : '#FEF3C7',
            }}
          >
            <Ionicons
              name="bulb-outline"
              size={22}
              color={isFine ? '#08b8a2' : '#D97706'}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, gap: 3 }}>
              <Text allowFontScaling style={[{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: isFine ? '#0F766E' : '#92400E' }, practiceText]}>
                {t('checkinAdvice')}
              </Text>
              <Text allowFontScaling style={[{ fontSize: 13.5, color: isFine ? '#334155' : '#78350F', lineHeight: 20 }, practiceText]}>
                {cleanAdvice}
              </Text>
            </View>
          </View>
          </GuideTarget>

          {/* Specialist recommendation prompt */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: isEmergency || isHigh ? '#FFF8F8' : isFine ? '#F8FDFB' : '#FFFDF7',
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderWidth: 1.5,
              borderColor: isEmergency || isHigh ? '#FEE2E2' : isFine ? '#E0F2EE' : '#FEF3C7',
            }}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={isEmergency || isHigh ? '#DC2626' : '#08b8a2'}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 13.5,
                fontWeight: '600',
                color: isEmergency || isHigh ? '#B91C1C' : isFine ? '#0F766E' : '#92400E',
                lineHeight: 19,
              }}
            >
              {doctorNoticeText}
            </Text>
          </View>

          {/* Nút kết nối với chuyên gia */}
          {isDoctorFeaturesEnabled && (!isFine || triageSummary?.needsDoctor) && (
            <GuideTarget step="checkin.result_doctor" enabled={practice}>
            <Pressable
              disabled={readOnly}
              onPress={() => readOnly ? undefined : practice ? showToast(tg('guidance.practiceActionNotice'), 'info') : router.push('/doctor-consultation' as any)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: isEmergency || isHigh ? '#DC2626' : '#08b8a2',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 18,
                  position: 'relative',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling style={[{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '700',
                  color: isEmergency || isHigh ? '#DC2626' : '#08b8a2',
                  lineHeight: 21,
                  paddingHorizontal: 8,
                  textAlign: 'center',
                }, practiceText]}
              >
                {t('checkinConnectDoctor')}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isEmergency || isHigh ? '#DC2626' : '#08b8a2'}
                style={{ position: 'absolute', right: 16 }}
              />
            </Pressable>
            </GuideTarget>
          )}

          {practice && <GuideTarget step="checkin.result_family">
            <Text allowFontScaling style={{ fontSize: 22, lineHeight: 32, color: guideColors.ink }}>{tg('guidance.practiceFamilyNotice')}</Text>
          </GuideTarget>}

          {/* Family Alert Result if present */}
          {triageSummary?.familyAlertResult?.attempted && (
            triageSummary.familyAlertResult.caregiversNotified > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#DCFCE7' }}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={{ color: '#166534', fontSize: 13, fontWeight: '600', flex: 1 }}>
                  {stripEmojis(t('checkinFamilyNotified', { count: triageSummary.familyAlertResult.caregiversNotified }))}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFDF7', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FEF3C7' }}>
                <Ionicons name="warning" size={16} color="#D97706" />
                <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '600', flex: 1 }}>
                  {stripEmojis(t('checkinFamilyNoCaregiver'))}
                </Text>
              </View>
            )
          )}

          {/* Caregiver CTA if applicable */}
          {triageSummary?.show_urgent_caregiver_warning && (
            <Pressable
              disabled={readOnly}
              onPress={() => readOnly ? undefined : practice ? showToast(tg('guidance.practiceActionNotice'), 'info') : router.push('/care-circle/invite')}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#DC2626',
                  borderRadius: 14,
                  padding: 12,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="warning" size={20} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  {stripEmojis(t('checkinCaregiverUrgentTitle'))}
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 12, opacity: 0.95, lineHeight: 16 }}>
                  {stripEmojis(t('checkinCaregiverUrgentBody'))}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Close button outside card */}
      {practice && <GuideTarget step="checkin.result_variants">
        <View style={{ gap: 12 }}>
          <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: guideColors.ink }}>{tg('guidance.practiceResultVariants')}</Text>
          {(['low', 'medium', 'high', 'emergency'] as const).map(level => <Pressable key={level}
            accessibilityRole="button" accessibilityState={{ selected: severity === level || level === 'low' && isFine }}
            onPress={() => { void guidanceAudio.stop(); setPracticeSeverity(level); }}
            style={({ pressed }) => ({ minHeight: 60, padding: 16, borderRadius: 18,
              backgroundColor: guideColors.actionBackground, opacity: pressed ? 0.8 : 1 })}>
            <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: guideColors.onAction }}>
              {tg(`guidance.${level === 'low' ? 'practiceVariantLow' : level === 'medium' ? 'practiceVariantMedium' : level === 'high' ? 'practiceVariantHigh' : 'practiceVariantEmergency'}`)}
            </Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => onRepeatPractice?.()}
            style={{ minHeight: 60, padding: 16, borderRadius: 18, backgroundColor: guideColors.actionBackground }}>
            <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: guideColors.onAction }}>{tg('guidance.practiceRepeat')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onRepeatPractice?.(true)}
            style={{ minHeight: 60, padding: 16, borderRadius: 18, backgroundColor: guideColors.actionBackground }}>
            <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: guideColors.onAction }}>{tg('guidance.practiceFollowup')}</Text>
          </Pressable>
        </View>
      </GuideTarget>}
      <GuideTarget step="checkin.result_close" enabled={practice}>
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        {/* Closing returns to Home; the result never presents a gift itself. */}
        <CheckinGiftCloseButton
          accessibilityRole="button"
          onBeforeClose={async () => {
            await Promise.allSettled([stopConclusionAudio(), guidanceAudio.stop()]);
          }}
          onClose={onClose}
          style={({ pressed }) => [
            {
              backgroundColor: practice ? guideColors.actionBackground : '#08b8a2',
              borderRadius: 28,
              minHeight: practice ? 60 : 52,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#08b8a2',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              opacity: pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
          disabled={readOnly}
        >
          <Text allowFontScaling style={{ fontSize: practice ? 22 : 17, fontWeight: '700', color: '#FFFFFF' }}>
            {practice ? tg('guidance.practiceFinish') : t('checkinClose')}
          </Text>
        </CheckinGiftCloseButton>
      </Animated.View>
      </GuideTarget>

      {/* Footer reassurance */}
      <Animated.View entering={FadeInDown.delay(350).duration(400)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          <Ionicons name="shield-checkmark-outline" size={15} color="#94A3B8" />
          <Text style={{ flexShrink: 1, fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' }}>
            {t('checkinFooter')}
          </Text>
        </View>
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
    statusSection: { gap: spacing.lg, position: 'relative' },
    heroDecorativeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      minHeight: 110,
      position: 'relative',
    },
    heroTopLeftBranch: {
      position: 'absolute',
      top: -24,
      left: -18,
    },
    heroSideWrapLeft: {
      flex: 1,
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingRight: 6,
    },
    heroSideWrapRight: {
      flex: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingLeft: 6,
    },
    heroSideText: {
      fontSize: 12.5,
      lineHeight: 18,
      fontStyle: 'italic',
      color: '#08b8a2',
      fontWeight: '500',
    },
    heroCenterBadgeWrap: {
      width: 112,
      height: 104,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    heroCenterBadgeDecor: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    heroCenterHeartBadge: {
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroHeadingWrap: {
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    heroHeading: {
      fontSize: 21,
      fontWeight: '800',
      color: '#123b36',
      textAlign: 'center',
      lineHeight: 28,
      letterSpacing: -0.3,
    },
    heroSubheading: {
      fontSize: 14,
      fontWeight: '500',
      color: '#64748b',
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
    },
    heroIndicatorPill: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#08b8a2',
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 2,
    },
    footerBrandWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      paddingHorizontal: 8,
      paddingVertical: 12,
    },
    footerBrandLeft: {
      alignItems: 'flex-start',
    },
    footerBrandWord: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: '#64748b',
      lineHeight: 15,
    },
    footerBrandUnderline: {
      width: 32,
      height: 2.5,
      backgroundColor: '#08b8a2',
      borderRadius: 2,
      marginTop: 4,
    },
    footerBrandRight: {
      alignItems: 'flex-end',
      gap: 2,
    },
    footerBrandTagline: {
      fontSize: 12,
      fontStyle: 'italic',
      color: '#08b8a2',
      textAlign: 'right',
      marginTop: 2,
    },
    statusAvatarWrap: { alignItems: 'center', marginBottom: spacing.xs },
    statusAvatar: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: 20,
      borderWidth: 1.5,
      gap: spacing.md,
      shadowColor: '#059669',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    statusLabel: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
    statusSub: { fontSize: 13, marginTop: 3, lineHeight: 18 },

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
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiBubble: {
      backgroundColor: colors.surface,
      flexShrink: 1,
      minWidth: 0,
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
      flexShrink: 1,
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
      minWidth: 0,
    },
    userAnswerTag: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '100%',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    userAnswerTagText: {
      flexShrink: 1,
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
      minWidth: 0,
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
      flexShrink: 1,
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
      fontSize: Math.max(22, typography.size.sm),
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputWrap: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    input: {
      minWidth: 0,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },


    // Confirm button
    confirmWrap: {
      paddingLeft: 36,
      marginTop: spacing.sm,
    },
    confirmBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },

    // ── Triage & Question Screens (Modern Companion Style) ──
    triageProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    triageProgressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#e6faf8',
      overflow: 'hidden',
    },
    triageProgressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: '#08b8a2',
    },
    triageProgressText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#64748b',
    },
    mascotRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 18,
    },
    mascotSticker: {
      width: 68,
      height: 76,
    },
    mascotBubble: {
      flex: 1,
      backgroundColor: '#e6f9f4',
      borderRadius: 20,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: 'rgba(8, 184, 162, 0.12)',
    },
    mascotBubbleText: {
      fontSize: 13.5,
      lineHeight: 20,
      color: '#0f3e36',
      fontWeight: '500',
    },
    questionSection: {
      marginBottom: 16,
    },
    questionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    questionPulseIcon: {
      marginTop: 2,
    },
    questionHeaderTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '800',
      color: '#0f2942',
      lineHeight: 26,
      letterSpacing: -0.2,
    },
    questionSubtitle: {
      fontSize: 13.5,
      color: '#64748b',
      lineHeight: 19,
      marginTop: 4,
      paddingLeft: 36,
    },
    triageOptionsList: {
      gap: 10,
      marginBottom: 14,
    },
    triageOptionCard: {
      minHeight: 60,
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#e2e8f0',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    triageOptionCardSelected: {
      backgroundColor: '#f0fbf8',
      borderColor: '#08b8a2',
    },
    triageRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    triageRadioSelected: {
      borderColor: '#08b8a2',
    },
    triageRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#08b8a2',
    },
    triageCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: '#cbd5e1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    triageCheckboxSelected: {
      borderColor: '#08b8a2',
      backgroundColor: '#08b8a2',
    },
    triageOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#0f2942',
      flex: 1,
    },
    triageOptionTitleSelected: {
      color: '#0f3e36',
      fontWeight: '700',
    },
    triageOptionSubtitle: {
      fontSize: 12.5,
      color: '#64748b',
      marginTop: 2,
    },
    groupHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
      marginTop: 6,
      marginBottom: 6,
    },
    groupHeaderText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: '#08b8a2',
    },
    groupHeaderLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#e2e8f0',
    },
    triageInputCard: {
      minHeight: 56,
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#e2e8f0',
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    triageMicBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#e6faf8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    triageTextInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: '#0f2942',
      padding: 0,
      minHeight: 24,
    },
    triagePillBtn: {
      height: 54,
      borderRadius: 27,
      backgroundColor: '#08b8a2',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    triagePillBtnDisabled: {
      backgroundColor: '#cbd5e1',
    },
    triagePillBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#ffffff',
    },
    triagePillBtnTextDisabled: {
      color: '#ffffff',
    },
    historyAnswerRow: {
      marginBottom: 10,
      gap: 4,
    },
    historyQuestionTag: {
      backgroundColor: '#f1f5f9',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    historyQuestionText: {
      fontSize: 12.5,
      color: '#64748b',
      fontWeight: '500',
    },
    historyAnswerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#f0fbf8',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      alignSelf: 'flex-end',
      borderWidth: 1,
      borderColor: 'rgba(8, 184, 162, 0.2)',
    },
    historyAnswerText: {
      fontSize: 13.5,
      color: '#0f3e36',
      fontWeight: '600',
    },
    bottomWatermarkWrap: {
      alignItems: 'flex-end',
      marginTop: 20,
      marginBottom: -16,
      overflow: 'hidden',
    },

    // ── Conclusion Loading / Synthesizing Screen ──
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 36,
      minHeight: 520,
    },
    loadingMascotWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    loadingAuraCircle: {
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: '#e6faf8',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    loadingArcSvg: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    loadingMascotImage: {
      width: 156,
      height: 168,
    },
    loadingTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#0f2942',
      textAlign: 'center',
      marginTop: 24,
      lineHeight: 32,
      letterSpacing: -0.3,
    },
    loadingSubtitle: {
      fontSize: 14.5,
      fontWeight: '500',
      color: '#64748b',
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 22,
    },
    loadingDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      marginBottom: 36,
    },
    loadingDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: '#08b8a2',
    },
    loadingFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
      marginBottom: 8,
    },
    loadingFooterText: {
      fontSize: 13,
      color: '#64748b',
      fontWeight: '500',
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
    doctorText: { fontSize: typography.size.xs, color: '#991b1b', fontWeight: '700', flex: 1 },

    // Caregiver CTAs (backend FIX #4) — urgent variant uses brand red so it
    // doesn't get lost next to the specialist banner; soft variant matches the
    // existing advice block.
    caregiverUrgentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: '#dc2626',
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    caregiverUrgentTitle: {
      color: '#fff',
      fontWeight: '800',
      fontSize: typography.size.sm,
      marginBottom: 2,
    },
    caregiverUrgentBody: {
      color: '#fff',
      fontSize: typography.size.xs,
      opacity: 0.95,
      lineHeight: 18,
    },
    caregiverSoftCTA: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary + '12',
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    caregiverSoftCTAText: {
      flex: 1,
      color: colors.primary,
      fontSize: typography.size.xs,
      fontWeight: '600',
    },

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
      borderWidth: 1,
      borderColor: colors.border,
    },
    doneBtnGradient: {
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
    },
    doneBtnText: {
      color: colors.primaryDark,
      fontSize: typography.size.md,
      fontWeight: '700',
    },
  });
}
