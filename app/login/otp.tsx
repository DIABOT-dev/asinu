import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { colors, spacing, typography } from '../../src/styles';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

export default function OtpScreen() {
  const params = useLocalSearchParams();
  const phone = useMemo(() => (typeof params.phone === 'string' ? params.phone : ''), [params.phone]);
  const flow = useMemo(() => (typeof params.flow === 'string' ? params.flow : 'login'), [params.flow]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleVerify = async () => {
    if (code.length < OTP_LENGTH) {
      setError('Nhập đủ 6 chữ số OTP');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      if (flow === 'signup') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setSecondsLeft(RESEND_SECONDS);
    setError(undefined);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.lg }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <Text style={styles.title}>Nhập mã OTP</Text>
      <Text style={styles.subtitle}>{phone ? `Đã gửi mã tới ${phone}` : 'Nhập mã 6 số'}</Text>
      <TextInput
        style={styles.otpInput}
        value={code}
        onChangeText={(val) => setCode(val.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        textAlign="center"
        placeholder="______"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Button label={loading ? 'Đang xác minh...' : 'Xác minh OTP'} onPress={handleVerify} disabled={loading} />
      <Button
        label={secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft}s` : 'Gửi lại mã'}
        variant="ghost"
        disabled={secondsLeft > 0}
        onPress={handleResend}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitle: {
    color: colors.textSecondary
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface
  },
  errorText: {
    color: colors.danger
  }
});
