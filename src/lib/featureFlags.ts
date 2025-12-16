import { env } from './env';
import { isDevBuild } from './appEnv';

export const featureFlags = {
  devBypassAuth: isDevBuild && env.devBypassAuthRaw,
  disableCharts: isDevBuild && env.disableChartsRaw
};

export const features = {
  showMascot: process.env.EXPO_PUBLIC_SHOW_MASCOT === 'true'
};
