import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { colors, spacing, typography } from '../../src/styles';
import { openExternal, PRIVACY_URL, TERMS_URL } from '../../src/lib/links';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Vui lòng nhập họ tên và số điện thoại');
      return;
    }
    if (!acceptTerms) {
      setError('Vui lòng đồng ý Điều khoản & Chính sách');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      router.push({
        pathname: '/login/otp',
        params: { phone: phone.trim(), flow: 'signup' }
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Tạo tài khoản</Text>
      <Text style={styles.subtitle}>Nhập thông tin cơ bản để bắt đầu</Text>
      <View style={styles.form}>
        <TextInput label="Họ tên" value={name} onChangeText={setName} />
        <TextInput label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+84..." />
        <TextInput label="Email (tùy chọn)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput label="Mật khẩu (tùy chọn)" value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable style={styles.checkboxRow} onPress={() => setAcceptTerms((v) => !v)}>
          <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]} />
          <Text style={styles.checkboxLabel}>Tôi đồng ý Điều khoản & Chính sách</Text>
        </Pressable>
        <View style={styles.linkRow}>
          <Pressable onPress={() => openExternal(TERMS_URL)}>
            <Text style={styles.link}>Xem Điều khoản</Text>
          </Pressable>
          <Text style={styles.separator}>·</Text>
          <Pressable onPress={() => openExternal(PRIVACY_URL)}>
            <Text style={styles.link}>Xem Chính sách</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={loading ? 'Đang xử lý...' : 'Tiếp tục'} onPress={handleSubmit} disabled={loading} />
        <Button label="Đã có tài khoản? Đăng nhập" variant="ghost" onPress={() => router.replace('/login')} disabled={loading} />
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkboxLabel: {
    color: colors.textPrimary
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
  },
  errorText: {
    color: colors.danger
  }
});
