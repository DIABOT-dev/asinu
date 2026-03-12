import { Linking } from 'react-native';

export const TERMS_URL = 'https://asinu.health/terms';
export const PRIVACY_URL = 'https://asinu.health/privacy';
export const SUPPORT_EMAIL = 'mailto:support@asinu.health';
export const DEMO_ACCOUNT_EMAIL = 'demo@asinu.health';
export const DEMO_ACCOUNT_PASSWORD = 'password';

export const openExternal = async (url: string) => {
  await Linking.openURL(url);
};
