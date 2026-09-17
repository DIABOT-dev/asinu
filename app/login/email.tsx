import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Circle, G, Path, Rect, Svg } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'react-native';
import React, { useMemo, useRef, useState } from 'react';
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
import { SocialProvider } from '../../src/features/auth/auth.service';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { showToast, setPendingToast, useToastStore } from '../../src/stores/toast.store';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { MedicalAuthBackdrop } from '../../src/components/MedicalAuthBackdrop';

const appLogo = require('../../assets/icon.png');

function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <Path fill="#34A853" d="M12 22c2.63 0 4.84-.87 6.46-2.36l-3.14-2.45c-.87.58-1.98.92-3.32.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.75 9.75 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.51 14.07A5.86 5.86 0 0 1 6.2 12c0-.72.12-1.42.31-2.07V7.4H3.27A9.99 9.99 0 0 0 2 12c0 1.66.4 3.23 1.27 4.6l3.24-2.53Z" />
      <Path fill="#EA4335" d="M12 3.88c1.43 0 2.72.49 3.74 1.45l2.8-2.8C16.84.95 14.63 0 12 0 7.27 0 3.27 2.7 1.27 7.4l3.24 2.53C5.29 5.6 7.45 3.88 12 3.88Z" />
    </Svg>
  );
}

const SOCIAL_PROVIDERS_BY_PLATFORM: Record<string, SocialProvider[]> = {
  ios: ['google', 'apple'],
  android: ['google', 'zalo'],
  default: ['google', 'apple'],
};

