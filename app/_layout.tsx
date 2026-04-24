import type { ParamListBase, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Appearance, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AsinuBrainOverlayHost } from '../asinu-brain-extension/AsinuBrainOverlayHost';
import { AsinuEmergencyFAB } from '../asinu-brain-extension/ui/AsinuEmergencyFAB';
import { useAuthStore } from '../src/features/auth/auth.store';
import { GlobalToastHost } from '../src/components/GlobalToastHost';
import { ScaledText as Text } from '../src/components/ScaledText';
import { CarePulseProvider } from '../src/features/care-pulse';
import { WellnessProvider } from '../src/features/wellness';
import { useThemeColors } from '../src/hooks/useThemeColors';
import { useThemeStore } from '../src/stores/theme.store';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });
import '../src/i18n';
import '../src/lib/initErrorHandler';
import { QueryProvider } from '../src/providers/QueryProvider';
import { SessionProvider } from '../src/providers/SessionProvider';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { applyTheme, spacing, typography } from '../src/styles';

type NavigationProp = NativeStackNavigationProp<ParamListBase>;
type ScreenOptionsProps = { 
  route: RouteProp<ParamListBase, string>;
  navigation: NavigationProp;
};

export default function RootLayout() {
  const { t } = useTranslation('auth');
  const { colors, isDark } = useThemeColors();
  const setSystemScheme = useThemeStore((s) => s.setSystemScheme);

  // Apply theme colors globally when resolved theme changes
  const resolved = useThemeStore((s) => s.resolved);
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Sync system color scheme
  useEffect(() => {
    const scheme = Appearance.getColorScheme();
    if (scheme) setSystemScheme(scheme);
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, [setSystemScheme]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors]
  );

  const legalScreenOptions = useCallback(
    ({ navigation }: ScreenOptionsProps) => ({
      presentation: 'modal' as const,
      headerShown: true,
      title: t('legalTitle'),
      headerTitleStyle: { color: colors.textPrimary, fontSize: typography.size.md, fontWeight: '700' as const },
      headerStyle: { backgroundColor: colors.surface },
      headerShadowVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('index')}
          style={styles.headerLeft}
        >
          <Text style={[styles.headerLeftText, { color: colors.primary }]}>{t('legalClose')}</Text>
        </Pressable>
      )
    }),
    [t, colors]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ErrorBoundary>
    <QueryProvider>
      <SessionProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <WellnessProvider>
            <CarePulseProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
              <Stack screenOptions={screenOptions}>
                <Stack.Screen
                  name="legal/content"
                  options={legalScreenOptions}
                />
              </Stack>
              <GlobalToastHost />
              <AsinuBrainOverlayHost />
              <EmergencyFABGate />
            </CarePulseProvider>
          </WellnessProvider>
        </SafeAreaProvider>
      </SessionProvider>
    </QueryProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function EmergencyFABGate() {
  const token = useAuthStore((s) => s.token);
  const profile = useAuthStore((s) => s.profile);
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) return null;
  if (!token || !profile?.onboardingCompleted) return null;
  return <AsinuEmergencyFAB />;
}

const styles = StyleSheet.create({
  headerLeft: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerLeftText: {
    fontSize: typography.size.md,
    fontWeight: '700',
  },
});
