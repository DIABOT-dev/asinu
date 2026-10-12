import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getAndroidCallPermissions, type AndroidCallPermissions } from '../../lib/android-checkin-call';
import { requestAndroidCallAccess } from '../../lib/android-call-access';
import { showToast } from '../../stores/toast.store';

/** OS permissions are separate from the saved schedule; never block saving. */
export function AndroidCallAccessCard({ onlyWhenNeeded = false }: { onlyWhenNeeded?: boolean } = {}) {
  const { t } = useTranslation('checkinCall');
  const { colors } = useThemeColors();
  const [access, setAccess] = useState<AndroidCallPermissions | null>(null);
  const [requesting, setRequesting] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    mounted.current = true;
    const refresh = () => { void getAndroidCallPermissions().then(value => { if (mounted.current) setAccess(value); }); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);
  const requestAccess = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRequesting(true);
    try {
      const opened = await requestAndroidCallAccess();
      if (!opened && mounted.current) showToast(t('androidAccess.settingsFailed'), 'error');
      const value = await getAndroidCallPermissions();
      if (mounted.current) setAccess(value);
    } finally {
      inFlight.current = false;
      if (mounted.current) setRequesting(false);
    }
  }, [t]);
  if (Platform.OS !== 'android' || !access) return null;
  const ready = access.notifications && access.fullScreen && access.channels;
  if (ready && onlyWhenNeeded) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <Ionicons name={ready ? 'shield-checkmark-outline' : 'notifications-outline'} size={24} color={colors.primaryDark} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t(ready ? 'androidAccess.ready' : 'androidAccess.title')}</Text>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{t(ready ? 'androidAccess.readyBody'
        : access.notifications && access.channels ? 'androidAccess.fullScreenBody' : 'androidAccess.body')}</Text>
      {!ready && <Pressable accessibilityRole="button" accessibilityState={{ disabled: requesting, busy: requesting }}
        disabled={requesting} onPress={requestAccess} style={[styles.action, requesting && styles.disabled]}>
        <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t(requesting ? 'androidAccess.requesting'
          : !access.notifications ? 'androidAccess.allowNotifications'
            : !access.channels ? 'androidAccess.enableSound' : 'androidAccess.allowFullScreen')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, marginTop: 12 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  disabled: { opacity: 0.6 },
  actionText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '700' },
});
