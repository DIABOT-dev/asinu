import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { colors, spacing, typography } from '../../src/styles';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAgreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Vui lòng nhập họ tên và số điện thoại');
      return;
    }
    if (!isAgreed) {
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
        <View style={styles.checkboxRow}>
          <Pressable style={styles.checkboxToggle} onPress={() => setAgreed(!isAgreed)}>
            <Ionicons
              name={isAgreed ? 'checkbox' : 'square-outline'}
              size={22}
              color={isAgreed ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.checkboxLabel}>Tôi đồng ý với </Text>
          </Pressable>
          <Pressable onPress={() => openLegal('terms')}>
            <Text style={[styles.checkboxLabel, styles.linkItalic]}>Điều khoản sử dụng</Text>
          </Pressable>
          <Text style={styles.checkboxLabel}> & </Text>
          <Pressable onPress={() => openLegal('privacy')}>
            <Text style={[styles.checkboxLabel, styles.linkItalic]}>Chính sách riêng tư</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label={loading ? 'Đang xử lý...' : 'Đăng ký'}
          onPress={handleSubmit}
          disabled={!isAgreed || loading}
          style={{ opacity: isAgreed ? 1 : 0.5 }}
        />
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
  }
});
