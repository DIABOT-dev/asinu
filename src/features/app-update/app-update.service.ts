import { requireOptionalNativeModule } from 'expo-modules-core';
import { getLocales } from 'expo-localization';
import { Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { ANDROID_STORE_URL, APP_BUNDLE_ID, APP_STORE_ID, appleUpdate, IOS_STORE_URL, type AppUpdate, type UpdateCheck } from './update-policy';

// Older development clients can load the new JS before being rebuilt. Keep
// those clients usable; production binaries autolink expo-application.
const nativeApp = requireOptionalNativeModule<{ applicationId?: string; nativeApplicationVersion?: string }>('ExpoApplication');
const nativeApplicationVersion = nativeApp?.applicationId === APP_BUNDLE_ID ? nativeApp.nativeApplicationVersion ?? null : null;

export type UpdateProgress = {
  phase: 'available' | 'pending' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'cancelled' | 'error';
  downloadedBytes: number;
  totalBytes: number;
  versionCode?: number;
  errorCode?: number;
};
export type StoreUpdateCheck = UpdateCheck & { progress?: UpdateProgress };
export type InstallUpdateResult = { outcome: 'started' | 'downloaded' | 'installing' | 'cancelled' | 'external' | 'error' };
type AndroidInfo = {
  available: boolean;
  versionCode: number;
  downloaded: boolean;
  inProgress: boolean;
  downloading: boolean;
  phase?: UpdateProgress['phase'];
  downloadedBytes?: number;
  totalBytes?: number;
  errorCode?: number;
};
type AndroidUpdates = {
  check(): Promise<AndroidInfo>;
  start(): Promise<string>;
  complete(): Promise<boolean>;
  addListener(name: string): void;
  removeListeners(count: number): void;
};
const android = Platform.OS === 'android' ? NativeModules.AsinuAppUpdate as AndroidUpdates | undefined : undefined;
const phases = new Set<UpdateProgress['phase']>(['available', 'pending', 'downloading', 'downloaded', 'installing', 'installed', 'cancelled', 'error']);
const bytes = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** Reject malformed native events. Missing byte totals mean indeterminate progress. */
export function readUpdateProgress(input: unknown): UpdateProgress | null {
  if (!input || typeof input !== 'object') {return null;}
  const raw = input as Partial<UpdateProgress>;
  if (!raw.phase || !phases.has(raw.phase)) {return null;}
  return {
    phase: raw.phase,
    downloadedBytes: bytes(raw.downloadedBytes),
    totalBytes: bytes(raw.totalBytes),
    ...(typeof raw.versionCode === 'number' && Number.isSafeInteger(raw.versionCode) && raw.versionCode > 0 ? { versionCode: raw.versionCode } : {}),
    ...(typeof raw.errorCode === 'number' && Number.isInteger(raw.errorCode) ? { errorCode: raw.errorCode } : {}),
  };
}

export async function checkStoreUpdate(): Promise<StoreUpdateCheck> {
  if (Platform.OS === 'android') {
    if (!android) {return { status: 'unavailable' };}
    const info = await android.check();
    const progress = readUpdateProgress({
      ...info,
      // Older native builds have only booleans; do not fabricate percentages.
      phase: info.phase || (info.downloaded ? 'downloaded' : info.downloading ? 'pending' : 'available'),
    });
    const active = progress && ['pending', 'downloading', 'downloaded', 'installing'].includes(progress.phase);
    if ((info.available || info.downloaded || info.inProgress || active)
      && Number.isSafeInteger(info.versionCode) && info.versionCode > 0) {
      return {
        status: 'available',
        update: { platform: 'android', id: `android:${info.versionCode}`, downloaded: progress?.phase === 'downloaded', inProgress: info.inProgress },
        ...(progress ? { progress } : {}),
      };
    }
    return { status: 'current' };
  }
  if (Platform.OS !== 'ios') {return { status: 'unavailable' };}
  const country = getLocales()[0]?.regionCode?.toLowerCase() || 'vn';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // Query the device storefront; don't advertise a release unavailable there.
    const response = await fetch(`https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=${encodeURIComponent(country)}`, { signal: controller.signal });
    if (!response.ok) {return { status: 'unavailable' };}
    return appleUpdate(await response.json(), nativeApplicationVersion, String(Platform.Version));
  } finally { clearTimeout(timer); }
}

export function subscribeUpdateProgress(onProgress: (progress: UpdateProgress) => void) {
  if (!android) {return () => {};}
  const subscription = new NativeEventEmitter(android as never).addListener('AsinuUpdateProgress', (input: unknown) => {
    const progress = readUpdateProgress(input);
    if (progress) {onProgress(progress);}
  });
  return () => subscription.remove();
}

/** Compatibility for callers that only need the ready-to-install notification. */
export function subscribeUpdateDownloaded(onDownloaded: () => void) {
  if (!android) {return () => {};}
  const subscription = new NativeEventEmitter(android as never).addListener('AsinuUpdateDownloaded', onDownloaded);
  return () => subscription.remove();
}

export async function installAppUpdate(update: AppUpdate): Promise<InstallUpdateResult> {
  if (update.platform === 'android' && android) {
    if (update.downloaded) {
      try { return { outcome: await android.complete() ? 'installing' : 'error' }; }
      catch { return { outcome: 'error' }; }
    }
    try {
      const result = await android.start();
      if (result === 'cancelled') {return { outcome: 'cancelled' };}
      if (result === 'failed') {return { outcome: 'error' };}
      if (result === 'downloaded') {return { outcome: 'downloaded' };}
      if (result === 'started' || result === 'busy') {return { outcome: 'started' };}
    } catch { /* Store listing remains usable if Play's in-app flow is unavailable. */ }
  }
  // iOS owns downloads in the App Store. Never show a fabricated in-app meter.
  const nativeUrl = update.platform === 'ios' ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}` : 'market://details?id=com.asinu.lite';
  try { await Linking.openURL(nativeUrl); }
  catch { await Linking.openURL(update.platform === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL); }
  return { outcome: 'external' };
}
