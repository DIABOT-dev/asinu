import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { AppAlertModal } from '../../src/components/AppAlertModal';
import { useAuthStore } from '../../src/features/auth/auth.store';
import {
  checkinCallApi,
  type CheckinVoicePreferences,
} from '../../src/features/checkin-call/checkin-call.api';
import {
  ADDRESS_OPTIONS,
  REGION_OPTIONS,
  VOICE_DEFAULTS,
  coarsePoint,
  weatherRegionReady,
} from '../../src/features/checkin-call/voice-preferences';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { colors } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function VoiceSettingsRoute() {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const id = useAuthStore((state) => state.profile?.id);
  if (!hydrated) return <ActivityIndicator color={colors.primaryDark} />;
  if (!token || !id) return <Redirect href="/login" />;
  return <VoiceSettings key={id} userId={id} />;
}

export function VoiceSettings({ userId }: { userId: string }) {
  useThemeColors();
  const styles = createStyles();
  const { t } = useTranslation('checkinCall');
  const { t: tc } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [value, setValue] = useState<CheckinVoicePreferences | null>(null);
  const [saved, setSaved] = useState<CheckinVoicePreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [consent, setConsent] = useState<
    'use_name' | 'use_health' | 'weather_enabled' | null
  >(null);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const inFlight = useRef(false);
  const current = useCallback(
    () =>
      mounted.current &&
      String(useAuthStore.getState().profile?.id) === userId &&
      Boolean(useAuthStore.getState().token),
    [userId]
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (initialized.current) return;
      void checkinCallApi
        .voicePreferences()
        .then((result) => {
          if (!active || !current()) return;
          const loaded = { ...VOICE_DEFAULTS, ...result.preferences };
          setValue(loaded);
          setSaved(loaded);
          initialized.current = true;
          setError('');
        })
        .catch((reason) => {
          if (active && current()) setError(getApiErrorMessage(reason, tc));
        });
      return () => {
        active = false;
      };
    }, [current, reload, tc])
  );

  const changeConsent = (
    field: 'use_name' | 'use_health' | 'weather_enabled',
    enabled: boolean
  ) => {
    if (!value || inFlight.current) return;
    setError('');
    if (enabled) setConsent(field);
    else
      setValue({
        ...value,
        [field]: false,
        ...(field === 'weather_enabled'
          ? { region: null, location: null }
          : {}),
      });
  };

  const locate = async () => {
    if (!value || !value.weather_enabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (permission.status !== 'granted') {
        setError(t('personalization.locationDenied'));
        return;
      }
      // A single coarse reading, no tracking and no background permission.
      const timeout = new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error('LOCATION_TIMEOUT')),
          8000
        );
        timeoutTimer.current = timer;
      });
      const point = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        timeout,
      ]);
      if (current())
        setValue((previous) =>
          previous
            ? {
                ...previous,
                region: 'device',
                location: coarsePoint(
                  point.coords.latitude,
                  point.coords.longitude
                ),
              }
            : previous
        );
    } catch {
      if (current()) setError(t('personalization.locationFailed'));
    } finally {
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  };
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    },
    []
  );

  const save = async () => {
    if (!value || inFlight.current || !weatherRegionReady(value) || !current())
      return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await checkinCallApi.saveVoicePreferences(value);
      if (!current()) return;
      setSaved(result.preferences);
      setValue(result.preferences);
      router.back();
    } catch (reason) {
      if (current()) setError(getApiErrorMessage(reason, tc));
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  };
  const dirty = value && JSON.stringify(value) !== JSON.stringify(saved);
  const ready = value && weatherRegionReady(value);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc('back')}
          style={styles.back}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.heading}>{t('personalization.title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.copy}>{t('personalization.description')}</Text>
        {!value && !error && <ActivityIndicator color={colors.primaryDark} />}
        {!!value && (
          <>
            <Text style={styles.subheading}>
              {t('personalization.addressTitle')}
            </Text>
            <Text style={styles.copy}>{t('personalization.addressHint')}</Text>
            <View style={styles.options}>
              {ADDRESS_OPTIONS.map((address) => (
                <Pressable
                  key={address}
                  accessibilityRole="radio"
                  accessibilityLabel={t(`personalization.address.${address}`)}
                  accessibilityState={{
                    checked: value.address === address,
                    disabled: busy,
                  }}
                  disabled={busy}
                  style={[
                    styles.option,
                    value.address === address && styles.selected,
                  ]}
                  onPress={() => setValue({ ...value, address })}
                >
                  <Ionicons
                    name={
                      value.address === address
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.optionText}>
                    {t(`personalization.address.${address}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {(['use_name', 'use_health', 'weather_enabled'] as const).map(
              (field) => (
                <View key={field} style={styles.toggleRow}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.subheading}>
                      {t(`personalization.${field}`)}
                    </Text>
                    <Text style={styles.copy}>
                      {t(`personalization.${field}Hint`)}
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel={t(`personalization.${field}`)}
                    accessibilityRole="switch"
                    accessibilityState={{
                      checked: value[field],
                      disabled: busy,
                    }}
                    value={value[field]}
                    disabled={busy}
                    onValueChange={(enabled) => changeConsent(field, enabled)}
                    trackColor={{
                      false: colors.border,
                      true: colors.primaryDark,
                    }}
                  />
                </View>
              )
            )}
            {value.weather_enabled && (
              <>
                <Text style={styles.subheading}>
                  {t('personalization.regionTitle')}
                </Text>
                <Text style={styles.copy}>
                  {t('personalization.regionHint')}
                </Text>
                <View style={styles.options}>
                  {REGION_OPTIONS.map((region) => (
                    <Pressable
                      key={region}
                      accessibilityRole="radio"
                      accessibilityLabel={t(
                        `personalization.regions.${region}`
                      )}
                      accessibilityState={{
                        checked: value.region === region,
                        disabled: busy,
                      }}
                      disabled={busy}
                      style={[
                        styles.option,
                        value.region === region && styles.selected,
                      ]}
                      onPress={() =>
                        setValue({ ...value, region, location: null })
                      }
                    >
                      <Text style={styles.optionText}>
                        {t(`personalization.regions.${region}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('personalization.useLocation')}
                  disabled={busy}
                  accessibilityState={{ busy, disabled: busy }}
                  onPress={locate}
                  style={styles.action}
                >
                  <Ionicons
                    name="location-outline"
                    size={22}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.optionText}>
                    {t('personalization.useLocation')}
                  </Text>
                </Pressable>
                {value.region === 'device' && (
                  <Text style={styles.copy}>
                    {t('personalization.locationSelected')}
                  </Text>
                )}
                {!ready && (
                  <Text style={styles.error}>
                    {t('personalization.chooseRegion')}
                  </Text>
                )}
                <Text style={styles.copy}>
                  {t('personalization.weatherCredit')}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('personalization.weatherSource')}
                  style={styles.action}
                  onPress={() => {
                    void Linking.openURL(
                      'https://api.met.no/doc/License'
                    ).catch(() => setError(t('personalization.linkFailed')));
                  }}
                >
                  <Text style={styles.optionText}>
                    {t('personalization.weatherSource')}
                  </Text>
                </Pressable>
              </>
            )}
            <Text style={styles.copy}>{t('personalization.privacy')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('personalization.save')}
              onPress={save}
              disabled={busy || !dirty || !ready}
              accessibilityState={{ disabled: busy || !dirty || !ready, busy }}
              style={[
                styles.action,
                styles.selected,
                (busy || !dirty || !ready) && styles.disabled,
              ]}
            >
              {busy && <ActivityIndicator color={colors.primaryDark} />}
              <Text style={styles.optionText}>{t('personalization.save')}</Text>
            </Pressable>
          </>
        )}
        {!!error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {!value && !!error && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc('retry')}
            style={styles.action}
            onPress={() => {
              setError('');
              setReload((count) => count + 1);
            }}
          >
            <Text>{tc('retry')}</Text>
          </Pressable>
        )}
      </ScrollView>
      <AppAlertModal
        visible={consent !== null}
        title={t('personalization.consentTitle')}
        stackButtons
        scrollable
        message={t(
          consent === 'weather_enabled'
            ? 'personalization.weatherConsent'
            : 'personalization.voiceConsent'
        )}
        buttons={[
          { text: tc('cancel'), style: 'cancel' },
          {
            text: t('personalization.agree'),
            onPress: () => {
              if (consent && current())
                setValue((previous) =>
                  previous ? { ...previous, [consent]: true } : previous
                );
            },
          },
        ]}
        onDismiss={() => setConsent(null)}
      />
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    back: {
      minHeight: 48,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: {
      flex: 1,
      minWidth: 0,
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    body: { padding: 20, gap: 16 },
    subheading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    copy: { fontSize: 16, color: colors.textSecondary },
    options: { gap: 8 },
    option: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionText: {
      flex: 1,
      minWidth: 0,
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    selected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primaryDark,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    toggleCopy: { flex: 1, minWidth: 0, gap: 8 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      padding: 12,
      borderRadius: 12,
    },
    error: { color: colors.danger, fontSize: 16 },
    disabled: { opacity: 0.55 },
  });
}
