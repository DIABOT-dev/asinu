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
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { logsApi } from '../../src/features/logs/logs.api';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { validateWaterPayload } from '../../src/features/logs/logs.validation';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { categoryColors, colors, radius, spacing } from '../../src/styles';

const QUICK_AMOUNTS = [150, 200, 250, 300, 350, 500];

export default function WaterLogScreen() {
  const { t } = useTranslation('logs');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [volume, setVolume] = useState('');
  const [notes, setNotes] = useState('');
  const [volumeError, setVolumeError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const createWater = useLogsStore((state) => state.createWater);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const numVal = parseFloat(volume) || 0;

  useEffect(() => {
    (async () => {
      try {
        const latest = await logsApi.fetchLatestByType('water');
        if (latest?.volume_ml) setVolume(String(latest.volume_ml));
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
    const result = validateWaterPayload(volume);
    if (!result.ok) {
      setVolumeError(result.errors.volume || 'Nhập lượng nước hợp lệ');
      triggerShake();
      return;
    }
    setVolumeError('');
    setIsSaving(true);
    try {
      await createWater(result.value);
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
                <Text style={styles.successValue}>{volume}</Text>
                <Text style={styles.successUnit}> ml</Text>
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
              <ActivityIndicator size="large" color={categoryColors.water} />
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
                    <Ionicons name="arrow-back" size={22} color={categoryColors.water} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Hero card */}
              <Animated.View entering={FadeInDown.delay(60).duration(450).springify()}>
                <LinearGradient
                  colors={[categoryColors.water, '#0891b2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroIconBg}>
                    <Ionicons name="water" size={30} color="#fff" />
                  </View>
                  <View style={styles.heroText}>
                    <Text style={styles.heroTitle}>{t('water')}</Text>
                    <Text style={styles.heroSub}>{t('quickLog')}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>ml</Text>
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Volume input card */}
              <Animated.View entering={FadeInDown.delay(140).duration(450).springify()}>
                <View style={[styles.numberCard, volumeError ? styles.numberCardError : null]}>
                  <Text style={styles.numberLabel}>{t('volumeMl') || 'Lượng nước uống'}</Text>
                  <Animated.View style={[styles.bigInputRow, shakeStyle]}>
                    <RNTextInput
                      value={volume}
                      onChangeText={(v) => { setVolume(v); setVolumeError(''); }}
                      keyboardType="numeric"
                      placeholder="---"
                      placeholderTextColor={colors.border}
                      style={[styles.bigInput, { fontSize: scaledTypography.size.xl * 2, color: categoryColors.water }]}
                      maxLength={4}
                      textAlign="center"
                      selectTextOnFocus
                    />
                    <Text style={styles.bigUnit}>ml</Text>
                  </Animated.View>
                  {volumeError ? (
                    <Text style={styles.errorText}>{volumeError}</Text>
                  ) : numVal > 0 ? (
                    <Animated.View entering={ZoomIn.duration(300)} style={styles.waterBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={categoryColors.water} />
                      <Text style={[styles.statusText, { color: categoryColors.water }]}>
                        {numVal >= 2000 ? 'Tuyệt vời! Đủ nước' : numVal >= 1000 ? 'Khá tốt' : 'Tiếp tục uống nước'}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>

              {/* Quick-add buttons */}
              <Animated.View entering={FadeInDown.delay(200).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionLabel}>{t('quickAdd')}</Text>
                  <View style={styles.quickGrid}>
                    {QUICK_AMOUNTS.map((amt) => (
                      <Pressable
                        key={amt}
                        onPress={() => {
                          const prev = parseFloat(volume) || 0;
                          setVolume(String(prev + amt));
                          setVolumeError('');
                        }}
                        style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
                      >
                        <Ionicons name="add" size={14} color={categoryColors.water} />
                        <Text style={styles.quickBtnText}>{amt}ml</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(280).duration(400).springify()}>
                <View style={styles.sectionCard}>
                  <TextInput
                    label={t('notes')}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder={t('notesPlaceholder') || 'Ghi chú thêm...'}
                  />
                </View>
              </Animated.View>

              {/* Save button */}
              <Animated.View entering={FadeInDown.delay(340).duration(400).springify()}>
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
                    colors={[categoryColors.water, '#0891b2']}
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
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: categoryColors.water,
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
    numberCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 2,
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
    waterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      backgroundColor: categoryColors.waterBg,
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
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: categoryColors.water + '60',
      backgroundColor: categoryColors.waterBg,
    },
    quickBtnPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.96 }],
    },
    quickBtnText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: categoryColors.water,
    },
    saveBtn: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      shadowColor: categoryColors.water,
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
      color: categoryColors.water,
    },
    successUnit: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });
}
