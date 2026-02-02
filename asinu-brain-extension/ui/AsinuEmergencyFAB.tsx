import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../src/styles';
import { postBrainEmergency } from '../asinuBrain.api';

type EmergencyType = 'SUDDEN_TIRED' | 'VERY_UNWELL' | 'ALERT_CAREGIVER';

type Props = {
  onInteraction?: () => void;
};

export const AsinuEmergencyFAB = ({ onInteraction }: Props) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState<EmergencyType | null>(null);

  const open = () => {
    onInteraction?.();
    setVisible(true);
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
      <Pressable onPress={open} style={styles.fab} accessibilityLabel="Emergency">
        <Text style={styles.fabText}>!</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Can ho tro ngay?</Text>
            <Pressable
              onPress={() => sendEmergency('SUDDEN_TIRED')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'SUDDEN_TIRED' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Met dot ngot</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('VERY_UNWELL')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'VERY_UNWELL' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Rat khong on</Text>
            </Pressable>
            <Pressable
              onPress={() => sendEmergency('ALERT_CAREGIVER')}
              disabled={!!loading}
              style={[styles.actionButton, loading === 'ALERT_CAREGIVER' && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionText}>Bao nguoi than</Text>
            </Pressable>
            <Pressable onPress={close} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Dong</Text>
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
