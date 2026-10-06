import { NativeModules, Platform } from 'react-native';
import { env } from './env';

export type AndroidCallPermissions = { notifications: boolean; fullScreen: boolean; channels: boolean };
type AndroidCallModule = {
  configure(baseUrl: string): Promise<boolean>;
  getCallPermissions(): Promise<AndroidCallPermissions>;
  openCallSettings(fullScreen: boolean): Promise<boolean>;
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
  try { return await native.openCallSettings(fullScreen); } catch { return false; }
}
