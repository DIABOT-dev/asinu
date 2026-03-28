/**
 * Reminder Config Screen — HH:MM time picker for morning/afternoon/evening
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { showToast } from '../../src/stores/toast.store';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../src/features/notifications/notifications.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const SLOT_META: Array<{
  slot: TimeSlot;
  labelKey: string;
  descKey: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  iconBg: string;
  gradient: [string, string];
  defaultTime: string;
  hourRange: [number, number];
}> = [
  {
    slot: 'morning',
    labelKey: 'scheduleMorning',
    descKey: 'scheduleMorningDesc',
    icon: 'weather-sunset-up',
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
    gradient: ['#fef3c7', '#fffbeb'],
    defaultTime: '08:00',
    hourRange: [5, 11],
  },
  {
    slot: 'afternoon',
    labelKey: 'scheduleAfternoon',
    descKey: 'scheduleAfternoonDesc',
    icon: 'weather-sunny',
    iconColor: '#f97316',
    iconBg: '#fff7ed',
    gradient: ['#ffedd5', '#fff7ed'],
    defaultTime: '14:00',
    hourRange: [11, 17],
  },
  {
    slot: 'evening',
    labelKey: 'scheduleEvening',
    descKey: 'scheduleEveningDesc',
    icon: 'weather-night',
    iconColor: '#6366f1',
    iconBg: '#eef2ff',
    gradient: ['#e0e7ff', '#eef2ff'],
    defaultTime: '21:00',
    hourRange: [17, 23],
  },
];

// ─── Time Picker Modal ────────────────────────────────────────────────────────

function TimePickerModal({
  visible,
  initialTime,
  hourRange,
  onConfirm,
  onCancel,
  onResetToAuto,
}: {
  visible: boolean;
  initialTime: string;
  hourRange: [number, number];
  onConfirm: (time: string) => void;
  onCancel: () => void;
  onResetToAuto: () => void;
}) {
  const { t } = useTranslation('settings');
  const scaledTypography = useScaledTypography();

  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (visible && initialTime) {
      const [h, m] = initialTime.split(':').map(Number);
      setHour(h);
      setMinute(m);
    }
  }, [visible, initialTime]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let i = hourRange[0]; i <= hourRange[1]; i++) arr.push(i);
    return arr;
  }, [hourRange]);

  const [minuteText, setMinuteText] = useState(String(minute).padStart(2, '0'));

  useEffect(() => {
    setMinuteText(String(minute).padStart(2, '0'));
  }, [minute]);

  const handleMinuteChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 2);
    setMinuteText(cleaned);
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      setMinute(num);
    }
  };

  const handleMinuteBlur = () => {
    const num = parseInt(minuteText, 10);
    if (isNaN(num) || num < 0 || num > 59) {
      setMinute(0);
      setMinuteText('00');
    } else {
      setMinute(num);
      setMinuteText(String(num).padStart(2, '0'));
    }
  };

  const handleConfirm = () => {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onConfirm(time);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={pickerStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={pickerStyles.card}>
          <View style={pickerStyles.handle} />

          <Text style={[pickerStyles.title, { fontSize: scaledTypography.size.lg }]}>
            {t('scheduleSetTime')}
          </Text>

          {/* Time display */}
          <View style={pickerStyles.timeDisplay}>
            <Text style={pickerStyles.timeText}>
              {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
            </Text>
          </View>

          {/* Hour picker */}
          <View style={pickerStyles.pickerSection}>
            <Text style={[pickerStyles.pickerLabel, { fontSize: scaledTypography.size.xs }]}>
              {t('schedulePickHour')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pickerStyles.pickerRow}
            >
              {hours.map(h => (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={[pickerStyles.pickerItem, hour === h && pickerStyles.pickerItemActive]}
                >
                  <Text style={[pickerStyles.pickerItemText, hour === h && pickerStyles.pickerItemTextActive]}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Minute picker */}
          <View style={pickerStyles.pickerSection}>
            <Text style={[pickerStyles.pickerLabel, { fontSize: scaledTypography.size.xs }]}>
              {t('schedulePickMinute')} (0–59)
            </Text>
            <RNTextInput
              style={pickerStyles.minuteInput}
              value={minuteText}
              onChangeText={handleMinuteChange}
              onBlur={handleMinuteBlur}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor={colors.border}
              selectTextOnFocus
            />
          </View>

          {/* Actions */}
          <View style={pickerStyles.actions}>
            <Pressable style={pickerStyles.cancelBtn} onPress={onResetToAuto}>
              <Text style={pickerStyles.cancelText}>{t('scheduleAuto')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [pickerStyles.confirmBtn, pressed && { opacity: 0.9 }]}
              onPress={handleConfirm}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={pickerStyles.confirmGradient}
              >
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                <Text style={pickerStyles.confirmText}>{t('scheduleConfirm')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  title: {
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  timeDisplay: {
    alignSelf: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  timeText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 4,
  },
  pickerSection: {
    gap: spacing.sm,
  },
  pickerLabel: {
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pickerRow: {
    gap: spacing.sm,
  },
  pickerItem: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickerItemTextActive: {
    color: '#fff',
  },
  minuteInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    width: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReminderConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('settings');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Time picker state
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const pickerMeta = pickerSlot ? SLOT_META.find(s => s.slot === pickerSlot) : null;

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getTimeForSlot = (slot: TimeSlot): string | null => {
    if (!prefs) return null;
    return (prefs as any)[`${slot}_time`] ?? null;
  };

  const getEffectiveTime = (slot: TimeSlot): string => {
    if (!prefs) return SLOT_META.find(s => s.slot === slot)!.defaultTime;
    return (prefs as any)[`effective_${slot}_time`] ?? SLOT_META.find(s => s.slot === slot)!.defaultTime;
  };

  const isAutoTime = (slot: TimeSlot): boolean => {
    return getTimeForSlot(slot) === null;
  };

  const handleTimeConfirm = useCallback(async (time: string) => {
    if (!prefs || !pickerSlot) return;
    const field = `${pickerSlot}_time`;
    const updated = { ...prefs, [field]: time, [`effective_${pickerSlot}_time`]: time };
    setPrefs(updated);
    setPickerSlot(null);
    setSaving(true);
    try {
      const result = await updateNotificationPreferences({ [field]: time });
      if (result.ok) {
        setPrefs(result);
        showToast(t('scheduleSaved'), 'success');
      } else {
        showToast(t('scheduleSaveError'), 'error');
      }
    } catch {
      showToast(t('scheduleSaveError'), 'error');
    }
    setSaving(false);
  }, [prefs, pickerSlot]);

  const handleResetToAuto = useCallback(async (slot: TimeSlot) => {
    if (!prefs) return;
    const field = `${slot}_time`;
    const updated = { ...prefs, [field]: null };
    setPrefs(updated as any);
    setSaving(true);
    try {
      const result = await updateNotificationPreferences({ [field]: null } as any);
      if (result.ok) {
        setPrefs(result);
        showToast(t('scheduleSaved'), 'success');
      } else {
        showToast(t('scheduleSaveError'), 'error');
      }
    } catch {
      showToast(t('scheduleSaveError'), 'error');
    }
    setSaving(false);
  }, [prefs]);

  const handlePickerCancel = useCallback(() => {
    setPickerSlot(null);
  }, []);

  const handlePickerResetToAuto = useCallback(() => {
    if (pickerSlot) handleResetToAuto(pickerSlot);
    setPickerSlot(null);
  }, [pickerSlot, handleResetToAuto]);

  const handleToggleReminders = useCallback(async (enabled: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, reminders_enabled: enabled });
    setSaving(true);
    try {
      const result = await updateNotificationPreferences({ reminders_enabled: enabled });
      setPrefs(result);
    } catch {
      showToast(t('scheduleSaveError'), 'error');
    }
    setSaving(false);
  }, [prefs]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('scheduleTitle'),
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      {/* Time Picker */}
      <TimePickerModal
        visible={!!pickerSlot}
        initialTime={pickerSlot ? getEffectiveTime(pickerSlot) : '08:00'}
        hourRange={pickerMeta?.hourRange ?? [0, 23]}
        onConfirm={handleTimeConfirm}
        onCancel={handlePickerCancel}
        onResetToAuto={handlePickerResetToAuto}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={styles.heroCard}>
              <MaterialCommunityIcons name="bell-ring-outline" size={28} color="#f59e0b" />
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroTitle}>{t('scheduleTitle')}</Text>
                <Text style={styles.heroSubtitle}>{t('scheduleHint')}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Reminders Toggle */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.toggleCard}>
              <MaterialCommunityIcons
                name={prefs?.reminders_enabled ? 'bell-check' : 'bell-off-outline'}
                size={22}
                color={prefs?.reminders_enabled ? iconColors.emerald : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>{t('taskReminders')}</Text>
                <Text style={styles.toggleDesc}>{t('taskRemindersDesc')}</Text>
              </View>
              <Switch
                value={prefs?.reminders_enabled ?? true}
                onValueChange={handleToggleReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          </Animated.View>

          {/* Schedule Cards */}
          {SLOT_META.map((meta, idx) => {
            const disabled = !prefs?.reminders_enabled;
            const userTime = getTimeForSlot(meta.slot);
            const effectiveTime = getEffectiveTime(meta.slot);
            const isAuto = isAutoTime(meta.slot);

            return (
              <Animated.View key={meta.slot} entering={FadeInDown.delay(200 + idx * 80).duration(400)}>
                <Pressable
                  style={[styles.scheduleCard, { backgroundColor: meta.iconBg }, disabled && { opacity: 0.5 }]}
                  onPress={() => !disabled && setPickerSlot(meta.slot)}
                  disabled={disabled}
                >

                  <View style={styles.scheduleTop}>
                    <MaterialCommunityIcons name={meta.icon} size={24} color={meta.iconColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduleLabel}>{t(meta.labelKey)}</Text>
                      <Text style={styles.scheduleDesc}>{t(meta.descKey)}</Text>
                    </View>
                    {saving && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>

                  <View style={styles.scheduleBottom}>
                    <View style={styles.timeDisplaySmall}>
                      <MaterialCommunityIcons name="clock-outline" size={18} color={meta.iconColor} />
                      <Text style={[styles.timeText, { color: meta.iconColor }]}>{effectiveTime}</Text>
                    </View>

                    {isAuto ? (
                      <View style={styles.autoBadge}>
                        <MaterialCommunityIcons name="auto-fix" size={12} color={colors.primary} />
                        <Text style={styles.autoBadgeText}>{t('scheduleAuto')}</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.resetBtn}
                        onPress={(e) => { e.stopPropagation(); handleResetToAuto(meta.slot); }}
                        hitSlop={12}
                      >
                        <MaterialCommunityIcons name="refresh" size={14} color={colors.textSecondary} />
                        <Text style={styles.resetBtnText}>{t('scheduleAuto')}</Text>
                      </Pressable>
                    )}

                    <View style={styles.editBtnWrap}>
                      <MaterialCommunityIcons name="pencil" size={16} color={meta.iconColor} />
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          {/* Info */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{t('scheduleHint')}</Text>
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: spacing.lg, gap: spacing.md },

    // Hero
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.xl,
      padding: spacing.lg,
      backgroundColor: '#fffbeb',
      borderWidth: 1.5,
      borderColor: '#f59e0b22',
      gap: spacing.md,
    },
    heroTextWrap: { flex: 1 },
    heroTitle: { fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
    heroSubtitle: { fontSize: typography.size.xs, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

    // Toggle
    toggleCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: radius.xl,
      padding: spacing.lg, borderWidth: 1.5, borderColor: colors.border, gap: spacing.md,
    },
    toggleTitle: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    toggleDesc: { fontSize: typography.size.xxs, color: colors.textSecondary, marginTop: 2 },

    // Schedule Cards
    scheduleCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: spacing.md,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    scheduleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    scheduleLabel: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    scheduleDesc: { fontSize: typography.size.xxs, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

    scheduleBottom: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: 'rgba(255,255,255,0.7)',
      borderRadius: radius.lg, padding: spacing.md,
    },
    timeDisplaySmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: typography.size.lg, fontWeight: '800' },

    autoBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.primaryLight, borderRadius: radius.full,
      paddingHorizontal: spacing.sm + 2, paddingVertical: 3,
      marginLeft: spacing.sm,
    },
    autoBadgeText: { fontSize: typography.size.xxs, fontWeight: '600', color: colors.primary },

    resetBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: colors.background, borderRadius: radius.full,
      paddingHorizontal: spacing.sm + 2, paddingVertical: 3,
      marginLeft: spacing.sm, borderWidth: 1.5, borderColor: colors.border,
    },
    resetBtnText: { fontSize: typography.size.xxs, fontWeight: '600', color: colors.textSecondary },

    editBtnWrap: {
      marginLeft: 'auto',
      width: 32, height: 32, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.8)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },

    // Info
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
      backgroundColor: colors.primaryLight, borderRadius: radius.lg,
      padding: spacing.md, borderWidth: 1.5, borderColor: colors.primary + '22',
    },
    infoText: { fontSize: typography.size.xs, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  });
}
