import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
/**
 * Reminder Config Screen — HH:MM time picker for morning/afternoon/evening
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ReminderConfigSkeleton } from '../../src/components/state/MainScreenSkeletons';
import { authApi } from '../../src/features/auth/auth.api';
import { showToast } from '../../src/stores/toast.store';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../src/features/notifications/notifications.api';
import {
  checkNotificationPermission,
  getExpoPushToken,
  requestNotificationPermissions,
} from '../../src/lib/notifications';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

const SLOT_META: Array<{
  slot: TimeSlot;
  labelKey: string;
  descKey: string;
  iconBg: string;
  iconColor: string;
  defaultTime: string;
  hourRange: [number, number];
  bgArt: any;
}> = [
  {
    slot: 'morning',
    labelKey: 'scheduleMorning',
    descKey: 'scheduleMorningDesc',
    iconBg: '#fffbeb',
    iconColor: '#f59e0b',
    defaultTime: '08:00',
    hourRange: [5, 11],
    bgArt: require('../../assets/images/reminders/morning_bg_art.png'),
  },
  {
    slot: 'afternoon',
    labelKey: 'scheduleAfternoon',
    descKey: 'scheduleAfternoonDesc',
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    defaultTime: '14:00',
    hourRange: [11, 17],
    bgArt: require('../../assets/images/reminders/afternoon_bg_art.png'),
  },
  {
    slot: 'evening',
    labelKey: 'scheduleEvening',
    descKey: 'scheduleEveningDesc',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    defaultTime: '21:00',
    hourRange: [17, 23],
    bgArt: require('../../assets/images/reminders/evening_bg_art.png'),
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

  const minutes = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 60; i++) arr.push(i);
    return arr;
  }, []);

  const handleConfirm = () => {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onConfirm(time);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={pickerStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              {t('schedulePickMinute')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pickerStyles.pickerRow}
            >
              {minutes.map(m => (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  style={[pickerStyles.pickerItem, minute === m && pickerStyles.pickerItemActive]}
                >
                  <Text style={[pickerStyles.pickerItemText, minute === m && pickerStyles.pickerItemTextActive]}>
                    {String(m).padStart(2, '0')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
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
              <View style={pickerStyles.confirmGradient}>
                <MaterialCommunityIcons name="check" size={18} color={colors.primaryDark} />
                <Text style={pickerStyles.confirmText}>{t('scheduleConfirm')}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primaryDark,
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
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.primaryDark,
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
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);

  // Time picker state
  const [pickerSlot, setPickerSlot] = useState<TimeSlot | null>(null);
  const pickerMeta = pickerSlot ? SLOT_META.find(s => s.slot === pickerSlot) : null;
  const remindersEnabled = Boolean(prefs?.reminders_enabled && notificationPermissionGranted);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getNotificationPreferences(),
      checkNotificationPermission(),
    ])
      .then(([loadedPrefs, granted]) => {
        if (!mounted) return;
        setPrefs(loadedPrefs);
        setNotificationPermissionGranted(granted);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
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
  }, [prefs, pickerSlot, t]);

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
  }, [prefs, t]);

  const handlePickerCancel = useCallback(() => {
    setPickerSlot(null);
  }, []);

  const handlePickerResetToAuto = useCallback(() => {
    if (pickerSlot) handleResetToAuto(pickerSlot);
    setPickerSlot(null);
  }, [pickerSlot, handleResetToAuto]);

  const ensureNotificationAccess = useCallback(async () => {
    const granted = notificationPermissionGranted || await requestNotificationPermissions();
    setNotificationPermissionGranted(granted);

    if (!granted) {
      showToast(t('notificationPermDesc'), 'info');
      return false;
    }

    const pushToken = await getExpoPushToken();
    if (pushToken) {
      authApi.updatePushToken(pushToken).catch(() => {});
    }

    return true;
  }, [notificationPermissionGranted, t]);

  const handleToggleReminders = useCallback(async (enabled: boolean) => {
    if (!prefs) return;

    const previous = prefs;
    setSaving(true);

    if (enabled) {
      const granted = await ensureNotificationAccess();
      if (!granted) {
        setPrefs({ ...previous, reminders_enabled: false });
        updateNotificationPreferences({ reminders_enabled: false }).catch(() => {});
        setSaving(false);
        return;
      }
    }

    setPrefs({ ...previous, reminders_enabled: enabled });
    try {
      const result = await updateNotificationPreferences({ reminders_enabled: enabled });
      setPrefs(result);
      showToast(t('scheduleSaved'), 'success');
    } catch {
      setPrefs(previous);
      showToast(t('scheduleSaveError'), 'error');
    }
    setSaving(false);
  }, [ensureNotificationAccess, prefs, t]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back', { ns: 'common' })}
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#0f3e36" />
        </Pressable>
        <Text style={styles.topHeaderTitle}>{t('scheduleTitle')}</Text>
        <View style={styles.backButtonPlaceholder} />
        <Image
          source={require('../../assets/images/reminders/header_leaves.png')}
          style={[styles.headerLeavesArt, { top: insets.top + 2 }]}
          resizeMode="contain"
        />
      </View>

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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <ReminderConfigSkeleton />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Banner Card */}
            <Animated.View entering={FadeIn.duration(400)}>
              <View style={styles.heroCard}>
                <Image
                  source={require('../../assets/images/reminders/hero_bell.png')}
                  style={styles.heroBellImg}
                  resizeMode="contain"
                />
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle}>{t('scheduleTitle')}</Text>
                  <Text style={styles.heroSubtitle}>{t('scheduleHint')}</Text>
                </View>
                <Image
                  source={require('../../assets/images/reminders/hero_deco.png')}
                  style={styles.heroDecoArt}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Reminders Toggle ("Nhắc nhiệm vụ" - WITHOUT > arrow) */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View style={styles.toggleCard}>
                <View style={styles.toggleBellWrap}>
                  <Ionicons name="notifications" size={26} color="#00897b" />
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={10} color="#ffffff" />
                  </View>
                </View>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>{t('taskReminders')}</Text>
                  <Text style={styles.toggleDesc}>{t('taskRemindersDesc')}</Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={handleToggleReminders}
                  disabled={saving}
                  trackColor={{ false: '#cbd5e1', true: '#00897b' }}
                  thumbColor="#ffffff"
                />
              </View>
            </Animated.View>

            {/* Schedule Cards */}
            {SLOT_META.map((meta, idx) => {
              const disabled = !remindersEnabled;
              const effectiveTime = getEffectiveTime(meta.slot);
              const isAuto = isAutoTime(meta.slot);

              return (
                <Animated.View key={meta.slot} entering={FadeInDown.delay(200 + idx * 80).duration(400)}>
                  <Pressable
                    style={[styles.scheduleCard, disabled && { opacity: 0.55 }]}
                    onPress={() => !disabled && setPickerSlot(meta.slot)}
                    disabled={disabled}
                  >
                    {/* Background Illustration */}
                    <Image
                      source={meta.bgArt}
                      style={styles.cardBgArt}
                      resizeMode="contain"
                    />

                    <View style={styles.cardMainRow}>
                      {/* Left circular icon */}
                      <View style={[styles.slotIconCircle, { backgroundColor: meta.iconBg }]}>
                        {meta.slot === 'evening' ? (
                          <MaterialCommunityIcons name="weather-night" size={26} color={meta.iconColor} />
                        ) : meta.slot === 'afternoon' ? (
                          <Ionicons name="sunny" size={26} color={meta.iconColor} />
                        ) : (
                          <Ionicons name="sunny-outline" size={26} color={meta.iconColor} />
                        )}
                      </View>

                      {/* Text & Pills */}
                      <View style={styles.slotCopy}>
                        <Text style={styles.slotTitle}>{t(meta.labelKey)}</Text>
                        <Text style={styles.slotDesc}>{t(meta.descKey)}</Text>

                        <View style={styles.pillsRow}>
                          {/* Time pill */}
                          <View
                            style={[
                              styles.pillBadge,
                              meta.slot === 'evening' && styles.pillBadgeLavender,
                            ]}
                          >
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={meta.slot === 'evening' ? '#7c3aed' : '#00897b'}
                            />
                            <Text
                              style={[
                                styles.pillText,
                                meta.slot === 'evening' && styles.pillTextLavender,
                              ]}
                            >
                              {effectiveTime}
                            </Text>
                          </View>

                          {/* Mode pill */}
                          <View style={styles.pillBadge}>
                            <MaterialCommunityIcons name="auto-fix" size={12} color="#00897b" />
                            <Text style={styles.pillText}>{isAuto ? t('scheduleAuto') : t('scheduleAuto')}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Edit action: one clear affordance in the former chevron position */}
                      <View style={styles.cardActionGroup}>
                        <View style={styles.editBtnCircle}>
                          <Ionicons name="pencil" size={16} color="#00897b" />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}

            {/* Bottom Info Card */}
            <Animated.View entering={FadeInDown.delay(500).duration(400)}>
              <View style={styles.bottomInfoCard}>
                <Ionicons name="information-circle-outline" size={20} color="#00897b" />
                <Text style={styles.bottomInfoText}>{t('scheduleHint')}</Text>
                <Image
                  source={require('../../assets/images/reminders/hero_deco.png')}
                  style={styles.bottomInfoDeco}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
          </ScrollView>

          {/* Floating Action Button (+) */}
          <View style={styles.fabWrap}>
            <Pressable
              style={styles.fabBtn}
              onPress={() => (!remindersEnabled ? null : setPickerSlot('morning'))}
              disabled={!remindersEnabled}
              hitSlop={8}
            >
              <Ionicons name="add" size={32} color="#ffffff" />
            </Pressable>
            {/* 3 small sparkle lines */}
            <View style={styles.fabSparkle1} />
            <View style={styles.fabSparkle2} />
            <View style={styles.fabSparkle3} />
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(_typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#f3fbf8',
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: '#f3fbf8',
      position: 'relative',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: 1,
      borderColor: '#eef5f2',
      zIndex: 2,
    },
    topHeaderTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0f3e36',
      textAlign: 'center',
      flex: 1,
      zIndex: 1,
    },
    backButtonPlaceholder: {
      width: 40,
      height: 40,
    },
    headerLeavesArt: {
      position: 'absolute',
      right: 0,
      width: 110,
      height: 60,
      opacity: 0.85,
      pointerEvents: 'none',
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 14,
    },

    // Hero
    heroCard: {
      backgroundColor: '#eaf8f3',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#cceee2',
      paddingVertical: 18,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
    },
    heroBellImg: {
      width: 56,
      height: 68,
      zIndex: 2,
    },
    heroTextWrap: {
      flex: 1,
      zIndex: 2,
      paddingRight: 10,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0f3e36',
    },
    heroSubtitle: {
      fontSize: 13,
      color: '#475569',
      lineHeight: 18,
      marginTop: 4,
    },
    heroDecoArt: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 80,
      height: 60,
      opacity: 0.7,
      pointerEvents: 'none',
    },

    // Toggle Card
    toggleCard: {
      backgroundColor: '#ffffff',
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: '#eef5f2',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    toggleBellWrap: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    checkBadge: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 15,
      height: 15,
      borderRadius: 7.5,
      backgroundColor: '#00897b',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    toggleTextWrap: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f3e36',
    },
    toggleDesc: {
      fontSize: 13,
      color: '#64748b',
      marginTop: 2,
    },

    // Schedule Card
    scheduleCard: {
      backgroundColor: '#ffffff',
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: '#eef5f2',
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardBgArt: {
      position: 'absolute',
      right: 48,
      top: 0,
      bottom: 0,
      width: 125,
      height: '100%',
      opacity: 0.9,
      pointerEvents: 'none',
    },
    cardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      zIndex: 2,
    },
    slotIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotCopy: {
      flex: 1,
      gap: 3,
    },
    slotTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f3e36',
    },
    slotDesc: {
      fontSize: 12.5,
      color: '#64748b',
      lineHeight: 16,
    },
    pillsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    pillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#e6f7f2',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pillBadgeLavender: {
      backgroundColor: '#f3e8ff',
    },
    pillText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#00897b',
    },
    pillTextLavender: {
      color: '#7c3aed',
    },
    cardActionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    editBtnCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: 1,
      borderColor: '#eef5f2',
    },

    // Bottom Info
    bottomInfoCard: {
      backgroundColor: '#eaf7f2',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#cceee2',
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      position: 'relative',
      overflow: 'hidden',
      marginTop: 2,
    },
    bottomInfoText: {
      fontSize: 12.5,
      color: '#475569',
      flex: 1,
      lineHeight: 18,
      zIndex: 2,
    },
    bottomInfoDeco: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 70,
      height: 50,
      opacity: 0.5,
      pointerEvents: 'none',
    },

    // FAB Button (+)
    fabWrap: {
      position: 'absolute',
      right: 22,
      bottom: 86,
      zIndex: 10,
    },
    fabBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#00897b',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00897b',
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    fabSparkle1: {
      position: 'absolute',
      top: -3,
      right: 0,
      width: 6,
      height: 2,
      backgroundColor: '#00897b',
      transform: [{ rotate: '45deg' }],
      borderRadius: 1,
    },
    fabSparkle2: {
      position: 'absolute',
      top: 6,
      right: -7,
      width: 7,
      height: 2,
      backgroundColor: '#00897b',
      borderRadius: 1,
    },
    fabSparkle3: {
      position: 'absolute',
      top: 15,
      right: -5,
      width: 6,
      height: 2,
      backgroundColor: '#00897b',
      transform: [{ rotate: '-30deg' }],
      borderRadius: 1,
    },
  });
}
