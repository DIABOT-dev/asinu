import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { showToast } from '../../src/stores/toast.store';
import { categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'nutrition-outline',
  midnight: 'bed-outline',
};

export default function MealLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [mealType, setMealType] = useState('breakfast');
  const [kcal, setKcal] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const createMeal = useLogsStore((state) => state.createMeal);

  const MEAL_TYPE_OPTIONS = useMemo(() => [
    { label: t('mealBreakfast'), value: 'breakfast' },
    { label: t('mealLunch'), value: 'lunch' },
    { label: t('mealDinner'), value: 'dinner' },
    { label: t('mealSnack'), value: 'snack' },
    { label: t('mealMidnight'), value: 'midnight' },
  ], [t]);

  const getMealLabel = useCallback((value: string) => {
    return MEAL_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
  }, [MEAL_TYPE_OPTIONS]);

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('meal');
        if (latest?.title) {
          const found = MEAL_TYPE_OPTIONS.find(o => o.label === latest.title);
          if (found) setMealType(found.value);
        }
        if (latest?.kcal) setKcal(String(latest.kcal));
      } catch { /* ignore */ } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await createMeal({
        title: getMealLabel(mealType),
        kcal: kcal ? parseFloat(kcal) : undefined,
        carbs_g: carbsG ? parseFloat(carbsG) : undefined,
        protein_g: proteinG ? parseFloat(proteinG) : undefined,
        fat_g: fatG ? parseFloat(fatG) : undefined,
        notes: notes || undefined,
      });
      showToast(t('savedTitle'), 'success');
      router.back();
    } catch {
      showToast(t('saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const screenOptions = useMemo(() => ({ headerShown: false }), []);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={categoryColors.meal} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.sm }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back button */}
              <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
                <View style={styles.navRow}>
                  <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={iconColors.meal} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <View style={[styles.heroCard, { backgroundColor: '#fef6e8' }]}>
                  <Ionicons name="restaurant" size={30} color={iconColors.meal} />
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('meal')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>kcal</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Meal type chips */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('mealType')}</Text>
                  <View style={styles.chipsGrid}>
                    {MEAL_TYPE_OPTIONS.map((opt) => {
                      const active = mealType === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setMealType(opt.value)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Ionicons
                            name={MEAL_ICONS[opt.value]}
                            size={16}
                            color={active ? '#fff' : colors.textSecondary}
                          />
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* Nutrition inputs */}
              <Animated.View entering={FadeInDown.delay(220).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('nutrition')}</Text>
                  <TextInput
                    label={t('kcal')}
                    keyboardType="numeric"
                    value={kcal}
                    onChangeText={setKcal}
                    placeholder={t('optional')}
                    leftIcon={<Ionicons name="flame-outline" size={18} color={colors.textSecondary} />}
                  />
                  <View style={styles.macroRow}>
                    <View style={styles.macroInput}>
                      <TextInput
                        label={t('carbs')}
                        keyboardType="numeric"
                        value={carbsG}
                        onChangeText={setCarbsG}
                        placeholder="g"
                      />
                    </View>
                    <View style={styles.macroInput}>
                      <TextInput
                        label={t('protein')}
                        keyboardType="numeric"
                        value={proteinG}
                        onChangeText={setProteinG}
                        placeholder="g"
                      />
                    </View>
                    <View style={styles.macroInput}>
                      <TextInput
                        label={t('fat')}
                        keyboardType="numeric"
                        value={fatG}
                        onChangeText={setFatG}
                        placeholder="g"
                      />
                    </View>
                  </View>
                </View>
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <TextInput
                    label={t('notes')}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder={t('notesPlaceholder')}
                  />
                </View>
              </Animated.View>

              {/* Save button */}
              <Animated.View entering={FadeInDown.delay(360).duration(400).springify()}>
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    pressed && styles.saveBtnPressed,
                    isSaving && styles.saveBtnDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={[categoryColors.meal, '#d97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtnGradient}
                  >
                    <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>{t('save')}</Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              <View style={{ height: insets.bottom + spacing.xl }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    heroText: { flex: 1 },
    heroTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    heroSub: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    heroBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    heroBadgeText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    chipsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: {
      backgroundColor: categoryColors.meal,
      borderColor: categoryColors.meal,
    },
    chipPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    chipText: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: '#fff',
    },
    macroRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    macroInput: {
      flex: 1,
    },
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.meal,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
    saveBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    saveBtnText: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: '#fff',
    },
    saveBtnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    saveBtnDisabled: { opacity: 0.6 },
  });
}
