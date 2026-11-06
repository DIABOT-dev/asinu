import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { SubscriptionComparisonContent } from '../../src/features/subscription/components/SubscriptionScenarioComparison';
import { useGuardedRouter } from '../../src/hooks/useGuardedRouter';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function SubscriptionComparisonScreen() {
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => StyleSheet.create({
    content: { paddingHorizontal: 12, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
    navigation: { marginBottom: 4 },
    back: { width: 44, height: 44 },
  }), [insets.top, insets.bottom]);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navigation}>
          <ScreenBackButton iconColor={colors.textPrimary} style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/subscription')} />
        </View>
        <SubscriptionComparisonContent />
      </ScrollView>
    </Screen>
  );
}
