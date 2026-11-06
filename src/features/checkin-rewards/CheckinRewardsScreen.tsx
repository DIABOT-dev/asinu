import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ScreenBackButton } from '../../components/ScreenHeaderButton';
import { ScaledText as Text } from '../../components/ScaledText';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useThemeColors } from '../../hooks/useThemeColors';
import { HomeGiftCard } from './HomeGiftCard';

export function CheckinRewardsScreen() {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();

  return (
    <Screen style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <ScreenBackButton
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')
          }
        />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          {t('checkinGift.dailyTitle')}
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <HomeGiftCard />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
