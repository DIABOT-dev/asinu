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
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, openExternal, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../../../src/lib/links';

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);
  const logout = useAuthStore((state) => state.logout);
  const flags = useFlagsStore();
  const fetchFlags = useFlagsStore((state) => state.fetchFlags);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

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

        <H1SectionHeader title="Tinh nang" subtitle="Trang thai co" />
        <ListItem
          title="Mood Tracker"
          subtitle={flags.FEATURE_MOOD_TRACKER ? 'Da bat' : 'Dang tat'}
          onPress={() => fetchFlags()}
        />
        <ListItem
          title="AI Chat"
          subtitle={flags.FEATURE_AI_CHAT ? 'Da bat' : 'Dang tat'}
          onPress={() => {
            if (flags.FEATURE_AI_CHAT) {
              router.push('/ai-chat');
            } else {
              fetchFlags();
            }
          }}
          style={{ marginTop: spacing.md }}
        />

        <H1SectionHeader title="Tuy chon" />
        <Button label="Mo cai dat" variant="warning" onPress={() => router.push('/settings')} />
        <Button label="Dang xuat" variant="warning" onPress={handleLogout} style={{ marginTop: spacing.md }} />

        <H1SectionHeader title="Ho tro & phap ly" />
        <ListItem title="Dieu khoan su dung" onPress={() => openExternal(TERMS_URL)} />
        <ListItem
          title="Chinh sach quyen rieng tu"
          onPress={() => openExternal(PRIVACY_URL)}
          style={{ marginTop: spacing.md }}
        />
        <ListItem
          title="Lien he ho tro"
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
