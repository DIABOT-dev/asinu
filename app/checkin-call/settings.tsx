import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal } from '../../src/components/AppAlertModal';
import { checkinCallApi, type CheckinCallSettings } from '../../src/features/checkin-call/checkin-call.api';
import { apiClient, getApiErrorMessage } from '../../src/lib/apiClient';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('checkinCall');
  const { t: tc } = useTranslation('common');
  const [value, setValue] = useState<CheckinCallSettings | null>(null);
  const [access, setAccess] = useState<'loading' | 'granted' | 'denied' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient<{ isAnTam: boolean; callCenterEnabled?: boolean }>('/api/subscriptions/status')
      .then(async (status) => {
        if (!active) return;
        const allowed = status.callCenterEnabled ?? status.isAnTam;
        if (!allowed) {
          setAccess('denied');
          return;
        }
        setAccess('granted');
        const result = await checkinCallApi.settings();
        if (!active) return;
        setValue({
          ...result.settings,
          checkin_time: result.settings.checkin_time.slice(0, 5),
        });
      })
      .catch((e) => {
        if (!active) return;
        setAccess('error');
        setError(getApiErrorMessage(e, tc));
      });
    return () => {
      active = false;
    };
  }, [tc]);

  const save = async () => {
    if (!value || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await checkinCallApi.saveSettings(value);
      setValue({ ...result.settings, checkin_time: result.settings.checkin_time.slice(0, 5) });
      router.back();
    } catch (e) {
      setError(getApiErrorMessage(e, tc));
    } finally {
      setSaving(false);
    }
  };

  const shiftTime = (direction: 1 | -1) => {
    if (!value) return;
    setValue({
      ...value,
      checkin_time: timeFromMinutes(minutesFromTime(value.checkin_time) + direction * 30),
    });
  };

  const stepField = (
    field: typeof FIELDS[number],
    direction: 1 | -1
  ) => {
    if (!value) return;
    const current = Number(value[field.key]);
    let next = current + direction * field.step;
    if (next > field.max) next = field.min;
    if (next < field.min) next = field.max;
    setValue({ ...value, [field.key]: next });
  };

  if (access === 'denied') {
    return (
      <View style={styles.center}>
        <AppAlertModal
          visible
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
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>{error || t('loadingSettings')}</Text>
      </View>
    );
  }

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
              <Text style={styles.toggleStatus}>{value.enabled ? t('active') : t('inactive')}</Text>
            </View>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel={t('enable')}
              accessibilityState={{ checked: value.enabled }}
              value={value.enabled}
              onValueChange={(enabled) => setValue({ ...value, enabled })}
              trackColor={{ false: '#cbd5e1', true: '#00897b' }}
            />
          </View>

          <View style={styles.divider} />

          {/* Row 1: Check-in Time */}
          <Pressable
            style={styles.settingItemRow}
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
                  style={styles.settingItemRow}
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

          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* Save Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('saveSettings')}
            accessibilityState={{ disabled: saving }}
            style={styles.saveBtn}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t('saveSettings')}</Text>
            )}
          </Pressable>

        </View>
      </ScrollView>
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  toggleStatus: {
    fontSize: 13,
    color: '#00897b',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  settingItemRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
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
    gap: 6,
  },
  pillBadge: {
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
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00897b',
    marginTop: -2,
  },
  error: { color: '#dc2626', fontSize: 13, marginTop: 10, textAlign: 'center' },
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
});
