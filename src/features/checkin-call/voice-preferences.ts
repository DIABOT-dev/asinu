import type { CheckinVoicePreferences } from './checkin-call.api';

export const VOICE_DEFAULTS: CheckinVoicePreferences = {
  use_name: false,
  use_health: false,
  address: 'auto',
  weather_enabled: false,
  region: null,
  location: null,
};
export const ADDRESS_OPTIONS = [
  'auto',
  'bac',
  'co',
  'chu',
  'anh',
  'chi',
  'ban',
] as const;
export const REGION_OPTIONS = [
  'hanoi',
  'hcm',
  'danang',
  'haiphong',
  'cantho',
  'hue',
] as const;

export function weatherRegionReady(value: CheckinVoicePreferences) {
  if (!value.weather_enabled) return true;
  if (value.region !== 'device')
    return REGION_OPTIONS.some((region) => region === value.region);
  const point = value.location;
  return (
    !!point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

export function coarsePoint(latitude: number, longitude: number) {
  return {
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
  };
}
