import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppAlertModal } from '../../components/AppAlertModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getAndroidCallPermissions, openAndroidCallSettings, type AndroidCallPermissions } from '../../lib/android-checkin-call';
import { showToast } from '../../stores/toast.store';

/** OS permissions are separate from the saved schedule; never block saving. */
export function AndroidCallAccessCard({ onlyWhenNeeded = false }: { onlyWhenNeeded?: boolean } = {}) {
  const { t } = useTranslation('checkinCall');
  const { t: tc } = useTranslation('common');
  const { colors } = useThemeColors();
  const [access, setAccess] = useState<AndroidCallPermissions | null>(null);
  const [dialog, setDialog] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    const refresh = () => { void getAndroidCallPermissions().then(value => { if (active) setAccess(value); }); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, []);
  const openSettings = useCallback(async () => {
    const fullScreen = !!access?.notifications && !!access?.channels && !access?.fullScreen;
    setDialog(false);
    if (!await openAndroidCallSettings(fullScreen)) showToast(t('androidAccess.settingsFailed'), 'error');
  }, [access, t]);
  if (Platform.OS !== 'android' || !access) return null;
  const ready = access.notifications && access.fullScreen && access.channels;
  if (ready && onlyWhenNeeded) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <Ionicons name={ready ? 'shield-checkmark-outline' : 'notifications-outline'} size={24} color={colors.primaryDark} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t(ready ? 'androidAccess.ready' : 'androidAccess.title')}</Text>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{t(ready ? 'androidAccess.readyBody' : 'androidAccess.body')}</Text>
      {!ready && <Pressable accessibilityRole="button" onPress={() => setDialog(true)} style={styles.action}>
        <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t('androidAccess.configure')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
      </Pressable>}
      <AppAlertModal queued visible={dialog} title={t('androidAccess.title')}
        message={t(!access.notifications || !access.channels ? 'androidAccess.notificationGuide' : 'androidAccess.fullScreenGuide')}
        icon={{ name: 'phone-outline', color: colors.primaryDark }} stackButtons scrollable
        buttons={[
          { text: t('androidAccess.openSettings'), variant: 'primary', onPress: openSettings },
          { text: tc('later'), style: 'cancel', variant: 'text' },
        ]} onDismiss={() => setDialog(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10, marginTop: 12 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  actionText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '700' },
});
