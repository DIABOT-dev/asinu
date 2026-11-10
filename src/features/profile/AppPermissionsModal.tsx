import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueuedModal } from '../../components/QueuedModal';
import { ModalToastHost } from '../../components/GlobalToastHost';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useDevicePermission } from './useDevicePermission';
import { useQrCameraPermission } from '../care-circle/useQrCameraPermission';
import { useAuthStore } from '../auth/auth.store';
import { getAndroidCallPermissions, openAndroidCallSettings, type AndroidCallPermissions } from '../../lib/android-checkin-call';
import { requestAndroidCallAccess } from '../../lib/android-call-access';
import { showToast } from '../../stores/toast.store';

type Props = { visible: boolean; onClose: () => void };

/** Controllers stay in the screen while the queued dialog yields to OS permission UI. */
export function AppPermissionsModal({ visible, onClose }: Props) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { t: tCall } = useTranslation('checkinCall');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const token = useAuthStore(state => state.token);
  const notifications = useDevicePermission('notifications');
  const microphone = useDevicePermission('microphone');
  const photos = useDevicePermission('photos');
  const camera = useQrCameraPermission();
  const [android, setAndroid] = useState<AndroidCallPermissions | null>(null);
  const [yielding, setYielding] = useState(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const generation = useRef(0);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    generation.current++;
    return () => {
      focused.current = false;
      generation.current++;
      onClose();
    };
  }, [onClose, token]));

  useEffect(() => {
    if (!visible || yielding || Platform.OS !== 'android') return;
    let active = true;
    const refresh = () => {
      void getAndroidCallPermissions().then(value => { if (active) setAndroid(value); });
    };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; listener.remove(); };
  }, [visible, yielding, token]);

  const requestChange = (operation: () => Promise<unknown>) => {
    if (inFlight.current || !focused.current) return;
    const version = generation.current;
    const current = () => focused.current && generation.current === version && useAuthStore.getState().token === token;
    inFlight.current = true;
    pending.current = async () => {
      try {
        if (current()) await operation();
      } catch {
        if (current()) showToast(t('devicePermissionError'), 'error');
      } finally {
        inFlight.current = false;
        if (mounted.current) setYielding(false);
      }
    };
    setYielding(true);
  };
  const afterDismiss = () => {
    const operation = pending.current;
    pending.current = null;
    return operation?.();
  };

  const row = (key: string, label: string, icon: React.ComponentProps<typeof Ionicons>['name'],
    granted: boolean, busy: boolean, unavailable: boolean, change: (enabled: boolean) => Promise<unknown>, retry?: () => Promise<unknown>) => (
    <View key={key} style={styles.row}>
      <Ionicons name={icon} size={23} color={colors.primaryDark} accessible={false} />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {unavailable && <Text style={[styles.status, { color: colors.textSecondary }]}>{t('devicePermissionUnavailable')}</Text>}
      </View>
      {busy && <ActivityIndicator color={colors.primary} accessibilityLabel={t('devicePermissionLoading')} />}
      {unavailable && retry ? <Pressable accessibilityRole="button" style={styles.retry}
        accessibilityLabel={t('devicePermissionRetry', { name: label })} onPress={() => requestChange(retry)}>
        <Ionicons name="refresh-outline" size={22} color={colors.primaryDark} />
      </Pressable> : <Switch accessibilityLabel={label} value={granted} disabled={busy || unavailable}
        accessibilityHint={t('devicePermissionSwitchHint')}
        accessibilityState={{ checked: granted, disabled: busy || unavailable, busy }}
        trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface}
        onValueChange={enabled => requestChange(() => change(enabled))} />}
    </View>
  );
  const deviceRow = (key: string, icon: React.ComponentProps<typeof Ionicons>['name'], state: ReturnType<typeof useDevicePermission>) =>
    row(key, t(key), icon, state.permission?.granted === true || state.permission?.accessPrivileges === 'limited',
      state.loading || state.pending || (!state.permission && !state.failed), state.failed, state.change, state.refresh);

  return <QueuedModal visible={visible && !yielding} transparent animationType="fade" priority={10} interruptible
    onRequestClose={onClose} onDismiss={afterDismiss}>
    <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        accessibilityRole="button" accessibilityLabel={tc('close')} onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: isDark ? '#142e29' : '#f1faf7' }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{t('appPermissions')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={tc('close')} style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator bounces={false}>
          {deviceRow('deviceNotifications', 'notifications-outline', notifications)}
          {deviceRow('deviceMicrophone', 'mic-outline', microphone)}
          {row('camera', t('cameraQrPermission'), 'camera-outline', camera.permission?.granted === true,
            camera.pending || !camera.permission, false, camera.change)}
          {deviceRow('devicePhotos', 'images-outline', photos)}
          {Platform.OS === 'android' && android && row('calls', tCall('androidAccess.title'), 'call-outline',
            android.notifications && android.fullScreen && android.channels, false, false, async enabled => {
              const opened = enabled ? await requestAndroidCallAccess() : await openAndroidCallSettings(true);
              if (!opened) throw new Error('Call permission unavailable');
              const value = await getAndroidCallPermissions();
              if (focused.current && useAuthStore.getState().token === token) setAndroid(value);
            })}
        </ScrollView>
        <ModalToastHost />
      </View>
    </View>
  </QueuedModal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '88%', alignSelf: 'center', borderRadius: 24, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: { minHeight: 64, paddingVertical: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12 },
  retry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
