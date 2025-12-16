import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { colors, spacing, typography } from '../../src/styles';
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, openExternal, PRIVACY_URL, TERMS_URL } from '../../src/lib/links';

export default function LoginEmailScreen() {
  const [email, setEmail] = useState(DEMO_ACCOUNT_EMAIL);
  const [password, setPassword] = useState(DEMO_ACCOUNT_PASSWORD);
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    try {
      await login({ email, password });
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Đăng nhập bằng email</Text>
      <Text style={styles.subtitle}>Nhập email và mật khẩu của bạn</Text>
      <View style={styles.form}>
        <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={handleLogin} disabled={loading} />
        <Button label="Đăng nhập bằng số điện thoại" variant="ghost" onPress={() => router.replace('/login/phone')} disabled={loading} />
      </View>

      <View style={styles.legal}>
        <Text style={styles.helper}>Bằng việc tiếp tục, bạn đồng ý với</Text>
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
