import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { SelectInput } from '../../src/components/SelectInput';
import { TextInput } from '../../src/components/TextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { logsApi } from '../../src/features/logs/logs.api';
import { logsService } from '../../src/features/logs/logs.service';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateBloodPressurePayload } from '../../src/features/logs/logs.validation';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

export default function BloodPressureLogScreen() {
  const { t } = useTranslation('logs');
  const { t: tc } = useTranslation('common');
  const router = useRouter();

  const BP_CONTEXT_OPTIONS = [
    { label: t('bpMorning'), value: 'morning' },
    { label: t('bpEvening'), value: 'evening' },
    { label: t('bpAfterExercise'), value: 'after_exercise' },
    { label: t('bpAfterRest'), value: 'after_rest' },
    { label: t('bpOther'), value: 'other' },
  ];
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [context, setContext] = useState('morning');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const createBloodPressure = useLogsStore((state) => state.createBloodPressure);
  const profile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  // Fetch latest log to pre-fill form
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const latest = await logsApi.fetchLatestByType('bp');
        if (latest) {
          if (latest.systolic) setSystolic(String(latest.systolic));
          if (latest.diastolic) setDiastolic(String(latest.diastolic));
          if (latest.context) setContext(latest.context);
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
    const result = validateBloodPressurePayload(systolic, diastolic, [context], notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // Add pulse and context to payload
    const payload = {
      ...result.value,
      pulse: pulse ? parseInt(pulse, 10) : undefined,
      context: context
    };
    setErrors({});
    setIsSaving(true);
    try {
      await createBloodPressure(payload);
      
      // Real-time health monitoring ngay sau khi save
      if (profile?.id) {
        await logsService.checkHealthOnLog(
          profile.id.toString(),
          'blood-pressure',
          { 
            systolic: result.value.systolic,
            diastolic: result.value.diastolic
          }
        );
      }
      
      setIsSaving(false);
      // Show success message
      Alert.alert(
        t('successTitle'),
        t('logSuccess'),
        [
          {
            text: tc('ok')
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
    [handleBack]
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
              <H1SectionHeader title={t('bloodPressure')} subtitle={t('quickLog')} />
              <TextInput label={t('systolic')} keyboardType="numeric" value={systolic} onChangeText={setSystolic} error={errors.bp} />
              <TextInput label={t('diastolic')} keyboardType="numeric" value={diastolic} onChangeText={setDiastolic} error={errors.bp} />
              <TextInput label={t('pulse')} keyboardType="numeric" value={pulse} onChangeText={setPulse} placeholder={t('optional')} />
              <SelectInput
                label={t('bpContextLabel')}
                value={context}
                options={BP_CONTEXT_OPTIONS}
                onSelect={setContext}
                placeholder={t('selectTime')}
              />
              <TextInput label={t('notes')} value={notes} onChangeText={setNotes} multiline />
              {errors.bp ? <Text style={styles.error}>{errors.bp}</Text> : null}
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
