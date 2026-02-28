import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { SocialProvider } from '../../src/features/auth/auth.service';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { colors, radius, spacing, typography } from '../../src/styles';

export default function LoginEmailScreen() {
  const [identifier, setIdentifier] = useState(''); // Email or phone
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<'login' | SocialProvider | null>(null);
  const login = useAuthStore((state) => state.login);
  const loginWithSocial = useAuthStore((state) => state.loginWithSocial);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  
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
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error(err);
    } finally {
      setPendingAction(null);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading) return;
    setPendingAction(provider);
    try {
      await loginWithSocial(provider);
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error(err);
    } finally {
      setPendingAction(null);
    }
  };

  const isSubmitting = loading;
  const loginButtonLoading = isSubmitting && pendingAction === 'login';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>{t('login')}</Text>
      <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>

      <View style={styles.form}>
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
            placeholderTextColor="#9AA0A6"
          />
          {identifierError && <Text style={styles.fieldError}>{identifierError}</Text>}
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('password')}
            secureTextEntry={!showPassword}
            style={[styles.inputRounded, styles.passwordInput]}
            placeholderTextColor="#9AA0A6"
          />
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={showPassword ? 'eye' : 'eye-off'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label={loginButtonLoading ? tc('processing') : t('login')}
          onPress={handleLogin}
          disabled={isSubmitting || !identifier.trim() || !password.trim()}
          style={styles.primaryButton}
        />
        <View style={styles.divider}>
          <Text style={styles.dividerText}>{t('orContinueWith')}</Text>
        </View>
        <View style={styles.socialGroup}>
          {(['google', 'apple'] as const).map((provider) => {
            const isButtonLoading = isSubmitting && pendingAction === provider;
            const label =
              provider === 'google' ? t('continueWithGoogle') : t('continueWithApple');

            return (
              <Pressable
                key={provider}
                onPress={() => handleSocialLogin(provider)}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.socialButtonPressed,
                  isSubmitting && styles.socialButtonDisabled
                ]}
              >
                <Text style={styles.socialButtonText}>{isButtonLoading ? tc('processing') : label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.legal}>
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
      </View>

      <View style={styles.registerPrompt}>
        <Text style={styles.registerText}>{t('noAccount')}</Text>
        <Pressable onPress={() => router.push('/register')}>
          <Text style={styles.registerLink}>{t('register')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'left',
    fontWeight: '400',
    marginBottom: spacing.lg
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    marginHorizontal: spacing.xl
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md
  },
  toggleButtonActive: {
    backgroundColor: colors.primary
  },
  toggleText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textSecondary
  },
  toggleTextActive: {
    color: colors.background
  },
  form: {
    gap: spacing.xl,
    width: '100%'
  },
  inputRounded: {
    borderRadius: radius.xxl,
    height: 52,
    fontSize: typography.size.md
  },
  inputGroup: {
    gap: spacing.sm
  },
  passwordContainer: {
    position: 'relative',
    width: '100%'
  },
  passwordInput: {
    paddingRight: spacing.xl + spacing.lg
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center'
  },
  passwordIcon: {
    fontSize: 20
  },
  fieldError: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginTop: spacing.xs / 2,
  },
  errorText: {
    color: colors.danger
  },
  primaryButton: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: radius.xxl,
    height: 52,
    marginTop: spacing.lg
  },
  divider: {
    alignItems: 'center',
    marginTop: spacing.sm
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: '400'
  },
  socialGroup: {
    gap: spacing.sm
  },
  socialButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  socialButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  socialButtonDisabled: {
    opacity: 0.6
  },
  socialButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  legal: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    alignItems: 'center'
  },
  helper: {
    color: colors.textSecondary,
    fontWeight: '400',
    fontSize: typography.size.sm,
    textAlign: 'center'
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center'
  },
  link: {
    color: colors.primary,
    fontWeight: '700'
  },
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: typography.size.md
  },
  registerLink: {
    color: colors.primary,
    fontSize: typography.size.md,
    fontWeight: '700'
  },
  separator: {
    color: colors.textSecondary
  }
});
