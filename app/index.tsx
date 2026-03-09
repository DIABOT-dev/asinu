import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../src/components/ScaledText';
import { DataConsentModal, hasDataConsent } from '../src/components/DataConsentModal';
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

  const [consentReady, setConsentReady] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    bootstrap();
    hasDataConsent().then((consented) => {
      if (!consented) setShowConsent(true);
      setConsentReady(true);
    });
  }, [bootstrap]);

  useEffect(() => {
    if (!isNavReady || loading || !consentReady || showConsent) return;
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
  }, [isNavReady, loading, profile, router, consentReady, showConsent]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>ASINU Lite</Text>
      <ActivityIndicator size="large" color={colors.primary} />

      <DataConsentModal
        visible={showConsent}
        onAgree={() => setShowConsent(false)}
      />
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
      gap: spacing.md,
    },
    title: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
    },
  });
}
