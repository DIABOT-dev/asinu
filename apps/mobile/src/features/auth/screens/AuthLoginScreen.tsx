import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export const AuthLoginScreen = () => {
    // MOCK MODE: Bỏ qua login, vào thẳng Home
    const MOCK_MODE = true;

    const handleLogin = () => {
      if (MOCK_MODE) {
        // Giả lập chuyển sang Home, có thể dùng router hoặc navigation
        // Nếu dùng React Navigation:
        // navigation.replace('Home');
        // Nếu dùng Expo Router:
        // router.replace('/home');
        return;
      }
      // ...existing login logic...
    };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Asinu</Text>
      <TextInput placeholder="Email" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="Password" style={styles.input} secureTextEntry />
      <View style={styles.meta}>
        <Text style={styles.metaText}>POST `/api/mobile/auth/login`</Text>
        <Text style={styles.metaText}>POST `/api/mobile/auth/config`</Text>
      </View>
      {/* Thêm nút login mock */}
      <Text style={{marginTop: 24, color: colors.primary}} onPress={handleLogin}>Login (MOCK)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: spacing.lg,
    color: colors.textPrimary
  },
  meta: {
    marginTop: spacing.lg,
    gap: spacing.xs
  },
  metaText: {
    color: colors.textSecondary
  }
});
