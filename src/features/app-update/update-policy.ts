export const APP_STORE_ID = 6758967197;
export const APP_BUNDLE_ID = 'com.asinu.lite';
export const IOS_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_BUNDLE_ID}`;
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

export type AppUpdate = {
  id: string;
  platform: 'ios' | 'android';
  version?: string;
  downloaded?: boolean;
  inProgress?: boolean;
};
export type UpdateCheck = { status: 'available'; update: AppUpdate }
  | { status: 'current' | 'unavailable' };

/** Compare numeric release components, never lexicographically or as floats. */
export function compareVersions(left: unknown, right: unknown): number | null {
  const parse = (value: unknown) => typeof value === 'string' && /^\d+(?:\.\d+){0,3}$/.test(value)
    ? value.split('.').map(Number) : null;
  const a = parse(left), b = parse(right);
  if (!a || !b || [...a, ...b].some(part => !Number.isSafeInteger(part))) {return null;}
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) {return (a[i] ?? 0) > (b[i] ?? 0) ? 1 : -1;}
  }
  return 0;
}

/** The public catalog excludes pending App Review releases. Works for iPad too. */
export function appleUpdate(payload: unknown, installed: string | null, osVersion: string): UpdateCheck {
  const results = (payload as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) {return { status: 'unavailable' };}
  const app = results.find((item: any) => item?.trackId === APP_STORE_ID && item?.bundleId === APP_BUNDLE_ID) as
    { version?: string; minimumOsVersion?: string } | undefined;
  if (!app || !installed) {return { status: 'unavailable' };}
  const newer = compareVersions(app.version, installed);
  if (newer === null) {return { status: 'unavailable' };}
  if (app.minimumOsVersion && compareVersions(osVersion, app.minimumOsVersion) !== null
    && compareVersions(osVersion, app.minimumOsVersion)! < 0) {return { status: 'current' };}
  return newer > 0 ? { status: 'available', update: { platform: 'ios', id: `ios:${app.version}`, version: app.version } }
    : { status: 'current' };
}

export function shouldPrompt(update: AppUpdate, dismissed: { id?: string; at?: number } | null, now: number) {
  // Completing an already downloaded update is a separate, user-confirmed step.
  if (update.inProgress) {return true;}
  const id = update.id + (update.downloaded ? ':downloaded' : '');
  return dismissed?.id !== id || typeof dismissed.at !== 'number' || now - dismissed.at >= UPDATE_SNOOZE_MS;
}

/** Never interrupt health entry, recording, invitations, purchases or a call. */
export function canPromptOnPath(pathname: string) {
  return ['/', '/home', '/profile', '/tree', '/missions', '/care-circle'].includes(pathname.replace(/\/$/, '') || '/');
}
