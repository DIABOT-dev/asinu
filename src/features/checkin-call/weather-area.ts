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
const pending = new Map<string, Promise<string | null>>();

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
): Promise<string | null> {
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
    return Promise.resolve(null);
  const key = `${userId}:${rounded.latitude}:${rounded.longitude}`;
  const existing = pending.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const cached = await localCache.getCached<CachedArea>(
        CACHE_KEYS.CHECKIN_WEATHER_AREA,
        '1'
      );
      if (!owner()) return null;
      if (
        cached?.userId === userId &&
        cached.latitude === rounded.latitude &&
        cached.longitude === rounded.longitude &&
        typeof cached.label === 'string' &&
        cached.label.trim()
      )
        return cached.label;
      if (AppState.currentState !== 'active') return null;
      // Reading a saved area never asks for location permission or a new GPS fix.
      const permission = await Location.getForegroundPermissionsAsync();
      if (
        !owner() ||
        permission.status !== 'granted' ||
        AppState.currentState !== 'active'
      )
        return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let addresses: Location.LocationGeocodedAddress[];
      try {
        addresses = await Promise.race([
          Location.reverseGeocodeAsync(rounded),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('AREA_LOOKUP_TIMEOUT')),
              5000
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const label = weatherAreaLabel(addresses[0]);
      if (!owner()) return null;
      if (label)
        await localCache.setCached(CACHE_KEYS.CHECKIN_WEATHER_AREA, '1', {
          ...rounded,
          label,
          userId,
        });
      return label;
    } catch {
      return null;
    }
  })();
  pending.set(key, request);
  void request.finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  return request;
}
