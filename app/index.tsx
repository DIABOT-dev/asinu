import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../src/components/ScaledText';
import { useAuthStore } from '../src/features/auth/auth.store';
import { useScaledTypography } from '../src/hooks/useScaledTypography';
import { colors, spacing } from '../src/styles';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isNavReady = Boolean(navigationState?.key);
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isNavReady || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (profile) {
        if (!profile.onboardingCompleted) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        router.replace('/login');
      }
    });
    return () => task.cancel();
  }, [isNavReady, loading, profile, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>ASINU Lite</Text>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: colors.textPrimary
  }
});
}
