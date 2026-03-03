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
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateWeightPayload } from '../../src/features/logs/logs.validation';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

export default function WeightLogScreen() {
  const { t } = useTranslation('logs');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const [weight, setWeight] = useState('');
  const [bodyfat, setBodyfat] = useState('');
  const [musclePct, setMusclePct] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const createWeight = useLogsStore((state) => state.createWeight);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  // Fetch latest log to pre-fill form
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const latest = await logsApi.fetchLatestByType('weight');
        if (latest && latest.weight_kg) {
          setWeight(String(latest.weight_kg));
          if (latest.bodyfat_pct) setBodyfat(String(latest.bodyfat_pct));
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

  const bmi = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(heightCm);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
    const hMeter = h / 100;
    return (w / (hMeter * hMeter)).toFixed(1);
  }, [heightCm, weight]);

  const handleSubmit = async () => {
    const result = validateWeightPayload(weight, bodyfat, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      await createWeight(result.value);
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
              <H1SectionHeader title={t('weight')} subtitle={t('quickLog')} />
              <TextInput label={t('weightKg')} keyboardType="numeric" value={weight} onChangeText={setWeight} error={errors.weight} />
              <TextInput
                label={t('bodyFatPct')}
                keyboardType="numeric"
                value={bodyfat}
                onChangeText={setBodyfat}
                placeholder={t('optional')}
                error={errors.bodyfat}
              />
              <TextInput
                label={t('musclePct')}
                keyboardType="numeric"
                value={musclePct}
                onChangeText={setMusclePct}
                placeholder={t('optional')}
              />
              <TextInput
                label={t('heightCm')}
                keyboardType="numeric"
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder={t('heightHint')}
              />
              {bmi ? <Text style={styles.helper}>{t('bmiEstimate', { value: bmi })}</Text> : null}
              <TextInput label={t('notes')} value={notes} onChangeText={setNotes} multiline />
              {errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}
              {errors.bodyfat ? <Text style={styles.error}>{errors.bodyfat}</Text> : null}
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
  helper: {
    color: colors.textSecondary
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
