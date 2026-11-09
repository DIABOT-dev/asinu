import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { localCache } from '../../lib/localCache';
import { CACHE_KEYS } from '../../lib/cacheKeys';
import { useAuthStore } from '../auth/auth.store';
import { coarsePoint } from './voice-preferences';

type Point = { latitude: number; longitude: number };
type CachedArea = Point & { label: string; userId: string };
type AreaParts = Pick<
  Location.LocationGeocodedAddress,
  'district' | 'subregion' | 'city' | 'region'
>;
export type WeatherAreaIssue =
  | 'permission'
  | 'inactive'
  | 'timeout'
  | 'noAddress'
  | 'unavailable';
export type WeatherAreaResult = {
  label: string | null;
  issue: WeatherAreaIssue | null;
};
const pending = new Map<string, Promise<WeatherAreaResult>>();
const unavailable: WeatherAreaResult = { label: null, issue: 'unavailable' };

/** Display administrative areas only, never a street, building or house number. */
export function weatherAreaLabel(address?: Partial<AreaParts>): string | null {
  if (!address) return null;
  const seen = new Set<string>();
  const parts = [
    address.district,
    address.subregion,
    address.city,
    address.region,
  ]
    .filter((part): part is string => typeof part === 'string')
    .map((part) =>
      part
        .replace(/[\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
    )
    .filter((part) => {
      const key = part
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/\b(thanh pho|tinh|city|province|tp)\b/g, '')
        .replace(/[^\p{L}\p{N}]/gu, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return parts.length ? parts.join(', ').slice(0, 240) : null;
}

export function resolveWeatherArea(
  point: Point,
  userId: string
): Promise<WeatherAreaResult> {
  const rounded = coarsePoint(point.latitude, point.longitude);
  const owner = () =>
    String(useAuthStore.getState().profile?.id) === userId &&
    Boolean(useAuthStore.getState().token);
  if (
    !owner() ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    return Promise.resolve(unavailable);
  const key = `${userId}:${rounded.latitude}:${rounded.longitude}`;
  const existing = pending.get(key);
  if (existing) return existing;

  const request = (async (): Promise<WeatherAreaResult> => {
    try {
      const cached = await localCache.getCached<CachedArea>(
        CACHE_KEYS.CHECKIN_WEATHER_AREA,
        '1'
      );
      if (!owner()) return unavailable;
      if (
        cached?.userId === userId &&
        cached.latitude === rounded.latitude &&
        cached.longitude === rounded.longitude &&
        typeof cached.label === 'string' &&
        cached.label.trim()
      )
        return { label: cached.label, issue: null };
      if (AppState.currentState !== 'active')
        return { label: null, issue: 'inactive' };
      // Reading a saved area never asks for location permission or a new GPS fix.
      const permission = await Location.getForegroundPermissionsAsync();
      if (!owner()) return unavailable;
      if (permission.status !== 'granted')
        return { label: null, issue: 'permission' };
      if (AppState.currentState !== 'active')
        return { label: null, issue: 'inactive' };
      let timer: ReturnType<typeof setTimeout> | undefined;
      let addresses: Location.LocationGeocodedAddress[];
      try {
        addresses = await Promise.race([
          Location.reverseGeocodeAsync(rounded),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('AREA_LOOKUP_TIMEOUT')),
              12000
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const label = addresses.map(weatherAreaLabel).find(Boolean) || null;
      if (!owner()) return unavailable;
      if (label)
        await localCache.setCached(CACHE_KEYS.CHECKIN_WEATHER_AREA, '1', {
          ...rounded,
          label,
          userId,
        });
      return { label, issue: label ? null : 'noAddress' };
    } catch (error) {
      return {
        label: null,
        issue:
          error instanceof Error && error.message === 'AREA_LOOKUP_TIMEOUT'
            ? 'timeout'
            : 'unavailable',
      };
    }
  })();
  pending.set(key, request);
  void request.finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  return request;
}
