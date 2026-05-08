import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { authApi } from '../features/auth/auth.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ApiError } from '../lib/apiClient';
import { showToast } from '../stores/toast.store';
import { colors, iconColors, radius, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({ visible, onClose }: Props) {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const typography = useScaledTypography();
  const styles = useMemo(() => createStyles(typography), [typography]);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setCurrent(''); setNext(''); setConfirm('');
    setShowCurrent(false); setShowNext(false); setShowConfirm(false);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (next.length < 8) { setError(t('passwordTooShort')); return; }
    if (next === current) { setError(t('passwordSameAsOld')); return; }
    if (next !== confirm) { setError(t('passwordsDoNotMatch')); return; }

    setSubmitting(true);
    try {
      await authApi.changePassword(current, next);
      showToast(t('changePasswordSuccess'), 'success');
      reset();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message || tc('error'));
      else setError(tc('error'));
    } finally {
      setSubmitting(false);
    }
  }, [current, next, confirm, t, tc, reset, onClose]);

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(v) => { onChange(v); setError(''); }}
          placeholder={t('passwordPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.eyeBtn} onPress={() => setShow(!show)} hitSlop={8}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons name="key-outline" size={24} color={iconColors.primary} />
              </View>
              <Text style={styles.title}>{t('changePassword')}</Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {renderField(t('currentPassword'), current, setCurrent, showCurrent, setShowCurrent)}
            {renderField(t('newPassword'), next, setNext, showNext, setShowNext)}
            {renderField(t('confirmNewPassword'), confirm, setConfirm, showConfirm, setShowConfirm)}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (submitting || !current || !next || !confirm) && styles.submitBtnDisabled, pressed && { opacity: 0.85 }]}
              disabled={submitting || !current || !next || !confirm}
              onPress={handleSubmit}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{t('save')}</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    overlay: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#eff6ff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    fieldGroup: { gap: spacing.xs },
    fieldLabel: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    input: {
      flex: 1,
      fontSize: typography.size.md,
      color: colors.textPrimary,
      paddingVertical: spacing.md,
    },
    eyeBtn: { padding: spacing.xs },
    errorText: {
      fontSize: typography.size.sm,
      color: '#dc2626',
      textAlign: 'center',
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnText: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
}
