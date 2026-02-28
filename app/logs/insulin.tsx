import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { Screen } from '../../src/components/Screen';
import { SelectInput } from '../../src/components/SelectInput';
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateInsulinPayload } from '../../src/features/logs/logs.validation';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

export default function InsulinLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const [insulinType, setInsulinType] = useState('');
  const [dose, setDose] = useState('');
  const [timing, setTiming] = useState('pre_meal');
  const [injectionSite, setInjectionSite] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const createInsulin = useLogsStore((state) => state.createInsulin);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const INSULIN_TIMING_OPTIONS = useMemo(() => [
    { label: t('timingPreMeal'), value: 'pre_meal' },
    { label: t('timingPostMeal'), value: 'post_meal' },
    { label: t('timingBedtime'), value: 'bedtime' },
    { label: t('timingCorrection'), value: 'correction' },
  ], [t]);

  const INSULIN_TYPE_OPTIONS = useMemo(() => [
    { label: t('insulinNovoRapid'), value: 'NovoRapid' },
    { label: t('insulinHumalog'), value: 'Humalog' },
    { label: t('insulinApidra'), value: 'Apidra' },
    { label: t('insulinLantus'), value: 'Lantus' },
    { label: t('insulinLevemir'), value: 'Levemir' },
    { label: t('insulinTresiba'), value: 'Tresiba' },
    { label: t('insulinOther'), value: 'other' },
  ], [t]);

  const INJECTION_SITE_OPTIONS = useMemo(() => [
    { label: t('siteAbdomen'), value: 'abdomen' },
    { label: t('siteThigh'), value: 'thigh' },
    { label: t('siteArm'), value: 'arm' },
    { label: t('siteButtock'), value: 'buttock' },
  ], [t]);

  // Fetch latest log to pre-fill form
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const latest = await logsApi.fetchLatestByType('insulin');
        if (latest) {
          if (latest.insulin_type) setInsulinType(latest.insulin_type);
          if (latest.dose_units) setDose(String(latest.dose_units));
          if (latest.timing) setTiming(latest.timing);
        }
      } catch {
        // Ignore error, use default values
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatest();
  }, []);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleSubmit = async () => {
    const result = validateInsulinPayload(insulinType, dose, undefined, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // Add timing to payload
    const payload = {
      ...result.value,
      timing: timing || undefined
    };
    setErrors({});
    setIsSaving(true);
    try {
      await createInsulin(payload);
      setIsSaving(false);
      // Show success message
      Alert.alert(
        t('successTitle'),
        t('logSuccess'),
        [
          {
            text: 'OK'
          }
        ]
      );
    } catch (error) {
      setIsSaving(false);
      Alert.alert(t('saveFailed'), t('pleaseTryAgain'));
    }
  };

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      presentation: 'modal' as const,
      title: t('logMetrics'),
      headerStyle: styles.header,
      headerTitleStyle: styles.headerTitle,
      headerLeft: () => (
        <TouchableOpacity onPress={handleBack} style={styles.headerLeft}>
          <Ionicons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
      ),
    }),
    [handleBack, t]
  );

  const scrollContentStyle = useMemo(
    () => [styles.container, { paddingTop: padTop }],
    [padTop]
  );

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <LoadingOverlay visible={isSaving} message={t('savingLog')} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={scrollContentStyle} keyboardShouldPersistTaps="handled">
              <H1SectionHeader title={t('insulin')} subtitle={t('quickLog')} />
              <SelectInput
                label={t('insulinType')}
                value={insulinType}
                options={INSULIN_TYPE_OPTIONS}
                onSelect={setInsulinType}
                placeholder={t('selectInsulinType')}
              />
              <TextInput label={t('insulinDose')} keyboardType="numeric" value={dose} onChangeText={setDose} error={errors.dose_units} />
              <SelectInput
                label={t('insulinTiming')}
                value={timing}
                options={INSULIN_TIMING_OPTIONS}
                onSelect={setTiming}
                placeholder={t('selectTime')}
              />
              <SelectInput
                label={t('injectionSite')}
                value={injectionSite}
                options={INJECTION_SITE_OPTIONS}
                onSelect={setInjectionSite}
                placeholder={t('selectInjectionSite')}
              />
              <TextInput label={t('notes')} value={notes} onChangeText={setNotes} multiline />
              {errors.dose_units ? <Text style={styles.error}>{errors.dose_units}</Text> : null}
              <Button label={t('save')} onPress={handleSubmit} disabled={isSaving} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    backgroundColor: colors.background
  },
  headerTitle: {
    color: colors.textPrimary
  },
  headerLeft: {
    marginLeft: 0,
    padding: 10
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
