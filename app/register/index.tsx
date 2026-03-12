import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { TextInput } from '../../src/components/TextInput';
import { Toast } from '../../src/components/Toast';
import { authApi } from '../../src/features/auth/auth.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { getPasswordStrength, validateEmail, validatePassword, validatePhone } from '../../src/lib/validation';
import { colors, spacing } from '../../src/styles';
import { LanguageToggle } from '../../src/components/LanguageToggle';

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
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const screenOptions = useMemo(() => ({
    headerShown: true,
    title: t('createAccount'),
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginLeft: 0 }}>
        <Ionicons name="arrow-back" size={26} color={colors.primary} />
      </TouchableOpacity>
    ),
    headerRight: () => <LanguageToggle />,
  }), [router, t]);

  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  const handleEmailBlur = () => {
    const error = validateEmail(email);
    setEmailError(error || undefined);
  };

  const handlePhoneBlur = () => {
    const error = validatePhone(phone);
    setPhoneError(error || undefined);
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);
    setPasswordError(error || undefined);
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
    // Validate
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
        full_name: name.trim() || undefined
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

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        position="center"
        onHide={() => setShowToast(false)}
      />

      <Text style={styles.title}>{t('createAccount')}</Text>
      <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>

      <View style={styles.form}>
        <View>
          <TextInput
            label={t('emailLabel')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError(undefined);
            }}
            onBlur={handleEmailBlur}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('emailPlaceholder')}
            leftIcon={<Ionicons name="mail-outline" size={18} color={colors.textSecondary} />}
          />
          {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
        </View>

        <View>
          <TextInput
            label={t('phoneLabel')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setPhoneError(undefined);
            }}
            onBlur={handlePhoneBlur}
            keyboardType="phone-pad"
            placeholder={t('phonePlaceholder')}
            leftIcon={<Ionicons name="call-outline" size={18} color={colors.textSecondary} />}
          />
          <Text style={styles.fieldHelp}>{t('phoneHelp')}</Text>
          {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
        </View>

        <View>
          <TextInput
            label={t('passwordLabel')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError(undefined);
            }}
            onBlur={handlePasswordBlur}
            secureTextEntry={!showPassword}
            placeholder={t('minChars')}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />}
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            }
          />
          {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
          {password && !passwordError && (
            <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
              {t('strengthLabel')} {getPasswordStrengthText()}
            </Text>
          )}
        </View>

        <TextInput
          label={t('nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('namePlaceholder')}
          leftIcon={<Ionicons name="person-outline" size={18} color={colors.textSecondary} />}
        />
        
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
            <Text style={[styles.checkboxLabel, styles.linkItalic]}>{t('termsOfUse')}</Text>
          </Pressable>
          <Text style={styles.checkboxLabel}>{t('and')}</Text>
          <Pressable onPress={() => openLegal('privacy')}>
            <Text style={[styles.checkboxLabel, styles.linkItalic]}>{t('privacyPolicyShort')}</Text>
          </Pressable>
        </View>
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <Button
          label={loading ? tc('processing') : t('register')}
          onPress={handleSubmit}
          disabled={!isAgreed || loading}
          style={{ opacity: isAgreed ? 1 : 0.5 }}
        />
        
        {/* Link to Login */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginLinkText}>{t('hasAccount')}</Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={styles.loginLinkButton}>{t('login')}</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitle: {
    color: colors.textSecondary
  },
  form: {
    gap: spacing.md
  },
  fieldError: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginTop: spacing.xs / 2,
  },
  fieldHelp: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: spacing.xs / 2,
  },
  strengthText: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs / 2,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  checkboxToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  checkboxLabel: {
    color: colors.textPrimary
  },
  linkItalic: {
    color: colors.primary,
    fontStyle: 'italic',
    fontWeight: '700'
  },
  errorText: {
    color: colors.danger
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loginLinkText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  loginLinkButton: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: '700',
  }
});
}
