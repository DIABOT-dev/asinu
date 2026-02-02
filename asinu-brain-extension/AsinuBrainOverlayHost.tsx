import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '../src/styles';
import { BrainOutcome, BrainQuestion, fetchBrainNext, sendBrainAnswer } from './asinuBrain.api';
import { AsinuEmergencyFAB } from './ui/AsinuEmergencyFAB';

const riskTierLabel = (tier?: string) => {
  if (tier === 'HIGH') return 'Can lien he nguoi than';
  if (tier === 'MEDIUM') return 'Can theo doi';
  return 'On dinh';
};

export const AsinuBrainOverlayHost = () => {
  const pathname = usePathname();
  const isHome = useMemo(() => pathname === '/' || pathname.includes('home'), [pathname]);

  const [appState, setAppState] = useState(AppState.currentState);
  const [idleTick, setIdleTick] = useState(0);
  const [idle, setIdle] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<BrainQuestion | null>(null);
  const [outcome, setOutcome] = useState<BrainOutcome | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

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

  const handleResponse = (response: { ok: boolean; session_id?: string; question?: BrainQuestion; outcome?: BrainOutcome }) => {
    if (!response?.ok) return;

    if (response.session_id) {
      setSessionId(response.session_id);
    }

    if (response.question) {
      setOutcome(null);
      setQuestion(response.question);
      setVisible(true);
      return;
    }

    if (response.outcome) {
      setQuestion(null);
      setOutcome(response.outcome);
      setVisible(true);
      return;
    }

    setVisible(false);
  };

  const nextQuery = useQuery({
    queryKey: ['asinu-brain-next'],
    queryFn: fetchBrainNext,
    enabled: isForeground && isHome && idle && !visible,
    staleTime: 5 * 60 * 1000,
    refetchInterval: isForeground && isHome && idle && !visible ? 2000 : false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (nextQuery.data) {
      handleResponse(nextQuery.data);
    }
  }, [nextQuery.data]);

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
    } catch (error) {
      console.warn('[AsinuBrainOverlayHost] answer failed', error);
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
    } catch (error) {
      console.warn('[AsinuBrainOverlayHost] symptom answer failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedMood(null);
    setSelectedSymptoms([]);
    setSelectedSeverity(null);
  }, [question?.id]);

  const isBusy = loading || nextQuery.isFetching;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {visible && (
        <View pointerEvents="box-none" style={styles.overlay}>
          <View pointerEvents="auto" style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Asinu Active Brain</Text>
              <Pressable onPress={() => setVisible(false)} style={styles.dismissButton}>
                <Text style={styles.dismissText}>De sau</Text>
              </Pressable>
            </View>

            {question?.id === 'mood' && (
              <View style={styles.section}>
                <Text style={styles.questionText}>{question.text}</Text>
                <View style={styles.optionRow}>
                  {question.options?.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => submitMood(option.value)}
                      style={[
                        styles.optionButton,
                        selectedMood === option.value && styles.optionButtonActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedMood === option.value && styles.optionTextActive
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {question?.id === 'symptom_severity' && (
              <View style={styles.section}>
                <Text style={styles.questionText}>{question.text}</Text>
                <Text style={styles.label}>Trieu chung</Text>
                <View style={styles.optionRow}>
                  {question.symptoms?.map((symptom) => (
                    <Pressable
                      key={symptom.value}
                      onPress={() => toggleSymptom(symptom.value)}
                      style={[
                        styles.optionButton,
                        selectedSymptoms.includes(symptom.value) && styles.optionButtonActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedSymptoms.includes(symptom.value) && styles.optionTextActive
                        ]}
                      >
                        {symptom.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Muc do</Text>
                <View style={styles.optionRow}>
                  {question.severity_options?.map((severity) => (
                    <Pressable
                      key={severity.value}
                      onPress={() => setSelectedSeverity(severity.value)}
                      style={[
                        styles.optionButton,
                        selectedSeverity === severity.value && styles.optionButtonActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedSeverity === severity.value && styles.optionTextActive
                        ]}
                      >
                        {severity.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={submitSymptoms}
                  disabled={selectedSymptoms.length === 0 || !selectedSeverity || isBusy}
                  style={[
                    styles.primaryButton,
                    (selectedSymptoms.length === 0 || !selectedSeverity || isBusy) &&
                      styles.primaryButtonDisabled
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Gui</Text>
                </Pressable>
              </View>
            )}

            {outcome && (
              <View style={styles.section}>
                <Text style={styles.questionText}>{riskTierLabel(outcome.risk_tier)}</Text>
                <Text style={styles.outcomeText}>{outcome.outcome_text || 'Cam on bac da chia se.'}</Text>
                {outcome.recommended_action ? (
                  <Text style={styles.recommendText}>{outcome.recommended_action}</Text>
                ) : null}
              </View>
            )}

            {isBusy && <Text style={styles.loadingText}>Dang xu ly...</Text>}
          </View>
        </View>
      )}

      <AsinuEmergencyFAB onInteraction={markInteraction} />
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
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: spacing.lg
  },
  card: {
    width: 320,
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary
  },
  dismissButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  dismissText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm
  },
  section: {
    gap: spacing.sm
  },
  questionText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  label: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  optionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  optionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted
  },
  optionText: {
    fontSize: typography.size.sm,
    color: colors.textPrimary
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '600'
  },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '700'
  },
  outcomeText: {
    color: colors.textPrimary,
    fontSize: typography.size.sm
  },
  recommendText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  loadingText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary
  }
});
