import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useFlagsStore } from '../../../src/features/app-config/flags.store';
import { F1ProfileSummary } from '../../../src/ui-kit/F1ProfileSummary';
import { H1SectionHeader } from '../../../src/ui-kit/H1SectionHeader';
import { ListItem } from '../../../src/components/ListItem';
import { Button } from '../../../src/components/Button';
import { Screen } from '../../../src/components/Screen';
import { colors, spacing } from '../../../src/styles';
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, openExternal, SUPPORT_EMAIL } from '../../../src/lib/links';

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);
  const flags = useFlagsStore();
  const fetchFlags = useFlagsStore((state) => state.fetchFlags);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;
  const openLegal = (type: 'terms' | 'privacy') => {
    router.push({ pathname: '/legal/content', params: { type } });
  };

  useEffect(() => {
    if (flags.status === 'idle') {
      fetchFlags();
    }
  }, [flags.status, fetchFlags]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        {profile ? (
          <F1ProfileSummary
            name={profile.name}
            email={profile.email}
            phone={profile.phone}
            caretakerFor={profile.relationship}
          />
        ) : null}

        <H1SectionHeader title="Tính năng" subtitle="Trạng thái cờ" />
        <ListItem
          title="Mood Tracker"
          subtitle={flags.FEATURE_MOOD_TRACKER ? 'Đã bật' : 'Đang tắt'}
          onPress={() => fetchFlags()}
        />
        {flags.FEATURE_AI_CHAT && flags.ENABLE_ADVANCED_AI ? (
          <ListItem
            title="AI Chat"
            subtitle="Đang bật"
            onPress={() => router.push('/ai-chat')}
            style={{ marginTop: spacing.md }}
          />
        ) : null}

        <H1SectionHeader title="Tùy chọn" />
        <Button label="Mở cài đặt" variant="warning" onPress={() => router.push('/settings')} />
        <Button label="Đăng xuất" variant="warning" onPress={handleLogout} style={{ marginTop: spacing.md }} />

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
        <ListItem
          title="Tai khoan demo"
          subtitle={`${DEMO_ACCOUNT_EMAIL} / ${DEMO_ACCOUNT_PASSWORD}`}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background
  }
});
