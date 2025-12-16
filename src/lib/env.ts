import { isDevBuild, isProdBuild, isStagingBuild } from './appEnv';

const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!rawBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
}

const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const hasProtocol = normalizedBaseUrl.startsWith('http://') || normalizedBaseUrl.startsWith('https://');
if (!hasProtocol) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL must include protocol (https://)');
}

const isHttp = normalizedBaseUrl.startsWith('http://');
if ((isStagingBuild || isProdBuild) && isHttp) {
  throw new Error('HTTP base URL is not allowed in staging/prod. Use HTTPS.');
}
if (!isDevBuild && isHttp) {
  throw new Error('HTTP base URL only allowed for dev builds.');
}

export const env = {
  apiBaseUrl: normalizedBaseUrl,
  devBypassAuthRaw: process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === '1',
  disableChartsRaw: process.env.EXPO_PUBLIC_DISABLE_CHARTS === '1'
};
