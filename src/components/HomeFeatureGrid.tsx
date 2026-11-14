import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useGuardedRouter } from '../hooks/useGuardedRouter';
import { useThemeColors } from '../hooks/useThemeColors';
import { useFontSizeStore } from '../stores/font-size.store';
import { HealthCoinIcon } from '../features/v21/HealthCoinIcon';
import { QuickActionTile } from './QuickActionTile';
import { AppPermissionsModal } from '../features/profile/AppPermissionsModal';
import { useLocalSearchParams } from 'expo-router';

const actions = [
  { id: 'healthHistory', route: '/(tabs)/tree', image: require('../../assets/images/notifications/checkin-v1.png') },
  { id: 'medication', route: '/medication', image: require('../../assets/images/notifications/medication-v1.png') },
  { id: 'journal', route: '/logs', image: require('../../assets/images/notifications/checkin-v1.png') },
  { id: 'expert', route: '/doctor-consultation', image: require('../../assets/images/notifications/expert-consultation-v1.png') },
  { id: 'calls', route: '/checkin-call/settings', icon: 'options-outline' },
  { id: 'callPersonalization', route: '/checkin-call/voice-settings', icon: 'person-circle-outline' },
  { id: 'permissions', icon: 'shield-checkmark-outline' },
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
  const { assistant_permissions } = useLocalSearchParams<{ assistant_permissions?: string }>();
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const multiplier = useFontSizeStore(state => state.multiplier);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [permissionDialog, setPermissionDialog] = useState<'unopened' | 'open' | 'closed'>('unopened');
  const scroller = useRef<ScrollView>(null);
  const closePermissions = useCallback(() => setPermissionDialog('closed'), []);
  const openPermissions = useCallback(() => setPermissionDialog('open'), []);
  useEffect(() => {
    if (assistant_permissions === '1') {
      setPermissionDialog('open');
      router.setParams({ assistant_permissions: '' });
    }
  }, [assistant_permissions, router]);
  const availableWidth = Math.min(measuredWidth || width - 32, width - 32);
  const textScale = multiplier * fontScale;
  const columns = textScale >= 1.6 ? 2 : availableWidth < 336 || textScale >= 1.2 ? 3 : 4;
  const tileWidth = (availableWidth - 12 * (columns - 1)) / columns;
  const visible = actions.filter(action =>
    (action.id !== 'medication' || medicationEnabled) && (action.id !== 'coins' || coinsEnabled));
  const pageSize = columns * 2;
  const pages = Array.from({ length: Math.ceil(visible.length / pageSize) }, (_, index) =>
    visible.slice(index * pageSize, (index + 1) * pageSize));

  useEffect(() => {
    setPage(0);
    scroller.current?.scrollTo({ x: 0, animated: false });
  }, [availableWidth, columns, medicationEnabled, coinsEnabled]);

  return <View testID="home-feature-grid" style={styles.section}
    onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
    <Text allowFontScaling accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
      {t('quickActions.title')}
    </Text>
    <ScrollView ref={scroller} horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled
      style={styles.pages} contentContainerStyle={styles.pageTrack}
      scrollEnabled={pages.length > 1} showsHorizontalScrollIndicator={false}
      testID="home-feature-pages"
      onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(pages.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / availableWidth))))}>
      {pages.map((items, index) => <View key={index} style={[styles.grid, { width: availableWidth }]}
        accessibilityElementsHidden={page !== index}
        importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'}>
      {items.map(action => <QuickActionTile key={action.id} testID={`home-feature-${action.id}`}
        label={t(`quickActions.${action.id}`)}
        onPress={() => 'route' in action ? router.push(action.route) : openPermissions()}
        style={{ width: tileWidth }}
        icon={'image' in action ? <Image source={action.image} accessible={false} resizeMode="contain" resizeMethod="resize" style={styles.image} />
          : action.id === 'coins' ? <HealthCoinIcon size={44} />
            : <Ionicons name={'icon' in action ? action.icon : 'call-outline'} size={36} color={colors.primaryText} accessible={false} />}
      />)}
      </View>)}
    </ScrollView>
    {pages.length > 1 && <View style={styles.pagination}>
      {pages.map((_, index) => <Pressable key={index} testID={`home-feature-page-${index}`}
        accessibilityRole="button" accessibilityLabel={t('quickActions.page', { page: index + 1, total: pages.length })}
        accessibilityState={{ selected: page === index }} style={styles.pageButton}
        onPress={() => { scroller.current?.scrollTo({ x: index * availableWidth, animated: false }); setPage(index); }}>
        <View style={[styles.dot, { width: page === index ? 18 : 6,
          backgroundColor: page === index ? colors.primaryText : colors.border }]} />
      </Pressable>)}
    </View>}
    {permissionDialog !== 'unopened' && <AppPermissionsModal visible={permissionDialog === 'open'}
      onClose={closePermissions} />}
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingTop: 10, paddingBottom: 12, gap: 20 },
  heading: { fontSize: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 20 },
  pages: { flexGrow: 0 },
  pageTrack: { alignItems: 'flex-start' },
  image: { width: 60, height: 60 },
  pagination: { flexDirection: 'row', justifyContent: 'center' },
  pageButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, borderRadius: 3 },
});
