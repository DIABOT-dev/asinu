import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { colors, spacing, typography } from '../../src/styles';
import { postBrainEmergency } from '../asinuBrain.api';

type EmergencyType = 'SUDDEN_TIRED' | 'VERY_UNWELL' | 'ALERT_CAREGIVER';

type Props = {
  onInteraction?: () => void;
};

const FAB_POSITION_KEY = '@asinu_fab_position';

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const { t } = useTranslation('home');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState<EmergencyType | null>(null);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const lastTap = useRef(0);
  const isDragging = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

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
        console.warn('[AsinuEmergencyFAB] Failed to load position', error);
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
      console.warn('[AsinuEmergencyFAB] Failed to save position', error);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => {
        isDragging.current = true;
        return true;
      },
      onPanResponderMove: (evt, { dx, dy }) => {
        pan.x.setValue(offsetRef.current.x + dx);
        pan.y.setValue(offsetRef.current.y + dy);
      },
      onPanResponderRelease: (evt, { dx, dy }) => {
        isDragging.current = false;
        // Lưu lại offset và persist vào storage
        const newX = offsetRef.current.x + dx;
        const newY = offsetRef.current.y + dy;
        offsetRef.current.x = newX;
        offsetRef.current.y = newY;
        savePosition(newX, newY);
      },
      onPanResponderTerminate: (evt, { dx, dy }) => {
        isDragging.current = false;
        const newX = offsetRef.current.x + dx;
        const newY = offsetRef.current.y + dy;
        offsetRef.current.x = newX;
        offsetRef.current.y = newY;
        savePosition(newX, newY);
      }
    })
  ).current;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 500 && !isDragging.current) {
      onInteraction?.();
      setVisible(true);
    }
    lastTap.current = now;
  };

  const close = () => {
    onInteraction?.();
    setVisible(false);
  };

  const sendEmergency = async (type: EmergencyType) => {
    onInteraction?.();
    try {
      setLoading(type);
      await postBrainEmergency({ type });
    } catch (error) {
      console.warn('[AsinuEmergencyFAB] emergency failed', error);
    } finally {
      setLoading(null);
      setVisible(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {positionLoaded && (
        <Animated.View
          style={[styles.fabContainer, pan.getLayout()]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={styles.fab}
            onPress={handlePress}
            accessibilityLabel="Emergency"
          >
            <Text style={styles.fabText}>!</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('emergencyTitle')}</Text>
            <Pressable
              onPress={() => sendEmergency('SUDDEN_TIRED')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'SUDDEN_TIRED' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>{t('emergencySuddenTired')}</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('VERY_UNWELL')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'VERY_UNWELL' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>{t('emergencyVeryUnwell')}</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('ALERT_CAREGIVER')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'ALERT_CAREGIVER' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>{t('emergencyAlertCaregiver')}</Text>
            </Pressable>
            <Pressable onPress={close} style={styles.cancelButton}>
              <Text style={styles.cancelText}>{t('common:close')}</Text>
            </Pressable>
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
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  }
});
