import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { Screen } from '../../src/components/Screen';
import { SelectInput } from '../../src/components/SelectInput';
import { TextInput } from '../../src/components/TextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { logsApi } from '../../src/features/logs/logs.api';
import { logsService } from '../../src/features/logs/logs.service';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

export default function GlucoseLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [context, setContext] = useState('pre_meal');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const createGlucose = useLogsStore((state) => state.createGlucose);
  const profile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const GLUCOSE_CONTEXT_OPTIONS = useMemo(() => [
    { label: t('ctxFasting'), value: 'fasting' },
    { label: t('ctxPreMeal'), value: 'pre_meal' },
    { label: t('ctxPostMeal'), value: 'post_meal' },
    { label: t('ctxBeforeSleep'), value: 'before_sleep' },
    { label: t('ctxRandom'), value: 'random' },
  ], [t]);

  // Fetch latest log to pre-fill form
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const latest = await logsApi.fetchLatestByType('glucose');
        if (latest && latest.value) {
          setValue(String(latest.value));
          if (latest.context) {
            setContext(latest.context);
          }
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
    // Validate
    if (!value || isNaN(parseFloat(value))) {
      setErrors({ value: t('enterValidValue') });
      return;
    }
    setErrors({});
    
    // Create payload matching GlucoseLogPayload type
    const payload = {
      value: parseFloat(value),
      context: context as 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random',
      notes: notes || undefined
    };
    setIsSaving(true);
    try {
      await createGlucose(payload);
      
      // Real-time health monitoring ngay sau khi save
      if (profile?.id) {
        await logsService.checkHealthOnLog(
          profile.id.toString(),
          'glucose',
          { value: payload.value }
        );
      }
      
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

  const keyboardAvoidingStyle = useMemo(() => ({ flex: 1 }), []);
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
          style={keyboardAvoidingStyle}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={scrollContentStyle}
              keyboardShouldPersistTaps="handled"
            >
              <H1SectionHeader title={t('glucose')} subtitle={t('quickLog')} />
              <TextInput label={t('glucoseValue')} keyboardType="numeric" value={value} onChangeText={setValue} error={errors.value} />
              <SelectInput
                label={t('glucoseContextLabel')}
                value={context}
                options={GLUCOSE_CONTEXT_OPTIONS}
                onSelect={setContext}
                placeholder={t('selectTime')}
              />
              <TextInput label={t('notes')} value={notes} onChangeText={setNotes} multiline />
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
  }
});
