import { Tabs } from 'expo-router';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const healthcheckIcon = require('../../src/assets/tab-icons/healthcheck.png');
const homeIcon = require('../../src/assets/tab-icons/home.png');
const missionIcon = require('../../src/assets/tab-icons/mission.png');
const profileIcon = require('../../src/assets/tab-icons/profile.png');
const careCircleIcon = require('../../src/assets/tab-icons/care-circle.png');

function TabIcon({ source, focused }: { source: any; focused: boolean }) {
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

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarHideOnKeyboard: true,
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

  const renderHomeIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={homeIcon} focused={focused} />, []);
  const renderMissionIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={missionIcon} focused={focused} />, []);
  const renderProfileIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={profileIcon} focused={focused} />, []);
  // Swap icons: Kết nối dùng healthcheckIcon, Tổng quan dùng careCircleIcon.
  const renderTreeIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={careCircleIcon} focused={focused} />, []);
  const renderCareCircleIcon = useCallback(({ focused }: { focused: boolean }) => <TabIcon source={healthcheckIcon} focused={focused} />, []);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home/index"
        options={{
          title: t('tabHome'),
          tabBarLabel: t('tabHome'),
          tabBarIcon: renderHomeIcon
        }}
      />
      {/* Tab "Kết nối" — thay vị trí Nhiệm vụ. Care Circle screen re-export
          từ /app/care-circle/index qua wrapper (tabs)/care-circle/index.tsx. */}
      <Tabs.Screen
        name="care-circle/index"
        options={{
          title: t('tabConnect'),
          tabBarLabel: t('tabConnect'),
          tabBarIcon: renderCareCircleIcon
        }}
      />
      <Tabs.Screen
        name="tree/index"
        options={{
          title: t('tabOverview'),
          tabBarLabel: t('tabOverview'),
          tabBarIcon: renderTreeIcon
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabProfile'),
          tabBarLabel: t('tabProfile'),
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
    height: 28
  }
});
