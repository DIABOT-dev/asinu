import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { ScaledTextInput as RNTextInput } from '../../src/components/ScaledTextInput';
import { LogEntryHeader } from '../../src/components/LogEntryHeader';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { VoiceLogButton } from '../../src/components/VoiceLogButton';
import { VoiceParseResult } from '../../src/features/logs/voice.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { authApi } from '../../src/features/auth/auth.api';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { showToast } from '../../src/stores/toast.store';
import { categoryColors, colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { assessBloodPressure, validateBloodPressure, type BPProfile } from '../../src/lib/blood-pressure';

// ─── BP status helpers ─────────────────────────────────────────────

type BPStatus = {
  key: string;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function getBPStatus(key: NonNullable<ReturnType<typeof assessBloodPressure>['displayCategory']>): BPStatus {
  if (key === 'low') return { key, color: colors.warning, bgColor: colors.premiumLight, icon: 'arrow-down-circle' };
  if (key === 'normal') return { key, color: colors.emerald, bgColor: colors.emeraldLight, icon: 'checkmark-circle' };
  if (key === 'elevated') return { key, color: colors.warning, bgColor: colors.premiumLight, icon: 'alert' };
  if (key === 'stage1') return { key, color: '#f97316', bgColor: '#fff7ed', icon: 'alert-circle' };
  return { key, color: colors.danger, bgColor: '#fef2f2', icon: 'alert-circle' };
}

const CTX_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  morning: 'sunny-outline',
  evening: 'moon-outline',
  after_exercise: 'fitness-outline',
  after_rest: 'bed-outline',
  other: 'time-outline',
};

export default function BloodPressureLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { colors: themeColors } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, themeColors), [scaledTypography, themeColors]);

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [context, setContext] = useState('morning');
  const [notes, setNotes] = useState('');
  const [bpError, setBpError] = useState('');
  const [pulseError, setPulseError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlight = useRef(false);

  const createBloodPressure = useLogsStore((state) => state.createBloodPressure);
  const profile = useAuthStore((state) => state.profile);
  const profileId = profile?.id;
  const token = useAuthStore((state) => state.token);
  const [assessmentProfile, setAssessmentProfile] = useState<BPProfile | null>(profile);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const assessment = assessBloodPressure(systolic, diastolic, assessmentProfile);
  const status = assessment.displayCategory ? getBPStatus(assessment.displayCategory) : null;

  useEffect(() => {
    let active = true;
    const owner = profileId;
    const ownerProfile = useAuthStore.getState().profile;
    const current = () => active && useAuthStore.getState().profile?.id === owner && useAuthStore.getState().token === token;
    setAssessmentProfile(ownerProfile);
    setSystolic(''); setDiastolic(''); setPulse(''); setNotes(''); setBpError(''); setPulseError('');
    setContext('morning');
    setIsLoading(true);
    (async () => {
      try {
        if (!owner) return;
        const [latestResult, profileResult] = await Promise.allSettled([
          logsApi.fetchLatestByType('bp'),
          ownerProfile?.dateOfBirth || typeof ownerProfile?.age === 'number' ? Promise.resolve(ownerProfile) : authApi.fetchProfile(),
        ]);
        if (!current()) return;
        if (latestResult.status === 'fulfilled') {
          const latest = latestResult.value;
          if (latest?.systolic) setSystolic(String(latest.systolic));
          if (latest?.diastolic) setDiastolic(String(latest.diastolic));
          if (latest?.context) setContext(latest.context);
        }
        if (profileResult.status === 'fulfilled') setAssessmentProfile(profileResult.value);
      } catch { /* ignore */ } finally {
        if (current()) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profileId, token]);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleVoiceParsed = useCallback((result: VoiceParseResult) => {
    if (!result.ok || !result.parsed || result.parsed.log_type !== 'blood_pressure') return;
    const parsed = result.parsed;
    setSystolic(String(parsed.systolic));
    setDiastolic(String(parsed.diastolic));
    if (parsed.pulse) setPulse(String(parsed.pulse));
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
    if (saveInFlight.current) return;
    const validated = validateBloodPressure(systolic, diastolic, pulse);
    if (!validated.ok) {
      if (validated.error === 'pulse') setPulseError(t('bpPulseInvalid'));
      else setBpError(t(validated.error === 'order' ? 'errBpOrder' : validated.error === 'range' ? 'errBpRange' : 'errBpNumbers'));
      triggerShake();
      return;
    }
    setBpError('');
    setPulseError('');
    saveInFlight.current = true;
    setIsSaving(true);
    const sameSession = () => useAuthStore.getState().profile?.id === profileId && useAuthStore.getState().token === token;
    try {
      const payload = {
        systolic: validated.systolic,
        diastolic: validated.diastolic,
        pulse: validated.pulse,
        context,
        notes: notes || undefined,
      };
      await createBloodPressure(payload);
      if (!sameSession()) return;
      showToast(t('savedTitle'), 'success');
      router.back();
    } catch {
      if (sameSession()) showToast(t('saveFailed'), 'error');
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const CONTEXT_OPTIONS = useMemo(() => [
    { label: t('bpMorning'), value: 'morning' },
    { label: t('bpEvening'), value: 'evening' },
    { label: t('bpAfterExercise'), value: 'after_exercise' },
    { label: t('bpAfterRest'), value: 'after_rest' },
    { label: t('bpOther'), value: 'other' },
  ], [t]);

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
              <ActivityIndicator size="large" color={categoryColors.bloodPressure} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.sm }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back button */}
              <Animated.View entering={FadeInDown.delay(0).duration(400).springify()}>
                <LogEntryHeader
                  title={t('bloodPressure')}
                  onBack={handleBack}
                  onSave={handleSubmit}
                  saving={isSaving}
                />
              </Animated.View>

              {/* SYS / DIA input card */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={[
                  styles.numberCard,
                  bpError ? styles.numberCardError : null,
                  status ? { borderColor: status.color + '40' } : null,
                ]}>
                  <Text style={styles.numberLabel}>{t('bloodPressureValue')}</Text>

                  <Animated.View style={[styles.bpRow, shakeStyle]}>
                    {/* Systolic */}
                    <View style={styles.bpInputWrap}>
                      <RNTextInput
                        value={systolic}
                        onChangeText={(v) => { setSystolic(v); setBpError(''); }}
                        keyboardType="numeric"
                        placeholder="---"
                        placeholderTextColor={colors.border}
                        style={[styles.bigInput, { fontSize: 30 * 1.8, color: categoryColors.bloodPressure }]}
                        maxLength={3}
                        textAlign="center"
                        selectTextOnFocus
                      />
                      <Text style={styles.bpInputLabel}>{t('systolic')}</Text>
                    </View>

                    <Text style={styles.bpSeparator}>/</Text>

                    {/* Diastolic */}
                    <View style={styles.bpInputWrap}>
                      <RNTextInput
                        value={diastolic}
                        onChangeText={(v) => { setDiastolic(v); setBpError(''); }}
                        keyboardType="numeric"
                        placeholder="---"
                        placeholderTextColor={colors.border}
                        style={[styles.bigInput, { fontSize: 30 * 1.8, color: categoryColors.bloodPressure }]}
                        maxLength={3}
                        textAlign="center"
                        selectTextOnFocus
                      />
                      <Text style={styles.bpInputLabel}>{t('diastolic')}</Text>
                    </View>
                  </Animated.View>

                  {bpError ? (
                    <Text style={styles.errorText}>{bpError}</Text>
                  ) : status ? (
                    <Animated.View
                      entering={ZoomIn.duration(300)}
                      style={[styles.statusBadge, { backgroundColor: status.bgColor }]}
                    >
                      <Ionicons name={status.icon} size={16} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {t(`bpStatus_${status.key}` as any) || status.key}
                      </Text>
                    </Animated.View>
                  ) : null}
                  {assessment.valid && <Text style={[styles.bpReference, { color: colors.textSecondary }]}>
                    {t(assessment.scope === 'under18' ? 'bpUnder18Reference' : assessment.scope === 'unknown_age' ? 'bpMissingAgeReference' : 'bpReadingReference')}
                  </Text>}
                  {assessment.low && !assessment.repeatHigh && <Text style={[styles.bpReference, { color: colors.warning }]}>{t('bpLowReadingNote')}</Text>}
                  {assessment.repeatHigh && <View style={styles.bpHighGuidance}>
                    <Text style={[styles.bpHighTitle, { color: colors.danger }]}>{t('bpHighReadingTitle')}</Text>
                    <Text style={[styles.bpReference, { color: colors.textPrimary }]}>{t('bpHighReadingGuide')}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('bpCallEmergency')} onPress={() => { void Linking.openURL('tel:115').catch(() => showToast(t('bpCallFailed'), 'error')); }} style={styles.bpEmergencyButton}>
                      <Ionicons name="call-outline" size={20} color={colors.danger} />
                      <Text style={[styles.bpHighTitle, { color: colors.danger }]}>{t('bpCallEmergency')}</Text>
                    </Pressable>
                  </View>}
                </View>
              </Animated.View>

              {/* Pulse input */}
              <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <TextInput
                    style={styles.plainInput}
                    label={t('pulse')}
                    keyboardType="numeric"
                    value={pulse}
                    onChangeText={(value) => { setPulse(value); setPulseError(''); }}
                    error={pulseError}
                    placeholder={t('optional')}
                    leftIcon={<Ionicons name="pulse-outline" size={18} color={colors.textSecondary} />}
                  />
                </View>
              </Animated.View>

              {/* Context chips */}
              <Animated.View entering={FadeInDown.delay(260).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('bpContextLabel')}</Text>
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

              {/* Voice input */}
              <Animated.View entering={FadeInDown.delay(300).duration(400).springify()}>
                <VoiceLogButton
                  logType="blood_pressure"
                  onParsed={handleVoiceParsed}
                  onError={(msg) => setBpError(msg)}
                />
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(340).duration(400).springify()}>
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
          )}
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, colors: ReturnType<typeof useThemeColors>['colors']) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    bpReference: { fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
    bpHighGuidance: { gap: spacing.xs, marginTop: spacing.md },
    bpHighTitle: { fontSize: 15, fontWeight: '700' },
    bpEmergencyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, alignSelf: 'flex-start' },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    bpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    bpInputWrap: {
      alignItems: 'center',
      gap: 4,
    },
    bigInput: {
      color: colors.textPrimary,
      fontWeight: '800',
      minWidth: 100,
      textAlign: 'center',
      padding: 0,
    },
    bpInputLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    bpSeparator: {
      fontSize: 48,
      fontWeight: '300',
      color: colors.border,
      marginBottom: 20,
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
      backgroundColor: categoryColors.bloodPressure,
      borderColor: categoryColors.bloodPressure,
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
