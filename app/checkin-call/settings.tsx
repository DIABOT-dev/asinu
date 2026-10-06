import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal } from '../../src/components/AppAlertModal';
import { checkinCallApi, type CheckinCallSettings } from '../../src/features/checkin-call/checkin-call.api';
import { apiClient, getApiErrorMessage } from '../../src/lib/apiClient';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useFontSizeStore } from '../../src/stores/font-size.store';
import { showToast } from '../../src/stores/toast.store';

const FIELDS: Array<{
  key: keyof CheckinCallSettings;
  labelKey: string;
  unitKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'grace_hours', labelKey: 'fieldGrace', unitKey: 'unitHours', icon: 'timer-outline', min: 2, max: 12, step: 2 },
  { key: 'user_timeout_seconds', labelKey: 'fieldUserTimeout', unitKey: 'unitSeconds', icon: 'time-outline', min: 30, max: 180, step: 30 },
  { key: 'family_ring_seconds', labelKey: 'fieldFamilyRing', unitKey: 'unitSeconds', icon: 'notifications-outline', min: 30, max: 120, step: 30 },
  { key: 'family_confirm_minutes', labelKey: 'fieldFamilyConfirm', unitKey: 'unitMinutes', icon: 'stopwatch-outline', min: 5, max: 30, step: 5 },
  { key: 'max_rounds', labelKey: 'fieldMaxRounds', unitKey: 'unitRounds', icon: 'warning-outline', min: 1, max: 3, step: 1 },
];

