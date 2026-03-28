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
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateWeightPayload } from '../../src/features/logs/logs.validation';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { showToast } from '../../src/stores/toast.store';
import { categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

function getBMIStatus(bmi: number, t: (key: string) => string) {
  if (bmi < 18.5) return { label: t('bmiUnderweight'), color: colors.warning, bg: colors.premiumLight };
  if (bmi < 25) return { label: t('bmiNormal'), color: colors.emerald, bg: colors.emeraldLight };
  if (bmi < 30) return { label: t('bmiOverweight'), color: '#f97316', bg: '#fff7ed' };
  return { label: t('bmiObese'), color: colors.danger, bg: '#fef2f2' };
}

export default function WeightLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [weight, setWeight] = useState('');
  const [bodyfat, setBodyfat] = useState('');
  const [musclePct, setMusclePct] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');
  const [weightError, setWeightError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const createWeight = useLogsStore((state) => state.createWeight);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const bmi = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(heightCm);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
    return parseFloat((w / ((h / 100) * (h / 100))).toFixed(1));
  }, [weight, heightCm]);

  const bmiStatus = bmi ? getBMIStatus(bmi, t) : null;

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('weight');
        if (latest?.weight_kg) setWeight(String(latest.weight_kg));
        if (latest?.bodyfat_pct) setBodyfat(String(latest.bodyfat_pct));
      } catch { /* ignore */ } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleBack = useCallback(() => router.back(), [router]);

  function triggerShake() {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }),
    );
  }

  const handleSubmit = async () => {
    const result = validateWeightPayload(weight, bodyfat, notes);
    if (!result.ok) {
      setWeightError(result.errors.weight || t('errWeightInvalid'));
      triggerShake();
      return;
    }
    setWeightError('');
    setIsSaving(true);
    try {
      await createWeight(result.value);
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
              <ActivityIndicator size="large" color={categoryColors.weight} />
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
                    <Ionicons name="arrow-back" size={22} color={iconColors.weight} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <View style={[styles.heroCard, { backgroundColor: '#ede8fd' }]}>
                  <MaterialCommunityIcons name="scale-bathroom" size={30} color={iconColors.weight} />
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('weight')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>kg</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Weight input card */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={[styles.numberCard, weightError ? styles.numberCardError : null]}>
                  <Text style={styles.numberLabel}>{t('weightKg')}</Text>
                  <Animated.View style={[styles.bigInputRow, shakeStyle]}>
                    <RNTextInput
                      value={weight}
                      onChangeText={(v) => { setWeight(v); setWeightError(''); }}
                      keyboardType="numeric"
                      placeholder="---"
                      placeholderTextColor={colors.border}
                      style={[styles.bigInput, { fontSize: scaledTypography.size.xl * 2, color: categoryColors.weight }]}
                      maxLength={5}
                      textAlign="center"
                      selectTextOnFocus
                    />
                    <Text style={styles.bigUnit}>kg</Text>
                  </Animated.View>
                  {weightError ? (
                    <Text style={styles.errorText}>{weightError}</Text>
                  ) : bmi && bmiStatus ? (
                    <Animated.View
                      entering={ZoomIn.duration(300)}
                      style={[styles.statusBadge, { backgroundColor: bmiStatus.bg }]}
                    >
                      <Ionicons name="body-outline" size={16} color={bmiStatus.color} />
                      <Text style={[styles.statusText, { color: bmiStatus.color }]}>
                        BMI {bmi} · {bmiStatus.label}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>

              {/* Height + body comp */}
              <Animated.View entering={FadeInDown.delay(220).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('bodyComposition')}</Text>
                  <TextInput
                    label={t('heightCm')}
                    keyboardType="numeric"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder={t('heightHint')}
                    leftIcon={<MaterialCommunityIcons name="human-male-height" size={18} color={colors.textSecondary} />}
                  />
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label={t('bodyFatPct')}
                        keyboardType="numeric"
                        value={bodyfat}
                        onChangeText={setBodyfat}
                        placeholder={t('optional')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        label={t('musclePct')}
                        keyboardType="numeric"
                        value={musclePct}
                        onChangeText={setMusclePct}
                        placeholder={t('optional')}
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
                    colors={[categoryColors.weight, '#7c3aed']}
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
    numberCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    numberCardError: {
      borderColor: colors.danger + '80',
    },
    numberLabel: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      fontWeight: '600',
      alignSelf: 'flex-start',
    },
    bigInputRow: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    bigInput: {
      fontWeight: '800',
      minWidth: 160,
      textAlign: 'center',
      padding: 0,
    },
    bigUnit: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    errorText: {
      fontSize: typography.size.sm,
      color: colors.danger,
      fontWeight: '600',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      marginTop: spacing.xs,
    },
    statusText: {
      fontSize: typography.size.sm,
      fontWeight: '700',
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
    rowInputs: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.weight,
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
