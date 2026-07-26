import { Asset } from 'expo-asset';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInitialLoadingGate } from '../../src/hooks/useInitialLoadingGate';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const homeIcon = require('../../src/assets/tab-icons/home.png');
const healthcheckIcon = require('../../src/assets/tab-icons/healthcheck.png');
const careCircleIcon = require('../../src/assets/tab-icons/care-circle.png');
const profileIcon = require('../../src/assets/tab-icons/profile.png');
const missionIcon = require('../../src/assets/tab-icons/mission.png');
const tabIconModules = [homeIcon, healthcheckIcon, careCircleIcon, profileIcon, missionIcon];
type TabIconSource = number | { uri: string };

function TabIconSkeleton() {
  const { colors } = useThemeColors();
  const opacity = useSharedValue(0.35);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 650 }), -1, true);
    return () => {
      opacity.value = 0.35;
    };
  }, [opacity]);

  return <Animated.View style={[styles.iconSkeleton, { backgroundColor: colors.border }, animatedStyle]} />;
}

function TabIcon({ source, focused, ready }: { source: TabIconSource; focused: boolean; ready: boolean }) {
  const { colors } = useThemeColors();
  const scale = useSharedValue(focused ? 1 : 0.9);
  const opacity = useSharedValue(focused ? 1 : 0.65);

  useEffect(() => {
    scale.value = withTiming(focused ? 1.05 : 0.9, { duration: 250 });
    opacity.value = withTiming(focused ? 1 : 0.65, { duration: 200 });
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!ready) return <TabIconSkeleton />;

  return (
    <Animated.View style={animStyle}>
      <Image
        source={source}
        style={[styles.icon, { tintColor: focused ? colors.primary : undefined }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { colors } = useThemeColors();
  const { bottom } = useSafeAreaInsets();
  const [tabIconSources, setTabIconSources] = useState<Array<TabIconSource | null>>(
    () => tabIconModules.map(() => null),
  );

  useEffect(() => {
    let active = true;
    tabIconModules.forEach((module, index) => {
      Asset.loadAsync(module)
        .then(async ([asset]) => {
          const uri = asset.localUri ?? asset.uri;
          // Warm the native image cache before replacing the skeleton.
          if (uri) await Image.prefetch(uri).catch(() => false);
          return uri ? { uri } : module;
        })
        .catch(() => {
          // Render the bundled image even if the preload step is unavailable.
          return module;
        })
        .then((source) => {
          if (!active) return;
          setTabIconSources((previous) => {
            if (previous[index]) return previous;
            const next = [...previous];
            next[index] = source;
            return next;
          });
        });
    });
    return () => {
      active = false;
    };
  }, []);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarHideOnKeyboard: false,
      tabBarLabelStyle: [styles.tabBarLabel, { fontSize: scaledTypography.size.xs }],
      tabBarStyle: {
        ...styles.tabBar,
        backgroundColor: colors.surface,
        height: 28 + scaledTypography.size.xs + 16 + 14 + bottom,
        paddingBottom: bottom > 0 ? bottom : 8,
        paddingTop: 8,
      },
    }),
    [scaledTypography, bottom, colors]
  );

  // Keep the whole visible tab bar in loading state until all four icons are ready.
  // The short minimum gate also makes cached bundled assets render the skeleton
  // consistently instead of skipping it in a single frame.
  const allVisibleTabIconsLoaded = tabIconSources.slice(0, 4).every(Boolean);
  const showTabBarLoading = useInitialLoadingGate(allVisibleTabIconsLoaded, 800);
  const visibleTabIconsReady = !showTabBarLoading;
  const homeIconSource = tabIconSources[0] ?? homeIcon;
  const connectIconSource = tabIconSources[1] ?? healthcheckIcon;
  const overviewIconSource = tabIconSources[2] ?? careCircleIcon;
  const profileIconSource = tabIconSources[3] ?? profileIcon;
  const missionIconSource = tabIconSources[4] ?? missionIcon;
  const renderHomeIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={homeIconSource} focused={focused} ready={visibleTabIconsReady} />, [homeIconSource, visibleTabIconsReady]);
  const renderMissionIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={missionIconSource} focused={focused} ready={Boolean(tabIconSources[4])} />, [missionIconSource, tabIconSources[4]]);
  const renderProfileIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={profileIconSource} focused={focused} ready={visibleTabIconsReady} />, [profileIconSource, visibleTabIconsReady]);
  const renderTreeIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={overviewIconSource} focused={focused} ready={visibleTabIconsReady} />, [overviewIconSource, visibleTabIconsReady]);
  const renderCareCircleIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={connectIconSource} focused={focused} ready={visibleTabIconsReady} />, [connectIconSource, visibleTabIconsReady]);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home/index"
        options={{
          title: t('tabHome'),
          tabBarLabel: visibleTabIconsReady ? t('tabHome') : t('loading'),
          tabBarIcon: renderHomeIcon
        }}
      />
      {/* Tab "Kết nối" — thay vị trí Nhiệm vụ. Care Circle screen re-export
          từ /app/care-circle/index qua wrapper (tabs)/care-circle/index.tsx. */}
      <Tabs.Screen
        name="care-circle/index"
        options={{
          title: t('tabConnect'),
          tabBarLabel: visibleTabIconsReady ? t('tabConnect') : t('loading'),
          tabBarIcon: renderCareCircleIcon
        }}
      />
      <Tabs.Screen
        name="tree/index"
        options={{
          title: t('tabOverview'),
          tabBarLabel: visibleTabIconsReady ? t('tabOverview') : t('loading'),
          tabBarIcon: renderTreeIcon
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabProfile'),
          tabBarLabel: visibleTabIconsReady ? t('tabProfile') : t('loading'),
          tabBarIcon: renderProfileIcon
        }}
      />
      {/* Missions screen vẫn giữ route — accessible từ home (section "Nhiệm vụ
          hôm nay") + push deep link. KHÔNG hiển thị trong tab bar (href: null). */}
      <Tabs.Screen
        name="missions/index"
        options={{
          title: t('tabMissions'),
          href: null,
          tabBarIcon: renderMissionIcon,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    marginTop: 1
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  icon: {
    width: 28,
    height: 28,
  },
  iconSkeleton: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
});
