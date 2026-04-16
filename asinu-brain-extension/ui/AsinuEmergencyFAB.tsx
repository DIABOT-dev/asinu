import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { colors, spacing, typography } from '../../src/styles';
import { checkinApi } from '../../src/features/checkin/checkin.api';

type Props = {
  onInteraction?: () => void;
};

const FAB_POSITION_KEY = '@asinu_fab_position';

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const { t } = useTranslation('home');
  const [visible, setVisible] = useState(false);
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

  const [todaySessionId, setTodaySessionId] = useState<number | null>(null);
  const [alerting, setAlerting] = useState(false);
  const [alertResult, setAlertResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const handleTap = useCallback(async () => {
    onInteractionRef.current?.();
    // Check session hôm nay trước khi hiện menu
    try {
      const res = await checkinApi.getToday();
      if (res.session) setTodaySessionId(res.session.id);
      else setTodaySessionId(null);
    } catch {}
    setAlertResult(null);
    setAlerting(false);
    setVisibleRef.current(true);
  }, []);

  const close = () => {
    onInteraction?.();
    setVisible(false);
    setAlertResult(null);
    setAlerting(false);
  };

  const handleFabCheckin = (status: 'tired' | 'very_tired') => {
    close();
    if (todaySessionId) {
      // Đã có session hôm nay → follow-up (cùng session, không tạo mới)
      router.push({ pathname: '/checkin', params: { checkin_id: String(todaySessionId), mode: 'followup' } });
    } else {
      // Chưa có → tạo check-in mới
      router.push({ pathname: '/checkin', params: { preset_status: status } });
    }
  };

  const handleAlertFamily = async () => {
    setAlerting(true);
    try {
      const res = await checkinApi.emergency();
      setAlertResult({ ok: true, message: res.message });
    } catch {
      setAlertResult({ ok: false, message: t('emergencyAlertError') });
    }
    setAlerting(false);
  };

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
              <Ionicons name="medkit" size={24} color="#fff" />
            </View>
          </Animated.View>
        </GestureDetector>
      )}

      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={styles.sheetWrapper}>
            <View style={styles.sheet}>
              <View style={styles.sheetContent}>
                {alertResult ? (
                  <>
                    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
                      <Text style={{ fontSize: 40 }}>{alertResult.ok ? '✓' : '✗'}</Text>
                      <Text style={[styles.sheetTitle, { textAlign: 'center' }]}>
                        {alertResult.ok ? t('emergencyNotifiedTitle') : t('emergencyNoCaregiverTitle')}
                      </Text>
                      <Text style={[styles.sheetSubtitle, { textAlign: 'center' }]}>
                        {alertResult.message || (alertResult.ok ? t('emergencyNotifiedAdvice') : t('emergencyNoCaregiverDesc'))}
                      </Text>
                    </View>
                    <Pressable onPress={close} style={styles.confirmButton}>
                      <Text style={styles.confirmText}>{t('common:understood') || t('common:ok')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.sheetTitle}>{t('fabCheckinTitle')}</Text>
                    <Text style={styles.sheetSubtitle}>
                      {todaySessionId ? t('fabCheckinSubFollowup') : t('fabCheckinSub')}
                    </Text>

                    <Pressable onPress={() => handleFabCheckin('tired')} style={styles.actionButton}>
                      <Text style={styles.actionText}>{t('checkinTired')}</Text>
                      <Text style={styles.actionSubText}>{t('checkinTiredSub')}</Text>
                    </Pressable>

                    <Pressable onPress={() => handleFabCheckin('very_tired')} style={[styles.actionButton, styles.actionButtonDanger]}>
                      <Text style={[styles.actionText, styles.actionTextDanger]}>{t('checkinVeryTired')}</Text>
                      <Text style={[styles.actionSubText, styles.actionSubTextDanger]}>{t('checkinVeryTiredSub')}</Text>
                    </Pressable>

                    <Pressable
                      onPress={handleAlertFamily}
                      disabled={alerting}
                      style={[styles.actionButton, { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#f87171' }]}
                    >
                      <Text style={[styles.actionText, { color: '#dc2626' }]}>{t('emergencyAlertCaregiver')}</Text>
                      <Text style={[styles.actionSubText, { color: '#ef4444' }]}>{t('emergencyAlertCaregiverSub')}</Text>
                    </Pressable>

                    <Pressable onPress={close} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>{t('common:close')}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
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
    backgroundColor: '#ef4444',
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
  sheetSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  actionButton: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12
  },
  actionButtonDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  actionSubText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionSubTextDanger: {
    color: '#dc2626',
  },
  actionTextDanger: {
    color: '#dc2626',
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