export default function LoginEmailScreen() {
  const flushPending = useToastStore((s) => s.flushPending);
  React.useEffect(() => {
    flushPending();
    useAuthStore.setState({ error: undefined });
  }, []);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<'login' | SocialProvider | null>(null);
  const navigatingRef = useRef(false);
  const login = useAuthStore((state) => state.login);
  const loginWithSocial = useAuthStore((state) => state.loginWithSocial);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const router = useRouter();

  const navigateAfterLogin = () => {
    const profile = useAuthStore.getState().profile;
    if (profile?.onboardingCompleted === true) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/onboarding');
    }
  };
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

  const getLoginErrorMessage = (loginError: unknown) => {
    const message = loginError instanceof Error
      ? loginError.message.trim()
      : typeof loginError === 'string'
        ? loginError.trim()
        : '';
    const errorName = loginError instanceof Error ? loginError.name : '';
    if (!message) return t('loginFailed');

    if (
      errorName === 'AbortError' ||
      errorName === 'RequestTimeoutError' ||
      /aborted|aborterror|timed out|timeout|network request failed|failed to fetch|network error/i.test(message)
    ) {
      return t('loginConnectionInterrupted');
    }

    return message;
  };

  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  const handleIdentifierBlur = () => {
    if (!identifier.trim()) {
      setIdentifierError(t('emailOrPhoneRequired'));
    } else {
      setIdentifierError(undefined);
    }
  };

  const handleLogin = async () => {
    if (loading || navigatingRef.current) return;
    useAuthStore.setState({ error: undefined });
    if (!identifier.trim()) {
      setIdentifierError(t('emailOrPhoneRequired'));
      return;
    }
    if (!password.trim()) {
      showToast(t('passwordRequired'), 'error');
      return;
    }
    setPendingAction('login');
    try {
      await login({ identifier: identifier.trim(), password: password.trim() });
      navigatingRef.current = true;
      setPendingToast(t('loginSuccess'), 'success');
      navigateAfterLogin();
    } catch (loginError) {
      showToast(getLoginErrorMessage(loginError), 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading || navigatingRef.current) return;
    useAuthStore.setState({ error: undefined });
    setPendingAction(provider);
    try {
      await loginWithSocial(provider);
      navigatingRef.current = true;
      setPendingToast(t('loginSuccess'), 'success');
      navigateAfterLogin();
    } catch (loginError) {
      showToast(getLoginErrorMessage(loginError), 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const isSubmitting = loading;
  const loginButtonLoading = isSubmitting && pendingAction === 'login';
  const canLogin = identifier.trim().length > 0 && password.trim().length > 0 && !isSubmitting;
  const inlineLoginError = error ? getLoginErrorMessage(error) : undefined;
  const visibleIdentifierError = identifier.trim() ? undefined : identifierError;

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, backgroundColor: isDark ? '#0A1A2F' : '#FAFCFE' }}>
          <MedicalAuthBackdrop width={width} height={height} isDark={isDark} />

          {/* Font size modal */}
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
            {/* Top Bar: Pill Font Size Button [Tt Nhỏ] & Pill Language Toggle [🇻🇳 VI | 🇬🇧 EN] */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.topBarRow}>
              <Pressable
                style={styles.fontSizeTopBtn}
                onPress={() => setShowFontModal(true)}
                accessibilityRole="button"
                accessibilityLabel={ts('fontSize')}
              >
                <Text style={styles.fontSizeTt}>Tt</Text>
                <Text style={styles.fontSizeTopLabel}>{getFontSizeLabel(scale)}</Text>
              </Pressable>
              <LanguageToggle />
            </Animated.View>

            {/* Logo + Title + Subtitle */}
            <View style={styles.heroSection}>
              <Animated.View entering={FadeInDown.duration(500)} style={styles.logoWrap}>
                <Image source={appLogo} style={styles.logo} resizeMode="cover" />
              </Animated.View>
              <Animated.View entering={FadeIn.delay(200).duration(400)} style={{ alignSelf: 'stretch' }}>
                <Text style={styles.title}>{t('welcomeTitle')}</Text>
              </Animated.View>
              <Animated.View entering={FadeIn.delay(300).duration(400)} style={{ alignSelf: 'stretch' }}>
                <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
              </Animated.View>
            </View>

            {/* Main Form Card */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <View style={styles.formCard}>
                {/* Email / Phone Input */}
                <View style={styles.inputGroup}>
                  <View style={[styles.inputBox, visibleIdentifierError ? styles.inputBoxError : null]}>
                    <Ionicons name="mail-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                    <RNTextInput
                      value={identifier}
                      onChangeText={(text) => {
                        setIdentifier(text);
                        setIdentifierError(undefined);
                        useAuthStore.setState({ error: undefined });
                      }}
                      onBlur={handleIdentifierBlur}
                      placeholder={t('emailOrPhone')}
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      keyboardType="default"
                      autoCapitalize="none"
                      style={styles.textInputField}
                    />
                  </View>
                  {visibleIdentifierError && (
                    <View style={styles.fieldErrorRow}>
                      <Ionicons name="alert-circle" size={14} color={colors.danger} />
                      <Text style={styles.fieldError}>{visibleIdentifierError}</Text>
                    </View>
                  )}
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.inputBox}>
                    <Ionicons name="lock-closed-outline" size={20} color="#1AB6AE" style={styles.inputLeftIcon} />
                    <RNTextInput
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        useAuthStore.setState({ error: undefined });
                      }}
                      placeholder={t('password')}
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
                </View>

                {/* Forgot Password */}
                <Pressable
                  onPress={() => showToast(t('forgotPasswordHelp'), 'info')}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotPassword}>{t('forgotPassword')}</Text>
                </Pressable>

                {/* Inline Error */}
                {inlineLoginError ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="warning" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{inlineLoginError}</Text>
                  </View>
                ) : null}

                {/* Login Button with Vibrant Turquoise-Mint Gradient and Pill Corners */}
                <Pressable
                  style={({ pressed }) => [
                    styles.loginBtn,
                    !canLogin && styles.loginBtnDisabled,
                    pressed && canLogin && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={handleLogin}
                  disabled={!canLogin || loginButtonLoading}
                >
                  <LinearGradient
                    colors={['#24C7BF', '#1BB5AD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginBtnGradient}
                  >
                    {loginButtonLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="log-in-outline" size={22} color="#FFFFFF" />
                        <Text style={styles.loginBtnText}>
                          {loginButtonLoading ? tc('processing') : t('login')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>

            {/* Divider: Hoặc đăng nhập bằng */}
            <Animated.View entering={FadeIn.delay(350).duration(400)} style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('orContinueWith')}</Text>
              <View style={styles.dividerLine} />
            </Animated.View>

            {/* Social Login: 2 Side-by-Side Cards (Google & Apple / Zalo) */}
            <Animated.View entering={FadeInUp.delay(450).duration(500)} style={styles.socialRow}>
              {(SOCIAL_PROVIDERS_BY_PLATFORM[Platform.OS] ?? SOCIAL_PROVIDERS_BY_PLATFORM.default)
                .slice(0, 2)
                .map((provider) => {
                  const isButtonLoading = isSubmitting && pendingAction === provider;
                  const label =
                    provider === 'google' ? t('continueWithGoogle') :
                    provider === 'apple' ? t('continueWithApple') :
                    provider === 'zalo' ? t('continueWithZalo') :
                    t('continueWithFacebook');

                  return (
                    <Pressable
                      key={provider}
                      onPress={() => handleSocialLogin(provider)}
                      disabled={isSubmitting}
                      style={({ pressed }) => [
                        styles.socialCard,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                        isSubmitting && { opacity: 0.5 },
                      ]}
                    >
                      {isButtonLoading ? (
                        <ActivityIndicator size="small" color="#20BCB4" />
                      ) : (
                        <>
                          {provider === 'google' ? (
                            <GoogleMark size={20} />
                          ) : provider === 'apple' ? (
                            <FontAwesome5 name="apple" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
                          ) : provider === 'zalo' ? (
                            <Image
                              source={require('../../src/assets/zalo.png')}
                              style={styles.zaloIcon}
                              resizeMode="contain"
                            />
                          ) : (
                            <FontAwesome5 name="facebook" size={20} color="#1877F2" />
                          )}
                          <Text style={styles.socialCardText} numberOfLines={1}>
                            {label}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
            </Animated.View>

            {/* Legal Links */}
            <Animated.View entering={FadeIn.delay(550).duration(400)} style={styles.legal}>
              <View style={styles.legalHelperRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#1AB6AE" />
                <Text style={styles.legalHelperText}>{t('agreeTerms')}</Text>
              </View>
              <View style={styles.legalLinksRow}>
                <Pressable onPress={() => openLegal('terms')}>
                  <Text style={styles.legalLink}>{t('termsOfUse')}</Text>
                </Pressable>
                <Text style={styles.legalDot}>•</Text>
                <Pressable onPress={() => openLegal('privacy')}>
                  <Text style={styles.legalLink}>{t('privacyPolicy')}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Register Prompt */}
            <Animated.View entering={FadeInUp.delay(650).duration(400)} style={styles.registerPrompt}>
              <Text style={styles.registerText}>{t('noAccount')}</Text>
              <Pressable onPress={() => router.replace('/register')}>
                <Text style={styles.registerLink}>{t('registerNow')}</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },

    // ── Top Bar ──
    topBarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fontSizeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2EEF5',
      paddingHorizontal: 14,
      height: 38,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    fontSizeTt: {
      fontSize: 16,
      fontWeight: '800',
      color: '#20BCB4',
      letterSpacing: -0.5,
    },
    fontSizeTopLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#20BCB4',
    },

    // ── Font Modal ──
    fontModalOverlay: {
      ...StyleSheet.absoluteFill,
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
      gap: 16,
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
    forgotButton: {
      alignSelf: 'flex-end',
      marginTop: -4,
      paddingVertical: 4,
    },
    forgotPassword: {
      color: '#1AB6AE',
      fontSize: 13.5,
      fontWeight: '600',
    },
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

    // ── Login Button ──
    loginBtn: {
      borderRadius: 26,
      overflow: 'hidden',
      marginTop: 2,
      shadowColor: '#20BCB4',
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    loginBtnDisabled: {
      opacity: 0.55,
      shadowOpacity: 0,
      elevation: 0,
    },
    loginBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 26,
    },
    loginBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // ── Divider ──
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? '#334155' : '#E2EEF5',
    },
    dividerText: {
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 13,
      fontWeight: '500',
      marginHorizontal: 14,
    },

    // ── Social Row (2 Side-by-Side Cards) ──
    socialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    socialCard: {
      flex: 1,
      height: 52,
      borderRadius: 18,
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2EEF5',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    socialCardText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F1F5F9' : '#0F172A',
      flexShrink: 1,
    },
    zaloIcon: {
      width: 22,
      height: 22,
    },

    // ── Legal ──
    legal: {
      gap: 4,
      alignItems: 'center',
      marginTop: 4,
    },
    legalHelperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legalHelperText: {
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 12.5,
    },
    legalLinksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
    },
    legalLink: {
      color: '#1AB6AE',
      fontWeight: '600',
      fontSize: 12.5,
    },
    legalDot: {
      color: '#1AB6AE',
      fontSize: 12,
    },

    // ── Register ──
    registerPrompt: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    registerText: {
      color: isDark ? '#94A3B8' : '#64748B',
      fontSize: 13.5,
    },
    registerLink: {
      color: '#20BCB4',
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}
