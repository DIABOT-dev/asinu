import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const displayMessage = message ?? t('processing');
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { fontSize: scaledTypography.size.md }]}>{displayMessage}</Text>
        </View>
      </View>
    </Modal>
  );
}

interface SuccessOverlayProps {
  visible: boolean;
  message?: string;
  onComplete?: () => void;
  duration?: number;
}

export function SuccessOverlay({
  visible,
  message,
  onComplete,
  duration = 1500
}: SuccessOverlayProps) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const displayMessage = message ?? t('savedSuccessfully');
  useEffect(() => {
    if (visible && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, onComplete, duration]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#FFFFFF" />
          </View>
          <Text style={[styles.successText, { fontSize: scaledTypography.size.lg }]}>{displayMessage}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 220,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successIcon: {
    marginBottom: spacing.xs,
  },
  successText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
});
