type AppEnv = 'dev' | 'staging' | 'prod';

const rawEnv = (process.env.EXPO_PUBLIC_APP_ENV || 'dev').toLowerCase();
const appEnv: AppEnv = rawEnv === 'staging' || rawEnv === 'prod' ? (rawEnv as AppEnv) : 'dev';

export const isDevBuild = appEnv === 'dev';
export const isStagingBuild = appEnv === 'staging';
export const isProdBuild = appEnv === 'prod';
export { appEnv };
