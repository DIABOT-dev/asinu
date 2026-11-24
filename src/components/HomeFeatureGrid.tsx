import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useGuardedRouter } from '../hooks/useGuardedRouter';
import { useThemeColors } from '../hooks/useThemeColors';
import { useFontSizeStore } from '../stores/font-size.store';
import { HealthCoinIcon } from '../features/v21/HealthCoinIcon';
import { QuickActionTile } from './QuickActionTile';
import { AppPermissionsModal } from '../features/profile/AppPermissionsModal';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isExpertConsultationEnabled } from '../lib/appEnv';
import { ReminderSettingsEntry } from '../features/profile/ReminderSettingsEntry';

const actions = [
  {
    id: 'healthHistory',
    route: '/(tabs)/tree',
    image: require('../../assets/images/notifications/checkin-v1.png'),
  },
  {
    id: 'medication',
    route: '/medication',
    image: require('../../assets/images/notifications/medication-v1.png'),
  },
  {
    id: 'journal',
    route: '/logs',
    image: require('../../assets/images/notifications/checkin-v1.png'),
  },
  { id: 'reminderSchedule' },
  {
    id: 'expert',
    route: '/doctor-consultation',
    image: require('../../assets/images/care-circle/expert-consultation-cutout.png'),
    expertOnly: true,
  },
  {
    id: 'consultationHistory',
    route: '/doctor-consultation-history',
    icon: 'chatbubbles-outline',
    expertOnly: true,
  },
  {
    id: 'consultationData',
    route: '/privacy-center',
    icon: 'finger-print-outline',
    expertOnly: true,
  },
  {
    id: 'carePlan',
    route: '/doctor-care',
    icon: 'clipboard-outline',
    expertOnly: true,
  },
  { id: 'calls', route: '/checkin-call/settings', icon: 'options-outline' },
  {
    id: 'callPersonalization',
    route: '/checkin-call/voice-settings',
    icon: 'person-circle-outline',
  },
  { id: 'permissions', icon: 'shield-checkmark-outline' },
  {
    id: 'family',
    route: '/care-circle',
    image: require('../../assets/images/notifications/family-v1.png'),
  },
  {
    id: 'missions',
    route: '/(tabs)/missions',
    image: require('../assets/tab-icons/mission.png'),
  },
  { id: 'coins', route: '/coins', coinsOnly: true },
  {
    id: 'coinShop',
    route: '/coins/redeem',
    icon: 'storefront-outline',
    coinsOnly: true,
  },
  {
    id: 'giftHistory',
    route: '/checkin-rewards/history',
    image: require('../../assets/images/rewards/gift-open-box.png'),
  },
] as const;

const featureGroups = [
  { id: 'health', actions: ['healthHistory', 'medication', 'journal', 'reminderSchedule'] },
  {
    id: 'consultation',
    actions: ['expert', 'consultationHistory', 'consultationData', 'carePlan'],
  },
  {
    id: 'connections',
    actions: ['family', 'calls', 'callPersonalization', 'permissions'],
  },
  { id: 'rewards', actions: ['missions', 'coins', 'coinShop', 'giftHistory'] },
] as const;

/** All groups remain visible while scrolling; reminder access follows notification permissions. */
export function HomeFeatureGrid({
  medicationEnabled,
  coinsEnabled,
}: {
  medicationEnabled: boolean;
  coinsEnabled: boolean;
}) {
  const { t } = useTranslation('home');
  const router = useGuardedRouter();
  const { assistant_permissions } = useLocalSearchParams<{
    assistant_permissions?: string;
  }>();
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const multiplier = useFontSizeStore((state) => state.multiplier);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [permissionDialog, setPermissionDialog] = useState<
    'unopened' | 'open' | 'closed'
  >('unopened');
  const closePermissions = useCallback(() => setPermissionDialog('closed'), []);
  const openPermissions = useCallback(() => setPermissionDialog('open'), []);
  useFocusEffect(useCallback(() => () => setPermissionDialog('closed'), []));
  useEffect(() => {
    if (assistant_permissions === '1') {
      setPermissionDialog('open');
      router.setParams({ assistant_permissions: '' });
    }
  }, [assistant_permissions, router]);
  const availableWidth = Math.min(measuredWidth || width - 32, width - 32);
  const textScale = multiplier * fontScale;
  const columns =
    textScale >= 1.6 ? 2 : availableWidth < 336 || textScale >= 1.2 ? 3 : 4;
  const tileWidth = (availableWidth - 12 * (columns - 1)) / columns;
  const visible = actions.filter(
    (action) =>
      (action.id !== 'medication' || medicationEnabled) &&
      (!('coinsOnly' in action) || coinsEnabled) &&
      (!('expertOnly' in action) ||
        !action.expertOnly ||
        isExpertConsultationEnabled)
  );

  return (
    <View
      testID="home-feature-grid"
      style={styles.section}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {featureGroups.map((group) => {
        const items = group.actions.flatMap((id) =>
          visible.filter((action) => action.id === id)
        );
        if (!items.length) return null;
        return (
          <View
            key={group.id}
            testID={`operations-group-${group.id}`}
            style={styles.group}
          >
            <Text
              allowFontScaling
              accessibilityRole="header"
              style={[styles.heading, { color: colors.textPrimary }]}
            >
              {t(
                `quickActions.group${group.id[0].toUpperCase()}${group.id.slice(
                  1
                )}`
              )}
            </Text>
            <View style={styles.grid}>
              {items.map((action) => action.id === 'reminderSchedule' ? (
                <ReminderSettingsEntry
                  key={action.id}
                  variant="tile"
                  style={{ width: tileWidth }}
                />
              ) : (
                <QuickActionTile
                  key={action.id}
                  testID={`home-feature-${action.id}`}
                  label={t(`quickActions.${action.id}`)}
                  framed={action.id !== 'expert'}
                  onPress={() =>
                    'route' in action
                      ? router.push(action.route)
                      : openPermissions()
                  }
                  style={{ width: tileWidth }}
                  icon={
                    'image' in action ? (
                      <Image
                        source={action.image}
                        accessible={false}
                        resizeMode="contain"
                        resizeMethod="resize"
                        style={styles.image}
                      />
                    ) : action.id === 'coins' ? (
                      <HealthCoinIcon size={44} />
                    ) : (
                      <Ionicons
                        name={'icon' in action ? action.icon : 'call-outline'}
                        size={36}
                        color={colors.primaryText}
                        accessible={false}
                      />
                    )
                  }
                />
              ))}
            </View>
          </View>
        );
      })}
      {permissionDialog !== 'unopened' && (
        <AppPermissionsModal
          visible={permissionDialog === 'open'}
          onClose={closePermissions}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingBottom: 12, gap: 26 },
  group: { gap: 16 },
  heading: { fontSize: 19, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 20 },
  image: { width: 60, height: 60 },
});
