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
import { categoryColors, colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

// ─── BP status helpers ─────────────────────────────────────────────

type BPStatus = {
  key: string;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function getBPStatus(sys: number, dia: number): BPStatus {
  if (sys < 90 || dia < 60)
    return { key: 'low', color: colors.warning, bgColor: colors.premiumLight, icon: 'arrow-down-circle' };
  if (sys < 120 && dia < 80)
    return { key: 'normal', color: colors.emerald, bgColor: colors.emeraldLight, icon: 'checkmark-circle' };
  if (sys < 130 && dia < 80)
    return { key: 'elevated', color: colors.warning, bgColor: colors.premiumLight, icon: 'alert' };
  if (sys < 140 || dia < 90)
    return { key: 'stage1', color: '#f97316', bgColor: '#fff7ed', icon: 'alert-circle' };
  return { key: 'stage2', color: colors.danger, bgColor: '#fef2f2', icon: 'alert-circle' };
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
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [context, setContext] = useState('morning');
  const [notes, setNotes] = useState('');
  const [bpError, setBpError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const createBloodPressure = useLogsStore((state) => state.createBloodPressure);
  const profile = useAuthStore((state) => state.profile);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const sysNum = parseFloat(systolic) || 0;
  const diaNum = parseFloat(diastolic) || 0;
  const status = sysNum > 0 && diaNum > 0 ? getBPStatus(sysNum, diaNum) : null;

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('bp');
        if (latest?.systolic) setSystolic(String(latest.systolic));
        if (latest?.diastolic) setDiastolic(String(latest.diastolic));
        if (latest?.context) setContext(latest.context);
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
    const sys = parseFloat(systolic);
    const dia = parseFloat(diastolic);
    if (!systolic || !diastolic || isNaN(sys) || isNaN(dia) || sys <= 0 || dia <= 0) {
      setBpError(t('enterValidBP'));
      triggerShake();
      return;
    }
    setBpError('');
    setIsSaving(true);
    try {
      const payload = {
        systolic: sys,
        diastolic: dia,
        pulse: pulse ? parseInt(pulse, 10) : undefined,
        context,
        notes: notes || undefined,
      };
      await createBloodPressure(payload);
      if (profile?.id) {
        await logsService.checkHealthOnLog(profile.id.toString(), 'blood-pressure', { systolic: sys, diastolic: dia });
      }
      setSaved(true);
    } catch {
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
        <LoadingOverlay visible={isSaving} message={t('savingLog')} />

        {saved && (
          <Animated.View entering={FadeIn.duration(250)} style={styles.successOverlay}>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successCard}>
              <MaterialCommunityIcons name="check-circle" size={80} color={colors.emerald} />
              <Text style={styles.successTitle}>{t('savedTitle')}</Text>
              <Text style={styles.successSub}>{t('savedMessage')}</Text>
              <View style={styles.successMeta}>
                <Text style={styles.successValue}>{systolic}/{diastolic}</Text>
                <Text style={styles.successUnit}> mmHg</Text>
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
                <View style={styles.navRow}>
                  <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={iconColors.bp} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero gradient card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <View style={[styles.heroCard, { backgroundColor: '#fde8e8' }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={32} color={iconColors.bp} />
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('bloodPressure')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>mmHg</Text>
                  </View>
                </View>
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
                        style={[styles.bigInput, { fontSize: scaledTypography.size.xl * 1.8, color: categoryColors.bloodPressure }]}
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
                        style={[styles.bigInput, { fontSize: scaledTypography.size.xl * 1.8, color: categoryColors.bloodPressure }]}
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
                </View>
              </Animated.View>

              {/* Pulse input */}
              <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <TextInput
                    label={t('pulse')}
                    keyboardType="numeric"
                    value={pulse}
                    onChangeText={setPulse}
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
                    colors={[categoryColors.bloodPressure, '#dc2626']}
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
    },
    chipTextActive: {
      color: '#fff',
    },
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.bloodPressure,
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
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: spacing.xs,
    },
    successValue: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: categoryColors.bloodPressure,
    },
    successUnit: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
