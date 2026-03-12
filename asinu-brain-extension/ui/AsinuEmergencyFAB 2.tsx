import { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../src/styles';
import { postBrainEmergency } from '../asinuBrain.api';

type EmergencyType = 'SUDDEN_TIRED' | 'VERY_UNWELL' | 'ALERT_CAREGIVER';

type Props = {
  onInteraction?: () => void;
};

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState<EmergencyType | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const lastTap = useRef(0);
  const isDragging = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

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
        // Lưu lại offset để lần tiếp theo sẽ cộng vào
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
      },
      onPanResponderTerminate: (evt, { dx, dy }) => {
        isDragging.current = false;
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
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

    } finally {
      setLoading(null);
      setVisible(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
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

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Cần hỗ trợ ngay?</Text>
            <Pressable
              onPress={() => sendEmergency('SUDDEN_TIRED')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'SUDDEN_TIRED' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Mệt đột ngột</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('VERY_UNWELL')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'VERY_UNWELL' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Rất không ổn</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('ALERT_CAREGIVER')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'ALERT_CAREGIVER' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Báo người thân</Text>
            </Pressable>
            <Pressable onPress={close} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Đóng</Text>
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
