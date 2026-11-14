import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as RNTextInput } from '../../src/components/ScaledTextInput';
import { LogEntryHeader } from '../../src/components/LogEntryHeader';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { VoiceLogButton } from '../../src/components/VoiceLogButton';
import { VoiceParseResult } from '../../src/features/logs/voice.api';
import { ReadingLevelIndicator } from '../../src/features/logs/ReadingLevelIndicator';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { showToast } from '../../src/stores/toast.store';
import { categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

// ─── Glucose status helpers ────────────────────────────────────────

type GlucoseStatus = {
  key: string;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function getGlucoseStatus(val: number, ctx: string): GlucoseStatus {
  if (val < 70)
    return { key: 'hypo', color: colors.danger, bgColor: '#fef2f2', icon: 'arrow-down-circle' };
  if (ctx === 'fasting') {
    if (val <= 99)  return { key: 'normal',      color: colors.emerald,  bgColor: colors.emeraldLight, icon: 'checkmark-circle' };
    if (val <= 125) return { key: 'prediabetes', color: colors.warning,  bgColor: colors.premiumLight, icon: 'alert' };
    return               { key: 'high',          color: colors.danger,   bgColor: '#fef2f2',           icon: 'alert-circle' };
  }
  if (ctx === 'post_meal') {
    if (val < 140)  return { key: 'normal',   color: colors.emerald, bgColor: colors.emeraldLight, icon: 'checkmark-circle' };
    if (val < 200)  return { key: 'elevated', color: colors.warning, bgColor: colors.premiumLight, icon: 'alert' };
    return               { key: 'high',       color: colors.danger,  bgColor: '#fef2f2',           icon: 'alert-circle' };
  }
  if (val <= 140) return { key: 'normal',   color: colors.emerald, bgColor: colors.emeraldLight, icon: 'checkmark-circle' };
  if (val <= 180) return { key: 'elevated', color: colors.warning, bgColor: colors.premiumLight, icon: 'alert' };
  return               { key: 'high',      color: colors.danger,  bgColor: '#fef2f2',           icon: 'alert-circle' };
}

const glucoseLevels = (context: string) => [
  { key: 'hypo', color: '#B64867' },
  { key: 'normal', color: '#169B78' },
  { key: context === 'fasting' ? 'prediabetes' : 'elevated', color: '#DCAB32' },
  { key: 'high', color: '#DB5555' },
];

// ─── Context chip icons ───────────────────────────────────────────

const CTX_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  fasting:      'moon-outline',
  pre_meal:     'restaurant-outline',
  post_meal:    'checkmark-done-outline',
  before_sleep: 'bed-outline',
  random:       'time-outline',
};

// ─── Main component ───────────────────────────────────────────────

export default function GlucoseLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [value, setValue] = useState('');
  const [context, setContext] = useState('pre_meal');
  const [notes, setNotes] = useState('');
  const [valueError, setValueError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const createGlucose = useLogsStore((state) => state.createGlucose);
  const profileId = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);

  // animations
  const shakeX = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const numVal = parseFloat(value) || 0;
  const status = numVal > 0 ? getGlucoseStatus(numVal, context) : null;

  // pulse when in warning/danger zone
  useEffect(() => {
    if (numVal > 180 || (numVal > 0 && numVal < 70)) {
      pulseScale.value = withRepeat(
        withSequence(withTiming(1.025, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1, true
      );
    } else {
      pulseScale.value = withSpring(1);
    }
  }, [numVal]);

  useFocusEffect(useCallback(() => {
    setValue('');
    setContext('pre_meal');
    setNotes('');
    setValueError('');
  }, [profileId, token]));

  const handleBack = useCallback(() => router.back(), [router]);

  const handleVoiceParsed = useCallback((result: VoiceParseResult) => {
    if (!result.ok || !result.parsed || result.parsed.log_type !== 'glucose') return;
    const parsed = result.parsed;
    setValue(String(parsed.value));
    setContext(parsed.context);
    if (parsed.notes) setNotes(parsed.notes);
  }, []);

  function triggerShake() {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
      withTiming(-8,  { duration: 50 }), withTiming(8,  { duration: 50 }),
      withTiming(-4,  { duration: 50 }), withTiming(0,  { duration: 50 }),
    );
  }

  const handleSubmit = async () => {
    const parsed = parseFloat(value);
    if (!value || isNaN(parsed) || parsed <= 0) {
      setValueError(t('enterValidValue'));
      triggerShake();
      return;
    }
    setValueError('');
    setIsSaving(true);
    try {
      await createGlucose({
        value: parsed,
        context: context as 'fasting' | 'pre_meal' | 'post_meal' | 'before_sleep' | 'random',
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

  const CONTEXT_OPTIONS = useMemo(() => [
    { label: t('ctxFasting'),     value: 'fasting' },
    { label: t('ctxPreMeal'),     value: 'pre_meal' },
    { label: t('ctxPostMeal'),    value: 'post_meal' },
    { label: t('ctxBeforeSleep'), value: 'before_sleep' },
    { label: t('ctxRandom'),      value: 'random' },
  ], [t]);

  const screenOptions = useMemo(() => ({
    headerShown: false,
  }), []);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
            <ScrollView
              contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.sm }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Custom header row */}
              <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
                <LogEntryHeader
                  title={t('glucose')}
                  onBack={handleBack}
                  onSave={handleSubmit}
                  saving={isSaving}
                />
              </Animated.View>

              {/* Big number input card */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={[
                  styles.numberCard,
                  valueError ? styles.numberCardError : null,
                  status ? { borderColor: status.color + '40' } : null,
                ]}>
                  <Text style={styles.numberLabel}>{t('glucoseValue')}</Text>
                  <Animated.View style={[styles.bigInputRow, shakeStyle, pulseStyle]}>
                    <RNTextInput
                      value={value}
                      onChangeText={(v) => { setValue(v); setValueError(''); }}
                      keyboardType="numeric"
                      placeholder="---"
                      placeholderTextColor={colors.border}
                      style={[styles.bigInput, { fontSize: 30 * 2 }]}
                      maxLength={5}
                      textAlign="center"
                      selectTextOnFocus
                    />
                    <Text style={styles.bigUnit}>mg/dL</Text>
                  </Animated.View>

                  {valueError ? (
                    <Text style={styles.errorText}>{valueError}</Text>
                  ) : null}
                  {status && !valueError ? (
                    <ReadingLevelIndicator
                      levels={glucoseLevels(context)}
                      activeKey={status.key}
                      label={t(`glucoseStatus_${status.key}` as any)}
                    />
                  ) : null}
                </View>
              </Animated.View>

              {/* Context chips */}
              <Animated.View entering={FadeInDown.delay(260).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('glucoseContextLabel')}</Text>
                  <View style={styles.chipsGrid}>
                    {CONTEXT_OPTIONS.map((opt) => {
                      const active = context === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setContext(opt.value)}
                          style={({ pressed }) => [
                            styles.chip,
                            active && styles.chipActive,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Ionicons
                            name={CTX_ICONS[opt.value]}
                            size={18}
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

              {/* Voice input */}
              <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
                <VoiceLogButton
                  logType="glucose"
                  onParsed={handleVoiceParsed}
                  onError={(msg) => setValueError(msg)}
                />
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(360).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <TextInput
                    style={styles.plainInput}
                    label={t('notes')}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder={t('notesPlaceholder')}
                  />
                </View>
              </Animated.View>

              <View style={{ height: insets.bottom + spacing.xl }} />
            </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    // Nav row
    // Hero card
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
    // Number input card
    numberCard: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderColor: colors.border,
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
      color: colors.textPrimary,
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
    // Section card
    sectionCard: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    plainInput: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      paddingHorizontal: 0,
      minHeight: 48,
    },
    sectionLabel: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    // Context chips
    chipsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      width: '48%',
      minHeight: 52,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: {
      backgroundColor: categoryColors.glucose,
      borderColor: categoryColors.glucose,
    },
    chipPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    chipText: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textSecondary,
      flexShrink: 1,
      textAlign: 'center',
    },
    chipTextActive: {
      color: '#fff',
    },
  });
}
