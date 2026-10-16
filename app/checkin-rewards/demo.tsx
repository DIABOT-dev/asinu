import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedRouter } from '../../src/hooks/useGuardedRouter';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { CheckinGiftDemoFlow } from '../../src/features/checkin-rewards/CheckinGiftDemoFlow';
import { isProdBuild } from '../../src/lib/appEnv';

export default function CheckinGiftDemoRoute() {
  if (isProdBuild) { return <Redirect href="/(tabs)/profile" />; }
  return <GiftDemoScreen />;
}

function GiftDemoScreen() {
  const router = useGuardedRouter();
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  return <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.header}>
      <ScreenBackButton onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('checkinGift.demoTitle')}</Text>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Ionicons name="gift-outline" size={56} color={colors.primary} accessible={false} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{t('checkinGift.title')}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{t('checkinGift.demoInstructions')}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.buttonText}>{t('checkinGift.demoTry')}</Text>
      </Pressable>
    </ScrollView>
    {open && <CheckinGiftDemoFlow reviewExisting onClose={() => setOpen(false)} />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 480 },
  button: { borderRadius: 24, minHeight: 52, paddingVertical: 14, paddingHorizontal: 24, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
