/**
 * AppAlertModal — drop-in replacement for Alert.alert()
 * Renders a styled modal instead of native alert.
 */
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, iconColors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTranslation } from 'react-i18next';
import { QueuedModal } from './QueuedModal';

const SafeImage = (Image || View) as any;

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  variant?: 'primary' | 'outline' | 'text' | 'destructive';
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void | Promise<void>;
};

export type AlertIcon = {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
  color?: string;
  background?: 'circle' | 'none';
};

type AlertLayout = 'alert' | 'actions';
type AlertAppearance = 'default' | 'access';
type AlertOptions = {
  layout?: AlertLayout;
  appearance?: AlertAppearance;
  heroImage?: ComponentProps<typeof Image>['source'];
  primaryButtonBackground?: React.ReactNode;
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
  headerImage?: any;
  showCloseButton?: boolean;
  titleAlign?: 'center' | 'left';
  messageAlign?: 'center' | 'left';
  children?: React.ReactNode;
  layout?: AlertLayout;
  primaryButtonColors?: { background: string; foreground: string };
} & AlertOptions;

export function AppAlertModal({
  visible,
  title,
  message,
  buttons,
  icon,
  onDismiss,
  queued = false,
  onShow,
  stackButtons = false,
  scrollable = false,
  headerImage,
  showCloseButton = false,
  titleAlign = 'center',
  messageAlign = 'center',
  children,
  layout = 'alert',
  primaryButtonColors,
  appearance = 'default',
  heroImage,
  primaryButtonBackground,
}: Props) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);
  const afterDismissRef = useRef<AlertButton['onPress']>(undefined);
  const closingRef = useRef(false);
  const ModalComponent = queued ? QueuedModal : Modal;

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: t('ok'), style: 'default' }];
  const actionList = layout === 'actions';
  const accessAppearance = appearance === 'access';
  const boundedContent = scrollable || actionList || accessAppearance;
  const verticalButtons = actionList || stackButtons || resolvedButtons.length > 2;
  const content = (
    <View style={headerImage ? styles.contentWithHeader : undefined}>
      {accessAppearance && heroImage ? (
        <SafeImage source={heroImage} resizeMode="contain" style={styles.accessHero}
          accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      ) : null}
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          titleAlign === 'left' && styles.titleLeft,
          headerImage && styles.titleWithHeader,
          actionList && styles.actionTitle,
          accessAppearance && styles.accessTitle,
        ]}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            styles.message,
            messageAlign === 'left' && styles.messageLeft,
            headerImage && styles.messageWithHeader,
            actionList && styles.actionMessage,
            accessAppearance && styles.accessMessage,
          ]}
        >
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );

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

  const buttonList = (
    <View style={[
      styles.buttonRow,
      verticalButtons && { flexDirection: 'column' },
      headerImage && styles.buttonRowWithHeader,
      actionList && styles.actionList,
      accessAppearance && styles.accessButtonRow,
    ]}>
      {resolvedButtons.map((btn, i) => {
        const isCancel = btn.style === 'cancel';
        const isDestructive = btn.variant === 'destructive' || (!btn.variant && btn.style === 'destructive');
        const tint = actionList
          ? isDestructive ? colors.danger : isCancel ? colors.textSecondary : colors.primaryText
          : btn.variant === 'primary' ? primaryButtonColors?.foreground ?? '#ffffff'
          : btn.variant === 'outline' ? '#466d82'
          : isDestructive ? iconColors.danger
          : isCancel ? colors.textSecondary : colors.primary;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={btn.text}
            style={({ pressed }) => [
              styles.button,
              verticalButtons ? { width: '100%', minHeight: 48, justifyContent: 'center' } : { flex: 1 },
              btn.variant === 'primary' && styles.buttonTealPrimary,
              btn.variant === 'primary' && primaryButtonColors && { backgroundColor: primaryButtonColors.background },
              btn.variant === 'outline' && styles.buttonOutlineSecondary,
              btn.variant === 'text' && styles.buttonTextOnly,
              !btn.variant && isCancel && styles.buttonCancel,
              isDestructive && styles.buttonDestructive,
              !btn.variant && !isCancel && !isDestructive && styles.buttonDefault,
              actionList && styles.actionButton,
              accessAppearance && styles.accessButton,
              accessAppearance && isCancel && styles.accessCancel,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => handlePress(btn)}
          >
            {accessAppearance && btn.variant === 'primary' ? primaryButtonBackground : null}
            {actionList && btn.icon ? (
              <View style={styles.actionIcon} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <MaterialCommunityIcons name={btn.icon} size={25} color={tint} />
              </View>
            ) : null}
            <Text style={[
              styles.buttonText,
              btn.variant === 'primary' && styles.buttonTextTealPrimary,
              btn.variant === 'primary' && primaryButtonColors && { color: primaryButtonColors.foreground },
              btn.variant === 'outline' && styles.buttonTextOutlineSecondary,
              btn.variant === 'text' && styles.buttonTextOnlyText,
              !btn.variant && isCancel && styles.buttonTextCancel,
              isDestructive && styles.buttonTextDestructive,
              actionList && styles.actionButtonText,
              actionList && { color: tint },
              accessAppearance && styles.accessButtonText,
            ]}>
              {!actionList && btn.icon ? <MaterialCommunityIcons name={btn.icon} size={18} color={tint} /> : null}
              {!actionList && btn.icon ? '  ' : null}
              {btn.text}
            </Text>
            {actionList && !isCancel ? (
              <MaterialCommunityIcons name="chevron-right" size={23} color={tint} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ModalComponent visible={visible} transparent animationType="fade" onRequestClose={onDismiss} onShow={onShow} onDismiss={handleModalDismiss}>
      <Pressable style={[styles.overlay, boundedContent && {
        paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl,
      }]} onPress={onDismiss}>
        <Pressable
          accessibilityViewIsModal
          style={[
            styles.card,
            boundedContent && { maxHeight: '85%' },
            headerImage && styles.cardWithHeader,
            actionList && styles.actionCard,
            accessAppearance && styles.accessCard,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {accessAppearance ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.accessWashLeft} />
              <View style={styles.accessWashRight} />
            </View>
          ) : null}
          {actionList ? <View style={styles.actionHandle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
          {headerImage ? (
            <View style={styles.headerImageWrap}>
              <SafeImage source={headerImage} style={styles.headerImage} resizeMode="cover" />
              {showCloseButton ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                  hitSlop={12}
                  style={styles.closeButton}
                  onPress={onDismiss}
                >
                  <MaterialCommunityIcons name="close" size={22} color="#5d7280" />
                </Pressable>
              ) : null}
            </View>
          ) : showCloseButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              hitSlop={12}
              style={styles.closeButtonAbsolute}
              onPress={onDismiss}
            >
              <MaterialCommunityIcons name="close" size={22} color="#5d7280" />
            </Pressable>
          ) : null}

          {icon && !headerImage && !(accessAppearance && heroImage) ? (
            <View style={icon.background === 'none' ? styles.iconStandalone : styles.iconWrap}>
              <MaterialCommunityIcons name={icon.name} size={30} color={icon.color ?? colors.primary} />
            </View>
          ) : null}
          {boundedContent ? (
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {content}
              {actionList ? buttonList : null}
            </ScrollView>
          ) : content}
          {!actionList ? buttonList : null}
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
    layout: 'alert' as AlertLayout,
    appearance: 'default' as AlertAppearance,
    heroImage: undefined as AlertOptions['heroImage'],
    primaryButtonBackground: undefined as React.ReactNode,
  });

  const showAlert = (title: string, message?: string, buttons?: AlertButton[], icon?: AlertIcon, options?: AlertOptions) => {
    setState({ visible: true, title, message: message ?? '', buttons: buttons ?? [], icon,
      layout: options?.layout ?? 'alert', appearance: options?.appearance ?? 'default',
      heroImage: options?.heroImage, primaryButtonBackground: options?.primaryButtonBackground });
  };

  const dismissAlert = () => setState(prev => ({ ...prev, visible: false }));

  return { alertState: state, showAlert, dismissAlert };
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
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
    accessCard: { maxWidth: 420, borderRadius: radius.xxl + spacing.sm, overflow: 'hidden', padding: spacing.xl, borderColor: colors.primaryLight },
    accessWashLeft: { position: 'absolute', top: -160, left: -140, width: 260, height: 280, borderRadius: radius.full, backgroundColor: colors.primaryLight, opacity: 0.5 },
    accessWashRight: { position: 'absolute', top: -140, right: -170, width: 260, height: 280, borderRadius: radius.full, backgroundColor: colors.primaryLight, opacity: 0.5 },
    accessHero: { width: 180, height: 136, alignSelf: 'center', marginBottom: spacing.lg },
    accessTitle: { fontSize: typography.size.lg, fontWeight: '700', lineHeight: 32, marginBottom: spacing.lg },
    accessMessage: { fontSize: typography.size.sm + 2, lineHeight: 26, marginBottom: spacing.xl },
    accessButtonRow: { gap: spacing.sm, marginTop: spacing.sm },
    accessButton: { minHeight: 56, minWidth: 0, paddingHorizontal: spacing.sm, borderRadius: radius.xl, overflow: 'hidden' },
    accessCancel: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    accessButtonText: { fontSize: typography.size.sm + 1, lineHeight: 24, fontWeight: '700', zIndex: 1 },
    actionCard: {
      maxWidth: 380,
      borderRadius: radius.xxl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    actionHandle: {
      alignSelf: 'center',
      width: 48,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.textSecondary + '45',
      marginBottom: spacing.xl,
    },
    actionTitle: {
      fontSize: typography.size.md + 2,
      fontWeight: '700',
      lineHeight: 28,
    },
    actionMessage: {
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    actionList: {
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    actionButton: {
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 56,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    actionIcon: {
      width: 28,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonText: {
      flex: 1,
      minWidth: 0,
      textAlign: 'left',
      fontSize: typography.size.sm + 1,
      fontWeight: '700',
      lineHeight: 24,
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
      alignSelf: 'center',
      borderRadius: 32,
      height: 64,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 64,
    },
    iconStandalone: {
      alignItems: 'center',
      alignSelf: 'center',
      height: 48,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 48,
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
      minHeight: 48,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
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
      backgroundColor: colors.danger + (isDark ? '20' : '12'),
      borderWidth: 1,
      borderColor: colors.danger + '35',
    },
    buttonText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      flexShrink: 1,
    },
    buttonTextCancel: {
      color: colors.textSecondary,
    },
    buttonTextDestructive: {
      color: iconColors.danger,
    },
    cardWithHeader: {
      padding: 0,
      maxWidth: 360,
      borderRadius: 24,
      overflow: 'hidden',
    },
    headerImageWrap: {
      width: '100%',
      height: 105,
      position: 'relative',
      backgroundColor: '#f1f8fa',
    },
    headerImage: {
      width: '100%',
      height: '100%',
    },
    closeButton: {
      position: 'absolute',
      top: 10,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    closeButtonAbsolute: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 10,
    },
    contentWithHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xs,
    },
    buttonRowWithHeader: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      marginTop: spacing.xs,
    },
    titleLeft: {
      textAlign: 'left',
    },
    messageLeft: {
      textAlign: 'left',
    },
    titleWithHeader: {
      fontSize: 22,
      fontWeight: '700',
      color: '#132c4a',
      marginBottom: spacing.xs,
    },
    messageWithHeader: {
      fontSize: 14,
      lineHeight: 21,
      color: '#5a6e8c',
      marginBottom: spacing.md,
    },
    buttonTealPrimary: {
      backgroundColor: '#209f97',
      borderWidth: 0,
      borderRadius: 16,
      minHeight: 50,
    },
    buttonOutlineSecondary: {
      backgroundColor: '#ffffff',
      borderWidth: 1.5,
      borderColor: '#c1cee4',
      borderRadius: 16,
      minHeight: 50,
    },
    buttonTextOnly: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      minHeight: 48,
    },
    buttonTextTealPrimary: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 16,
    },
    buttonTextOutlineSecondary: {
      color: '#2e4d86',
      fontWeight: '600',
      fontSize: 15,
    },
    buttonTextOnlyText: {
      color: '#2e4d86',
      fontWeight: '600',
      fontSize: 16,
    },
  });
}
