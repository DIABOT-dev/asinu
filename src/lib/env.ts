const devBypassAuthRaw = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === '1';
const disableChartsRaw = process.env.EXPO_PUBLIC_DISABLE_CHARTS === '1';
const isProdRuntime = process.env.NODE_ENV === 'production';

const devBypassAuth = isProdRuntime ? false : devBypassAuthRaw;

if (isProdRuntime && devBypassAuthRaw) {

}

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  devBypassAuthRaw,
  devBypassAuth,
  disableChartsRaw
};
