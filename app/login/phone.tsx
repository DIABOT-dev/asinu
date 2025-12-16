import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { colors, spacing, typography } from '../../src/styles';
import { openExternal, PRIVACY_URL, TERMS_URL } from '../../src/lib/links';

export default function LoginPhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      router.push({
        pathname: '/login/otp',
        params: { phone: phone.trim(), flow: 'login' }
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Đăng nhập bằng số điện thoại</Text>
      <Text style={styles.subtitle}>Chúng tôi sẽ gửi mã OTP qua SMS</Text>
      <View style={styles.form}>
        <TextInput
          label="Số điện thoại"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          placeholder="+84..."
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={loading ? 'Đang gửi mã...' : 'Gửi mã OTP'} onPress={handleSendOtp} disabled={loading} />
        <Button label="Đăng nhập bằng email" variant="ghost" onPress={() => router.replace('/login/email')} disabled={loading} />
      </View>

      <View style={styles.legal}>
        <Text style={styles.helper}>Khi tiếp tục bạn đồng ý với</Text>
        <View style={styles.linkRow}>
          <Pressable onPress={() => openExternal(TERMS_URL)}>
            <Text style={styles.link}>Điều khoản sử dụng</Text>
          </Pressable>
          <Text style={styles.separator}>·</Text>
          <Pressable onPress={() => openExternal(PRIVACY_URL)}>
            <Text style={styles.link}>Chính sách quyền riêng tư</Text>
          </Pressable>
        </View>
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
    color: colors.textSecondary
  },
  form: {
    gap: spacing.md
  },
  errorText: {
    color: colors.danger
  },
  legal: {
    gap: spacing.xs,
    marginTop: spacing.lg
  },
  helper: {
    color: colors.textSecondary
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  link: {
    color: colors.primary,
    fontWeight: '700'
  },
  separator: {
    color: colors.textSecondary
  }
});
