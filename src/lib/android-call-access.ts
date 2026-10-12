import * as Notifications from 'expo-notifications';
import { getAndroidCallPermissions, openAndroidCallSettings } from './android-checkin-call';
import { refreshNotificationLocalization } from './notifications';

/** One user tap opens the next missing OS permission, without an app dialog. */
export async function requestAndroidCallAccess(): Promise<boolean> {
  try {
    let access = await getAndroidCallPermissions();
    if (!access) return false;

    if (!access.notifications) {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) return await openAndroidCallSettings(false);
        // Android needs a notification channel before its permission prompt.
        await refreshNotificationLocalization();
        const decision = await Notifications.requestPermissionsAsync({ android: {} });
        // Respect a refusal. Do not immediately send the user to settings.
        if (!decision.granted) return true;
      }
      access = await getAndroidCallPermissions();
      if (!access) return false;
      if (!access.notifications) return await openAndroidCallSettings(false);
    }

    if (!access.channels) return await openAndroidCallSettings(false);
    if (!access.fullScreen) return await openAndroidCallSettings(true);
    return true;
  } catch {
    return false;
  }
}
