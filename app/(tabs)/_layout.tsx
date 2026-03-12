import { Tabs, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors } from '../../src/styles';

const healthcheckIcon = require('../../src/assets/tab-icons/healthcheck.png');
const homeIcon = require('../../src/assets/tab-icons/home.png');
const missionIcon = require('../../src/assets/tab-icons/mission.png');
const profileIcon = require('../../src/assets/tab-icons/profile.png');

export default function TabsLayout() {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (!loading && profile && !profile.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [loading, profile]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: [styles.tabBarLabel, { fontSize: scaledTypography.size.xs }],
      tabBarStyle: {
        ...styles.tabBar,
        height: 60 + bottom,
        paddingBottom: bottom > 0 ? bottom : 10,
        paddingTop: 14,
      },
    }),
    [scaledTypography, bottom]
  );

  const renderHomeIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <Image
        source={homeIcon}
        style={[styles.icon, { opacity: focused ? 1 : 0.45, tintColor: focused ? colors.primary : undefined }]}
        resizeMode="contain"
      />
    ),
    []
  );

  const renderMissionIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <Image
        source={missionIcon}
        style={[styles.icon, { opacity: focused ? 1 : 0.45, tintColor: focused ? colors.primary : undefined }]}
        resizeMode="contain"
      />
    ),
    []
  );

  const renderTreeIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <Image
        source={healthcheckIcon}
        style={[styles.icon, { opacity: focused ? 1 : 0.45, tintColor: focused ? colors.primary : undefined }]}
        resizeMode="contain"
      />
    ),
    []
  );

  const renderProfileIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <Image
        source={profileIcon}
        style={[styles.icon, { opacity: focused ? 1 : 0.45, tintColor: focused ? colors.primary : undefined }]}
        resizeMode="contain"
      />
    ),
    []
  );

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
      <Tabs.Screen
        name="missions/index"
        options={{
          title: t('tabMissions'),
          tabBarLabel: t('tabMissions'),
          tabBarIcon: renderMissionIcon
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    marginTop: 2
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    backgroundColor: colors.surface,
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
    width: 50,
    height: 50
  }
});
