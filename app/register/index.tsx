import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

const appLogo = require('../../logo.jpg');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { TextInput } from '../../src/components/TextInput';
import { Toast } from '../../src/components/Toast';
import { authApi } from '../../src/features/auth/auth.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { getPasswordStrength, validateEmail, validatePassword, validatePhone } from '../../src/lib/validation';
import { colors, radius, spacing } from '../../src/styles';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAgreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const { t: ts } = useTranslation('settings');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const { scale, setScale } = useFontSizeStore();
  const [showFontModal, setShowFontModal] = useState(false);

  const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; iconSize: number }> = [
    { value: 'small', iconSize: 16 },
    { value: 'normal', iconSize: 20 },
    { value: 'large', iconSize: 24 },
    { value: 'xlarge', iconSize: 28 },
  ];

  const getFontSizeLabel = (v: FontSizeScale) => {
    const labels: Record<FontSizeScale, string> = {
      small: ts('fontSmall'),
      normal: ts('fontNormal'),
      large: ts('fontLarge'),
      xlarge: ts('fontXLarge'),
    };
    return labels[v];
  };

  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  const handleEmailBlur = () => {
    const err = validateEmail(email);
    setEmailError(err || undefined);
  };

  const handlePhoneBlur = () => {
    const err = validatePhone(phone);
    setPhoneError(err || undefined);
  };

  const handlePasswordBlur = () => {
    const err = validatePassword(password);
    setPasswordError(err || undefined);
  };

  const getPasswordStrengthColor = () => {
    if (!password) return colors.textSecondary;
    const { strength } = getPasswordStrength(password);
    if (strength === 'weak') return '#ef4444';
    if (strength === 'medium') return colors.premium;
    return '#22c55e';
  };

  const getPasswordStrengthText = () => {
    if (!password) return '';
    const { strength } = getPasswordStrength(password);
    if (strength === 'weak') return t('strengthWeak');
    if (strength === 'medium') return t('strengthMedium');
    return t('strengthStrong');
  };

  const handleSubmit = async () => {
    const emailErr = validateEmail(email);
    const phoneErr = validatePhone(phone);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr || undefined);
    setPhoneError(phoneErr || undefined);
    setPasswordError(passwordErr || undefined);

    if (emailErr || phoneErr || passwordErr) {
      setError(t('checkInfo'));
      return;
    }

    if (!isAgreed) {
      setError(t('agreeRequired'));
      return;
    }

    setError(undefined);
    setLoading(true);
    try {
      await authApi.register({
        email: email.trim(),
        phone_number: phone.trim(),
        password: password.trim(),
        full_name: name.trim() || undefined,
      });
      setToastMessage(t('registerSuccess'));
      setToastType('success');
      setShowToast(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err: any) {
      setError(err.message || t('registerFailed'));
      setToastMessage(err.message || t('registerFailed'));
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = isAgreed && email.trim() && phone.trim() && password.trim() && !loading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Font size modal */}
      {showFontModal && (
        <Pressable style={styles.fontModalOverlay} onPress={() => setShowFontModal(false)}>
          <Pressable style={styles.fontModalCard} onPress={() => {}}>
            <Text style={styles.fontModalTitle}>{ts('fontSize')}</Text>
            <View style={styles.fontSizeRow}>
              {FONT_SIZE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => { setScale(opt.value); setShowFontModal(false); }}
                  style={[styles.fontSizeBtn, scale === opt.value && styles.fontSizeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name="format-size"
                    size={opt.iconSize}
                    color={scale === opt.value ? '#fff' : colors.primary}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={[styles.fontSizeBtnText, scale === opt.value && styles.fontSizeBtnTextActive]}>
                    {getFontSizeLabel(opt.value)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fontSizePreview}>{ts('fontPreview')}</Text>
          </Pressable>
        </Pressable>
      )}

      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        position="center"
        onHide={() => setShowToast(false)}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBarRow}>
          <Pressable style={styles.fontSizeTopBtn} onPress={() => setShowFontModal(true)}>
            <MaterialCommunityIcons name="format-size" size={16} color={colors.primary} />
            <Text style={styles.fontSizeTopLabel}>{getFontSizeLabel(scale)}</Text>
          </Pressable>
          <LanguageToggle />
        </Animated.View>

        {/* Logo + Title */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.heroSection}>
          <View style={styles.logoWrap}>
            <Image source={appLogo} style={styles.logo} resizeMode="cover" />
          </View>
          <Text style={styles.title}>{t('createAccount')}</Text>
          <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View entering={FadeInDown.delay(250).duration(500)}>
          <View style={styles.formCard}>
            {/* Email */}
            <View style={styles.inputGroup}>
              <TextInput
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailError(undefined); }}
                onBlur={handleEmailBlur}
                placeholder={t('emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  </View>
                }
              />
              {emailError && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.fieldError}>{emailError}</Text>
                </View>
              )}
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <TextInput
                value={phone}
                onChangeText={(text) => { setPhone(text); setPhoneError(undefined); }}
                onBlur={handlePhoneBlur}
                placeholder={t('phonePlaceholder')}
                keyboardType="phone-pad"
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="call-outline" size={18} color={colors.primary} />
                  </View>
                }
              />
              <Text style={styles.fieldHelp}>{t('phoneHelp')}</Text>
              {phoneError && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.fieldError}>{phoneError}</Text>
                </View>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <TextInput
                value={password}
                onChangeText={(text) => { setPassword(text); setPasswordError(undefined); }}
                onBlur={handlePasswordBlur}
                placeholder={t('minChars')}
                secureTextEntry={!showPassword}
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                  </View>
                }
                rightElement={
                  <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color={colors.textSecondary} />
                  </Pressable>
                }
              />
              {passwordError && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.fieldError}>{passwordError}</Text>
                </View>
              )}
              {password && !passwordError && (
                <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
                  {t('strengthLabel')} {getPasswordStrengthText()}
                </Text>
              )}
            </View>

            {/* Name (optional) */}
            <View style={styles.inputGroup}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('namePlaceholder')}
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                  </View>
                }
              />
            </View>

            {/* Agree checkbox */}
            <View style={styles.checkboxRow}>
              <Pressable style={styles.checkboxToggle} onPress={() => setAgreed(!isAgreed)}>
                <Ionicons
                  name={isAgreed ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isAgreed ? colors.primary : colors.textSecondary}
                />
                <Text style={styles.checkboxLabel}>{t('agreeCheckbox')}</Text>
              </Pressable>
              <Pressable onPress={() => openLegal('terms')}>
                <Text style={styles.linkItalic}>{t('termsOfUse')}</Text>
              </Pressable>
              <Text style={styles.checkboxLabel}>{t('and')}</Text>
              <Pressable onPress={() => openLegal('privacy')}>
                <Text style={styles.linkItalic}>{t('privacyPolicyShort')}</Text>
              </Pressable>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="warning" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Register Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                !canSubmit && styles.submitBtnDisabled,
                pressed && canSubmit && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <LinearGradient
                colors={canSubmit ? [colors.primary, colors.primaryDark] : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtnGradient}
              >
                {loading ? (
                  <MaterialCommunityIcons name="loading" size={20} color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-plus" size={20} color={canSubmit ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.submitBtnText, !canSubmit && { color: colors.textSecondary }]}>
                      {loading ? tc('processing') : t('register')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Login link */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.loginPrompt}>
          <Text style={styles.loginText}>{t('hasAccount')}</Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.loginLink}> {t('login')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },

    // ── Top bar ──
    topBarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fontSizeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      height: 36,
    },
    fontSizeTopLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },

    // ── Font modal ──
    fontModalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    fontModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      width: '85%',
      alignItems: 'center',
    },
    fontModalTitle: {
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    fontSizeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    fontSizeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    fontSizeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    fontSizeBtnText: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    fontSizeBtnTextActive: {
      color: '#fff',
    },
    fontSizePreview: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // ── Hero ──
    heroSection: {
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    logoWrap: {
      width: 80,
      height: 80,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
      borderWidth: 2,
      borderColor: colors.primary + '22',
    },
    logo: {
      width: '100%',
      height: '100%',
    },
    title: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: spacing.sm,
      width: '100%',
    },
    subtitle: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: typography.size.sm,
      lineHeight: 20,
      width: '100%',
    },

    // ── Form Card ──
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    inputGroup: {
      gap: spacing.xs,
    },
    inputRounded: {
      borderRadius: radius.xxl,
      height: 52,
    },
    inputIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeBtn: {
      padding: 4,
    },
    fieldErrorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: spacing.sm,
    },
    fieldError: {
      color: colors.danger,
      fontSize: typography.size.xs,
    },
    fieldHelp: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      marginLeft: spacing.sm,
    },
    strengthText: {
      fontSize: typography.size.xs,
      marginLeft: spacing.sm,
      fontWeight: '600',
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: '#fef2f2',
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: typography.size.xs,
      flex: 1,
    },

    // ── Checkbox ──
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    checkboxToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    checkboxLabel: {
      color: colors.textPrimary,
      fontSize: typography.size.xs,
    },
    linkItalic: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: typography.size.xs,
    },

    // ── Submit Button ──
    submitBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      marginTop: spacing.xs,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    submitBtnDisabled: {
      shadowOpacity: 0,
    },
    submitBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md + 2,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },

    // ── Login link ──
    loginPrompt: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
    },
    loginLink: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
  });
}
