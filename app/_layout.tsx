import type { ParamListBase, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CarePulseProvider } from '../src/features/care-pulse';
import { WellnessProvider } from '../src/features/wellness';
import '../src/lib/initErrorHandler';
import { QueryProvider } from '../src/providers/QueryProvider';
import { SessionProvider } from '../src/providers/SessionProvider';
import { colors, spacing, typography } from '../src/styles';
import { AsinuBrainOverlayHost } from '../asinu-brain-extension/AsinuBrainOverlayHost';

type NavigationProp = NativeStackNavigationProp<ParamListBase>;
type ScreenOptionsProps = { 
  route: RouteProp<ParamListBase, string>;
  navigation: NavigationProp;
};

export default function RootLayout() {
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
      title: 'Điều khoản',
      headerTitleStyle: styles.headerTitle,
      headerStyle: styles.header,
      headerShadowVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerLeft}
        >
          <Text style={styles.headerLeftText}>Đóng</Text>
        </Pressable>
      )
    }),
    []
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
