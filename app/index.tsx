import { useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '../src/features/auth/auth.store';
import { colors, spacing, typography } from '../src/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isNavReady = Boolean(navigationState?.key);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isNavReady || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (profile) {
        router.replace('/(tabs)/home');
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

const styles = StyleSheet.create({
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
