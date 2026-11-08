import { runNativePermission } from '../../src/lib/native-permissions';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { AppAlertModal } from '../../src/components/AppAlertModal';
import { QuickActionTile } from '../../src/components/QuickActionTile';
import { useFontSizeStore } from '../../src/stores/font-size.store';
import { showToast } from '../../src/stores/toast.store';
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

type PersonalizationSection = 'permissions' | 'address' | 'weather';
type ConsentChoice = {
  field: 'use_name' | 'use_health' | 'weather_enabled';
  region?: CheckinVoicePreferences['region'];
  deviceLocation?: boolean;
};
const PERSONALIZATION_ACTIONS = [
  { id: 'permissions', icon: 'shield-checkmark-outline' },
  { id: 'address', icon: 'person-outline' },
  { id: 'weather', icon: 'partly-sunny-outline' },
] as const;

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
  const { width, fontScale } = useWindowDimensions();
  const multiplier = useFontSizeStore((state) => state.multiplier);
  const actionColumns = width < 360 || fontScale * multiplier >= 1.2 ? 2 : 3;
  const actionWidth = (width - 40 - 12 * (actionColumns - 1)) / actionColumns;
  const [section, setSection] = useState<PersonalizationSection | null>(null);
  const [value, setValue] = useState<CheckinVoicePreferences | null>(null);
  const [failedChoice, setFailedChoice] =
    useState<CheckinVoicePreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [consent, setConsent] = useState<ConsentChoice | null>(null);
  const weatherConsentGranted = useRef(false);
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
          weatherConsentGranted.current = loaded.weather_enabled;
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

  const writePreferences = async (next: CheckinVoicePreferences) => {
    const result = await checkinCallApi.saveVoicePreferences(next);
    if (!current()) return;
    setValue(result.preferences);
    weatherConsentGranted.current = result.preferences.weather_enabled;
    setFailedChoice(null);
    showToast(t('personalization.saved'), 'success');
  };
  const writeFailed = (next: CheckinVoicePreferences, reason: unknown) => {
    if (!current()) return;
    const message = getApiErrorMessage(reason, tc);
    setFailedChoice(next);
    setError(message);
    showToast(message, 'error');
  };
  const persistSelection = async (next: CheckinVoicePreferences) => {
    if (!value || inFlight.current || !current()) return;
    if (!weatherRegionReady(next)) {
      setSection('weather');
      return;
    }
    setError('');
    setFailedChoice(null);
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await writePreferences(next);
    } catch (reason) {
      writeFailed(next, reason);
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  };
  const changeConsent = (
    field: 'use_name' | 'use_health' | 'weather_enabled',
    enabled: boolean
  ) => {
    if (!value || inFlight.current || !current()) return;
    setError('');
    if (enabled) {
      if (
        field === 'weather_enabled' &&
        !weatherRegionReady({ ...value, weather_enabled: true })
      ) {
        setSection('weather');
        return;
      }
      setConsent({ field });
      return;
    }
    return persistSelection({
      ...value,
      [field]: false,
      ...(field === 'weather_enabled' ? { region: null, location: null } : {}),
    });
  };
  const selectRegion = (region: (typeof REGION_OPTIONS)[number]) => {
    if (!value || inFlight.current || !current()) return;
    if (!value.weather_enabled && !weatherConsentGranted.current) {
      setConsent({ field: 'weather_enabled', region });
      return;
    }
    return persistSelection({
      ...value,
      weather_enabled: true,
      region,
      location: null,
    });
  };

  const locate = async () => {
    if (!value || inFlight.current || !current()) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setFailedChoice(null);
    let selection: CheckinVoicePreferences | null = null;
    try {
      const permission = await runNativePermission(
        () => Location.requestForegroundPermissionsAsync(),
        { key: 'location', canRun: current }
      );
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
      if (!current()) return;
      selection = {
        ...value,
        weather_enabled: true,
        region: 'device',
        location: coarsePoint(point.coords.latitude, point.coords.longitude),
      };
      await writePreferences(selection);
    } catch (reason) {
      if (selection) writeFailed(selection, reason);
      else if (current()) setError(t('personalization.locationFailed'));
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

  const useDeviceRegion = () => {
    if (!value || inFlight.current || !current()) return;
    if (!value.weather_enabled && !weatherConsentGranted.current) {
      setConsent({ field: 'weather_enabled', deviceLocation: true });
      return;
    }
    return locate();
  };
  const ready = value && weatherRegionReady(value);
  const permissionSwitch = (
    field: 'use_name' | 'use_health' | 'weather_enabled'
  ) =>
    value && (
      <View key={field} style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.subheading}>{t(`personalization.${field}`)}</Text>
        </View>
        <Switch
          accessibilityLabel={t(`personalization.${field}`)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value[field], disabled: busy }}
          value={value[field]}
          disabled={busy}
          onValueChange={(enabled) => changeConsent(field, enabled)}
          trackColor={{ false: colors.border, true: colors.primaryDark }}
        />
      </View>
    );

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
        <Text style={styles.heading}>{t('personalization.screenTitle')}</Text>
        {busy && (
          <ActivityIndicator
            color={colors.primaryDark}
            accessibilityLabel={tc('saving')}
          />
        )}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {!value && !error && <ActivityIndicator color={colors.primaryDark} />}
        {!!value && (
          <>
            <View style={styles.actions}>
              {PERSONALIZATION_ACTIONS.map((action) => (
                <QuickActionTile
                  key={action.id}
                  testID={`voice-action-${action.id}`}
                  label={t(`personalization.sections.${action.id}`)}
                  expanded={section === action.id}
                  style={{ width: actionWidth }}
                  icon={
                    <Ionicons
                      name={action.icon}
                      size={32}
                      color={colors.primaryText}
                      accessible={false}
                    />
                  }
                  onPress={() =>
                    setSection((current) =>
                      current === action.id ? null : action.id
                    )
                  }
                />
              ))}
            </View>
            {section === 'address' && (
              <View style={styles.panel}>
                <Text style={styles.subheading}>
                  {t('personalization.addressTitle')}
                </Text>
                <View style={styles.options}>
                  {ADDRESS_OPTIONS.map((address) => (
                    <Pressable
                      key={address}
                      accessibilityRole="radio"
                      accessibilityLabel={t(
                        `personalization.address.${address}`
                      )}
                      accessibilityState={{
                        checked: value.address === address,
                        disabled: busy,
                      }}
                      disabled={busy}
                      style={[
                        styles.option,
                        value.address === address && styles.selected,
                      ]}
                      onPress={() => persistSelection({ ...value, address })}
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
              </View>
            )}
            {section === 'permissions' && (
              <View style={styles.panel}>
                <Text accessibilityRole="header" style={styles.subheading}>
                  {t('personalization.sections.permissions')}
                </Text>
                {(['use_name', 'use_health', 'weather_enabled'] as const).map(
                  permissionSwitch
                )}
                <Text style={styles.copy}>{t('personalization.privacy')}</Text>
              </View>
            )}
            {section === 'weather' && (
              <View style={styles.panel}>
                <Text accessibilityRole="header" style={styles.subheading}>
                  {t('personalization.sections.weather')}
                </Text>
                {permissionSwitch('weather_enabled')}
                <>
                  {!value.weather_enabled && (
                    <Text style={styles.copy}>
                      {t('personalization.chooseRegion')}
                    </Text>
                  )}
                  <Text style={styles.subheading}>
                    {t('personalization.regionTitle')}
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
                        onPress={() => selectRegion(region)}
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
                    onPress={useDeviceRegion}
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
              </View>
            )}
            {!ready && value.weather_enabled && section !== 'weather' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('personalization.chooseRegion')}
                style={styles.action}
                onPress={() => setSection('weather')}
              >
                <Ionicons
                  name="location-outline"
                  size={22}
                  color={colors.primaryDark}
                />
                <Text style={styles.error}>
                  {t('personalization.chooseRegion')}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.primaryDark}
                />
              </Pressable>
            )}
          </>
        )}
        {!!error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {!!value && failedChoice && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc('retry')}
            disabled={busy}
            accessibilityState={{ disabled: busy, busy }}
            style={styles.action}
            onPress={() => persistSelection(failedChoice)}
          >
            <Ionicons
              name="refresh-outline"
              size={22}
              color={colors.primaryDark}
            />
            <Text style={styles.optionText}>{tc('retry')}</Text>
          </Pressable>
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
        queued
        visible={consent !== null}
        title={t('personalization.consentTitle')}
        stackButtons
        scrollable
        message={t(
          consent?.field === 'weather_enabled'
            ? 'personalization.weatherConsent'
            : 'personalization.voiceConsent'
        )}
        buttons={[
          { text: tc('cancel'), style: 'cancel' },
          {
            text: t('personalization.agree'),
            onPress: async () => {
              if (!consent || !value || inFlight.current || !current()) return;
              if (consent.field === 'weather_enabled') {
                weatherConsentGranted.current = true;
                if (consent.deviceLocation) {
                  await locate();
                  return;
                }
              }
              await persistSelection({
                ...value,
                [consent.field]: true,
                ...(consent.region
                  ? { region: consent.region, location: null }
                  : {}),
              });
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
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 12,
      rowGap: 20,
      paddingVertical: 8,
    },
    panel: { gap: 12, paddingTop: 8, paddingBottom: 4 },
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
  });
}
