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
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateMedicationPayload } from '../../src/features/logs/logs.validation';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { categoryColors, colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function MedicationLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [frequencyText, setFrequencyText] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const FREQ_OPTIONS = useMemo(() => [
    t('freqOnceDay'),
    t('freqTwiceDay'),
    t('freqThreeDay'),
    t('freqAfterMeal'),
    t('freqBeforeSleep'),
  ], [t]);

  const createMedication = useLogsStore((state) => state.createMedication);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('medication');
        if (latest?.medication) setMedication(latest.medication);
        if (latest?.dose) setDose(latest.dose);
      } catch { /* ignore */ } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1600);
    return () => clearTimeout(timer);
  }, [saved]);

  const handleBack = useCallback(() => router.back(), [router]);

  function triggerShake() {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }),
    );
  }

  const handleSubmit = async () => {
    const result = validateMedicationPayload(medication, dose, notes);
    if (!result.ok) {
      setErrors(result.errors);
      triggerShake();
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      await createMedication(result.value);
      setSaved(true);
    } catch {
      setIsSaving(false);
    }
  };

  const screenOptions = useMemo(() => ({ headerShown: false }), []);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <LoadingOverlay visible={isSaving} message={t('savingLog')} />

        {saved && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.successOverlay}>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successCard}>
              <MaterialCommunityIcons name="check-circle" size={80} color={colors.emerald} />
              <Text style={styles.successTitle}>{t('savedTitle')}</Text>
              <Text style={styles.successSub}>{t('savedMessage')}</Text>
              <View style={styles.successMeta}>
                <Text style={styles.successValue}>{medication}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={categoryColors.medication} />
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
                    <Ionicons name="arrow-back" size={22} color={categoryColors.medication} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <LinearGradient
                  colors={[categoryColors.medication, '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroIconBg}>
                    <MaterialCommunityIcons name="pill" size={30} color="#fff" />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('medication')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#fff" />
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Medication info */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <Animated.View style={[styles.sectionCard, shakeStyle]}>
                  <Text style={styles.sectionLabel}>{t('medicationInfo')}</Text>
                  <TextInput
                    label={t('medicationName')}
                    value={medication}
                    onChangeText={(v) => { setMedication(v); setErrors({}); }}
                    error={errors.medication}
                    placeholder={t('medNamePlaceholder')}
                    leftIcon={<MaterialCommunityIcons name="pill" size={18} color={colors.textSecondary} />}
                  />
                  <TextInput
                    label={t('medicationDose')}
                    value={dose}
                    onChangeText={(v) => { setDose(v); setErrors({}); }}
                    error={errors.dose}
                    placeholder={t('dosePlaceholder')}
                    leftIcon={<Ionicons name="flask-outline" size={18} color={colors.textSecondary} />}
                  />
                </Animated.View>
              </Animated.View>

              {/* Frequency chips */}
              <Animated.View entering={FadeInDown.delay(220).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('frequency')}</Text>
                  <View style={styles.chipsGrid}>
                    {FREQ_OPTIONS.map((freq) => {
                      const active = frequencyText === freq;
                      return (
                        <Pressable
                          key={freq}
                          onPress={() => setFrequencyText(active ? '' : freq)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {freq}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    label={t('frequency')}
                    value={frequencyText}
                    onChangeText={setFrequencyText}
                    placeholder={t('freqPlaceholder')}
                  />
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
                    colors={[categoryColors.medication, '#059669']}
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
      shadowColor: categoryColors.medication,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    heroIconBg: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroText: { flex: 1 },
    heroTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: '#fff',
    },
    heroSub: {
      fontSize: typography.size.sm,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    heroBadge: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
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
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: {
      backgroundColor: categoryColors.medication,
      borderColor: categoryColors.medication,
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
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.medication,
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
    successOverlay: {
      position: 'absolute',
      inset: 0,
      zIndex: 999,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    successCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xxl,
      padding: spacing.xxxl,
      alignItems: 'center',
      gap: spacing.md,
      width: 280,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    successTitle: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    successSub: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    successMeta: {
      marginTop: spacing.xs,
    },
    successValue: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: categoryColors.medication,
      textAlign: 'center',
    },
  });
}
