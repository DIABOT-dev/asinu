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
import { AiDataConsentModal } from '../../components/AiDataConsentModal';
import { useDataReminderPermissions } from './useDataReminderPermissions';
import { useTaskReminderPreference } from './useTaskReminderPreference';
import { useSpecialistSharingPermission } from './useSpecialistSharingPermission';
import { SpecialistSharingDialog } from './SpecialistSharingPermission';
import { isDoctorFeaturesEnabled } from '../../lib/appEnv';

type Props = { visible: boolean; onClose: () => void };

/** Controllers stay in the screen while the queued dialog yields to OS permission UI. */
export function AppPermissionsModal({ visible, onClose }: Props) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { t: tCall } = useTranslation('checkinCall');
  const { t: tp } = useTranslation('profile');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const token = useAuthStore(state => state.token);
  const notifications = useDevicePermission('notifications');
  const microphone = useDevicePermission('microphone');
  const photos = useDevicePermission('photos');
  const camera = useQrCameraPermission();
  const data = useDataReminderPermissions(visible);
  const reminders = useTaskReminderPreference();
  const sharing = useSpecialistSharingPermission();
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
  const notifyResult = (label: string, expected: boolean, actual: boolean | null) => {
    showToast(actual === null ? t('devicePermissionError')
      : t(actual === expected
        ? actual ? 'permissionEnabled' : 'permissionDisabled'
        : 'permissionUnchanged', { name: label }),
    actual === null ? 'error' : actual === expected ? 'success' : 'warning');
  };

  const row = (key: string, label: string, icon: React.ComponentProps<typeof Ionicons>['name'],
    granted: boolean, busy: boolean, unavailable: boolean, change: (enabled: boolean) => Promise<unknown>, retry?: () => Promise<unknown>, native = true) => (
    <View key={key} style={styles.row}>
      <Ionicons name={icon} size={23} color={colors.primaryDark} accessible={false} />
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {unavailable && <Text style={[styles.status, { color: colors.textSecondary }]}>{t('devicePermissionUnavailable')}</Text>}
      </View>
      {busy && <ActivityIndicator color={colors.primary} accessibilityLabel={t('devicePermissionLoading')} />}
      {unavailable && retry ? <Pressable accessibilityRole="button" style={styles.retry}
        accessibilityLabel={t('devicePermissionRetry', { name: label })} onPress={() => native ? requestChange(retry) : void retry()}>
        <Ionicons name="refresh-outline" size={22} color={colors.primaryDark} />
      </Pressable> : <Switch accessibilityLabel={label} value={granted} disabled={busy || unavailable}
        accessibilityHint={native ? t('devicePermissionSwitchHint') : undefined}
        accessibilityState={{ checked: granted, disabled: busy || unavailable, busy }}
        trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface}
        onValueChange={enabled => native ? requestChange(() => change(enabled)) : void change(enabled)} />}
    </View>
  );
  const deviceRow = (key: string, icon: React.ComponentProps<typeof Ionicons>['name'], state: ReturnType<typeof useDevicePermission>) =>
    row(key, t(key), icon, state.permission?.granted === true || state.permission?.accessPrivileges === 'limited',
      state.loading || state.pending || (!state.permission && !state.failed), state.failed, async enabled => {
        const result = await state.change(enabled);
        if (focused.current && useAuthStore.getState().token === token && result !== undefined)
          notifyResult(t(key), enabled, result ? result.granted || result.accessPrivileges === 'limited' : null);
      }, state.refresh);

  return <><QueuedModal visible={visible && !yielding && !data.prompt && !sharing.decision} transparent animationType="fade" priority={10} interruptible
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
            camera.pending || !camera.permission, false, async enabled => {
              const result = await camera.change(enabled);
              if (focused.current && useAuthStore.getState().token === token)
                notifyResult(t('cameraQrPermission'), enabled, result?.granted ?? null);
            })}
          {deviceRow('devicePhotos', 'images-outline', photos)}
          {Platform.OS === 'android' && android && row('calls', tCall('androidAccess.title'), 'call-outline',
            android.notifications && android.fullScreen && android.channels, false, false, async enabled => {
              const opened = enabled ? await requestAndroidCallAccess() : await openAndroidCallSettings(true);
              if (!opened) throw new Error('Call permission unavailable');
              const value = await getAndroidCallPermissions();
              if (focused.current && useAuthStore.getState().token === token) {
                setAndroid(value);
                notifyResult(tCall('androidAccess.title'), enabled, value ? value.notifications && value.fullScreen && value.channels : null);
              }
            })}
          <Text accessibilityRole="header" style={[styles.sectionHeading, { color: colors.textPrimary, borderColor: colors.border }]}>{tp('sectionData')}</Text>
          {isDoctorFeaturesEnabled && row('specialist', t('specialistSharing'), 'finger-print-outline', sharing.enabled === true,
            sharing.loading || sharing.busy, sharing.failed, async value => { sharing.request(value); }, sharing.refresh, false)}
          {row('ai', t('aiDataConsentSettings'), 'sparkles-outline', data.ai === true, data.busy || data.loading,
            data.ai === null && !data.loading, async value => { data.change('ai', value); }, data.refresh, false)}
          {row('reminders', t('taskReminders'), 'alarm-outline', reminders.enabled,
            reminders.loading || reminders.pending, reminders.failed || (!reminders.loading && !reminders.available), reminders.change,
            async () => reminders.refresh())}
          {row('feed', tp('healthFeed'), 'bookmark-outline', data.feed === true, data.busy || data.loading,
            data.feed === null && !data.loading, async value => { data.change('feed', value); }, data.refresh, false)}
        </ScrollView>
        <ModalToastHost />
      </View>
    </View>
  </QueuedModal>
    <AiDataConsentModal visible={visible && data.prompt === 'ai'} onAgree={data.agreeAi} onDecline={data.cancel}
      toastHost={<ModalToastHost />} />
    <QueuedModal visible={visible && data.prompt === 'feed'} transparent animationType="fade" onRequestClose={data.cancel}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface, gap: 16 }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{tp('healthFeed')}</Text>
          <Text style={{ color: colors.textSecondary }}>{t('healthFeedToggleDesc')}</Text>
          <Pressable accessibilityRole="button" onPress={data.agreeFeed} style={styles.confirmButton}>
            <Text style={{ color: colors.primaryText }}>{t('healthFeedEnableAction')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={data.cancel} style={styles.confirmButton}>
            <Text style={{ color: colors.textSecondary }}>{tc('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </QueuedModal>
    <SpecialistSharingDialog sharing={sharing} toastHost={<ModalToastHost />} />
  </>;
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
  sectionHeading: { fontSize: 17, fontWeight: '700', marginTop: 12, paddingTop: 16, paddingHorizontal: 8, borderTopWidth: 1 },
  confirmButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
