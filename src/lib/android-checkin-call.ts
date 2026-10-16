import { NativeModules, Platform } from 'react-native';
import { env } from './env';
import { runNativePermission } from './native-permissions';

export type AndroidCallPermissions = { notifications: boolean; fullScreen: boolean; channels: boolean; telecomSupported?: boolean; telecomEnabled?: boolean; telecomPermissionNeeded?: boolean };
type AndroidCallModule = {
  configure(baseUrl: string): Promise<boolean>;
  getCallPermissions(): Promise<AndroidCallPermissions>;
  openCallSettings(fullScreen: boolean): Promise<boolean>;
  openTelecomSettings?(): Promise<boolean>;
};
const native = Platform.OS === 'android'
  ? NativeModules.AsinuCheckinCallModule as AndroidCallModule | undefined : undefined;

/** Called BEFORE registering/uploading the native FCM token. No session JWT is persisted. */
export async function configureAndroidCheckinCalls(): Promise<void> {
  await native?.configure(env.apiBaseUrl);
}

export async function getAndroidCallPermissions(): Promise<AndroidCallPermissions | null> {
  if (!native) return null; // older installed builds / Expo Go
  try { return await native.getCallPermissions(); } catch { return null; }
}

export async function openAndroidCallSettings(fullScreen: boolean): Promise<boolean> {
  if (!native) return false;
  try { return await runNativePermission(() => native.openCallSettings(fullScreen), {
    key: fullScreen ? 'android-call-fullscreen' : 'android-notification-settings', settings: true,
  }); } catch { return false; }
}

export async function openAndroidTelecomSettings(): Promise<boolean> {
  try {
    if (!native?.openTelecomSettings) return false;
    return await runNativePermission(() => native.openTelecomSettings!(), { key: 'android-telecom-settings', settings: true });
  } catch { return false; }
}
