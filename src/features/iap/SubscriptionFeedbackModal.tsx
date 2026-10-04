import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { radius, spacing } from '../../styles';

export type SubscriptionFeedback = {
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
};

type Props = {
  feedback: SubscriptionFeedback | null;
  onDismiss: () => void;
};

const FEEDBACK_ICONS = {
  success: 'shield-checkmark-outline',
  warning: 'time-outline',
  error: 'alert-circle-outline',
  info: 'information-circle-outline',
} as const;

export function SubscriptionFeedbackModal({ feedback, onDismiss }: Props) {
  const { t } = useTranslation('subscription');
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconColor = feedback?.kind === 'success'
    ? colors.success
    : feedback?.kind === 'warning'
      ? colors.premiumDark
      : feedback?.kind === 'error'
        ? colors.danger
        : colors.primaryDark;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={feedback !== null}
    >
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Ionicons
              name={FEEDBACK_ICONS[feedback?.kind ?? 'info']}
              size={42}
              color={iconColor}
              style={styles.icon}
            />
            <Text style={styles.eyebrow}>{t('iapFeedbackEyebrow')}</Text>
            <Text accessibilityRole="header" style={styles.title}>{feedback?.title}</Text>
            <Text style={styles.message}>{feedback?.message}</Text>
          </ScrollView>
          <Pressable
            accessibilityLabel={t('close')}
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{t('close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(palette: ReturnType<typeof useThemeColors>['colors']) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.overlay,
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      maxHeight: '82%',
      borderRadius: radius.xxl,
      backgroundColor: palette.surface,
      padding: spacing.xl,
    },
    content: {
      alignItems: 'center',
      paddingBottom: spacing.lg,
    },
    icon: {
      marginBottom: spacing.md,
    },
    eyebrow: {
      color: palette.primaryDark,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      color: palette.textPrimary,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      color: palette.textSecondary,
      fontSize: 15,
      textAlign: 'center',
    },
    button: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: palette.primaryDark,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    buttonPressed: {
      opacity: 0.82,
    },
    buttonText: {
      color: palette.surface,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
