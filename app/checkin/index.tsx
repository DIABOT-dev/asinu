import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → regional questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCheckinPresentationPriority } from '../../src/hooks/useCheckinPresentation';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { AiDataConsentModal, hasAiDataConsent } from '../../src/components/AiDataConsentModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as TextInput } from '../../src/components/ScaledTextInput';
import { isDoctorFeaturesEnabled, isExpertConsultationEnabled } from '../../src/lib/appEnv';
import type { CheckinUiPreviewId } from '../../src/features/checkin/checkin-ui-gallery';
import { CheckinGiftModal } from '../../src/features/checkin-rewards/CheckinGiftModal';
import { CheckinGiftCloseButton } from '../../src/features/checkin-rewards/CheckinGiftCloseButton';
import { offerCheckinGiftOnHome } from '../../src/features/checkin-rewards/checkin-gift-handoff';
import { checkinApi, type CheckinStatus, type CheckinSession, type TriageAnswer, type TriageSummaryView, type TriageOptionGroup } from '../../src/features/checkin/checkin.api';
import { useCheckinCallAudio } from '../../src/features/checkin-call/useCheckinCallAudio';
import { CHECKIN_STATUS_CHOICES, CheckinStatusChoice } from '../../src/features/checkin/CheckinStatusChoice';
import { CheckinConclusion } from '../../src/features/checkin/CheckinConclusion';
import { CheckinConclusionLoading } from '../../src/features/checkin/CheckinConclusionLoading';
import { CheckinQuestionLoading } from '../../src/features/checkin/CheckinQuestionLoading';
import { useCheckinQuestionViewport } from '../../src/features/checkin/useCheckinQuestionViewport';
import { hasDisplayCheckinConclusion, checkinConclusionSpeech } from '../../src/features/checkin/checkin-conclusion';
import { formatTriageOptionLabel, getTriageOptionIcon } from '../../src/features/checkin/triage-option-display';
import { type BodyLocation } from '../../src/features/checkin/location-details';
import { CheckinLocationFlow } from '../../src/features/checkin/CheckinLocationFlow';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useLanguageStore } from '../../src/stores/language.store';
import { showToast } from '../../src/stores/toast.store';
import { colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { StateError } from '../../src/components/state/StateError';
import { loadCheckinEntry, checkinPhaseId, saveLocationDraft, clearLocationDraft, savePendingAnswers, clearPendingAnswers, type LocationDraft } from '../../src/features/checkin/checkin-progress';
import { toggleTriageOption, withoutExclusiveAnswers, composeTriageAnswer } from '../../src/features/checkin/triage-answer-selection';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { GuidePracticeScope, GuideScrollScope, GuideTarget, useGuideAcknowledgement } from '../../src/features/guidance/GuidanceProvider';
import { useReviewGuidance } from '../../src/features/guidance/GuidanceSettings';
import { useGuidanceStore } from '../../src/features/guidance/guidance.store';
import { VoiceAnswerInput } from '../../src/features/guidance/VoiceAnswerInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { createCheckinPractice } from '../../src/features/guidance/checkin.practice';
import { guidanceAudio } from '../../src/features/guidance/guidance.audio';
import { guideColors as guideColors } from '../../src/features/guidance/guidance.model';

const asinuChatSticker = require('../../assets/asinu_chat_sticker.png');

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

export default function CheckinRoute() {
  const params = useLocalSearchParams<{ mode?: string; checkin_id?: string; guide?: string; entry?: string }>();
  return <CheckinScreen key={`${params.mode || 'daily'}:${params.checkin_id || ''}:${params.guide || ''}:${params.entry || ''}`} />;
}

function CheckinScreen() {
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
  const params = useLocalSearchParams<{
    checkin_id?: string;
    mode?: string;
    preset_status?: string;
    guide?: string;
    guide_followup?: string;
    entry?: string;
  }>();
  const isPractice = params.mode === 'guide';
  const practiceRunKey = useRef(`checkin-practice:${Date.now()}:${Math.random()}`).current;
  const checkinClient = useMemo(() => isPractice ? createCheckinPractice(t) : checkinApi, [isPractice, t]);
  const [practiceFollowup, setPracticeFollowup] = useState(params.guide_followup === '1');
  const [practiceRevision, setPracticeRevision] = useState(0);
  const isFollowUp = isPractice ? practiceFollowup : params.mode === 'followup';
  const isRandom = params.mode === 'random';
  const isInstantEntry = !isFollowUp && (isRandom || (isPractice && params.entry === 'instant'));
  const isResultPreview = params.mode === 'result_preview';
  const reviewGuidance = useReviewGuidance('checkin', { instant: isInstantEntry, followup: isFollowUp });
  const existingCheckinId = isPractice ? (practiceFollowup ? -1 : null)
    : params.checkin_id ? parseInt(params.checkin_id, 10) : null;
  const presetStatus = params.preset_status as CheckinStatus | undefined;

  const [screen, setScreen] = useState<Screen>(isResultPreview ? 'done' : 'status');
  const [loading, setLoading] = useState(!isPractice && !isResultPreview);
  useCheckinPresentationPriority(!isPractice && (loading || screen === 'done'));
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

  const [entryError, setEntryError] = useState(false);
  const [entryAttempt, setEntryAttempt] = useState(0);
  const [locationDraft, setLocationDraft] = useState<LocationDraft | null>(null);
  const locationBackRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (isPractice || isResultPreview) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    setEntryError(false);
    loadCheckinEntry(checkinClient, userId, params.mode, existingCheckinId)
      .then(async entry => {
        if (!mounted) return;
        if (entry.kind === 'resume') {
          setSession(entry.session);
          const saved = entry.answers;
          setAnswers(saved);
          setScreen('triage');
          await fetchNextQuestion(entry.session, saved);
        } else if (entry.kind === 'location') {
          setLocationDraft(entry.draft);
          setPendingStatus(entry.draft.status);
          setScreen('location');
        } else if (entry.kind === 'home') {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/home');
          return;
        } else if (entry.kind === 'followup' && !isFollowUp) {
          router.replace({ pathname: '/checkin', params: { checkin_id: String(entry.session.id), mode: 'followup' } });
          return;
        }
        if (mounted) setLoading(false);
      })
      .catch(() => { if (mounted) { setEntryError(true); setLoading(false); } });
    return () => { mounted = false; };
  }, [checkinClient, existingCheckinId, isPractice, isResultPreview, params.mode, userId, entryAttempt, router]);

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
    if (!presetStatus || presetHandled.current || loading || entryError || screen !== 'status') return;
    presetHandled.current = true;
    handleStatusSelect(presetStatus);
  }, [presetStatus, loading, entryError, screen]);

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
  const [triageError, setTriageError] = useState(false);
  const [triageConflict, setTriageConflict] = useState(false);
  const triageRetryRef = useRef<null | (() => Promise<void>)>(null);
  const [currentQ, setCurrentQ]    = useState<string>('');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [questionProgress, setQuestionProgress] = useState<{ current: number; total: number } | undefined>();
  const [questionGroup, setQuestionGroup] = useState<{ label: string; index: number; total: number } | null>(null);
  const [exclusiveOptions, setExclusiveOptions] = useState<string[]>([]);
  const [currentOpts, setCurrentOpts] = useState<string[]>([]);
  const [currentOptsGrouped, setCurrentOptsGrouped] = useState<TriageOptionGroup[] | null>(null);
  const [currentMultiSelect, setCurrentMultiSelect] = useState(true);
  const [currentAllowFreeText, setCurrentAllowFreeText] = useState(false);
  const [currentFreeTextOption, setCurrentFreeTextOption] = useState<string>();
  const [currentSkipAnswerLabel, setCurrentSkipAnswerLabel] = useState<string>();
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
  const handleMainScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    guideScrollOffset.current = e.nativeEvent.contentOffset.y;
  };
  const questionViewport = useCheckinQuestionViewport(mainScrollRef, `${screen}:${currentStep}:${currentQ}`,
    screen === 'triage' && !isPractice, loading);

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
    if (screen === 'triage' && !currentQ) {
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)/home');
    }
  }, [screen, currentQ, router]);

  // ─── Status select ─────────────────────────────────────────────────────────

  // T1 status pick — không INSERT DB ngay, chỉ giữ pending để T2 location quyết
  // định body_location trước khi commit. Trừ trường hợp 'fine' (skip T2) hoặc
  // followup (đã có session).
  const [pendingStatus, setPendingStatus] = useState<CheckinStatus | null>(null);

  const handleStatusSelect = useCallback(async (status: CheckinStatus) => {
    if (isInstantEntry && status !== 'tired' && status !== 'very_tired') return;
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
        if (!isPractice) await clearPendingAnswers(userId, res.session);
        if (status === 'fine') {
          setScreen('done');
          showToast(isPractice ? tg('guidance.practiceSaved') : t('checkinSaved'), 'success');
          setLoading(false);
          return;
        }
        setScreen('triage');
        await fetchNextQuestion(res.session, []);
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
        if (!isPractice) { await clearPendingAnswers(userId, res.session); await clearLocationDraft(userId); }
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
        if (!isPractice) { await clearPendingAnswers(userId, res.session); await clearLocationDraft(userId); }
        setScreen('triage');
        await fetchNextQuestion(res.session, []);
      } catch (err: any) {
        if (__DEV__) console.warn('[Checkin] handleStatusSelect concern:', err?.message || err);
        showAlert(t('error', { ns: 'common' }), t('checkinError'));
        setLoading(false);
      }
      return;
    }

    // "Hơi mệt" / "Rất mệt" keep the body-location shortcut.
    const draft: LocationDraft = { status, selected: [], other: '', details: {}, positionNotes: {}, detailIndex: null };
    if (!isPractice) await saveLocationDraft(userId, draft);
    setLocationDraft(draft);
    setPendingStatus(status);
    setScreen('location');
  }, [checkinClient, isPractice, isFollowUp, isInstantEntry, existingCheckinId, requestAiConsent, userId, isRandom, t, tg]);

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
      if (!isPractice) { await clearPendingAnswers(userId, res.session); await clearLocationDraft(userId); }
      setScreen('triage');
      await fetchNextQuestion(res.session, []);
    } catch (err: any) {
      if (__DEV__) console.warn('[Checkin] handleLocationsConfirm:', err?.message || err);
      showAlert(t('error', { ns: 'common' }), t('checkinError'));
      setLoading(false);
    }
  }, [checkinClient, pendingStatus, requestAiConsent, isPractice, userId, isRandom, t]);

  // ─── Triage ────────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: TriageAnswer[]) => {
    if (!(await requestAiConsent(() => fetchNextQuestion(sess, prevAnswers)))) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setTriageError(false);
    setTriageConflict(false);
    triageRetryRef.current = () => fetchNextQuestion(sess, prevAnswers);
    try {
      if (!isPractice) await savePendingAnswers(userId, sess, prevAnswers);
      const result = await checkinClient.triage(sess.id, prevAnswers, isPractice ? undefined : checkinPhaseId(sess));
      if (__DEV__) console.log('[Checkin] triage completed:', {
        isDone: result.isDone, step: result.step,
        promptVersion: result.conclusionPromptVersion,
        renderVersion: result.conclusionRenderVersion,
        source: result.conclusionSource,
      });
      if ((result as any).ok === false) {
        throw new Error((result as any).error || 'Triage API error');
      }
      if (!isPractice) await clearPendingAnswers(userId, sess, prevAnswers);
      if (result.isDone) {
        setTriageSummary({
          summary: result.summary || '',
          severity: result.severity || 'medium',
          recommendation: result.recommendation || '',
          needsDoctor: result.needsDoctor ?? false,
          conclusionVersion: result.conclusionVersion,
          conclusionFormat: result.conclusionFormat,
          narrative: result.narrative,
          speechText: result.speechText,
          conclusionPromptVersion: result.conclusionPromptVersion,
          conclusionRenderVersion: result.conclusionRenderVersion,
          conclusionSource: result.conclusionSource,
          personalMessage: result.personalMessage,
          explanation: result.explanation,
          todo: result.todo,
          seeDoctorWhen: result.seeDoctorWhen,
          disclaimer: result.disclaimer,
          aiNotice: result.aiNotice,
          closeMessage: result.closeMessage,
          followUpHours: result.followUpHours,
          familyAlertResult: result.familyAlertResult,
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
        setQuestionProgress(result.questionProgress);
        setQuestionGroup(result.questionGroup || null);
        setExclusiveOptions(result.exclusiveOptions || []);
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
        setCurrentFreeTextOption(result.freeTextOption);
        setCurrentSkipAnswerLabel(result.skipAnswerLabel);
      }
    } catch (err: any) {
      if (__DEV__) console.warn('[Checkin] triage request failed:', err?.message || err);
      // Keep this exact request, including the last answer. A network failure
      // must never replace a regional question with an unrelated fallback.
      setTriageError(true);
      if (err?.code === 'TRIAGE_CHANGED') {
        setTriageConflict(true);
        triageRetryRef.current = async () => {
          setLoading(true);
          setTriageError(false);
          setEntryAttempt(value => value + 1);
        };
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

    // Backend decides when the assessment is complete and persists its severity.
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
          backgroundColor: screen === 'status' ? (isDark ? colors.background : '#f4fdfb') : '#f3fbf8',
        }}
      >
        <ScreenBackButton
          iconColor={screen === 'status' ? colors.textPrimary : "#0F172A"}
          style={{ width: 44, height: 44 }}
          onPress={() => {
            if (screen === 'location') {
              locationBackRef.current?.();
            } else {
              router.back();
            }
          }}
        />
        {isPractice ? <GuideTarget step="checkin.practice" style={{ flex: 1, marginHorizontal: 12 }}>
          <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
            {tg('guidance.practiceTitle')}
          </Text>
        </GuideTarget> : <Text
          style={{
            fontSize: screen === 'status' ? 22 : 17,
            fontWeight: '700',
            color: screen === 'status' ? colors.textPrimary : '#0F172A',
            textAlign: 'center',
            flex: 1,
            marginHorizontal: 12,
          }}
          allowFontScaling
          numberOfLines={screen === 'status' ? undefined : 1}
        >
          {isResultPreview
            ? t('checkinResultPreviewHeader')
            : isFollowUp
              ? t('checkinHeaderFollowUp')
              : screen === 'status'
                ? t(isInstantEntry ? 'checkinSelectIntensityTitle' : 'checkinSelectStatusTitle')
                : t('checkinHeaderTitle')}
        </Text>}
        {screen === 'status' && !isPractice && !isResultPreview ? <Pressable
          testID="checkin-context-help"
          accessibilityLabel={t('checkinGuide.badge')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void reviewGuidance()}
          style={{
            alignItems: 'center',
            borderRadius: 20,
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
        >
          <Ionicons name="help-circle-outline" size={24} color={colors.primaryText} />
        </Pressable> : <View style={{ width: 44, height: 44 }} />}
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
        style={{ flex: 1, backgroundColor: screen === 'status' ? (isDark ? colors.background : '#f4fdfb') : '#f3fbf8' }}
        contentContainerStyle={[styles.container, screen === 'status' && { paddingTop: 8 }, { paddingBottom: insets.bottom + (screen === 'status' ? 24 : 120) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        bounces={false}
        overScrollMode="never"
        onScroll={handleMainScroll}
        onContentSizeChange={questionViewport.onContentSizeChange}
        onScrollBeginDrag={questionViewport.onScrollBeginDrag}
        scrollEventThrottle={120}
      >
        {entryError ? <StateError message={t('checkinResumeError')} onRetry={() => setEntryAttempt(value => value + 1)} /> : null}
        {!entryError && screen === 'status' && <StatusScreen styles={styles} onSelect={handleStatusSelect} isFollowUp={isFollowUp} instant={isInstantEntry} practice={isPractice} />}
        {screen === 'location' && (
          <LocationScreen
            styles={styles}
            initialDraft={locationDraft}
            draftStatus={pendingStatus}
            draftAccount={isPractice ? undefined : userId}
            onBackHandlerChange={handler => { locationBackRef.current = handler; }}
            onQuestionChange={() => mainScrollRef.current?.scrollTo({ y: 0, animated: false })}
            onConfirm={handleLocationsConfirm}
            onBack={() => { setPendingStatus(null); setScreen('status'); }}
            loading={loading}
            onBeforeAi={requestAiConsent}
            practice={isPractice}
          />
        )}
        {screen === 'triage' && triageError ? <StateError message={t(triageConflict ? 'checkinProgressChanged' : 'checkinSyncError')} onRetry={() => { void triageRetryRef.current?.(); }} /> : null}
        {screen === 'triage' && !entryError && !triageError && (
          <TriageScreen
            styles={styles}
            question={currentQ}
            options={currentOpts}
            optionsGrouped={currentOptsGrouped}
            questionProgress={questionProgress}
            questionGroup={questionGroup}
            exclusiveOptions={exclusiveOptions}
            multiSelect={currentMultiSelect}
            allowFreeText={currentAllowFreeText}
            freeTextOption={currentFreeTextOption}
            skipAnswerLabel={currentSkipAnswerLabel}
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
      return <ConclusionLoadingView />;
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
  instant = false,
  practice = false,
  readOnly = false,
}: {
  styles: Styles;
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
  instant?: boolean;
  practice?: boolean;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('home');
  const getGreeting = () => {
    if (instant) return t('checkinInstantStatusTitle');
    if (isFollowUp) return t('checkinGreetingFollowUp');
    const h = new Date().getHours();
    if (h < 12) return t('checkinGreetingMorning');
    if (h < 14) return t('checkinGreetingAfternoon');
    if (h < 18) return t('checkinGreetingEvening2');
    return t('checkinGreetingEvening');
  };

  return (
    <View style={styles.statusSection} testID="checkin-status-screen">
      <View style={styles.heroHeadingWrap}>
        <Text allowFontScaling accessibilityRole="header" style={styles.heroHeading}>{getGreeting()}</Text>
        <Text allowFontScaling style={styles.heroSubheading}>{t(instant ? 'checkinInstantStatusHint' : 'checkinSubheading')}</Text>
      </View>

      <GuideTarget step="checkin.status" style={styles.optionList} enabled={practice}>
        {CHECKIN_STATUS_CHOICES.filter(choice => !instant || choice.status !== 'fine').map(choice => (
          <CheckinStatusChoice key={choice.status} choice={choice} onSelect={readOnly ? undefined : onSelect} />
        ))}
      </GuideTarget>

      {!practice && !instant && <Text allowFontScaling style={styles.statusGiftHint}>{t('checkinGift.afterCheckin')}</Text>}
    </View>
  );
}

// ─── T2 Location screen ──────────────────────────────────────────────────────

function LocationScreen(props: React.ComponentProps<typeof CheckinLocationFlow>) {
  return <CheckinLocationFlow {...props} />;
}

// ─── Triage screen ────────────────────────────────────────────────────────────

function TriageScreen({
  styles,
  question,
  options,
  optionsGrouped,
  questionProgress,
  questionGroup,
  exclusiveOptions = [],
  multiSelect,
  allowFreeText,
  freeTextOption,
  skipAnswerLabel,
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
  questionProgress?: { current: number; total: number };
  questionGroup?: { label: string; index: number; total: number } | null;
  exclusiveOptions?: string[];
  multiSelect: boolean;
  allowFreeText?: boolean;
  freeTextOption?: string;
  skipAnswerLabel?: string;
  answers: TriageAnswer[];
  loading: boolean;
  onAnswer: (a: string) => void | Promise<void>;
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [otherActive, setOtherActive] = useState(false);
  useEffect(() => { if (!readOnly) setOtherActive(false); }, [question, readOnly]);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { if (!readOnly) setShowHistory(false); }, [question, readOnly]);
  const answering = useRef(false);
  const submitAnswer = (answer: string) => {
    if (answering.current) return;
    answering.current = true;
    void Promise.resolve(onAnswer(answer)).finally(() => { answering.current = false; }).catch(() => {});
  };

  const progressCurrent = questionProgress?.current || answers.length + 1;
  const progressTotal = questionProgress?.total;
  const progress = progressTotal ? progressCurrent / progressTotal : 0;

  const handleOptionTap = (opt: string) => {
    if (readOnly || loading || isTranscribing) return;
    if (freeTextOption && opt === freeTextOption) {
      setOtherActive(true);
      setSelected(previous => multiSelect ? withoutExclusiveAnswers(previous, exclusiveOptions) : new Set());
      return;
    }
    setOtherActive(false);
    if (multiSelect) {
      if (exclusiveOptions.includes(opt)) setCustom('');
      setSelected(previous => toggleTriageOption(previous, opt, exclusiveOptions));
    } else {
      // Single-select: send immediately
      submitAnswer(opt);
      setSelected(new Set());
      setCustom('');
    }
  };

  const handleConfirm = () => {
    if (readOnly || loading || isTranscribing) return;
    const combined = composeTriageAnswer(selected, custom, exclusiveOptions);
    if (!combined) return;
    submitAnswer(combined);
    setSelected(new Set());
    setCustom('');
  };

  const hasSelection = !loading && !isTranscribing && (selected.size > 0 || custom.trim().length > 0);
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
        {progressTotal ? <View style={styles.triageProgressTrack}>
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[styles.triageProgressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
          />
        </View> : null}
        <Text style={styles.triageProgressText}>
          {progressTotal ? `${progressCurrent}/${progressTotal}` : t('checkinQuestionNumber', { count: progressCurrent })}
        </Text>
      </View>

      {questionGroup && <Text allowFontScaling style={styles.groupHeaderText}>
        {t('checkinQuestionRegion', { region: questionGroup.label, current: questionGroup.index, total: questionGroup.total })}
      </Text>}

      {/* Answered history if any */}
      {answers.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Pressable disabled={readOnly} onPress={() => { if (!readOnly) setShowHistory(value => !value); }}
            accessibilityRole="button" accessibilityState={{ expanded: showHistory }}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.historyQuestionText}>{t('checkinAnsweredCount', { count: answers.length })}</Text>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </Pressable>
          {showHistory && answers.map((a, i) => (
            <View key={i} style={styles.historyAnswerRow}>
              <View style={styles.historyQuestionTag}>
                <Text style={styles.historyQuestionText}>{a.question}</Text>
              </View>
              <View style={styles.historyAnswerCard}>
                <Ionicons name="checkmark-circle" size={14} color="#08b8a2" />
                <Text style={styles.historyAnswerText}>{formatTriageOptionLabel(a.answer)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <CheckinQuestionLoading key={`question-${answers.length}`} first={answers.length === 0} active={!readOnly} />
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
                    const isSelected = selected.has(opt) || (opt === freeTextOption && otherActive);
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
                            disabled={readOnly || loading || isTranscribing}
                            onPress={() => handleOptionTap(opt)}
                            accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                            accessibilityLabel={formatTriageOptionLabel(opt)}
                            accessibilityState={{ checked: isSelected, disabled: readOnly || loading || isTranscribing }}
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
                const isSelected = selected.has(opt) || (opt === freeTextOption && otherActive);
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
                        disabled={readOnly || loading || isTranscribing}
                        onPress={() => handleOptionTap(opt)}
                        accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
                        accessibilityLabel={formatTriageOptionLabel(opt)}
                        accessibilityState={{ checked: isSelected, disabled: readOnly || loading || isTranscribing }}
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
                <VoiceAnswerInput key={question} value={custom} onChangeText={text => {
                  setCustom(text);
                  if (text.trim()) setSelected(previous => withoutExclusiveAnswers(previous, exclusiveOptions));
                }}
                  onRecognized={() => acknowledgeGuide('checkin.voice')}
                  onBeforeAi={onBeforeAi} onProcessingChange={setIsTranscribing}
                  disabled={loading} readOnly={readOnly} practice={practice}
                  placeholder={t('checkinCustomPlaceholder')}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                  inputStyle={[styles.triageTextInput, { fontSize: practice ? 20 : 15 }]} />
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

          {skipAnswerLabel && <Pressable disabled={readOnly || loading || isTranscribing}
            accessibilityRole="button" accessibilityLabel={skipAnswerLabel}
            onPress={() => {
              if (!readOnly && !loading && !isTranscribing) {
                submitAnswer(skipAnswerLabel);
                setCustom('');
                setSelected(new Set());
              }
            }}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: colors.primaryText }}>{skipAnswerLabel}</Text>
          </Pressable>}

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

function ConclusionLoadingView() {
  return <CheckinConclusionLoading />;
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
  const conclusionSpeechPlayedRef = useRef<string | null>(null);
  const [speechReplayKey, setSpeechReplayKey] = useState(0);
  const [audioReadyIdentity, setAudioReadyIdentity] = useState<string | null>(null);
  const [audioTimeoutIdentity, setAudioTimeoutIdentity] = useState<string | null>(null);
  const activeConclusionIdentityRef = useRef<string | null>(null);
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi';
  const { audio: conclusionAudio, play: playConclusionAudio, stopAudio: stopConclusionAudio } =
    useCheckinCallAudio(null, language, t, undefined, !readOnly);
  const audioStateRef = useRef(conclusionAudio);
  audioStateRef.current = conclusionAudio;
  const audioBeforeSpeechRef = useRef<typeof conclusionAudio | null>(null);
  const isSpeakingConclusion = ['loading', 'playing'].includes(conclusionAudio.phase);
  const isFine = practice && practiceSeverity ? practiceSeverity === 'low'
    : session?.current_status === 'fine' || (!triageSummary && session?.initial_status === 'fine');

  const severity = practice && practiceSeverity ? practiceSeverity : triageSummary?.severity;
  const practiceText = practice ? { fontSize: 22, lineHeight: 32, color: guideColors.ink } : undefined;
  const isEmergency = severity === 'emergency';
  const isHigh = severity === 'high';
  const isMedium = severity === 'medium';
  const structuredConclusion = !isEmergency && !isFine && triageSummary?.conclusionVersion === 2
    && hasDisplayCheckinConclusion(triageSummary) ? triageSummary : null;
  const connectConclusionExpert = () => {
    if (readOnly) return;
    if (practice) { showToast(tg('guidance.practiceActionNotice'), 'info'); return; }
    if (!isExpertConsultationEnabled) return;
    router.push('/doctor-consultation' as any);
  };

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

  const aiNotice = triageSummary?.aiNotice?.trim() || t('checkinAiNotice');
  const aiNoticeParts = aiNotice.match(/^(Asinu là ai và có thể sai|Asinu is AI and can make mistakes)[,.]?\s*([\s\S]*)$/i);
  const aiNoticeTitle = aiNoticeParts?.[1].replace(/\bai\b/gi, 'AI');
  const aiNoticeDetail = aiNoticeParts?.[2] || aiNotice;
  const aiNoticeBody = aiNoticeDetail.charAt(0).toUpperCase() + aiNoticeDetail.slice(1);
  const conclusionSpeechText = structuredConclusion ? checkinConclusionSpeech(structuredConclusion, aiNotice) : [
    t('checkinDoneNoted'),
    pillText,
    cleanSubtitle,
    shouldReadSummary ? `${t('checkinResultSummaryLabel')}: ${cleanSummary}` : '',
    `${t('checkinRecordedSymptoms')}: ${recordedSymptoms}`,
    `${t('checkinAdvice')}: ${cleanAdvice}`,
    doctorNoticeText,
    aiNotice,
  ]
    .map((part) => stripEmojis(String(part)).replace(/[.!?]+$/g, '').trim())
    .filter(Boolean)
    .join('. ') + '.';

  const conclusionIdentity = JSON.stringify([session?.id, language, conclusionSpeechText]);
  const conclusionSpeechIdentity = JSON.stringify([conclusionIdentity, speechReplayKey]);
  const audioReady = audioReadyIdentity === conclusionIdentity && activeConclusionIdentityRef.current === conclusionIdentity;
  const waitForAudio = !practice && !readOnly && !isEmergency;
  useEffect(() => {
    if (practice || readOnly) return; // The bundled coach recordings explain example results offline.
    if (conclusionSpeechPlayedRef.current === conclusionSpeechIdentity || !conclusionSpeechText) {
      return;
    }
    conclusionSpeechPlayedRef.current = conclusionSpeechIdentity;
    if (activeConclusionIdentityRef.current !== conclusionIdentity) {
      activeConclusionIdentityRef.current = conclusionIdentity;
      setAudioReadyIdentity(null);
      setAudioTimeoutIdentity(null);
    }
    // Ignore a previous result's final playback state until this request emits
    // its own state, even if two sessions happen to have the same transcript.
    audioBeforeSpeechRef.current = audioStateRef.current;
    void playConclusionAudio('conclusion', conclusionSpeechText);

    return () => {
      // Development effect replay stops the player but preserves this ref.
      // Let the next setup restart the narration that cleanup interrupted.
      if (conclusionSpeechPlayedRef.current === conclusionSpeechIdentity) {
        conclusionSpeechPlayedRef.current = null;
      }
      void stopConclusionAudio();
    };
  }, [practice, readOnly, conclusionIdentity, conclusionSpeechIdentity, conclusionSpeechText, playConclusionAudio, stopConclusionAudio]);

  useEffect(() => {
    if (!waitForAudio || audioReady || conclusionAudio === audioBeforeSpeechRef.current) return;
    if (conclusionAudio.prompt?.text !== conclusionSpeechText || conclusionAudio.prompt.language !== language) return;
    if (['playing', 'finished', 'error'].includes(conclusionAudio.phase)) setAudioReadyIdentity(conclusionIdentity);
  }, [waitForAudio, audioReady, conclusionAudio, conclusionIdentity, conclusionSpeechText, language]);

  useEffect(() => {
    if (!waitForAudio || audioReady) return;
    // The synthesis request has a 30s network deadline. Also bound metadata,
    // file/decoder stalls; a failed narrator must never hide the health result.
    const safetyTimer = setTimeout(() => {
      setAudioTimeoutIdentity(conclusionIdentity);
      setAudioReadyIdentity(conclusionIdentity);
      void stopConclusionAudio();
    }, 40000);
    return () => clearTimeout(safetyTimer);
  }, [waitForAudio, audioReady, conclusionIdentity, stopConclusionAudio]);

  const replayConclusionSpeech = () => {
    if (readOnly) return;
    if (practice) { void guidanceAudio.speak('practice_result', language, true); return; }
    conclusionSpeechPlayedRef.current = null;
    setSpeechReplayKey((value) => value + 1);
  };

  if (forceLoading || (waitForAudio && !audioReady)) {
    return <ConclusionLoadingView key={conclusionIdentity} />;
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

      {(conclusionAudio.phase === 'error' || (audioTimeoutIdentity === conclusionIdentity && !['playing', 'finished'].includes(conclusionAudio.phase))) && (
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
        {!structuredConclusion && <Text allowFontScaling style={[{ fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21, marginTop: 6, maxWidth: 330 }, practiceText]}>
          {cleanSubtitle}
        </Text>}
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

          {structuredConclusion ? <CheckinConclusion result={structuredConclusion}
            onConnectExpert={connectConclusionExpert} expertAvailable={isExpertConsultationEnabled} readOnly={readOnly} /> : <>
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

          </>}

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
      <View
        testID="checkin-ai-notice"
        accessible
        accessibilityRole="text"
        accessibilityLabel={[aiNoticeTitle, aiNoticeBody].filter(Boolean).join('. ')}
        style={{
          backgroundColor: '#FFF8E8',
          borderColor: '#DBC48D',
          borderWidth: 1,
          borderRadius: 18,
          padding: 18,
          gap: 10,
          marginTop: 4,
        }}
      >
        {aiNoticeTitle && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#866014"
              accessible={false}
              importantForAccessibility="no"
              style={{ marginTop: 2 }}
            />
            <Text
              testID="checkin-ai-notice-title"
              allowFontScaling
              style={{ flex: 1, fontSize: 19, lineHeight: 28, fontWeight: '700', color: '#60420B' }}
            >
              {aiNoticeTitle}
            </Text>
          </View>
        )}
        <Text
          testID="checkin-ai-notice-body"
          allowFontScaling
          style={{ color: '#594B32', fontSize: 17, lineHeight: 27 }}
        >
          {aiNoticeBody}
        </Text>
      </View>
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
    statusBackdrop: { position: 'absolute', top: -20, bottom: -24, left: -20, right: -20 },
    heroDecorativeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 120 },
    heroSideWrapLeft: { flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center' },
    heroSideWrapRight: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center' },
    heroSideText: { fontSize: 12, lineHeight: 18, color: colors.primaryText },
    heroSideTextRight: { textAlign: 'right' },
    heroCenterBadgeWrap: { width: 130, height: 120, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    heroHeadingWrap: { alignItems: 'center', paddingHorizontal: 4 },
    heroHeading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', lineHeight: 31, letterSpacing: -0.3 },
    heroSubheading: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 23, marginTop: 8 },
    statusGiftHint: { fontSize: 15, lineHeight: 23, textAlign: 'center', color: colors.textSecondary },
    footerBrandWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingHorizontal: 4, paddingVertical: 8, marginTop: 4 },
    footerBrandLeft: { alignItems: 'flex-start', flexShrink: 0 },
    footerBrandWord: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: colors.textSecondary, lineHeight: 15 },
    footerBrandRight: { flex: 1, minWidth: 150, alignItems: 'flex-end', gap: 2 },
    footerBrandTagline: { fontSize: 12, color: colors.primaryText, textAlign: 'right', marginTop: 2 },
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
    locationOptionIcon: {
      width: 28,
      height: 28,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationOptionLabel: {
      minWidth: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
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