const minutesFromTime = (time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

const timeFromMinutes = (minutes: number) => {
  const normalized = (minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export default function CheckinCallSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fontScale = useFontSizeStore(state => state.scale);
  const stackedFields = width < 390 || fontScale === 'large' || fontScale === 'xlarge';
  const { t } = useTranslation('checkinCall');
  const { t: tc } = useTranslation('common');
  const [value, setValue] = useState<CheckinCallSettings | null>(null);
  const [savedValue, setSavedValue] = useState<CheckinCallSettings | null>(null);
  const [contacts, setContacts] = useState<Array<{ id: number; name: string | null }> | null>(null);
  const [reload, setReload] = useState(0);
  const [access, setAccess] = useState<'loading' | 'granted' | 'denied' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [noContactsWarning, setNoContactsWarning] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const initialized = useRef(false);
  const saveInFlight = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    focused.current = true;
    setNoContactsWarning(false);
    setLoadFailed(false);
    if (!saveInFlight.current) setSaving(false);
    setAccess('loading');
    apiClient<{ isAnTam: boolean; callCenterEnabled?: boolean }>('/api/subscriptions/status')
      .then(async (status) => {
        if (!active) return;
        const allowed = status.callCenterEnabled ?? status.isAnTam;
        if (!allowed) {
          setAccess('denied');
          return;
        }
        const result = await checkinCallApi.settings();
        if (!active) return;
        const loaded = {
          ...result.settings,
          checkin_time: result.settings.checkin_time.slice(0, 5),
        };
        // Refresh eligibility on return without discarding an unsaved configuration.
        if (!initialized.current) {
          setValue(loaded);
          setSavedValue(loaded);
          initialized.current = true;
        }
        setContacts(result.contacts || null);
        setAccess('granted');
      })
      .catch((e) => {
        if (!active) return;
        setAccess('error');
        setLoadFailed(true);
        showToast(getApiErrorMessage(e, tc), 'error', 5000);
      });
    return () => {
      active = false;
      focused.current = false;
    };
  }, [tc, reload]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && !saveInFlight.current) {
        setReload(current => current + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const save = async () => {
    if (!value || saveInFlight.current || access !== 'granted' || noContactsWarning || !focused.current) return;
    saveInFlight.current = true;
    setSaving(true);
    try {
      const result = await checkinCallApi.saveSettings(value);
      if (!mounted.current || !focused.current) return;
      if (!result.ok) throw new Error(t('homeControl.updateFailed'));
      const saved = { ...result.settings, checkin_time: result.settings.checkin_time.slice(0, 5) };
      setValue(saved);
      setSavedValue(saved);
      showToast(t('savedSettings'), 'success');
      router.back();
    } catch (e) {
      if (mounted.current && focused.current) showToast(getApiErrorMessage(e, tc), 'error', 5000);
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const toggleDraft = (enabled: boolean) => {
    if (saveInFlight.current || access !== 'granted' || noContactsWarning || !focused.current) return;
    if (enabled && !value?.enabled && contacts?.length === 0) {
      setNoContactsWarning(true);
      return;
    }
    setValue(current => current ? { ...current, enabled } : current);
  };

  const shiftTime = (direction: 1 | -1) => {
    if (!value || saving) return;
    setValue({
      ...value,
      checkin_time: timeFromMinutes(minutesFromTime(value.checkin_time) + direction * 30),
    });
  };

  const stepField = (
    field: typeof FIELDS[number],
    direction: 1 | -1
  ) => {
    if (!value || saving) return;
    const current = Number(value[field.key]);
    const next = Math.min(field.max, Math.max(field.min, current + direction * field.step));
    setValue({ ...value, [field.key]: next });
  };

  if (access === 'denied') {
    return (
      <View style={styles.center}>
        <AppAlertModal
          visible
          stackButtons
          scrollable
          title={t('accessRequiredTitle')}
          message={t('accessRequiredBody')}
          icon={{ name: 'lock-outline', color: '#c2410c' }}
          buttons={[
            { text: tc('later'), style: 'cancel' },
            { text: t('viewPlans'), onPress: () => router.replace('/subscription') },
          ]}
          onDismiss={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)/profile')
          }
        />
      </View>
    );
  }

  if (!value) {
    return (
      <View style={styles.center}>
        {!loadFailed && <ActivityIndicator size="large" color="#059669" />}
        <Text style={styles.loadingText}>{t(loadFailed ? 'settingsLoadFailed' : 'loadingSettings')}</Text>
        {loadFailed && <Pressable accessibilityRole="button" style={styles.stepBtn} onPress={() => setReload(current => current + 1)}><Text>{tc('retry')}</Text></Pressable>}
      </View>
    );
  }

  const dirty = JSON.stringify(value) !== JSON.stringify(savedValue);
  const busy = saving || access !== 'granted' || noContactsWarning;
  const saveDisabled = busy || !dirty || access !== 'granted';

  return (
    <View style={styles.root}>
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc('back')}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#0f3e36" />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('title')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View style={styles.card}>
          {/* Header row with headset icon */}
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="headset-outline" size={24} color="#00897b" />
              <Text style={styles.cardTitle}>{t('title')}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{t('subtitle')}</Text>
          </View>

          {/* Toggle row */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>{t('enable')}</Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel={t('enable')}
              accessibilityState={{ checked: value.enabled, disabled: busy }}
              value={value.enabled}
              disabled={busy}
              onValueChange={toggleDraft}
              trackColor={{ false: '#cbd5e1', true: '#00897b' }}
            />
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel={t('personalization.open')}
            style={styles.setupAction} disabled={busy} onPress={() => router.push('/checkin-call/voice-settings')}>
            <Ionicons name="person-outline" size={20} color="#00897b" />
            <Text style={styles.setupActionText}>{t('personalization.open')}</Text>
          </Pressable>
          {contacts !== null && <View style={styles.contactPreview}>
            <Text style={styles.toggleLabel}>{t('eligibleContacts')}</Text>
            {contacts.length === 0 ? <>
              <Text style={styles.cardSubtitle}>{t('noEligibleContacts')}</Text>
              <Text style={styles.cardSubtitle}>{t('contactSetupHint')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('manageCareCircle')}
                disabled={busy}
                style={styles.setupAction}
                onPress={() => router.push('/care-circle')}
              >
                <Ionicons name="people-outline" size={20} color="#00897b" />
                <Text style={styles.setupActionText}>{t('manageCareCircle')}</Text>
              </Pressable>
            </> : contacts.map((contact, index) => <Text style={styles.cardSubtitle} key={contact.id}>{index + 1}. {contact.name || t('eligibleContactFallback', { index: index + 1 })}</Text>)}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('refreshContacts')}
              accessibilityState={{ disabled: busy, busy: access === 'loading' }}
              disabled={busy}
              style={styles.setupAction}
              onPress={() => setReload(current => current + 1)}
            >
              {access === 'loading'
                ? <ActivityIndicator size="small" color="#00897b" />
                : <Ionicons name="refresh-outline" size={20} color="#00897b" />}
              <Text style={styles.setupActionText}>{t('refreshContacts')}</Text>
            </Pressable>
          </View>}

          {/* Row 1: Check-in Time */}
          <Pressable
            style={[styles.settingItemRow, stackedFields && styles.stackedItemRow]}
            accessibilityRole="button"
            accessibilityLabel={t('checkinTime')}
            accessibilityValue={{ text: value.checkin_time.slice(0, 5) }}
            accessibilityHint={t('editSettingHint')}
            onPress={() => setActiveField(activeField === 'time' ? null : 'time')}
          >
            <View style={styles.rowLeftGroup}>
              <Ionicons name="call-outline" size={22} color="#00897b" style={styles.settingRowIcon} />
              <Text style={styles.settingItemLabel}>{t('checkinTime')}</Text>
            </View>
            <View style={styles.pillWithControls}>
              {activeField === 'time' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('decreaseValue', { label: t('checkinTime') })}
                  style={styles.stepBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    shiftTime(-1);
                  }}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
              )}
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>{value.checkin_time.slice(0, 5)}</Text>
              </View>
              {activeField === 'time' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('increaseValue', { label: t('checkinTime') })}
                  style={styles.stepBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    shiftTime(1);
                  }}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              )}
            </View>
          </Pressable>

          {/* Remaining 5 setting rows */}
          {FIELDS.map((field) => {
            const numVal = Number(value[field.key]);
            const unit = t(field.unitKey);
            const isSelected = activeField === field.key;
            return (
              <View key={field.key}>
                <Pressable
                  style={[styles.settingItemRow, stackedFields && styles.stackedItemRow]}
                  accessibilityRole="button"
                  accessibilityLabel={t(field.labelKey)}
                  accessibilityValue={{ text: `${numVal} ${unit}` }}
                  accessibilityHint={t('editSettingHint')}
                  onPress={() => setActiveField(isSelected ? null : field.key)}
                >
                  <View style={styles.rowLeftGroup}>
                    <Ionicons name={field.icon} size={22} color="#00897b" style={styles.settingRowIcon} />
                    <Text style={styles.settingItemLabel}>{t(field.labelKey)}</Text>
                  </View>
                  <View style={styles.pillWithControls}>
                    {isSelected && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('decreaseValue', { label: t(field.labelKey) })}
                        disabled={saving || numVal <= field.min}
                        accessibilityState={{ disabled: saving || numVal <= field.min }}
                        style={styles.stepBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          stepField(field, -1);
                        }}
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                    )}
                    <View style={styles.pillBadge}>
                      <Text style={styles.pillBadgeText}>{`${numVal} ${unit}`}</Text>
                    </View>
                    {isSelected && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('increaseValue', { label: t(field.labelKey) })}
                        disabled={saving || numVal >= field.max}
                        accessibilityState={{ disabled: saving || numVal >= field.max }}
                        style={styles.stepBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          stepField(field, 1);
                        }}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}

          {access === 'error' && <Pressable accessibilityRole="button" style={styles.setupAction} onPress={() => setReload(current => current + 1)}><Text style={styles.setupActionText}>{tc('retry')}</Text></Pressable>}
          <Text style={styles.cardSubtitle}>{t('urgentSettingsNotice')}</Text>

          {/* Save Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('saveSettings')}
            accessibilityState={{ disabled: saveDisabled, busy: saving }}
            style={[styles.saveBtn, saveDisabled && styles.saveBtnDisabled]}
            onPress={save}
            disabled={saveDisabled}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t('saveSettings')}</Text>
            )}
          </Pressable>

        </View>
      </ScrollView>
      <AppAlertModal
        queued
        visible={noContactsWarning}
        title={t('noContactsWarning.title')}
        message={t('noContactsWarning.body')}
        icon={{ name: 'account-alert-outline', color: '#b45309' }}
        stackButtons
        scrollable
        buttons={[
          { text: t('homeControl.turnOn'), onPress: () => {
            if (mounted.current && focused.current && !saveInFlight.current) {
              setValue(current => current ? { ...current, enabled: true } : current);
            }
          } },
          { text: t('manageCareCircle'), style: 'cancel', onPress: () => {
            if (mounted.current && focused.current) router.push('/care-circle');
          } },
          { text: tc('cancel'), style: 'cancel' },
        ]}
        onDismiss={() => setNoContactsWarning(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4faf8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f4faf8' },
  loadingText: { fontSize: 14, color: '#64748b' },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f4faf8',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  contactPreview: { gap: 8, paddingVertical: 12 },
  setupAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  setupActionText: { flexShrink: 1, color: '#00897b', fontSize: 14, fontWeight: '600' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: '#0f3e36', textAlign: 'center', flex: 1 },
  container: { padding: 18, paddingTop: 4, paddingBottom: 48, gap: 14 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 16,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    flexShrink: 1,
    fontWeight: '800',
    color: '#0f3e36',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f3e36',
  },
  settingItemRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  stackedItemRow: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  rowLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  settingRowIcon: {
    width: 24,
    textAlign: 'center',
  },
  settingItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  pillWithControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillBadge: {
    flexShrink: 1,
    backgroundColor: '#f0fdf9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  pillBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f3e36',
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00897b',
    marginTop: -2,
  },
  saveBtn: {
    backgroundColor: '#00897b',
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#00897b',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtnDisabled: { opacity: 0.45, elevation: 0, shadowOpacity: 0 },
});
