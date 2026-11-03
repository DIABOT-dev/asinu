import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { AppState, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { runNativePermission } from '../../lib/native-permissions';
import { getExpoPushToken, refreshNotificationLocalization } from '../../lib/notifications';
import { showToast } from '../../stores/toast.store';
import { authApi } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';

export type DevicePermissionKind = 'notifications' | 'microphone' | 'photos';
type Permission = { granted: boolean; canAskAgain: boolean; accessPrivileges?: 'all' | 'limited' | 'none' };

const adapters: Record<DevicePermissionKind, {
  key: string;
  get: () => Promise<Permission>;
  request: (canRun: () => boolean) => Promise<Permission>;
}> = {
  notifications: {
    key: 'notifications',
    get: Notifications.getPermissionsAsync,
    request: async (canRun) => {
      await refreshNotificationLocalization();
      if (!canRun()) throw new Error('Permission request is no longer current');
      return Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    },
  },
  microphone: { key: 'microphone', get: getRecordingPermissionsAsync, request: requestRecordingPermissionsAsync },
  photos: { key: 'photo-library', get: ImagePicker.getMediaLibraryPermissionsAsync, request: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
};

export function useDevicePermission(kind: DevicePermissionKind) {
  const { t } = useTranslation('settings');
  const token = useAuthStore(state => state.token);
  const adapter = adapters[kind];
  const [permission, setPermission] = useState<Permission | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const focused = useRef(false);
  const generation = useRef(0);
  const latestRead = useRef(0);
  const operation = useRef<object | null>(null);
  const current = useCallback((version: number) => focused.current && generation.current === version && useAuthStore.getState().token === token, [token]);

  const refresh = useCallback(async () => {
    const version = generation.current;
    const read = ++latestRead.current;
    if (!current(version)) return null;
    setLoading(true);
    try {
      const next = await adapter.get();
      if (current(version) && read === latestRead.current) {
        setPermission(next);
        setFailed(false);
      }
      return next;
    } catch {
      if (current(version) && read === latestRead.current) {
        setPermission(null);
        setFailed(true);
      }
      return null;
    } finally {
      if (current(version) && read === latestRead.current) setLoading(false);
    }
  }, [adapter, current]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    generation.current++;
    operation.current = null;
    setPending(false);
    setPermission(null);
    void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !operation.current) void refresh();
    });
    return () => {
      focused.current = false;
      generation.current++;
      latestRead.current++;
      operation.current = null;
      subscription.remove();
    };
  }, [refresh]));

  const change = useCallback(async (enabled: boolean) => {
    if (operation.current || loading || !permission || !current(generation.current)) return;
    const owner = {};
    const version = generation.current;
    const canRun = () => current(version) && operation.current === owner;
    operation.current = owner;
    latestRead.current++;
    setPending(true);
    try {
      const before = await adapter.get();
      if (!canRun()) return;
      const granted = before.granted || before.accessPrivileges === 'limited';
      if (enabled && !granted && before.canAskAgain) {
        await runNativePermission(() => adapter.request(canRun), { key: adapter.key, canRun });
      } else if ((enabled && !granted) || (!enabled && granted)) {
        await runNativePermission(() => Linking.openSettings(), { key: 'app-settings', settings: true, canRun });
      }
      if (!canRun()) return;
      const next = await refresh();
      if (canRun() && kind === 'notifications' && next?.granted) {
        // Register only for the account that explicitly enabled notifications.
        void getExpoPushToken().then(pushToken => {
          if (pushToken && current(version)) return authApi.updatePushToken(pushToken);
        }).catch(() => {});
      }
    } catch {
      if (canRun()) {
        showToast(t('devicePermissionError'), 'error');
        await refresh();
      }
    } finally {
      if (canRun()) {
        operation.current = null;
        setPending(false);
      }
    }
  }, [adapter, current, kind, loading, permission, refresh, t]);

  return { permission, loading, pending, failed, refresh, change };
}
