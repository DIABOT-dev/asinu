import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { colors, spacing, typography } from '../../src/styles';
import { checkinApi } from '../../src/features/checkin/checkin.api';

type Props = {
  onInteraction?: () => void;
};

const FAB_SIZE = 56;
const FAB_POSITION_KEY = '@asinu_fab_position';
const DRAG_THRESHOLD = 10;

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const { t } = useTranslation('home');
  const [visible, setVisible] = useState(false);
  const [todaySessionId, setTodaySessionId] = useState<number | null>(null);
  const [alerting, setAlerting] = useState(false);
  const [alertResult, setAlertResult] = useState<{ ok: boolean; message?: string } | null>(null);

  // Drag state
  const pan = useRef(new Animated.ValueXY()).current;
  const isDragging = useRef(false);
  const savedOffset = useRef({ x: 0, y: 0 });

  // Load saved position
  useEffect(() => {
    AsyncStorage.getItem(FAB_POSITION_KEY)
      .then(saved => {
        if (saved) {
          const pos = JSON.parse(saved);
          savedOffset.current = pos;
          pan.setOffset(pos);
          pan.setValue({ x: 0, y: 0 });
        }
      })
      .catch(() => {});
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > DRAG_THRESHOLD || Math.abs(gs.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset(savedOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > DRAG_THRESHOLD || Math.abs(gs.dy) > DRAG_THRESHOLD) {
          isDragging.current = true;
        }
        if (isDragging.current) {
          pan.setValue({ x: gs.dx, y: gs.dy });
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (!isDragging.current) {
          // TAP
          handleTap();
          return;
        }
        // DRAG — save final position
        const newX = savedOffset.current.x + gs.dx;
        const newY = savedOffset.current.y + gs.dy;

        // Clamp to screen
        const sw = Dimensions.get('window').width;
        const sh = Dimensions.get('window').height;
        const clampedX = Math.max(-sw + FAB_SIZE + 16, Math.min(0, newX));
        const clampedY = Math.max(-sh + FAB_SIZE + 100, Math.min(0, newY));

        savedOffset.current = { x: clampedX, y: clampedY };
        pan.setOffset({ x: clampedX, y: clampedY });
        pan.setValue({ x: 0, y: 0 });

        AsyncStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x: clampedX, y: clampedY })).catch(() => {});
      },
    })
  ).current;

  const handleTap = useCallback(() => {
    onInteraction?.();
    setAlertResult(null);
    setAlerting(false);
    setVisible(true);
    checkinApi.getToday()
      .then(res => setTodaySessionId(res.session ? res.session.id : null))
      .catch(() => setTodaySessionId(null));
  }, [onInteraction]);

  const close = () => {
    onInteraction?.();
    setVisible(false);
    setAlertResult(null);
    setAlerting(false);
  };

  const handleFabCheckin = (status: 'tired' | 'very_tired') => {
    close();
    if (todaySessionId) {
      router.push({ pathname: '/checkin', params: { checkin_id: String(todaySessionId), mode: 'followup' } });
    } else {
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

  return (
    <>
      <Animated.View
        style={[styles.fabWrap, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.fab}>
          <Ionicons name="medkit" size={24} color="#fff" />
        </View>
      </Animated.View>

      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheetWrapper} onPress={e => e.stopPropagation()}>
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 9999,
    elevation: 20,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  sheetWrapper: { width: '100%', maxHeight: '85%' },
  sheet: { backgroundColor: colors.surface, borderRadius: 20 },
  sheetContent: { padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
  sheetSubtitle: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  actionButton: { backgroundColor: colors.surfaceMuted, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 12 },
  actionButtonDanger: { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca' },
  actionSubText: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  actionSubTextDanger: { color: '#dc2626' },
  actionTextDanger: { color: '#dc2626' },
  actionText: { fontSize: typography.size.md, fontWeight: '600', color: colors.textPrimary },
  cancelButton: { paddingVertical: spacing.sm, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '600' },
  confirmButton: { marginTop: spacing.md, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#ffffff', fontWeight: '700', fontSize: typography.size.md },
});
