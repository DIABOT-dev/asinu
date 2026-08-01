import { Linking } from 'react-native';

export const TERMS_URL = 'https://asinu.vn/terms/';
export const PRIVACY_URL = 'https://asinu.top/privacy/';
export const DATA_DELETION_URL = 'https://asinu.vn/data-deletion/';
export const SUPPORT_EMAIL = 'mailto:info@asinu.vn';
export const DEMO_ACCOUNT_EMAIL = 'demo@asinu.vn';
export const DEMO_ACCOUNT_PASSWORD = '!Demoasinu2026';

export const openExternal = async (url: string) => {
  await Linking.openURL(url);
};
