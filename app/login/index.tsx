import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { colors, spacing, typography } from '../../src/styles';
import { openExternal, PRIVACY_URL, TERMS_URL } from '../../src/lib/links';

export default function LoginMethodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Chào mừng quay lại</Text>
      <Text style={styles.subtitle}>Chọn cách đăng nhập</Text>
      <View style={styles.buttonGroup}>
        <Button label="Đăng nhập bằng số điện thoại" onPress={() => router.push('/login/phone')} />
        <Button label="Đăng nhập bằng email" variant="secondary" onPress={() => router.push('/login/email')} />
        <Button label="Tạo tài khoản mới" variant="ghost" onPress={() => router.push('/register')} />
      </View>

      <View style={styles.legal}>
        <Text style={styles.helper}>Bằng việc tiếp tục, bạn đồng ý với</Text>
        <View style={styles.linkRow}>
          <Pressable onPress={() => openExternal(TERMS_URL)}>
            <Text style={styles.link}>Điều khoản</Text>
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
    color: colors.textSecondary,
    marginBottom: spacing.md
  },
  buttonGroup: {
    gap: spacing.md
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
