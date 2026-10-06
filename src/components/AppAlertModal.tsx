/**
 * AppAlertModal — drop-in replacement for Alert.alert()
 * Renders a styled modal instead of native alert.
 */
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, iconColors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTranslation } from 'react-i18next';
import { QueuedModal } from './QueuedModal';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

export type AlertIcon = {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
  color?: string;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: AlertIcon;
  onDismiss: () => void;
  queued?: boolean;
  onShow?: () => void;
  stackButtons?: boolean;
  scrollable?: boolean;
};

export function AppAlertModal({ visible, title, message, buttons, icon, onDismiss, queued = false, onShow, stackButtons = false, scrollable = false }: Props) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const afterDismissRef = useRef<AlertButton['onPress']>(undefined);
  const closingRef = useRef(false);
  const ModalComponent = queued ? QueuedModal : Modal;

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: t('ok'), style: 'default' }];
  const verticalButtons = stackButtons || resolvedButtons.length > 2;
  const content = <>
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </>;

  const handlePress = (btn: AlertButton) => {
    if (queued) {
      if (closingRef.current) return;
      closingRef.current = true;
      afterDismissRef.current = btn.onPress;
    }
    onDismiss();
    if (!queued) btn.onPress?.();
  };

  const handleModalDismiss = () => {
    closingRef.current = false;
    const action = afterDismissRef.current;
    afterDismissRef.current = undefined;
    return action?.();
  };

  return (
    <ModalComponent visible={visible} transparent animationType="fade" onRequestClose={onDismiss} onShow={onShow} onDismiss={handleModalDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={[styles.card, scrollable && { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>
          {icon ? (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={icon.name} size={30} color={icon.color ?? colors.primary} />
            </View>
          ) : null}
          {scrollable ? <ScrollView style={{ flexShrink: 1 }}>{content}</ScrollView> : content}

          <View style={[styles.buttonRow, verticalButtons && { flexDirection: 'column' }]}>
            {resolvedButtons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.button,
                    verticalButtons ? { width: '100%', minHeight: 48, justifyContent: 'center' } : { flex: 1 },
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
        </Pressable>
      </Pressable>
    </ModalComponent>
  );
}

/** Helper hook to manage alert modal state */
export function useAppAlert() {
  const [state, setState] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [] as AlertButton[],
    icon: undefined as AlertIcon | undefined,
  });

  const showAlert = (title: string, message?: string, buttons?: AlertButton[], icon?: AlertIcon) => {
    setState({ visible: true, title, message: message ?? '', buttons: buttons ?? [], icon });
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
      borderWidth: 1,
      borderColor: colors.border,
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
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    buttonDefault: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    buttonCancel: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonDestructive: {
      backgroundColor: colors.danger + '12',
      borderWidth: 1,
      borderColor: colors.textPrimary + '20',
    },
    buttonText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.primary,
    },
    buttonTextCancel: {
      color: colors.textSecondary,
    },
    buttonTextDestructive: {
      color: iconColors.danger,
    },
  });
}
