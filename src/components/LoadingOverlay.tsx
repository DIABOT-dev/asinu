import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const displayMessage = message ?? t('loading');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(8, 13, 17, 0.72)' : 'rgba(24, 28, 32, 0.56)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingCard: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      color: '#f8fafc',
      fontWeight: '700',
      textAlign: 'center',
    },
  }), [isDark]);
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#d1d5db" />
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
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
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
  }), [isDark]);
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
