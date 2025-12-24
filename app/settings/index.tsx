import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { Button } from '../../src/components/Button';
import { ListItem } from '../../src/components/ListItem';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { colors, spacing, typography } from '../../src/styles';
import { openExternal, SUPPORT_EMAIL } from '../../src/lib/links';

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;
  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Cài đặt" />
        <View style={styles.row}>
          <View>
            <Text style={styles.title}>Thông báo</Text>
            <Text style={styles.subtitle}>Nhận nhắc nhở log</Text>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.title}>Nhắc nhiệm vụ</Text>
            <Text style={styles.subtitle}>Nhận push khi gần hết ngày</Text>
          </View>
          <Switch value={reminders} onValueChange={setReminders} />
        </View>

        <H1SectionHeader title="Hỗ trợ & pháp lý" />
        <ListItem title="Điều khoản sử dụng" onPress={() => openLegal('terms')} />
        <ListItem
          title="Chính sách quyền riêng tư"
          onPress={() => openLegal('privacy')}
          style={{ marginTop: spacing.md }}
        />
        <ListItem
          title="Liên hệ hỗ trợ"
          subtitle="support@asinu.health"
          onPress={() => openExternal(SUPPORT_EMAIL)}
          style={{ marginTop: spacing.md }}
        />

        <Button label="Đăng xuất" variant="warning" onPress={handleLogout} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  }
});
