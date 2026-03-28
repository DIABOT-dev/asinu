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
import { validateInsulinPayload } from '../../src/features/logs/logs.validation';
import { VoiceLogButton } from '../../src/components/VoiceLogButton';
import { VoiceParseResult } from '../../src/features/logs/voice.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { showToast } from '../../src/stores/toast.store';
import { categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function InsulinLogScreen() {
  const { t } = useTranslation('logs');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [insulinType, setInsulinType] = useState('');
  const [dose, setDose] = useState('');
  const [timing, setTiming] = useState('');
  const [injectionSite, setInjectionSite] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const createInsulin = useLogsStore((state) => state.createInsulin);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const INSULIN_TYPE_OPTIONS = useMemo(() => [
    { label: t('insulinNovoRapid'), value: 'NovoRapid' },
    { label: t('insulinHumalog'), value: 'Humalog' },
    { label: t('insulinApidra'), value: 'Apidra' },
    { label: t('insulinLantus'), value: 'Lantus' },
    { label: t('insulinLevemir'), value: 'Levemir' },
    { label: t('insulinTresiba'), value: 'Tresiba' },
    { label: t('insulinOther'), value: 'other' },
  ], [t]);

  const TIMING_OPTIONS = useMemo(() => [
    { label: t('timingPreMeal'), value: 'pre_meal' },
    { label: t('timingPostMeal'), value: 'post_meal' },
    { label: t('timingBedtime'), value: 'bedtime' },
    { label: t('timingCorrection'), value: 'correction' },
  ], [t]);

  const SITE_OPTIONS = useMemo(() => [
    { label: t('siteAbdomen'), value: 'abdomen' },
    { label: t('siteThigh'), value: 'thigh' },
    { label: t('siteArm'), value: 'arm' },
    { label: t('siteButtock'), value: 'buttock' },
  ], [t]);

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('insulin');
        if (latest) {
          if (latest.insulin_type) setInsulinType(latest.insulin_type);
          if (latest.dose_units) setDose(String(latest.dose_units));
          if (latest.timing) setTiming(latest.timing);
        }
      } catch {} finally { setIsLoading(false); }
    })();
  }, []);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleVoiceParsed = useCallback((result: VoiceParseResult) => {
    if (!result.ok || !result.parsed || result.parsed.log_type !== 'insulin') return;
    const parsed = result.parsed;
    if (parsed.dose_units) setDose(String(parsed.dose_units));
    if (parsed.insulin_type) setInsulinType(parsed.insulin_type);
    if (parsed.timing) setTiming(parsed.timing);
    if (parsed.injection_site) setInjectionSite(parsed.injection_site);
    if (parsed.notes) setNotes(parsed.notes);
  }, []);

  function triggerShake() {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 }),
    );
  }

  const handleSubmit = async () => {
    const result = validateInsulinPayload(insulinType, dose, undefined, notes);
    if (!result.ok) {
      setErrors(result.errors);
      triggerShake();
      return;
    }
    const payload = { ...result.value, timing: timing || undefined };
    setErrors({});
    setIsSaving(true);
    try {
      await createInsulin(payload);
      showToast(t('savedTitle'), 'success');
      router.back();
    } catch {
      showToast(t('saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={categoryColors.insulin} />
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
                    <Ionicons name="arrow-back" size={22} color={iconColors.insulin} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <View style={[styles.heroCard, { backgroundColor: '#eceefe' }]}>
                  <MaterialCommunityIcons name="needle" size={30} color={iconColors.insulin} />
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('insulin')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>IU</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Insulin type chips */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('insulinType')}</Text>
                  <View style={styles.chipsGrid}>
                    {INSULIN_TYPE_OPTIONS.map((opt) => {
                      const active = insulinType === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setInsulinType(active ? '' : opt.value)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* Dose input */}
              <Animated.View entering={FadeInDown.delay(220).duration(450).springify()}>
                <Animated.View style={[styles.sectionCard, shakeStyle]}>
                  <Text style={styles.sectionLabel}>{t('insulinDose')}</Text>
                  <TextInput
                    label={t('insulinDose')}
                    keyboardType="numeric"
                    value={dose}
                    onChangeText={(v) => { setDose(v); setErrors({}); }}
                    error={errors.dose_units}
                    placeholder="0"
                    leftIcon={<MaterialCommunityIcons name="needle" size={18} color={colors.textSecondary} />}
                  />
                </Animated.View>
              </Animated.View>

              {/* Timing chips */}
              <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('insulinTiming')}</Text>
                  <View style={styles.chipsGrid}>
                    {TIMING_OPTIONS.map((opt) => {
                      const active = timing === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setTiming(active ? '' : opt.value)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* Injection site chips */}
              <Animated.View entering={FadeInDown.delay(380).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('injectionSite')}</Text>
                  <View style={styles.chipsGrid}>
                    {SITE_OPTIONS.map((opt) => {
                      const active = injectionSite === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setInjectionSite(active ? '' : opt.value)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* Voice input */}
              <Animated.View entering={FadeInDown.delay(460).duration(400).springify()}>
                <VoiceLogButton
                  logType="insulin"
                  onParsed={handleVoiceParsed}
                  onError={(msg) => setErrors({ dose_units: msg })}
                />
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(540).duration(400).springify()}>
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
              <Animated.View entering={FadeInDown.delay(620).duration(400).springify()}>
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
                    colors={[categoryColors.insulin, '#4f46e5']}
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    heroBadgeText: {
      fontSize: typography.size.sm,
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
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: {
      backgroundColor: categoryColors.insulin,
      borderColor: categoryColors.insulin,
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
      shadowColor: categoryColors.insulin,
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
