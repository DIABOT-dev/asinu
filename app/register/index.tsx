import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as RNTextInput } from '../../src/components/ScaledTextInput';
import { authApi } from '../../src/features/auth/auth.api';
import { showToast } from '../../src/stores/toast.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { validateEmail, validatePassword, validatePhone } from '../../src/lib/validation';
import { colors, radius, spacing } from '../../src/styles';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { MedicalAuthBackdrop } from '../../src/components/MedicalAuthBackdrop';

const appLogo = require('../../assets/icon.png');

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const { t: ts } = useTranslation('settings');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);
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
      showToast(t('agreeRequired'), 'error');
      return;
    }

    setError(undefined);
    setLoading(true);
    try {
      await authApi.register({
        email: email.trim(),
        phone_number: phone.trim() || undefined,
        password: password.trim(),
        full_name: name.trim() || undefined,
      });
      showToast(t('registerSuccess'), 'success');
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err: any) {
      const raw = String(err?.message || '');
      const isHtml = raw.includes('<!DOCTYPE') || raw.includes('<html');
      const msg = (isHtml || raw.length > 200 || !raw)
        ? t('registerFailed')
        : raw;

      const msgLower = msg.toLowerCase();
      if (msgLower.includes('phone') || msgLower.includes('điện thoại') || msgLower.includes('số điện thoại')) {
        setPhoneError(msg);
        setError(undefined);
      } else if (msgLower.includes('email')) {
        setEmailError(msg);
        setError(undefined);
      } else {
        setError(msg);
      }
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = isAgreed && email.trim() && password.trim() && !loading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, backgroundColor: isDark ? '#0A1A2F' : '#FAFCFE' }}>
        <MedicalAuthBackdrop width={width} height={height} isDark={isDark} />

        {/* Font size modal (if triggered) */}
        {showFontModal && (
          <Pressable style={styles.fontModalOverlay} onPress={() => setShowFontModal(false)}>
            <Pressable style={styles.fontModalCard} onPress={() => {}}>
              <Text style={styles.fontModalTitle}>{ts('fontSize')}</Text>
              <View style={styles.fontSizeRow}>
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setScale(opt.value); setShowFontModal(false); }}
                    style={[styles.fontSizeBtn, scale === opt.value && styles.fontSizeBtnActive]}
                  >
                    <MaterialCommunityIcons
                      name="format-size"
                      size={opt.iconSize}
                      color={scale === opt.value ? '#fff' : '#20BCB4'}
                      style={{ width: 28, textAlign: 'center' }}
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

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: Math.max(insets.bottom, 24) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar: Pill Language Toggle on Right */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.topBarRowNoBack}>
            <LanguageToggle />
          </Animated.View>

          {/* Logo + Title + Subtitle */}
          <View style={styles.heroSection}>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.logoWrap}>
              <Image source={appLogo} style={styles.logo} resizeMode="cover" />
            </Animated.View>
            <Animated.View entering={FadeIn.delay(200).duration(400)} style={{ alignSelf: 'stretch' }}>
              <Text style={styles.title}>{t('createAccount')}</Text>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(300).duration(400)} style={{ alignSelf: 'stretch' }}>
              <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>
            </Animated.View>
          </View>

          {/* Main Form Card */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View style={styles.formCard}>
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <View style={[styles.inputBox, emailError ? styles.inputBoxError : null]}>
                  <Ionicons name="mail-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                  <RNTextInput
                    value={email}
                    onChangeText={(text) => { setEmail(text); setEmailError(undefined); }}
                    onBlur={handleEmailBlur}
                    placeholder={t('emailPlaceholder')}
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.textInputField}
                  />
                </View>
                {emailError && (
                  <View style={styles.fieldErrorRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.fieldError}>{emailError}</Text>
                  </View>
                )}
              </View>

              {/* Phone Field */}
              <View style={styles.inputGroup}>
                <View style={[styles.inputBox, phoneError ? styles.inputBoxError : null]}>
                  <Ionicons name="call-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                  <RNTextInput
                    value={phone}
                    onChangeText={(text) => { setPhone(text); setPhoneError(undefined); }}
                    onBlur={handlePhoneBlur}
                    placeholder={t('phonePlaceholder')}
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    keyboardType="phone-pad"
                    style={styles.textInputField}
                  />
                </View>
                <Text style={styles.fieldHelp}>{t('phoneHelp')}</Text>
                {phoneError && (
                  <View style={styles.fieldErrorRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.fieldError}>{phoneError}</Text>
                  </View>
                )}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <View style={[styles.inputBox, passwordError ? styles.inputBoxError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                  <RNTextInput
                    value={password}
                    onChangeText={(text) => { setPassword(text); setPasswordError(undefined); }}
                    onBlur={handlePasswordBlur}
                    placeholder={t('minChars')}
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    secureTextEntry={!showPassword}
                    style={styles.textInputField}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={12}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={isDark ? '#64748B' : '#94A3B8'}
                    />
                  </Pressable>
                </View>
                {passwordError && (
                  <View style={styles.fieldErrorRow}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.fieldError}>{passwordError}</Text>
                  </View>
                )}
              </View>

              {/* Full Name Field */}
              <View style={styles.inputGroup}>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                  <RNTextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    autoCapitalize="words"
                    style={styles.textInputField}
                  />
                </View>
              </View>

              {/* Agree Checkbox */}
              <View style={styles.checkboxContainer}>
                <Pressable
                  onPress={() => setAgreed(!isAgreed)}
                  style={[
                    styles.checkboxBox,
                    isAgreed && styles.checkboxBoxChecked,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isAgreed }}
                >
                  {isAgreed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                </Pressable>

                <View style={styles.checkboxTextRow}>
                  <Pressable onPress={() => setAgreed(!isAgreed)}>
                    <Text style={styles.checkboxText}>{t('agreeCheckbox')}</Text>
                  </Pressable>
                  <Pressable onPress={() => openLegal('terms')}>
                    <Text style={styles.checkboxLink}>{t('termsOfUse')}</Text>
                  </Pressable>
                  <Text style={styles.checkboxText}> & </Text>
                  <Pressable onPress={() => openLegal('privacy')}>
                    <Text style={styles.checkboxLink}>{t('privacyPolicyShort')}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Register Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  !canSubmit && styles.submitBtnDisabled,
                  pressed && canSubmit && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
              >
                <LinearGradient
                  colors={['#24C7BF', '#1BB5AD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="account-plus" size={21} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>
                        {loading ? tc('processing') : t('register')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>

          {/* Trust Points Card (Bảo mật - An toàn - Hỗ trợ) */}
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <View style={styles.trustCard}>
              {/* Item 1: Bảo mật */}
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark-outline" size={28} color="#1AB6AE" />
                <View style={styles.trustCopy}>
                  <Text style={styles.trustTitle}>{t('registerSecurityTitle')}</Text>
                  <Text style={styles.trustText}>{t('registerSecurityText')}</Text>
                </View>
              </View>

              <View style={styles.trustDivider} />

              {/* Item 2: An toàn */}
              <View style={styles.trustItem}>
                <Ionicons name="lock-closed-outline" size={28} color="#1AB6AE" />
                <View style={styles.trustCopy}>
                  <Text style={styles.trustTitle}>{t('registerSafetyTitle')}</Text>
                  <Text style={styles.trustText}>{t('registerSafetyText')}</Text>
                </View>
              </View>

              <View style={styles.trustDivider} />

              {/* Item 3: Hỗ trợ */}
              <View style={styles.trustItem}>
                <Ionicons name="headset-outline" size={28} color="#1AB6AE" />
                <View style={styles.trustCopy}>
                  <Text style={styles.trustTitle}>{t('registerSupportTitle')}</Text>
                  <Text style={styles.trustText}>{t('registerSupportText')}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Login Prompt */}
          <Animated.View entering={FadeInUp.delay(450).duration(400)} style={styles.loginPrompt}>
            <Text style={styles.loginText}>{t('hasAccount')}</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>{t('login')}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },

    // ── Top Bar ──
    topBarRowNoBack: {
      alignItems: 'flex-end',
    },

    // ── Font Modal ──
    fontModalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    fontModalCard: {
      backgroundColor: isDark ? '#1E293B' : colors.surface,
      borderRadius: 22,
      padding: spacing.xl,
      width: '85%',
      borderWidth: 1,
      borderColor: isDark ? '#334155' : colors.border,
    },
    fontModalTitle: {
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : colors.textPrimary,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    fontSizeRow: {
      flexDirection: 'column',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    fontSizeBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : colors.border,
      backgroundColor: isDark ? '#0F172A' : colors.background,
      gap: spacing.sm,
    },
    fontSizeBtnActive: {
      backgroundColor: '#20BCB4',
      borderColor: '#20BCB4',
    },
    fontSizeBtnText: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : colors.textSecondary,
    },
    fontSizeBtnTextActive: {
      color: '#fff',
    },
    fontSizePreview: {
      fontSize: typography.size.md,
      color: isDark ? '#94A3B8' : colors.textSecondary,
      textAlign: 'center',
    },

    // ── Hero ──
    heroSection: {
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    logoWrap: {
      width: 96,
      height: 96,
      borderRadius: 26,
      backgroundColor: '#FFFFFF',
      borderWidth: 3.5,
      borderColor: '#FFFFFF',
      overflow: 'hidden',
      shadowColor: '#0284C7',
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
      marginBottom: 6,
    },
    logo: {
      width: '100%',
      height: '100%',
    },
    title: {
      fontSize: 27,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#0B1E48',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: isDark ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 2,
    },

    // ── Form Card ──
    formCard: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 26,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 22,
      gap: 14,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#F1F7FB',
      shadowColor: '#0284C7',
      shadowOpacity: 0.07,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    inputGroup: {
      gap: 4,
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 54,
      borderRadius: 16,
      backgroundColor: isDark ? '#0F172A' : '#F8FCFE',
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2EEF5',
      paddingHorizontal: 16,
    },
    inputBoxError: {
      borderColor: colors.danger,
    },
    inputLeftIcon: {
      marginRight: 12,
    },
    textInputField: {
      flex: 1,
      fontSize: 14.5,
      color: isDark ? '#F8FAFC' : '#0F172A',
      height: '100%',
      paddingVertical: 0,
    },
    eyeBtn: {
      padding: 6,
      marginLeft: 4,
    },
    fieldHelp: {
      fontSize: 12.5,
      color: isDark ? '#94A3B8' : '#64748B',
      marginLeft: 4,
      marginTop: 2,
    },
    fieldErrorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 4,
      marginTop: 2,
    },
    fieldError: {
      color: colors.danger,
      fontSize: typography.size.xs,
    },

    // ── Checkbox ──
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    checkboxBox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: isDark ? '#64748B' : '#94A3B8',
      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxBoxChecked: {
      backgroundColor: '#20BCB4',
      borderColor: '#20BCB4',
    },
    checkboxTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      flex: 1,
    },
    checkboxText: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
    },
    checkboxLink: {
      fontSize: 13,
      color: '#1AB6AE',
      fontWeight: '600',
    },

    // ── Error ──
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.danger + '18',
      borderRadius: radius.md,
      padding: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: typography.size.xs,
      flex: 1,
    },

    // ── Submit Button ──
    submitBtn: {
      borderRadius: 26,
      overflow: 'hidden',
      marginTop: 4,
      shadowColor: '#20BCB4',
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.55,
      shadowOpacity: 0,
      elevation: 0,
    },
    submitBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 26,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Trust Card ──
    trustCard: {
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#F1F7FB',
      shadowColor: '#0284C7',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    trustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      justifyContent: 'center',
    },
    trustCopy: {
      justifyContent: 'center',
    },
    trustTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#0B1E48',
    },
    trustText: {
      fontSize: 12,
      fontWeight: '400',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    trustDivider: {
      width: 1,
      height: 36,
      backgroundColor: isDark ? '#334155' : '#E2EEF5',
    },

    // ── Login Prompt ──
    loginPrompt: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 4,
    },
    loginText: {
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 13.5,
    },
    loginLink: {
      color: '#20BCB4',
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}
