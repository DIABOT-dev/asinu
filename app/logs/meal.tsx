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
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

export default function MealLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const [mealType, setMealType] = useState('breakfast');
  const [kcal, setKcal] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [notes, setNotes] = useState('');
  const [photoKey, setPhotoKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const createMeal = useLogsStore((state) => state.createMeal);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const MEAL_TYPE_OPTIONS = useMemo(() => [
    { label: t('mealBreakfast'), value: 'breakfast' },
    { label: t('mealLunch'), value: 'lunch' },
    { label: t('mealDinner'), value: 'dinner' },
    { label: t('mealSnack'), value: 'snack' },
    { label: t('mealMidnight'), value: 'midnight' },
  ], [t]);

  // Fetch latest log to pre-fill form
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const latest = await logsApi.fetchLatestByType('meal');
        if (latest) {
          if (latest.title) setMealType(latest.title);
          if (latest.kcal) setKcal(String(latest.kcal));
          if (latest.carbs_g) setCarbsG(String(latest.carbs_g));
          if (latest.protein_g) setProteinG(String(latest.protein_g));
          if (latest.fat_g) setFatG(String(latest.fat_g));
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

  // Get display label for meal type
  const getMealLabel = useCallback((value: string) => {
    const option = MEAL_TYPE_OPTIONS.find(opt => opt.value === value);
    return option?.label || value;
  }, [MEAL_TYPE_OPTIONS]);

  const handleSubmit = async () => {
    // Validate
    if (!mealType) {
      setErrors({ title: t('selectMealError') });
      return;
    }
    setErrors({});

    // Create payload matching MealLogPayload type
    const payload = {
      title: getMealLabel(mealType),
      kcal: kcal ? parseFloat(kcal) : undefined,
      carbs_g: carbsG ? parseFloat(carbsG) : undefined,
      protein_g: proteinG ? parseFloat(proteinG) : undefined,
      fat_g: fatG ? parseFloat(fatG) : undefined,
      photo_key: photoKey || undefined,
      notes: notes || undefined
    };
    setIsSaving(true);
    try {
      await createMeal(payload);
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
              <H1SectionHeader title={t('meal')} subtitle={t('quickLog')} />
              <SelectInput
                label={t('mealType')}
                value={mealType}
                options={MEAL_TYPE_OPTIONS}
                onSelect={setMealType}
                placeholder={t('selectMealType')}
              />
              <TextInput label={t('kcal')} keyboardType="numeric" value={kcal} onChangeText={setKcal} placeholder={t('optional')} error={errors.kcal} />
              <TextInput label={t('carbs')} keyboardType="numeric" value={carbsG} onChangeText={setCarbsG} placeholder={t('optional')} />
              <TextInput label={t('protein')} keyboardType="numeric" value={proteinG} onChangeText={setProteinG} placeholder={t('optional')} />
              <TextInput label={t('fat')} keyboardType="numeric" value={fatG} onChangeText={setFatG} placeholder={t('optional')} />
              <TextInput label={t('notes')} value={notes} onChangeText={setNotes} multiline />
              {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}
              {errors.kcal ? <Text style={styles.error}>{errors.kcal}</Text> : null}
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
