/**
 * Dev Test Screen — Check-in Flow Testing
 *
 * Allows testing all check-in scenarios:
 * - Reset today's session
 * - Start fresh morning check-in
 * - Start follow-up check-in
 * - View current session state
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { checkinApi, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

type TestLog = { time: string; text: string; type: 'info' | 'success' | 'error' | 'action' };

export default function DevTestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [session, setSession] = useState<CheckinSession | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const addLog = useCallback((text: string, type: TestLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ time, text, type }, ...prev]);
  }, []);

  // Load current session on mount
  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await checkinApi.getToday();
      setSession(res.session);
      if (res.session) {
        addLog(`Session found: #${res.session.id} | status=${res.session.initial_status} | flow=${res.session.flow_state}`, 'info');
        if (res.session.triage_severity) {
          addLog(`Triage: severity=${res.session.triage_severity} | summary="${res.session.triage_summary || 'N/A'}"`, 'info');
        }
        if (res.session.next_checkin_at) {
          const next = new Date(res.session.next_checkin_at);
          const diff = Math.round((next.getTime() - Date.now()) / 60000);
          addLog(`Next check-in: ${next.toLocaleTimeString('vi-VN')} (${diff > 0 ? `in ${diff} min` : 'overdue'})`, 'info');
        }
      } else {
        addLog('No session today — ready for morning check-in', 'info');
      }
    } catch (err: any) {
      addLog(`Error loading session: ${err.message}`, 'error');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => { refreshSession(); }, []);

  // Reset today's session
  const handleReset = useCallback(() => {
    showAlert(
      'Reset Session',
      t('devTestResetConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await checkinApi.resetToday();
              addLog('Session reset OK — ready for fresh test', 'success');
              setSession(null);
            } catch (err: any) {
              addLog(`Reset failed: ${err.message}`, 'error');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [addLog, showAlert]);

  // Navigate to check-in (morning)
  const goCheckinMorning = useCallback(() => {
    addLog('Opening check-in (morning flow)...', 'action');
    router.push('/checkin');
  }, [addLog, router]);

  // Navigate to check-in (follow-up)
  const goCheckinFollowUp = useCallback(() => {
    if (!session) {
      addLog('No session to follow up — start morning first', 'error');
      return;
    }
    addLog(`Opening follow-up for session #${session.id}...`, 'action');
    router.push(`/checkin?mode=followup&checkin_id=${session.id}`);
  }, [addLog, router, session]);

  const sessionStatusColor = !session ? colors.textSecondary
    : session.flow_state === 'resolved' ? '#16a34a'
    : session.flow_state === 'high_alert' ? '#dc2626'
    : session.flow_state === 'follow_up' ? '#d97706'
    : colors.primary;

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={{
        headerShown: true,
        title: t('devTestTitle'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Session Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusDot, { backgroundColor: sessionStatusColor }]} />
            <Text style={styles.cardTitle}>{t('devTestSessionToday')}</Text>
            <Pressable onPress={refreshSession} hitSlop={12}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {loading && session === undefined ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : !session ? (
            <View style={styles.emptySession}>
              <MaterialCommunityIcons name="clipboard-outline" size={32} color={colors.border} />
              <Text style={styles.emptyText}>{t('devTestNoSession')}</Text>
            </View>
          ) : (
            <View style={styles.sessionInfo}>
              <InfoRow label="ID" value={`#${session.id}`} />
              <InfoRow label="Status" value={session.initial_status} color={sessionStatusColor} />
              <InfoRow label="Flow" value={session.flow_state} color={sessionStatusColor} />
              <InfoRow label="Severity" value={session.triage_severity || '—'} />
              <InfoRow label="Summary" value={session.triage_summary || '—'} />
              <InfoRow
                label="Next check-in"
                value={session.next_checkin_at
                  ? new Date(session.next_checkin_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              />
              <InfoRow label="Messages" value={`${(session.triage_messages || []).length} Q&A`} />
              <InfoRow label="Resolved" value={session.resolved_at ? 'Yes' : 'No'} />
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <Text style={styles.sectionLabel}>Test Actions</Text>

        <View style={styles.actionsGrid}>
          {/* Reset */}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionRed, pressed && { opacity: 0.85 }]}
            onPress={handleReset}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="trash-outline" size={22} color="#dc2626" />
            </View>
            <Text style={styles.actionTitle}>Reset Session</Text>
            <Text style={styles.actionSub}>{t('devTestResetSession')}</Text>
          </Pressable>

          {/* Refresh */}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBlue, pressed && { opacity: 0.85 }]}
            onPress={refreshSession}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="refresh" size={22} color="#3b82f6" />
            </View>
            <Text style={styles.actionTitle}>Refresh</Text>
            <Text style={styles.actionSub}>{t('devTestReloadSession')}</Text>
          </Pressable>
        </View>

        <View style={styles.actionsGrid}>
          {/* Morning check-in */}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionGreen, pressed && { opacity: 0.85 }]}
            onPress={goCheckinMorning}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
              <MaterialCommunityIcons name="weather-sunny" size={22} color="#16a34a" />
            </View>
            <Text style={styles.actionTitle}>Morning Check-in</Text>
            <Text style={styles.actionSub}>{t('devTestMorningFlow')}</Text>
          </Pressable>

          {/* Follow-up */}
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn, styles.actionOrange,
              !session && { opacity: 0.4 },
              pressed && session && { opacity: 0.85 },
            ]}
            onPress={goCheckinFollowUp}
            disabled={!session}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fffbeb' }]}>
              <Ionicons name="pulse" size={22} color="#d97706" />
            </View>
            <Text style={styles.actionTitle}>Follow-up</Text>
            <Text style={styles.actionSub}>{t('devTestFollowUpFlow')}</Text>
          </Pressable>
        </View>

        {/* Test Scenarios */}
        {/* Push Notification Tester */}
        <Pressable
          style={({ pressed }) => [styles.scenarioBtn, { borderColor: '#8b5cf6' + '44', borderWidth: 1.5 }, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/dev-test/notifications')}
        >
          <View style={styles.scenarioRow}>
            <View style={[styles.scenarioIcon, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="notifications" size={18} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioTitle}>Test Push Notifications</Text>
              <Text style={styles.scenarioSub}>{t('devTestNotifAll')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8b5cf6" />
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>Quick Test Scenarios</Text>

        <Pressable
          style={({ pressed }) => [styles.scenarioBtn, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            addLog('Scenario: Full morning flow (tired)...', 'action');
            setLoading(true);
            try {
              await checkinApi.resetToday();
              addLog('Reset OK', 'success');
              setSession(null);
              setTimeout(() => router.push('/checkin'), 300);
            } catch (err: any) {
              addLog(`Error: ${err.message}`, 'error');
            } finally {
              setLoading(false);
            }
          }}
        >
          <View style={styles.scenarioRow}>
            <View style={[styles.scenarioIcon, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 18 }}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioTitle}>Reset + Morning Check-in</Text>
              <Text style={styles.scenarioSub}>{t('devTestScenario1')}</Text>
            </View>
            <Ionicons name="play-circle" size={24} color={colors.primary} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.scenarioBtn, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            addLog('Scenario: Start with very_tired...', 'action');
            setLoading(true);
            try {
              await checkinApi.resetToday();
              const res = await checkinApi.start('very_tired');
              setSession(res.session);
              addLog(`Session started: #${res.session.id} (very_tired)`, 'success');
              router.push('/checkin');
            } catch (err: any) {
              addLog(`Error: ${err.message}`, 'error');
            } finally {
              setLoading(false);
            }
          }}
        >
          <View style={styles.scenarioRow}>
            <View style={[styles.scenarioIcon, { backgroundColor: '#fee2e2' }]}>
              <Text style={{ fontSize: 18 }}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioTitle}>Auto-start "Rất mệt"</Text>
              <Text style={styles.scenarioSub}>{t('devTestScenario2')}</Text>
            </View>
            <Ionicons name="play-circle" size={24} color="#dc2626" />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.scenarioBtn,
            !session && { opacity: 0.4 },
            pressed && session && { opacity: 0.85 },
          ]}
          disabled={!session}
          onPress={() => {
            if (session) {
              addLog(`Scenario: Follow-up for session #${session.id}`, 'action');
              router.push(`/checkin?mode=followup&checkin_id=${session.id}`);
            }
          }}
        >
          <View style={styles.scenarioRow}>
            <View style={[styles.scenarioIcon, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 18 }}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scenarioTitle}>Test Follow-up</Text>
              <Text style={styles.scenarioSub}>{t('devTestScenario3')}</Text>
            </View>
            <Ionicons name="play-circle" size={24} color="#3b82f6" />
          </View>
        </Pressable>

        {/* Logs */}
        <Text style={styles.sectionLabel}>Test Logs</Text>
        <View style={styles.logCard}>
          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>{t('devTestNoLogs')}</Text>
          ) : (
            logs.map((log, i) => (
              <View key={i} style={styles.logRow}>
                <Text style={styles.logTime}>{log.time}</Text>
                <View style={[
                  styles.logDot,
                  { backgroundColor: log.type === 'error' ? '#dc2626' : log.type === 'success' ? '#16a34a' : log.type === 'action' ? '#3b82f6' : colors.textSecondary },
                ]} />
                <Text style={[
                  styles.logText,
                  log.type === 'error' && { color: '#dc2626' },
                  log.type === 'success' && { color: '#16a34a' },
                ]}>{log.text}</Text>
              </View>
            ))
          )}
        </View>

        {logs.length > 0 && (
          <Pressable
            style={styles.clearLogsBtn}
            onPress={() => setLogs([])}
          >
            <Text style={styles.clearLogsText}>Clear logs</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: color || colors.textPrimary, maxWidth: '65%' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      padding: spacing.lg,
      gap: spacing.md,
    },

    // Card
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    cardTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    emptySession: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    sessionInfo: {
      gap: 2,
    },

    // Section
    sectionLabel: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.sm,
    },

    // Actions grid
    actionsGrid: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1.5,
      gap: spacing.xs,
    },
    actionRed: { borderColor: '#dc2626' + '33' },
    actionBlue: { borderColor: '#3b82f6' + '33' },
    actionGreen: { borderColor: '#16a34a' + '33' },
    actionOrange: { borderColor: '#d97706' + '33' },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionTitle: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    actionSub: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },

    // Scenarios
    scenarioBtn: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scenarioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    scenarioIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scenarioTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scenarioSub: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // Logs
    logCard: {
      backgroundColor: '#1a1a2e',
      borderRadius: radius.lg,
      padding: spacing.md,
      minHeight: 100,
    },
    logEmpty: {
      fontSize: typography.size.xs,
      color: '#555',
      fontStyle: 'italic',
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 3,
    },
    logTime: {
      fontSize: 11,
      color: '#666',
      fontFamily: 'Courier',
      width: 65,
    },
    logDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 5,
    },
    logText: {
      fontSize: 12,
      color: '#ccc',
      flex: 1,
      fontFamily: 'Courier',
    },
    clearLogsBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
    },
    clearLogsText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
  });
}
