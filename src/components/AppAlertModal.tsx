/**
 * AppAlertModal — drop-in replacement for Alert.alert()
 * Renders a styled modal instead of native alert.
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
};

export function AppAlertModal({ visible, title, message, buttons, onDismiss }: Props) {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  const handlePress = (btn: AlertButton) => {
    onDismiss();
    btn.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.buttonRow}>
            {resolvedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.button,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    !isCancel && !isDestructive && styles.buttonDefault,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => handlePress(btn)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Helper hook to manage alert modal state */
export function useAppAlert() {
  const [state, setState] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [] as AlertButton[],
  });

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    setState({ visible: true, title, message: message ?? '', buttons: buttons ?? [] });
  };

  const dismissAlert = () => setState(prev => ({ ...prev, visible: false }));

  return { alertState: state, showAlert, dismissAlert };
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 340,
    },
    title: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    button: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    buttonDefault: {
      backgroundColor: colors.primary,
    },
    buttonCancel: {
      backgroundColor: colors.surfaceMuted,
    },
    buttonDestructive: {
      backgroundColor: colors.danger,
    },
    buttonText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: '#ffffff',
    },
    buttonTextCancel: {
      color: colors.textSecondary,
    },
    buttonTextDestructive: {
      color: '#ffffff',
    },
  });
}
