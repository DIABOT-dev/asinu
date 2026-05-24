import type { ParamListBase, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Stack, usePathname } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
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
import { initializeIap, teardownIap } from '../src/features/iap/iap.service';
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
  // Load Inter font weights — chuẩn typography cho healthcare app.
  // Render null cho đến khi font ready (~200ms first launch, sau đó cached).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

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

  // IAP listeners must live for the whole app lifetime — pending purchases
  // (renewals, deferred actions) are delivered through purchaseUpdatedListener,
  // and finishTransaction has to fire from the same listener that started it.
  useEffect(() => {
    initializeIap();
    return () => { teardownIap(); };
  }, []);

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

  // Block render đến khi font load xong → tránh flash of unstyled text
  if (!fontsLoaded) return null;

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
  const pathname = usePathname();
  if (!hydrated) return null;
  if (!token || !profile?.onboardingCompleted) return null;
  // Ẩn FAB trên các route có flow riêng để tránh conflict (mất state triage,
  // race 2 cuộc gọi /checkin/start, modal đè modal):
  // /checkin: pure check-in flow đang chạy
  // /onboarding, /login, /register: flow setup, FAB không có ngữ nghĩa
  // /legal: trang xem điều khoản
  if (
    pathname.startsWith('/checkin')
    || pathname.startsWith('/onboarding')
    || pathname.startsWith('/login')
    || pathname.startsWith('/register')
    || pathname.startsWith('/legal')
  ) return null;
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
