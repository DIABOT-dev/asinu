import React, { useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useGuardedRouter } from '../hooks/useGuardedRouter';
import { useThemeColors } from '../hooks/useThemeColors';
import { useFontSizeStore } from '../stores/font-size.store';
import { HealthCoinIcon } from '../features/v21/HealthCoinIcon';
import { QuickActionTile } from './QuickActionTile';

const actions = [
  { id: 'medication', route: '/medication', image: require('../../assets/images/notifications/medication-v1.png') },
  { id: 'journal', route: '/logs', image: require('../../assets/images/notifications/checkin-v1.png') },
  { id: 'calls', route: '/checkin-call/settings' },
  { id: 'family', route: '/care-circle', image: require('../../assets/images/notifications/family-v1.png') },
  { id: 'missions', route: '/(tabs)/missions', image: require('../assets/tab-icons/mission.png') },
  { id: 'coins', route: '/coins' },
  { id: 'dailyGift', route: '/checkin-rewards', image: require('../../assets/images/notifications/gift-v1.png') },
  { id: 'giftHistory', route: '/checkin-rewards/history', image: require('../../assets/images/rewards/gift-open-box.png') },
] as const;

/** Navigation only: data is loaded by the destination, never for each tile. */
export function HomeFeatureGrid({ medicationEnabled, coinsEnabled }: {
  medicationEnabled: boolean;
  coinsEnabled: boolean;
}) {
  const { t } = useTranslation('home');
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const multiplier = useFontSizeStore(state => state.multiplier);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const availableWidth = Math.min(measuredWidth || width - 32, width - 32);
  const textScale = multiplier * fontScale;
  const columns = textScale >= 1.6 ? 2 : availableWidth < 336 || textScale >= 1.2 ? 3 : 4;
  const tileWidth = (availableWidth - 12 * (columns - 1)) / columns;
  const visible = actions.filter(action =>
    (action.id !== 'medication' || medicationEnabled) && (action.id !== 'coins' || coinsEnabled));

  return <View testID="home-feature-grid" style={styles.section}
    onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Text allowFontScaling accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
      {t('quickActions.title')}
    </Text>
    <View style={styles.grid}>
      {visible.map(action => <QuickActionTile key={action.id} testID={`home-feature-${action.id}`}
        label={t(`quickActions.${action.id}`)}
        onPress={() => router.push(action.route)}
        style={{ width: tileWidth }}
        icon={'image' in action ? <Image source={action.image} accessible={false} resizeMode="contain" resizeMethod="resize" style={styles.image} />
          : action.id === 'coins' ? <HealthCoinIcon size={44} />
            : <Ionicons name="call-outline" size={36} color={colors.primaryText} accessible={false} />}
      />)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingTop: 10, paddingBottom: 12, gap: 20 },
  heading: { fontSize: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 20 },
  image: { width: 60, height: 60 },
});
