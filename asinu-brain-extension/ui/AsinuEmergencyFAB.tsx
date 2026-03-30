import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
  const [textInput, setTextInput] = useState('');
  const [positionLoaded, setPositionLoaded] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // Lưu kích thước màn hình vào shared value để dùng trong worklet
  const screenW = useSharedValue(Dimensions.get('window').width);
  const screenH = useSharedValue(Dimensions.get('window').height);
  // Keep stable refs so gesture callbacks always see latest values
  const onInteractionRef = useRef(onInteraction);
  const setVisibleRef = useRef(setVisible);
  useEffect(() => { onInteractionRef.current = onInteraction; }, [onInteraction]);
  useEffect(() => { setVisibleRef.current = setVisible; }, [setVisible]);

  // Khôi phục vị trí từ storage khi component mount
  // Fix #7: Validate bounds khi load vị trí từ storage
  useEffect(() => {
    AsyncStorage.getItem(FAB_POSITION_KEY)
      .then(saved => {
        if (saved) {
          const { x, y } = JSON.parse(saved);
          const FAB = 56;
          const MARGIN = 16;
          const sw = Dimensions.get('window').width;
          const sh = Dimensions.get('window').height;
          const initLeft = sw - MARGIN - FAB;
          const initTop = sh - MARGIN - FAB;
          const absLeft = Math.max(MARGIN, Math.min(sw - FAB - MARGIN, initLeft + x));
          const absTop = Math.max(MARGIN, Math.min(sh - FAB - MARGIN, initTop + y));
          translateX.value = absLeft - initLeft;
          translateY.value = absTop - initTop;
        }
      })
      .catch(() => {})
      .finally(() => setPositionLoaded(true));
  }, []);

  // Lưu vị trí vào storage
  const savePosition = useCallback(async (x: number, y: number) => {
    try {
      await AsyncStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x, y }));
    } catch {}
  }, []);

  const handleTap = useCallback(() => {
    onInteractionRef.current?.();
    setVisibleRef.current(true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      const FAB = 56;
      const MARGIN = 16;
      const rawX = startX.value + e.translationX;
      const rawY = startY.value + e.translationY;

      // Vị trí ban đầu của FAB (right: 16, bottom: 16)
      const initLeft = screenW.value - MARGIN - FAB;
      const initTop  = screenH.value - MARGIN - FAB;

      // Vị trí tuyệt đối hiện tại
      const absLeft = initLeft + rawX;
      const absTop  = initTop  + rawY;

      // Clamp trong màn hình có margin
      const clampedLeft = Math.max(MARGIN, Math.min(screenW.value - FAB - MARGIN, absLeft));
      const clampedTop  = Math.max(MARGIN, Math.min(screenH.value - FAB - MARGIN, absTop));

      // Chuyển lại thành translate
      const finalX = clampedLeft - initLeft;
      const finalY = clampedTop  - initTop;

      translateX.value = withSpring(finalX, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(finalY, { damping: 20, stiffness: 200 });
      runOnJS(savePosition)(finalX, finalY);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleTap)();
  });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);


  const close = () => {
    onInteraction?.();
    setVisible(false);
    setStep({ phase: 'menu' });
    setTextInput('');
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

  const handleTriageAnswer = async (
    sessionId: string,
    questionId: string,
    optionValue?: string,
    optionLabel?: string,
    freeText?: string,
  ) => {
    setStep({ phase: 'triage_loading' });
    setTextInput('');
    try {
      const res = await submitEmergencyTriageAnswer({
        session_id: sessionId,
        question_id: questionId,
        answer: freeText
          ? { text_input: freeText, label: freeText }
          : { option_id: optionValue, label: optionLabel },
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

  const [emergencyResult, setEmergencyResult] = useState<{ status: string; message: string; caregiversAlerted?: number } | null>(null);

  const sendEmergency = async (type: 'VERY_UNWELL' | 'ALERT_CAREGIVER') => {
    onInteraction?.();
    setStep({ phase: 'emergency_loading', type });
    try {
      const res = await postBrainEmergency({ type });
      setEmergencyResult(res);
      setStep({ phase: 'emergency_done' });
    } catch {
      close();
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {positionLoaded && (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[styles.fabContainer, animStyle]}
            accessibilityLabel="Emergency"
            accessibilityRole="button"
          >
            <View style={styles.fab}>
              <Text style={styles.fabText}>!</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      )}

      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheetWrapper}>
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={styles.sheetContent}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

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

                {step.question.type === 'open_text' ? (
                  /* Nhập tự do — mô tả triệu chứng */
                  <>
                    <TextInput
                      style={styles.textInput}
                      placeholder={t('emergencyTypePlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={textInput}
                      onChangeText={setTextInput}
                      multiline
                      numberOfLines={3}
                      maxLength={200}
                      autoFocus
                    />
                    <Pressable
                      style={[styles.confirmButton, !textInput.trim() && styles.confirmButtonDisabled]}
                      onPress={() => {
                        if (textInput.trim()) {
                          handleTriageAnswer(step.sessionId, step.question.id, undefined, undefined, textInput.trim());
                        }
                      }}
                      disabled={!textInput.trim()}
                    >
                      <Text style={styles.confirmText}>{t('emergencySendAnswer')}</Text>
                    </Pressable>
                  </>
                ) : (
                  /* Chọn 1 trong nhiều lựa chọn */
                  step.question.options?.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={styles.actionButton}
                      onPress={() => handleTriageAnswer(step.sessionId, step.question.id, opt.value, opt.label)}
                    >
                      <Text style={styles.actionText}>{opt.label}</Text>
                    </Pressable>
                  ))
                )}
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
                {emergencyResult?.caregiversAlerted != null && emergencyResult.caregiversAlerted > 0 ? (
                  <>
                    <Text style={[styles.sheetTitle, styles.titleDanger]}>
                      {t('emergencyNotifiedTitle')}
                    </Text>
                    <Text style={styles.outcomeAction}>
                      {t('emergencyNotifiedDesc', { count: emergencyResult.caregiversAlerted })}
                    </Text>
                    <View style={styles.notifiedBadge}>
                      <Text style={styles.notifiedText}>
                        {t('emergencyNotifiedBadge', { count: emergencyResult.caregiversAlerted })}
                      </Text>
                    </View>
                    <Text style={styles.outcomeAction}>
                      {t('emergencyNotifiedAdvice')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.sheetTitle, styles.titleDanger]}>
                      {t('emergencyNoCaregiverTitle')}
                    </Text>
                    <Text style={styles.outcomeAction}>
                      {t('emergencyNoCaregiverDesc')}
                    </Text>
                    <Text style={styles.outcomeAction}>
                      {t('emergencyNoCaregiverAdvice')}
                    </Text>
                  </>
                )}
                <Pressable onPress={close} style={styles.confirmButton}>
                  <Text style={styles.confirmText}>{t('common:understood') || t('common:ok')}</Text>
                </Pressable>
              </>
            )}

          </ScrollView>
          </View>
        </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md
  },
  sheetWrapper: {
    width: '100%',
    maxHeight: '85%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  sheetContent: {
    padding: spacing.lg,
    gap: spacing.sm,
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
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceMuted,
  },
  confirmButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border,
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: typography.size.md
  }
});
