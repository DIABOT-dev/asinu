import { Linking, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { checkinCallApi } from '../checkin-call/checkin-call.api';
import { useDevicePermission } from '../profile/useDevicePermission';
import { useQrCameraPermission } from '../care-circle/useQrCameraPermission';
import { getAndroidCallPermissions, openAndroidCallSettings } from '../../lib/android-checkin-call';
import { requestAndroidCallAccess } from '../../lib/android-call-access';
import { runNativePermission } from '../../lib/native-permissions';
import { authApi } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';
import { useAppUpdateStore } from '../app-update/app-update.store';
import { useGuidanceStore } from '../guidance/guidance.store';
import type { AssistantNative } from './app-assistant.api';

export function useAssistantNativeActions({ present, isCurrent, dismissArticle }: {
  present: (operation: () => Promise<{ granted: boolean }>) => Promise<{ granted: boolean }>;
  isCurrent: () => boolean;
  dismissArticle: (id: string) => Promise<unknown>;
}) {
  const { t } = useTranslation('settings');
  const { t: tp } = useTranslation('profile');
  const notifications = useDevicePermission('notifications');
  const microphone = useDevicePermission('microphone');
  const photos = useDevicePermission('photos');
  const camera = useQrCameraPermission();
  return async (action: AssistantNative) => {
    let reply: string | undefined;
    await present(async () => {
      if (!isCurrent()) throw new Error('Session changed');
      if (action.kind === 'device.permission') {
        const { kind, enabled } = action.parameters;
        if (!kind || typeof enabled !== 'boolean') throw new Error('Invalid permission');
        let granted = false;
        if (kind === 'calls') {
          if (enabled) await requestAndroidCallAccess();
          else await openAndroidCallSettings(true);
          if (!isCurrent()) return { granted: false };
          const actual = await getAndroidCallPermissions();
          granted = !!actual && actual.notifications && actual.fullScreen && actual.channels;
        } else if (kind === 'camera') {
          await camera.change(enabled);
          granted = (await Camera.getCameraPermissionsAsync()).granted;
        } else {
          const control = { notifications, microphone, photos }[kind];
          if (control.loading || control.pending || !control.permission) throw new Error('Permission status unavailable');
          await control.change(enabled);
          const actual = await control.refresh();
          granted = actual?.granted === true || actual?.accessPrivileges === 'limited';
        }
        reply = t('appAssistant.permissionStatus', { permission: t(`appAssistant.permissionNames.${kind}`), status: t(granted ? 'appAssistant.permissionOn' : 'appAssistant.permissionOff') });
      } else if (action.kind === 'profile.avatar') {
        let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!permission.granted) permission = await runNativePermission(() => ImagePicker.requestMediaLibraryPermissionsAsync(), { key: 'photos', canRun: isCurrent });
        if (!permission.granted) throw new Error('PHOTO_PERMISSION_DENIED');
        const selected = await runNativePermission(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }),
          { key: 'assistant-avatar-picker', canRun: isCurrent });
        if (!isCurrent() || selected.canceled || !selected.assets[0]) return { granted: false };
        const profile = await authApi.uploadAvatar(selected.assets[0].uri);
        if (isCurrent()) useAuthStore.setState({ profile });
        reply = t('appAssistant.avatarSaved');
      } else if (action.kind === 'app.share') {
        await runNativePermission(() => Share.share({ message: tp('shareMessage'), title: 'Asinu' }), { key: 'assistant-share', canRun: isCurrent });
      } else if (action.kind === 'app.support') {
        await runNativePermission(() => Linking.openURL('https://zalo.me/0898888917'), { key: 'assistant-support', canRun: isCurrent });
      } else if (action.kind === 'app.update') {
        const result = await useAppUpdateStore.getState().check(true);
        reply = t(result.status === 'current' ? 'appAssistant.updateCurrent' : result.status === 'available' ? 'appAssistant.updateAvailable' : 'appAssistant.updateUnavailable');
      } else if (action.kind === 'app.guide') {
        await useGuidanceStore.getState().replay();
      } else if (action.kind === 'feed.hide') {
        if (!/^curated-[1-5]$/.test(action.parameters.id || '')) throw new Error('Invalid article');
        await dismissArticle(action.parameters.id!);
      } else if (action.kind === 'calls.weather_device') {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) permission = await runNativePermission(() => Location.requestForegroundPermissionsAsync(), { key: 'weather-location', canRun: isCurrent });
        if (!permission.granted || !isCurrent()) throw new Error('Location permission required');
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isCurrent()) return { granted: false };
        const { preferences } = await checkinCallApi.voicePreferences();
        if (!isCurrent()) return { granted: false };
        await checkinCallApi.saveVoicePreferences({ ...preferences, weather_enabled: true, region: 'device', location: {
          latitude: Math.round(position.coords.latitude * 100) / 100,
          longitude: Math.round(position.coords.longitude * 100) / 100,
        } });
        reply = t('appAssistant.weatherSaved');
      }
      return { granted: true };
    });
    return isCurrent() ? reply : undefined;
  };
}
