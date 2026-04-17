import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../src/components/ScaledText';
import { useAuthStore } from '../src/features/auth/auth.store';
import { useScaledTypography } from '../src/hooks/useScaledTypography';
import { showToast } from '../src/stores/toast.store';
import { colors, spacing } from '../src/styles';
import { BrainOutcome, BrainQuestion, fetchBrainNext, sendBrainAnswer } from './asinuBrain.api';
import { AsinuEmergencyFAB } from './ui/AsinuEmergencyFAB';

const OUTCOME_HISTORY_KEY = '@asinu_brain_outcomes';
const MAX_OUTCOMES = 50;

type SavedOutcome = {
  risk_tier: string;
  outcome_text?: string | null;
  recommended_action?: string | null;
  saved_at: string;
};

async function saveOutcomeToHistory(outcome: BrainOutcome) {
  try {
    const raw = await AsyncStorage.getItem(OUTCOME_HISTORY_KEY);
    const history: SavedOutcome[] = raw ? JSON.parse(raw) : [];
    history.unshift({
      risk_tier: outcome.risk_tier,
      outcome_text: outcome.outcome_text,
      recommended_action: outcome.recommended_action,
      saved_at: new Date().toISOString(),
    });
    if (history.length > MAX_OUTCOMES) history.length = MAX_OUTCOMES;
    await AsyncStorage.setItem(OUTCOME_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

const riskTierLabel = (tier: string | undefined, t: (key: string) => string) => {
  if (tier === 'HIGH') return t('brainRiskHigh');
  if (tier === 'MEDIUM') return t('brainRiskMedium');
  return t('brainRiskStable');
};

export const AsinuBrainOverlayHost = () => {
  const { t } = useTranslation('home');
  const pathname = usePathname();
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = !!profile; // Kiểm tra đã đăng nhập chưa
  
  // Chỉ hiển thị ở trang home đã đăng nhập, không phải login/register/onboarding
  const isHome = useMemo(() => {
    if (!isAuthenticated) return false; // KHÔNG hoạt động khi chưa đăng nhập
    const excludedPaths = ['/login', '/register', '/onboarding', '/legal'];
    const isExcluded = excludedPaths.some(path => pathname.startsWith(path));
    return !isExcluded && (pathname === '/' || pathname.includes('home') || pathname.includes('(tabs)'));
  }, [pathname, isAuthenticated]);
  const scaledTypography = useScaledTypography();

  const [appState, setAppState] = useState(AppState.currentState);
  const [idleTick, setIdleTick] = useState(0);
  const [idle, setIdle] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<BrainQuestion | null>(null);
  const [questionFlow, setQuestionFlow] = useState<{ step: number; total: number; mode?: string } | null>(null);
  const [outcome, setOutcome] = useState<BrainOutcome | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null); // Thêm cho dynamic mode
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [nextDueAt, setNextDueAt] = useState<Date | null>(null);
  const [lastDismissed, setLastDismissed] = useState<number>(0);
  const [logsRequired, setLogsRequired] = useState<{ message: string; missingTypes: string[] } | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fix #3: Session timeout — auto-dismiss sau 5 phút không tương tác
  useEffect(() => {
    if (visible) {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        resetAndDismiss();
      }, 5 * 60 * 1000);
    } else {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    }
    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [visible]);

  const isForeground = appState === 'active';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppState(state));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isForeground || !isHome) {
      setIdle(false);
      return;
    }
    const timer = setTimeout(() => setIdle(true), 2000);
    return () => clearTimeout(timer);
  }, [isForeground, isHome, idleTick]);

  const markInteraction = () => {
    setIdle(false);
    setIdleTick((prev) => prev + 1);
  };

  // Fix #5: Reset toàn bộ state khi dismiss
  const resetAndDismiss = () => {
    setVisible(false);
    setLastDismissed(Date.now());
    setSessionId(null);
    setQuestion(null);
    setQuestionFlow(null);
    setOutcome(null);
    setLogsRequired(null);
    setSelectedOption(null);
    setSelectedMood(null);
    setSelectedSymptoms([]);
    setSelectedSeverity(null);
    markInteraction();
  };

  const handleResponse = (response: { ok: boolean; session_id?: string; question?: BrainQuestion; question_flow?: { step: number; total: number }; outcome?: BrainOutcome; requires_logs?: boolean; message?: string; missing_log_types?: string[]; next_due_at?: string }) => {
    if (!response?.ok) return;

    if (response.session_id) {
      setSessionId(response.session_id);
    }

    if (response.question_flow) {
      setQuestionFlow(response.question_flow);
    }

    // Fix #4: Set nextDueAt từ API response
    if (response.next_due_at) {
      const due = new Date(response.next_due_at);
      if (!isNaN(due.getTime())) setNextDueAt(due);
    }

    // Nếu cần logs trước khi hỏi
    if (response.requires_logs && response.message) {
      setLogsRequired({
        message: response.message,
        missingTypes: response.missing_log_types || []
      });
      setQuestion(null);
      setOutcome(null);
      setVisible(true);
      return;
    }

    if (response.question) {
      setOutcome(null);
      setQuestion(response.question);
      setLogsRequired(null);
      setVisible(true);
      return;
    }

    if (response.outcome) {
      setQuestion(null);
      setOutcome(response.outcome);
      setLogsRequired(null);
      setVisible(true);
      saveOutcomeToHistory(response.outcome);
      return;
    }

    setVisible(false);
  };

  const canQuery = useMemo(() => {
    const now = Date.now();
    const timeSinceDismiss = now - lastDismissed;
    const canQ = timeSinceDismiss > 30 * 1000; // 30 giây sau khi dismiss mới query lại (testing)

    return canQ;
  }, [lastDismissed]);

  const queryEnabled = isForeground && isHome && idle && !visible && canQuery;

  const nextQuery = useQuery({
    queryKey: ['asinu-brain-next'],
    queryFn: fetchBrainNext,
    enabled: queryEnabled,
    staleTime: 60 * 1000,
    refetchInterval: queryEnabled ? 30000 : false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false);
      return;
    }
    if (nextQuery.data) {
      handleResponse(nextQuery.data);
    }
  }, [nextQuery.data, isAuthenticated]);

  // Dynamic question handler - cho câu hỏi AI sinh
  const submitDynamicAnswer = async (value: string, label: string) => {
    markInteraction();
    if (!sessionId || !question) return;
    setSelectedOption(value);
    try {
      setLoading(true);
      const response = await sendBrainAnswer({
        session_id: sessionId,
        question_id: question.id,
        answer: { option_id: value, value, label }
      });
      handleResponse(response);
    } catch {
      showToast(t('common:error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitMood = async (value: string) => {
    markInteraction();
    if (!sessionId) return;
    setSelectedMood(value);
    try {
      setLoading(true);
      const response = await sendBrainAnswer({
        session_id: sessionId,
        question_id: 'mood',
        answer: { option_id: value, value }
      });
      handleResponse(response);
    } catch {
      showToast(t('common:error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSymptom = (value: string) => {
    markInteraction();
    setSelectedSymptoms((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const submitSymptoms = async () => {
    markInteraction();
    if (!sessionId || selectedSymptoms.length === 0 || !selectedSeverity) return;
    try {
      setLoading(true);
      const response = await sendBrainAnswer({
        session_id: sessionId,
        question_id: 'symptom_severity',
        answer: { option_id: selectedSymptoms, value: selectedSeverity }
      });
      handleResponse(response);
    } catch {
      showToast(t('common:error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedOption(null);
    setSelectedMood(null);
    setSelectedSymptoms([]);
    setSelectedSeverity(null);
  }, [question?.id]);

  const isBusy = loading || nextQuery.isFetching;

  const formatNextDue = (): string => {
    if (!nextDueAt) return '';
    const now = new Date();
    const diffMs = nextDueAt.getTime() - now.getTime();
    if (diffMs <= 0) return t('brainRightNow');
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return t('brainAfterHoursMinutes', { hours, minutes });
    }
    return t('brainAfterMinutes', { minutes });
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {/* Brain Modal — temporarily disabled
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={resetAndDismiss}
      >
        ...
      </Modal>
      */}

      {/* FAB moved to _layout.tsx — rendered outside OverlayHost for Android touch compatibility */}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Tối hơn để nổi bật modal
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  modalContent: {
    width: '100%',
    maxWidth: 500, // Tăng từ 400 → 500 để dễ đọc hơn
    alignItems: 'center'
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24, // Tăng từ 20 → 24 để mượt hơn
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.35, // Tăng từ 0.25 để nổi bật hơn
    shadowRadius: 20, // Tăng từ 16 để shadow rõ hơn
    shadowOffset: { width: 0, height: 10 }, // Tăng từ 8 → 10
    elevation: 16, // Tăng từ 12 → 16 cho Android
    borderWidth: 2, // Thêm viền để nổi bật
    borderColor: colors.primary
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  title: {
    fontWeight: '700',
    color: colors.textPrimary
  },
  dismissButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  dismissText: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  progressBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginLeft: spacing.sm
  },
  progressText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  frequencyInfo: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm
  },
  frequencyLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  frequencyText: {
    color: colors.primary,
    fontWeight: '600'
  },
  logButtonsContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  logButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center'
  },
  logButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  logButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  section: {
    gap: spacing.sm
  },
  questionText: {
    fontWeight: '600',
    color: colors.textPrimary
  },
  questionHint: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.xs
  },
  label: {
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  optionColumn: {
    flexDirection: 'column',
    gap: spacing.sm
  },
  optionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  dynamicOptionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  dynamicOptionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  dynamicOptionText: {
    color: colors.textPrimary,
    textAlign: 'center'
  },
  dynamicOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  optionText: {
    color: colors.textPrimary
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.5
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  outcomeText: {
    color: colors.textPrimary
  },
  recommendText: {
    color: colors.textSecondary,
    fontStyle: 'italic'
  },
  loadingText: {
    color: colors.textSecondary,
    textAlign: 'center'
  }
});
