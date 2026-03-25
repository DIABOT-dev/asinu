import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { colors, spacing, typography } from '../../src/styles';
import {
  postBrainEmergency,
  startEmergencyTriage,
  submitEmergencyTriageAnswer,
  type EmergencyTriageQuestion,
  type EmergencyTriageOutcome
} from '../asinuBrain.api';

type EmergencyType = 'SUDDEN_TIRED' | 'VERY_UNWELL' | 'ALERT_CAREGIVER';

type Props = {
  onInteraction?: () => void;
};

const FAB_POSITION_KEY = '@asinu_fab_position';

type TriageStep =
  | { phase: 'menu' }
  | { phase: 'triage_loading' }
  | { phase: 'triage_question'; sessionId: string; question: EmergencyTriageQuestion }
  | { phase: 'triage_outcome'; outcome: EmergencyTriageOutcome }
  | { phase: 'emergency_loading'; type: 'VERY_UNWELL' | 'ALERT_CAREGIVER' }
  | { phase: 'emergency_done' };

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const { t } = useTranslation('home');
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<TriageStep>({ phase: 'menu' });
  const [loading, setLoading] = useState<EmergencyType | null>(null);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  const moveDistRef = useRef(0);
  const offsetRef = useRef({ x: 0, y: 0 });
  // Keep stable refs so PanResponder callbacks always see latest values
  const onInteractionRef = useRef(onInteraction);
  const setVisibleRef = useRef(setVisible);
  useEffect(() => { onInteractionRef.current = onInteraction; }, [onInteraction]);
  useEffect(() => { setVisibleRef.current = setVisible; }, [setVisible]);

  // Khôi phục vị trí từ storage khi component mount
  useEffect(() => {
    const loadPosition = async () => {
      try {
        const savedPosition = await AsyncStorage.getItem(FAB_POSITION_KEY);
        if (savedPosition) {
          const { x, y } = JSON.parse(savedPosition);
          offsetRef.current = { x, y };
          pan.setValue({ x, y });
        }
      } catch (error) {

      } finally {
        setPositionLoaded(true);
      }
    };
    loadPosition();
  }, []);

  // Lưu vị trí vào storage
  const savePosition = async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x, y }));
    } catch (error) {

    }
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim every touch immediately so Android doesn't route to child views
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      // Capture move events once past drag threshold so ScrollView never receives them
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => Math.abs(dx) > 3 || Math.abs(dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isDragging.current = false;
        moveDistRef.current = 0;
      },
      onPanResponderMove: (_, { dx, dy }) => {
        moveDistRef.current = Math.sqrt(dx * dx + dy * dy);
        if (moveDistRef.current > 5) {
          isDragging.current = true;
        }
        pan.x.setValue(offsetRef.current.x + dx);
        pan.y.setValue(offsetRef.current.y + dy);
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        if (!isDragging.current) {
          // Treated as tap — open menu
          onInteractionRef.current?.();
          setVisibleRef.current(true);
          return;
        }
        isDragging.current = false;
        const newX = offsetRef.current.x + dx;
        const newY = offsetRef.current.y + dy;
        offsetRef.current = { x: newX, y: newY };
        savePosition(newX, newY);
      },
      onPanResponderTerminate: (_, { dx, dy }) => {
        isDragging.current = false;
        const newX = offsetRef.current.x + dx;
        const newY = offsetRef.current.y + dy;
        offsetRef.current = { x: newX, y: newY };
        savePosition(newX, newY);
      },
    })
  ).current;


  const close = () => {
    onInteraction?.();
    setVisible(false);
    setStep({ phase: 'menu' });
  };

  const handleSuddenTired = async () => {
    onInteraction?.();
    setStep({ phase: 'triage_loading' });
    try {
      const res = await startEmergencyTriage();
      if (res.ok && res.question) {
        setStep({ phase: 'triage_question', sessionId: res.session_id, question: res.question });
      } else {
        close();
      }
    } catch {
      close();
    }
  };

  const handleTriageAnswer = async (sessionId: string, questionId: string, optionValue: string, optionLabel: string) => {
    setStep({ phase: 'triage_loading' });
    try {
      const res = await submitEmergencyTriageAnswer({
        session_id: sessionId,
        question_id: questionId,
        answer: { option_id: optionValue, label: optionLabel }
      });
      if (!res.ok) { close(); return; }
      if (!res.isDone) {
        setStep({ phase: 'triage_question', sessionId, question: res.question });
      } else {
        setStep({ phase: 'triage_outcome', outcome: res.outcome });
      }
    } catch {
      close();
    }
  };

  const sendEmergency = async (type: 'VERY_UNWELL' | 'ALERT_CAREGIVER') => {
    onInteraction?.();
    setStep({ phase: 'emergency_loading', type });
    try {
      await postBrainEmergency({ type });
      setStep({ phase: 'emergency_done' });
    } catch {
      close();
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {positionLoaded && (
        <Animated.View
          style={[styles.fabContainer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          {...panResponder.panHandlers}
          accessibilityLabel="Emergency"
          accessibilityRole="button"
        >
          <View style={styles.fab}>
            <Text style={styles.fabText}>!</Text>
          </View>
        </Animated.View>
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={step.phase === 'menu' ? close : undefined}>
          <View style={styles.sheet}>

            {/* Menu chọn loại khẩn cấp */}
            {step.phase === 'menu' && (
              <>
                <Text style={styles.sheetTitle}>{t('emergencyTitle')}</Text>
                <Pressable onPress={handleSuddenTired} style={styles.actionButton}>
                  <Text style={styles.actionText}>{t('emergencySuddenTired')}</Text>
                </Pressable>
                <Pressable onPress={() => sendEmergency('VERY_UNWELL')} style={styles.actionButton}>
                  <Text style={styles.actionText}>{t('emergencyVeryUnwell')}</Text>
                </Pressable>
                <Pressable onPress={() => sendEmergency('ALERT_CAREGIVER')} style={styles.actionButton}>
                  <Text style={styles.actionText}>{t('emergencyAlertCaregiver')}</Text>
                </Pressable>
                <Pressable onPress={close} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>{t('common:close')}</Text>
                </Pressable>
              </>
            )}

            {/* Loading AI */}
            {(step.phase === 'triage_loading' || step.phase === 'emergency_loading') && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{t('emergencyAiThinking')}</Text>
              </View>
            )}

            {/* AI đang hỏi câu hỏi */}
            {step.phase === 'triage_question' && (
              <>
                <Text style={styles.triageStep}>{t('emergencyTriageStep', { step: step.question.step })}</Text>
                <Text style={styles.sheetTitle}>{step.question.text}</Text>
                {step.question.options.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.actionButton}
                    onPress={() => handleTriageAnswer(step.sessionId, step.question.id, opt.value, opt.label)}
                  >
                    <Text style={styles.actionText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </>
            )}

            {/* Kết quả đánh giá AI (SUDDEN_TIRED) */}
            {step.phase === 'triage_outcome' && (
              <>
                <Text style={[styles.sheetTitle, step.outcome.risk_tier === 'HIGH' && styles.titleDanger]}>
                  {step.outcome.risk_tier === 'HIGH' ? '⚠️ ' : '✓ '}{step.outcome.outcome_text}
                </Text>
                <Text style={styles.outcomeAction}>{step.outcome.recommended_action}</Text>
                {step.outcome.caregiver_notified && (
                  <View style={styles.notifiedBadge}>
                    <Text style={styles.notifiedText}>{t('emergencyCaregiverNotified')}</Text>
                  </View>
                )}
                <Pressable onPress={close} style={styles.confirmButton}>
                  <Text style={styles.confirmText}>{t('common:understood')}</Text>
                </Pressable>
              </>
            )}

            {/* Xác nhận đã gửi (VERY_UNWELL / ALERT_CAREGIVER) */}
            {step.phase === 'emergency_done' && (
              <>
                <Text style={styles.sheetTitle}>{t('emergencySent')}</Text>
                <Text style={styles.outcomeAction}>{t('emergencySentDesc')}</Text>
                <Pressable onPress={close} style={styles.confirmButton}>
                  <Text style={styles.confirmText}>{t('common:ok')}</Text>
                </Pressable>
              </>
            )}

          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 60
  },
  fabContainer: {
    width: 56,
    height: 56
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  fabText: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: '800'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 20,
    gap: spacing.sm
  },
  sheetTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: colors.textPrimary
  },
  actionButton: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center'
  },
  triageStep: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  outcomeAction: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: Math.round(typography.size.sm * 1.5),
    marginTop: spacing.xs
  },
  titleDanger: {
    color: colors.danger
  },
  notifiedBadge: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm
  },
  notifiedText: {
    color: '#856404',
    fontSize: typography.size.sm,
    fontWeight: '600',
    textAlign: 'center'
  },
  confirmButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: typography.size.md
  }
});
