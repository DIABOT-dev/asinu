import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from './locales/en/auth.json';
import enCareCircle from './locales/en/careCircle.json';
import enChat from './locales/en/chat.json';
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enLogs from './locales/en/logs.json';
import enMissions from './locales/en/missions.json';
import enOnboarding from './locales/en/onboarding.json';
import enProfile from './locales/en/profile.json';
import enSettings from './locales/en/settings.json';
import enTree from './locales/en/tree.json';
import viAuth from './locales/vi/auth.json';
import viCareCircle from './locales/vi/careCircle.json';
import viChat from './locales/vi/chat.json';
import viCommon from './locales/vi/common.json';
import viHome from './locales/vi/home.json';
import viLogs from './locales/vi/logs.json';
import viMissions from './locales/vi/missions.json';
import viOnboarding from './locales/vi/onboarding.json';
import viProfile from './locales/vi/profile.json';
import viSettings from './locales/vi/settings.json';
import viTree from './locales/vi/tree.json';

const LANGUAGE_STORAGE_KEY = '@app/language';

const resources = {
  vi: {
    common: viCommon,
    home: viHome,
    profile: viProfile,
    missions: viMissions,
    tree: viTree,
    settings: viSettings,
    auth: viAuth,
    onboarding: viOnboarding,
    careCircle: viCareCircle,
    chat: viChat,
    logs: viLogs,
  },
  en: {
    common: enCommon,
    home: enHome,
    profile: enProfile,
    missions: enMissions,
    tree: enTree,
    settings: enSettings,
    auth: enAuth,
    onboarding: enOnboarding,
    careCircle: enCareCircle,
    chat: enChat,
    logs: enLogs,
  },
};

const getDeviceLanguage = (): string => {
  const locales = Localization.getLocales();
  const lang = locales?.[0]?.languageCode ?? 'vi';
  return lang === 'vi' || lang === 'en' ? lang : 'vi';
};

const initI18n = async () => {
  let savedLanguage: string | null = null;
  try {
    savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // ignore
  }

  const lng = savedLanguage || getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'vi',
    defaultNS: 'common',
    ns: [
      'common',
      'home',
      'profile',
      'missions',
      'tree',
      'settings',
      'auth',
      'onboarding',
      'careCircle',
      'chat',
      'logs',
    ],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
};

initI18n();

export { LANGUAGE_STORAGE_KEY };
export default i18n;
