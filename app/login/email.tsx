import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const zaloLogo = require('../../src/assets/zalo.png');
const appLogo = require('../../logo.jpg');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { TextInput } from '../../src/components/TextInput';
import { SocialProvider } from '../../src/features/auth/auth.service';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';
import { LanguageToggle } from '../../src/components/LanguageToggle';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';

export default function LoginEmailScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<'login' | SocialProvider | null>(null);
  const login = useAuthStore((state) => state.login);
  const loginWithSocial = useAuthStore((state) => state.loginWithSocial);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const router = useRouter();

  const navigateAfterLogin = () => {
    const profile = useAuthStore.getState().profile;
    if (profile && !profile.onboardingCompleted) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)/home');
    }
  };
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

  const handleIdentifierBlur = () => {
    if (!identifier.trim()) {
      setIdentifierError(t('emailOrPhoneRequired'));
    } else {
      setIdentifierError(undefined);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim() || loading) return;
    setPendingAction('login');
    try {
      await login({ identifier: identifier.trim(), password: password.trim() });
      navigateAfterLogin();
    } catch {
    } finally {
      setPendingAction(null);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading) return;
    setPendingAction(provider);
    try {
      await loginWithSocial(provider);
      navigateAfterLogin();
    } catch {
    } finally {
      setPendingAction(null);
    }
  };

  const isSubmitting = loading;
  const loginButtonLoading = isSubmitting && pendingAction === 'login';
  const canLogin = identifier.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

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
          <Text style={styles.title}>{t('login')}</Text>
          <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View entering={FadeInDown.delay(250).duration(500)}>
          <View style={styles.formCard}>
            {/* Email/Phone Input */}
            <View style={styles.inputGroup}>
              <TextInput
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  setIdentifierError(undefined);
                }}
                onBlur={handleIdentifierBlur}
                placeholder={t('emailOrPhone')}
                keyboardType="default"
                autoCapitalize="none"
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                  </View>
                }
              />
              {identifierError && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.danger} />
                  <Text style={styles.fieldError}>{identifierError}</Text>
                </View>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('password')}
                secureTextEntry={!showPassword}
                style={styles.inputRounded}
                leftIcon={
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                  </View>
                }
                rightElement={
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={8}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                }
              />
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="warning" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                !canLogin && styles.loginBtnDisabled,
                pressed && canLogin && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleLogin}
              disabled={!canLogin}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginBtnGradient}
              >
                {loginButtonLoading ? (
                  <MaterialCommunityIcons name="loading" size={20} color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="login" size={20} color="#fff" />
                    <Text style={styles.loginBtnText}>
                      {loginButtonLoading ? tc('processing') : t('login')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Divider */}
        <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('orContinueWith')}</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* Social Login */}
        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.socialGroup}>
          {(Platform.OS === 'ios'
            ? (['google', 'facebook', 'zalo', 'apple'] as SocialProvider[])
            : (['google', 'facebook', 'zalo'] as SocialProvider[])
          ).map((provider) => {
            const isButtonLoading = isSubmitting && pendingAction === provider;
            const label =
              provider === 'google' ? t('continueWithGoogle') :
              provider === 'facebook' ? t('continueWithFacebook') :
              provider === 'zalo' ? t('continueWithZalo') :
              t('continueWithApple');

            const meta = {
              google: { icon: 'google', color: '#EA4335', bg: '#fef2f2' },
              facebook: { icon: 'facebook', color: '#1877F2', bg: '#eff6ff' },
              zalo: { icon: null, color: '#0068FF', bg: '#eff6ff' },
              apple: { icon: 'apple', color: '#000', bg: '#f5f5f5' },
            }[provider];

            return (
              <Pressable
                key={provider}
                onPress={() => handleSocialLogin(provider)}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  isSubmitting && { opacity: 0.5 },
                ]}
              >
                {!isButtonLoading && (
                  <View style={[styles.socialIconCircle, { backgroundColor: meta.bg }]}>
                    {provider === 'zalo' ? (
                      <Image source={zaloLogo} style={styles.zaloIcon} resizeMode="contain" />
                    ) : (
                      <FontAwesome5 name={meta.icon} size={18} color={meta.color} brand />
                    )}
                  </View>
                )}
                <Text style={styles.socialButtonText}>
                  {isButtonLoading ? tc('processing') : label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary + '66'} />
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Legal */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.legal}>
          <Text style={styles.helper}>{t('agreeTerms')}</Text>
          <View style={styles.linkRow}>
            <Pressable onPress={() => openLegal('terms')}>
              <Text style={styles.link}>{t('termsOfUse')}</Text>
            </Pressable>
            <Text style={styles.separator}>·</Text>
            <Pressable onPress={() => openLegal('privacy')}>
              <Text style={styles.link}>{t('privacyPolicy')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Register */}
        <Animated.View entering={FadeInUp.delay(700).duration(400)} style={styles.registerPrompt}>
          <Text style={styles.registerText}>{t('noAccount')}</Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}> {t('register')}</Text>
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
    fontSizeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
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
      borderWidth: 1.5,
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
      borderWidth: 1.5,
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
      borderWidth: 1.5,
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

    // ── Login Button ──
    loginBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      marginTop: spacing.xs,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    loginBtnDisabled: {
      shadowOpacity: 0,
    },
    loginBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md + 2,
    },
    loginBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },

    // ── Divider ──
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      fontWeight: '500',
    },

    // ── Social Login ──
    socialGroup: {
      gap: spacing.sm,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    socialIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zaloIcon: {
      width: 20,
      height: 20,
    },
    socialButtonText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },

    // ── Legal ──
    legal: {
      gap: spacing.xs,
      alignItems: 'center',
    },
    helper: {
      color: colors.textSecondary,
      fontWeight: '400',
      fontSize: typography.size.xs,
      textAlign: 'center',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    link: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: typography.size.xs,
    },
    separator: {
      color: colors.textSecondary,
    },

    // ── Register ──
    registerPrompt: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    registerText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
    },
    registerLink: {
      color: colors.primary,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
  });
}
