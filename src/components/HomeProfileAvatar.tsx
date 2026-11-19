import { useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../features/auth/auth.store';
import { useGuardedRouter } from '../hooks/useGuardedRouter';
import { useThemeColors } from '../hooks/useThemeColors';
import { ScaledText as Text } from './ScaledText';

export function HomeProfileAvatar({
  profile,
}: {
  profile: Pick<Profile, 'id' | 'name' | 'avatarUrl'>;
}) {
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
  const { t } = useTranslation('common');
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const avatarKey = `${profile.id}:${profile.avatarUrl ?? ''}`;
  const initial = Array.from(
    profile.name?.trim().split(/\s+/).pop() ?? ''
  )[0]?.toLocaleUpperCase();
  return (
    <Pressable
      testID="home-profile-avatar"
      accessibilityRole="button"
      accessibilityLabel={t('tabProfile')}
      accessibilityHint={t('openProfile')}
      onPress={() => router.push('/account')}
      style={({ pressed }) => [
        styles.avatar,
        {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {profile.avatarUrl && failedAvatar !== avatarKey ? (
        <Image
          key={avatarKey}
          source={{ uri: profile.avatarUrl }}
          style={styles.photo}
          accessible={false}
          onError={() => setFailedAvatar(avatarKey)}
        />
      ) : initial ? (
        <Text style={[styles.initial, { color: colors.primaryText }]}>
          {initial}
        </Text>
      ) : (
        <Image
          source={require('../assets/tab-icons/profile.png')}
          style={styles.fallback}
          accessible={false}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  fallback: { width: 36, height: 36 },
  initial: { fontSize: 21, fontWeight: '700' },
});
