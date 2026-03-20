/**
 * Dev Test — Push Notification Tester
 * Test all 21 notification types with real push delivery
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { apiClient } from '../../src/lib/apiClient';
import { scheduleLocalNotification } from '../../src/lib/notifications';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

// ─── Notification catalog ────────────────────────────────────────────────────

type NotifCategory = {
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  items: Array<{
    type: string;
    labelKey: string;
    descKey: string;
    priority: 'normal' | 'high';
  }>;
};

const CATEGORIES: NotifCategory[] = [
  {
    titleKey: 'catReminder',
    icon: 'alarm-outline',
    color: '#3b82f6',
    bg: '#eff6ff',
    items: [
      { type: 'reminder_log_morning', labelKey: 'notifReminderMorning', descKey: 'notifReminderMorningDesc', priority: 'normal' },
      { type: 'reminder_log_evening', labelKey: 'notifReminderEvening', descKey: 'notifReminderEveningDesc', priority: 'normal' },
      { type: 'reminder_water', labelKey: 'notifReminderWater', descKey: 'notifReminderWaterDesc', priority: 'normal' },
      { type: 'reminder_glucose', labelKey: 'notifReminderGlucose', descKey: 'notifReminderGlucoseDesc', priority: 'normal' },
      { type: 'reminder_bp', labelKey: 'notifReminderBp', descKey: 'notifReminderBpDesc', priority: 'normal' },
      { type: 'reminder_medication_morning', labelKey: 'notifReminderMedMorning', descKey: 'notifReminderMedMorningDesc', priority: 'normal' },
      { type: 'reminder_medication_evening', labelKey: 'notifReminderMedEvening', descKey: 'notifReminderMedEveningDesc', priority: 'normal' },
    ],
  },
  {
    titleKey: 'catCheckin',
    icon: 'heart-outline',
    color: '#08b8a2',
    bg: '#e6faf8',
    items: [
      { type: 'morning_checkin', labelKey: 'notifMorningCheckin', descKey: 'notifMorningCheckinDesc', priority: 'high' },
      { type: 'checkin_followup', labelKey: 'notifFollowUp', descKey: 'notifFollowUpDesc', priority: 'high' },
      { type: 'checkin_followup_urgent', labelKey: 'notifFollowUpUrgent', descKey: 'notifFollowUpUrgentDesc', priority: 'high' },
    ],
  },
  {
    titleKey: 'catAlert',
    icon: 'warning-outline',
    color: '#dc2626',
    bg: '#fef2f2',
    items: [
      { type: 'emergency', labelKey: 'notifEmergency', descKey: 'notifEmergencyDesc', priority: 'high' },
      { type: 'caregiver_alert', labelKey: 'notifCaregiverAlert', descKey: 'notifCaregiverAlertDesc', priority: 'high' },
      { type: 'health_alert', labelKey: 'notifHealthAlert', descKey: 'notifHealthAlertDesc', priority: 'high' },
    ],
  },
  {
    titleKey: 'catCareCircle',
    icon: 'people-outline',
    color: '#10b981',
    bg: '#d1fae5',
    items: [
      { type: 'care_circle_invitation', labelKey: 'notifCareInvite', descKey: 'notifCareInviteDesc', priority: 'high' },
      { type: 'care_circle_accepted', labelKey: 'notifCareAccept', descKey: 'notifCareAcceptDesc', priority: 'high' },
    ],
  },
  {
    titleKey: 'catAchievement',
    icon: 'trophy-outline',
    color: '#f59e0b',
    bg: '#fffbeb',
    items: [
      { type: 'streak_7', labelKey: 'notifStreak7', descKey: 'notifStreak7Desc', priority: 'normal' },
      { type: 'streak_14', labelKey: 'notifStreak14', descKey: 'notifStreak14Desc', priority: 'normal' },
      { type: 'streak_30', labelKey: 'notifStreak30', descKey: 'notifStreak30Desc', priority: 'normal' },
      { type: 'weekly_recap', labelKey: 'notifWeeklyRecap', descKey: 'notifWeeklyRecapDesc', priority: 'normal' },
    ],
  },
  {
    titleKey: 'catEngagement',
    icon: 'chatbubble-outline',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    items: [
      { type: 'engagement', labelKey: 'notifEngagement', descKey: 'notifEngagementDesc', priority: 'normal' },
    ],
  },
];

const TOTAL = CATEGORIES.reduce((s, c) => s + c.items.length, 0);

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationTestScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [sending, setSending] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const sendTestNotif = async (type: string) => {
    setSending(type);
    setLastResult(null);
    try {
      const res = await apiClient<{ ok: boolean; title?: string; body?: string; error?: string }>(
        '/api/mobile/test-notification',
        { method: 'POST', body: { type } }
      );
      if (res.ok) {
        setResults(prev => ({ ...prev, [type]: 'ok' }));
        setLastResult(`Push: ${res.title}`);
      } else if (res.error?.toLowerCase().includes('push_token')) {
        const item = CATEGORIES.flatMap(c => c.items).find(i => i.type === type);
        if (item) {
          await scheduleLocalNotification(
            t(item.labelKey),
            t(item.descKey),
            { type } as any
          );
          setResults(prev => ({ ...prev, [type]: 'ok' }));
          setLastResult(`Local: ${t(item.labelKey)} (no push token)`);
        }
      } else {
        setResults(prev => ({ ...prev, [type]: 'error' }));
        setLastResult(`${t('error')}: ${res.error || 'Unknown'}`);
      }
    } catch (err: any) {
      setResults(prev => ({ ...prev, [type]: 'error' }));
      setLastResult(`${t('error')}: ${err.message}`);
    } finally {
      setSending(null);
    }
  };

  const sendAll = () => {
    showAlert(
      t('sendAll'),
      t('sendAllConfirm', { count: TOTAL }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('send'),
          onPress: async () => {
            for (const cat of CATEGORIES) {
              for (const item of cat.items) {
                await sendTestNotif(item.type);
                await new Promise(r => setTimeout(r, 1500));
              }
            }
            setLastResult(t('sendAllDone', { count: TOTAL }));
          },
        },
      ]
    );
  };

  const successCount = Object.values(results).filter(r => r === 'ok').length;

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={{
        headerShown: true,
        title: t('devTestNotifTitle'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Header info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="notifications" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{t('pushTester')}</Text>
              <Text style={styles.infoSub}>
                {TOTAL} {t('notifTypes')} | {successCount} {t('notifSent')}
              </Text>
            </View>
          </View>

          {/* Status bar */}
          <View style={styles.statusBar}>
            {lastResult && (
              <Text style={[
                styles.statusText,
                lastResult.startsWith(t('error')) && { color: '#dc2626' },
              ]}>{lastResult}</Text>
            )}
          </View>

          {/* Send All button */}
          <Pressable
            style={({ pressed }) => [styles.sendAllBtn, pressed && { opacity: 0.85 }]}
            onPress={sendAll}
          >
            <Ionicons name="paper-plane" size={16} color="#fff" />
            <Text style={styles.sendAllText}>{t('sendAll')} ({TOTAL})</Text>
          </Pressable>
        </View>

        {/* Categories */}
        {CATEGORIES.map(cat => (
          <View key={cat.titleKey}>
            <View style={styles.catHeader}>
              <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                <Ionicons name={cat.icon} size={16} color={cat.color} />
              </View>
              <Text style={styles.catTitle}>{t(cat.titleKey)}</Text>
              <Text style={styles.catCount}>{cat.items.length}</Text>
            </View>

            <View style={styles.catCard}>
              {cat.items.map((item, i) => {
                const isSending = sending === item.type;
                const result = results[item.type];
                return (
                  <View key={item.type}>
                    {i > 0 && <View style={styles.divider} />}
                    <Pressable
                      style={({ pressed }) => [
                        styles.notifRow,
                        pressed && { backgroundColor: colors.surfaceMuted },
                      ]}
                      onPress={() => sendTestNotif(item.type)}
                      disabled={!!sending}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.notifLabelRow}>
                          <Text style={styles.notifLabel}>{t(item.labelKey)}</Text>
                          {item.priority === 'high' && (
                            <View style={styles.highBadge}>
                              <Text style={styles.highBadgeText}>HIGH</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.notifDesc}>{t(item.descKey)}</Text>
                        <Text style={styles.notifType}>{item.type}</Text>
                      </View>

                      {/* Status / Send button */}
                      <View style={styles.notifAction}>
                        {isSending ? (
                          <View style={[styles.notifBtn, { backgroundColor: colors.border }]}>
                            <Ionicons name="hourglass" size={16} color={colors.textSecondary} />
                          </View>
                        ) : result === 'ok' ? (
                          <View style={[styles.notifBtn, { backgroundColor: '#dcfce7' }]}>
                            <Ionicons name="checkmark" size={16} color="#16a34a" />
                          </View>
                        ) : result === 'error' ? (
                          <Pressable
                            style={[styles.notifBtn, { backgroundColor: '#fee2e2' }]}
                            onPress={() => sendTestNotif(item.type)}
                          >
                            <Ionicons name="close" size={16} color="#dc2626" />
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.notifBtn, { backgroundColor: cat.bg }]}
                            onPress={() => sendTestNotif(item.type)}
                          >
                            <Ionicons name="paper-plane-outline" size={14} color={cat.color} />
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Reset results */}
        {successCount > 0 && (
          <Pressable
            style={styles.resetBtn}
            onPress={() => { setResults({}); setLastResult(null); }}
          >
            <Text style={styles.resetText}>{t('clearResults')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    infoCard: {
      backgroundColor: '#1a1a2e',
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    infoIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: '#fff',
    },
    infoSub: {
      fontSize: typography.size.xxs,
      color: '#888',
      marginTop: 2,
    },
    statusBar: {
      minHeight: 18,
    },
    statusText: {
      fontSize: typography.size.xxs,
      color: '#4ade80',
      fontFamily: 'Courier',
    },
    sendAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm + 2,
    },
    sendAllText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: '#fff',
    },
    catHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    catIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catTitle: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    catCount: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    catCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: spacing.lg,
    },
    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    },
    notifLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    notifLabel: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    highBadge: {
      backgroundColor: '#dc2626',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    highBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },
    notifDesc: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      marginTop: 1,
    },
    notifType: {
      fontSize: 10,
      color: colors.textSecondary + '88',
      fontFamily: 'Courier',
      marginTop: 2,
    },
    notifAction: {
      width: 36,
      alignItems: 'center',
    },
    notifBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    resetText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
  });
}
