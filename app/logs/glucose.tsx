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
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { VoiceLogButton } from '../../src/components/VoiceLogButton';
import { VoiceParseResult } from '../../src/features/logs/voice.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { logsApi } from '../../src/features/logs/logs.api';
import { logsService } from '../../src/features/logs/logs.service';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { categoryColors, colors, radius, spacing } from '../../src/styles';
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

// ─── Range bar ────────────────────────────────────────────────────

function RangeBar({ value, ctx }: { value: string; ctx: string }) {
  const { t } = useTranslation('logs');
  const [trackWidth, setTrackWidth] = useState(0);
  const numVal = parseFloat(value) || 0;
  const MIN = 40, MAX = 400, RANGE = MAX - MIN;
  const clamped = Math.min(Math.max(numVal, MIN), MAX);
  const pct = (clamped - MIN) / RANGE;
  const pointerLeft = trackWidth * pct;

  // zones differ by context
  const zones = ctx === 'fasting'
    ? [
        { flex: 30,  bg: '#fecaca', label: '' },   // 40-70 low
        { flex: 29,  bg: '#bbf7d0', label: '' },   // 70-99 normal
        { flex: 26,  bg: '#fde68a', label: '' },   // 99-125 pre
        { flex: 275, bg: '#fecaca', label: '' },   // 125-400 high
      ]
    : [
        { flex: 30,  bg: '#fecaca', label: '' },   // 40-70 low
        { flex: 70,  bg: '#bbf7d0', label: '' },   // 70-140 normal
        { flex: 40,  bg: '#fde68a', label: '' },   // 140-180 elevated
        { flex: 220, bg: '#fecaca', label: '' },   // 180-400 high
      ];

  return (
    <View style={rangeStyles.wrap}>
      <View
        style={rangeStyles.track}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {zones.map((z, i) => (
          <View key={i} style={[rangeStyles.zone, { flex: z.flex, backgroundColor: z.bg }]} />
        ))}
        {numVal > 0 && trackWidth > 0 && (
          <View style={[rangeStyles.pointer, { left: pointerLeft - 7 }]}>
            <View style={rangeStyles.pointerInner} />
          </View>
        )}
      </View>
      <View style={rangeStyles.labelRow}>
        <Text style={rangeStyles.labelLow}>{t('glucoseRangeLow')}</Text>
        <Text style={rangeStyles.labelNormal}>{t('glucoseRangeNormal')}</Text>
        <Text style={rangeStyles.labelHigh}>{t('glucoseRangeHigh')}</Text>
      </View>
    </View>
  );
}

const rangeStyles = StyleSheet.create({
  wrap: { gap: 6 },
  track: {
    height: 12,
    borderRadius: radius.full,
    flexDirection: 'row',
    overflow: 'visible',
  },
  zone: { height: 12 },
  pointer: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pointerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelLow:    { fontSize: 11, color: colors.danger,  fontWeight: '600' },
  labelNormal: { fontSize: 11, color: colors.emerald, fontWeight: '600' },
  labelHigh:   { fontSize: 11, color: colors.danger,  fontWeight: '600' },
});

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const createGlucose = useLogsStore((state) => state.createGlucose);
  const profile = useAuthStore((state) => state.profile);

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

  // auto-navigate back after saved
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1600);
    return () => clearTimeout(timer);
  }, [saved]);

  // pre-fill from last log
  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('glucose');
        if (latest?.value) setValue(String(latest.value));
        if (latest?.context) setContext(latest.context);
      } catch { /* ignore */ } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
      if (profile?.id) {
        await logsService.checkHealthOnLog(profile.id.toString(), 'glucose', { value: parsed });
      }
      setSaved(true);
    } catch {
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
        <LoadingOverlay visible={isSaving} message={t('savingLog')} />

        {/* Success overlay */}
        {saved && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.successOverlay}>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successCard}>
              <MaterialCommunityIcons name="check-circle" size={80} color={colors.emerald} />
              <Text style={styles.successTitle}>{t('savedTitle')}</Text>
              <Text style={styles.successSub}>{t('savedMessage')}</Text>
              <View style={styles.successMeta}>
                <Text style={styles.successValue}>{value}</Text>
                <Text style={styles.successUnit}> mg/dL</Text>
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
              <ActivityIndicator size="large" color={categoryColors.glucose} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.sm }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Custom header row */}
              <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
                <View style={styles.navRow}>
                  <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={categoryColors.glucose} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero gradient card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <LinearGradient
                  colors={[categoryColors.glucose, '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroIconBg}>
                    <MaterialCommunityIcons name="water" size={32} color="#fff" />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('glucose')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>mg/dL</Text>
                  </View>
                </LinearGradient>
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
                      style={[styles.bigInput, { fontSize: scaledTypography.size.xl * 2 }]}
                      maxLength={5}
                      textAlign="center"
                      selectTextOnFocus
                    />
                    <Text style={styles.bigUnit}>mg/dL</Text>
                  </Animated.View>

                  {valueError ? (
                    <Text style={styles.errorText}>{valueError}</Text>
                  ) : status ? (
                    <Animated.View
                      entering={ZoomIn.duration(300)}
                      style={[styles.statusBadge, { backgroundColor: status.bgColor }]}
                    >
                      <Ionicons name={status.icon} size={16} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {t(`glucoseStatus_${status.key}` as any) || status.key}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>

              {/* Range bar */}
              {numVal > 0 && (
                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.rangeCard}>
                  <Text style={styles.sectionLabel}>{t('glucoseRange')}</Text>
                  <RangeBar value={value} ctx={context} />
                </Animated.View>
              )}

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
                    label={t('notes')}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder={t('notesPlaceholder')}
                  />
                </View>
              </Animated.View>

              {/* Save button */}
              <Animated.View entering={FadeInDown.delay(380).duration(400).springify()}>
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
                    colors={[categoryColors.glucose, '#2563eb']}
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

// ─── Styles ───────────────────────────────────────────────────────

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
    // Nav row
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
    // Hero card
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: categoryColors.glucose,
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
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    heroBadgeText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: '#fff',
    },
    // Number input card
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
    // Range bar card
    rangeCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    // Section card
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
    // Context chips
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
    },
    chipTextActive: {
      color: '#fff',
    },
    // Save button
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.glucose,
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
    // Success overlay
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
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: spacing.xs,
    },
    successValue: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: categoryColors.glucose,
    },
    successUnit: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
