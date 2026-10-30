import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ScaledText as Text } from './ScaledText';
import { ScaledTextInput as TextInput } from './ScaledTextInput';
import { colors, lightColors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type DeleteAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const details = [
  {
    icon: 'clock-outline',
    titleKey: 'deleteWarningTitle1',
    bodyKey: 'deleteWarning1',
    warning: true,
  },
  {
    icon: 'database-outline',
    titleKey: 'deleteWarningTitle2',
    bodyKey: 'deleteWarning2',
  },
  {
    icon: 'shield-check-outline',
    titleKey: 'deleteWarningTitle3',
    bodyKey: 'deleteWarning3',
  },
  {
    icon: 'file-document-outline',
    titleKey: 'deleteWarningTitle4',
    bodyKey: 'deleteWarning4',
  },
] as const;
const normalizeConfirmation = (value: string) =>
  value.normalize('NFC').trim().toUpperCase();

export default function DeleteAccountModal({
  visible,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const latestInput = useRef('');
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const word = t('deleteConfirmWord');
  const valid =
    normalizeConfirmation(inputValue) === normalizeConfirmation(word);

  useEffect(() => {
    if (!visible) {
      latestInput.current = '';
      setInputValue('');
      setError(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (
      !visible ||
      normalizeConfirmation(latestInput.current) !== normalizeConfirmation(word) ||
      inFlight.current
    ) return;
    inFlight.current = true;
    setIsDeleting(true);
    setError(false);
    try {
      await onConfirm();
      latestInput.current = '';
      setInputValue('');
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setIsDeleting(false);
    }
  };
  const handleClose = () => {
    if (inFlight.current) return;
    latestInput.current = '';
    setInputValue('');
    setError(false);
    onClose();
  };
  const styles = useMemo(
    () =>
      StyleSheet.create({
        keyboard: { flex: 1 },
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
        },
        card: {
          width: '100%',
          maxWidth: 440,
          maxHeight: '96%',
          borderRadius: radius.xxl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        scroll: { flexShrink: 1 },
        body: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: spacing.sm,
        },
        icon: { alignSelf: 'center', marginBottom: spacing.md },
        title: {
          fontSize: typography.size.lg + 2,
          lineHeight: 32,
          fontWeight: '800',
          width: '100%',
          maxWidth: 300,
          alignSelf: 'center',
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: spacing.md,
        },
        lead: {
          fontSize: typography.size.sm,
          lineHeight: 23,
          textAlign: 'center',
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        },
        detail: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        detailIcon: { width: 28, marginTop: 3 },
        detailCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
        detailTitle: {
          fontSize: typography.size.sm + 1,
          lineHeight: 23,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        detailBody: {
          fontSize: typography.size.sm - 1,
          lineHeight: 21,
          color: colors.textSecondary,
        },
        footer: {
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
          paddingTop: spacing.md,
          gap: spacing.md,
        },
        confirmLabel: {
          fontSize: typography.size.sm,
          lineHeight: 22,
          fontWeight: '600',
          color: colors.textPrimary,
        },
        input: {
          minHeight: 56,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.background,
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: '600',
        },
        buttons: { flexDirection: 'row', gap: spacing.sm },
        button: {
          flex: 1,
          minWidth: 0,
          minHeight: 56,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        cancel: {
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
        },
        remove: { backgroundColor: lightColors.danger },
        disabled: { opacity: 0.45 },
        pressed: { opacity: 0.8 },
        buttonText: {
          fontSize: 16,
          lineHeight: 24,
          fontWeight: '700',
          textAlign: 'center',
          color: colors.textPrimary,
        },
        removeText: { color: lightColors.surface },
        error: {
          color: colors.danger,
          fontSize: typography.size.sm - 1,
          lineHeight: 21,
        },
      }),
    [isDark, typography]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}
          onPress={handleClose}
        >
          <Pressable
            accessibilityViewIsModal
            style={styles.card}
            onPress={(event) => event.stopPropagation()}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={40}
                color={colors.danger}
                style={styles.icon}
                accessible={false}
              />
              <Text accessibilityRole="header" style={styles.title}>
                {t('deleteAccountConfirm')}
              </Text>
              <Text style={styles.lead}>{t('deleteAccountWarning')}</Text>
              {details.map((item) => (
                <View key={item.titleKey} style={styles.detail}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={27}
                    style={styles.detailIcon}
                    color={
                      'warning' in item
                        ? colors.premiumDark
                        : colors.primaryText
                    }
                    accessible={false}
                  />
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailTitle}>{t(item.titleKey)}</Text>
                    <Text style={styles.detailBody}>{t(item.bodyKey)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.footer}>
              <Text style={styles.confirmLabel}>
                {t('deleteConfirmPrompt', { word })}
              </Text>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={(value) => {
                  latestInput.current = value;
                  setInputValue(value);
                  setError(false);
                }}
                accessibilityLabel={t('deleteConfirmPrompt', { word })}
                placeholder={t('deleteConfirmPlaceholder', { word })}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                editable={!isDeleting}
                returnKeyType="done"
              />
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t('deleteErrorGeneric')}
                </Text>
              ) : null}
              <View style={styles.buttons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tc('cancel')}
                  accessibilityState={{ disabled: isDeleting }}
                  onPress={handleClose}
                  disabled={isDeleting}
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancel,
                    pressed && styles.pressed,
                    isDeleting && styles.disabled,
                  ]}
                >
                  <Text style={styles.buttonText}>{tc('cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('deleteAccount')}
                  accessibilityState={{
                    disabled: !valid || isDeleting,
                    busy: isDeleting,
                  }}
                  onPress={handleConfirm}
                  disabled={!valid || isDeleting}
                  style={({ pressed }) => [
                    styles.button,
                    styles.remove,
                    (!valid || isDeleting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={[lightColors.danger, '#b91c1c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {isDeleting ? (
                    <ActivityIndicator
                      accessibilityLabel={t('deleteProcessing')}
                      color={lightColors.surface}
                    />
                  ) : (
                    <Text style={[styles.buttonText, styles.removeText]}>
                      {t('deleteAccount')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
