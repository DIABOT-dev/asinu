import type { ParamListBase, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AsinuBrainOverlayHost } from '../asinu-brain-extension/AsinuBrainOverlayHost';
import { ScaledText as Text } from '../src/components/ScaledText';
import { CarePulseProvider } from '../src/features/care-pulse';
import { WellnessProvider } from '../src/features/wellness';
import '../src/i18n';
import '../src/lib/initErrorHandler';
import { QueryProvider } from '../src/providers/QueryProvider';
import { SessionProvider } from '../src/providers/SessionProvider';
import { colors, spacing, typography } from '../src/styles';

type NavigationProp = NativeStackNavigationProp<ParamListBase>;
type ScreenOptionsProps = { 
  route: RouteProp<ParamListBase, string>;
  navigation: NavigationProp;
};

export default function RootLayout() {
  const { t } = useTranslation('auth');

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: styles.contentStyle
    }),
    []
  );

  const legalScreenOptions = useCallback(
    ({ navigation }: ScreenOptionsProps) => ({
      presentation: 'modal' as const,
      headerShown: true,
      title: t('legalTitle'),
      headerTitleStyle: styles.headerTitle,
      headerStyle: styles.header,
      headerShadowVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('index')}
          style={styles.headerLeft}
        >
          <Text style={styles.headerLeftText}>{t('legalClose')}</Text>
        </Pressable>
      )
    }),
    [t]
  );

  return (
    <QueryProvider>
      <SessionProvider>
        <SafeAreaProvider>
          <WellnessProvider>
            <CarePulseProvider>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
              <Stack screenOptions={screenOptions}>
                <Stack.Screen
                  name="legal/content"
                  options={legalScreenOptions}
                />
              </Stack>
              <AsinuBrainOverlayHost />
            </CarePulseProvider>
          </WellnessProvider>
        </SafeAreaProvider>
      </SessionProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  contentStyle: {
    backgroundColor: colors.background
  },
  header: {
    backgroundColor: colors.surface
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: '700'
  },
  headerLeft: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  headerLeftText: {
    color: colors.primary,
    fontSize: typography.size.md,
    fontWeight: '700'
  }
});
