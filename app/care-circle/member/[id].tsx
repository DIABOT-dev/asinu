import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { careCircleApi } from '../../../src/features/care-circle';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../../src/styles';

// ── Log type config ──────────────────────────────────────────────
const LOG_TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; labelKey: string }> = {
  glucose:    { icon: 'water',                 color: '#3b82f6', bg: '#eff6ff', labelKey: 'glucose' },
  bp:         { icon: 'heart-pulse',           color: '#ef4444', bg: '#fef2f2', labelKey: 'bloodPressure' },
  weight:     { icon: 'scale-bathroom',        color: '#8b5cf6', bg: '#f5f3ff', labelKey: 'weight' },
  water:      { icon: 'cup-water',             color: '#06b6d4', bg: '#ecfeff', labelKey: 'water' },
  medication: { icon: 'pill',                  color: '#f59e0b', bg: '#fffbeb', labelKey: 'medication' },
  meal:       { icon: 'food-apple-outline',    color: '#10b981', bg: '#ecfdf5', labelKey: 'meal' },
  insulin:    { icon: 'needle',                color: '#6366f1', bg: '#eef2ff', labelKey: 'insulin' },
};
const getLogConfig = (type: string) =>
  LOG_TYPE_CONFIG[type] || { icon: 'clipboard-text-outline', color: colors.textSecondary, bg: colors.surfaceMuted, labelKey: type };

// ── Checkin status config ────────────────────────────────────────
const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; labelKey: string }> = {
  fine:             { icon: 'emoticon-happy-outline',   color: '#16a34a', bg: '#dcfce7', labelKey: 'checkinStatusFine' },
  tired:            { icon: 'emoticon-neutral-outline', color: '#f59e0b', bg: '#fef3c7', labelKey: 'checkinStatusTired' },
  very_tired:       { icon: 'emoticon-sad-outline',     color: '#ef4444', bg: '#fee2e2', labelKey: 'checkinStatusVeryTired' },
  specific_concern: { icon: 'alert-circle-outline',     color: '#8b5cf6', bg: '#f5f3ff', labelKey: 'checkinStatusConcern' },
};
const SEVERITY_CONFIG: Record<string, { color: string; labelKey: string }> = {
  low:    { color: '#16a34a', labelKey: 'checkinSeverityLow' },
  medium: { color: '#f59e0b', labelKey: 'checkinSeverityMedium' },
  high:   { color: '#ef4444', labelKey: 'checkinSeverityHigh' },
};

// ── Helpers ──────────────────────────────────────────────────────
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const formatCheckinDateTime = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm}:${ss} ${dd}/${mo}/${yyyy}`;
};

const getLogValue = (log: { log_type: string; metadata: any }): string => {
  const m = log.metadata || {};
  switch (log.log_type) {
    case 'glucose': return m.value ? `${m.value} ${m.unit || 'mg/dL'}` : '';
    case 'bp':      return m.systolic ? `${m.systolic}/${m.diastolic} mmHg` : '';
    case 'weight':  return m.value ? `${m.value} ${m.unit || 'kg'}` : '';
    case 'water':   return m.amount_ml ? `${m.amount_ml} ml` : '';
    case 'insulin': return m.dose_units ? `${m.dose_units} units` : '';
    default: return '';
  }
};

type Tab = 'logs' | 'checkins';

type CheckinSession = {
  id: number;
  session_date: string;
  initial_status: 'fine' | 'tired' | 'very_tired' | 'specific_concern' | null;
  current_status: string | null;
  flow_state: 'monitoring' | 'follow_up' | 'high_alert' | 'resolved' | null;
  triage_summary: string | null;
  triage_severity: 'low' | 'medium' | 'high' | null;
  family_alerted: boolean;
  emergency_triggered: boolean;
  resolved_at: string | null;
  created_at: string;
};

export default function MemberLogsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { t } = useTranslation('careCircle');
  const { t: tl } = useTranslation('logs');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [activeTab, setActiveTab] = useState<Tab>('logs');
  const [patientName, setPatientName] = useState(name || '');

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');

  // Checkins state
  const [checkins, setCheckins] = useState<CheckinSession[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [checkinsError, setCheckinsError] = useState('');

  useEffect(() => {
    if (!id) return;
    // Load logs
    careCircleApi.getPatientLogs(id)
      .then(res => {
        if (res.ok) {
          setLogs(res.logs || []);
          if (res.patientName) setPatientName(res.patientName);
        } else {
          setLogsError(t('noPermissionViewLogs'));
        }
      })
      .catch(() => setLogsError(t('cannotLoadLogs')))
      .finally(() => setLogsLoading(false));

    // Load checkins
    careCircleApi.getPatientCheckins(id)
      .then(res => {
        if (res.ok) {
          setCheckins(res.sessions || []);
          if (res.patientName && !patientName) setPatientName(res.patientName);
        } else {
          setCheckinsError(t('noPermissionViewLogs'));
        }
      })
      .catch(() => setCheckinsError(t('cannotLoadLogs')))
      .finally(() => setCheckinsLoading(false));
  }, [id]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const map: Record<string, typeof logs> = {};
    for (const log of logs) {
      const date = formatDate(log.occurred_at);
      if (!map[date]) map[date] = [];
      map[date].push(log);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  const isLoading = activeTab === 'logs' ? logsLoading : checkinsLoading;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: patientName ? t('memberLogsTitle', { name: patientName }) : t('healthLogs'),
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'logs' && styles.tabActive]}
          onPress={() => setActiveTab('logs')}
        >
          <MaterialCommunityIcons
            name="clipboard-list-outline"
            size={16}
            color={activeTab === 'logs' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
            {t('tabLogs')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'checkins' && styles.tabActive]}
          onPress={() => setActiveTab('checkins')}
        >
          <MaterialCommunityIcons
            name="emoticon-outline"
            size={16}
            color={activeTab === 'checkins' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'checkins' && styles.tabTextActive]}>
            {t('tabCheckins')}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* ── LOGS TAB ── */}
        {activeTab === 'logs' && !logsLoading && (
          <>
            {logsError !== '' && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{logsError}</Text>
              </View>
            )}
            {logsError === '' && logs.length === 0 && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{t('noLogsYet')}</Text>
              </View>
            )}
            {groupedLogs.map(([date, dateLogs]) => (
              <View key={date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{date}</Text>
                {dateLogs.map((log: any) => {
                  const cfg = getLogConfig(log.log_type);
                  const value = getLogValue(log);
                  return (
                    <View key={log.id} style={styles.logCard}>
                      <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
                      <View style={styles.logInfo}>
                        <Text style={styles.logType}>{tl(cfg.labelKey)}</Text>
                        {value !== '' && <Text style={styles.logValue}>{value}</Text>}
                        {log.note && <Text style={styles.logNote}>{log.note}</Text>}
                      </View>
                      <Text style={styles.logTime}>{formatTime(log.occurred_at)}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {/* ── CHECKINS TAB ── */}
        {activeTab === 'checkins' && !checkinsLoading && (
          <>
            {checkinsError !== '' && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{checkinsError}</Text>
              </View>
            )}
            {checkinsError === '' && checkins.length === 0 && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="emoticon-neutral-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{t('noCheckinsYet')}</Text>
              </View>
            )}
            {checkins.map((session) => {
              const statusCfg = session.initial_status
                ? (STATUS_CONFIG[session.initial_status] || STATUS_CONFIG.fine)
                : null;
              const severityCfg = session.triage_severity
                ? SEVERITY_CONFIG[session.triage_severity]
                : null;
              const isResolved = session.flow_state === 'resolved' || !!session.resolved_at;

              return (
                <View key={session.id} style={styles.checkinCard}>
                  {/* Header row */}
                  <View style={styles.checkinHeader}>
                    {statusCfg && (
                      <MaterialCommunityIcons name={statusCfg.icon as any} size={22} color={statusCfg.color} />
                    )}
                    <View style={styles.checkinHeaderInfo}>
                      <Text style={styles.checkinDate}>{formatCheckinDateTime(session.created_at)}</Text>
                      {statusCfg && (
                        <Text style={[styles.checkinStatus, { color: statusCfg.color }]}>
                          {t(statusCfg.labelKey)}
                        </Text>
                      )}
                    </View>
                    {isResolved && (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedText}>{t('checkinResolved')}</Text>
                      </View>
                    )}
                  </View>

                  {/* Severity */}
                  {severityCfg && (
                    <View style={styles.checkinRow}>
                      <View style={[styles.severityDot, { backgroundColor: severityCfg.color }]} />
                      <Text style={[styles.checkinMeta, { color: severityCfg.color, fontWeight: '600' }]}>
                        {t(severityCfg.labelKey)}
                      </Text>
                    </View>
                  )}

                  {/* Triage summary */}
                  {session.triage_summary && (
                    <View style={styles.triageSummaryBox}>
                      <Text style={styles.triageSummaryLabel}>{t('checkinTriageSummary')}</Text>
                      <Text style={styles.triageSummaryText}>{session.triage_summary}</Text>
                    </View>
                  )}

                  {/* Alerts */}
                  {(session.family_alerted || session.emergency_triggered) && (
                    <View style={styles.alertRow}>
                      <MaterialCommunityIcons
                        name={session.emergency_triggered ? 'alert-octagon' : 'bell-ring-outline'}
                        size={14}
                        color={session.emergency_triggered ? colors.danger : colors.warning}
                      />
                      <Text style={[styles.checkinMeta, { color: session.emergency_triggered ? colors.danger : colors.warning }]}>
                        {session.emergency_triggered ? t('checkinEmergency') : t('checkinFamilyAlerted')}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center' },

    // ── Tab bar ──
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },

    // ── Logs ──
    dateGroup: { gap: spacing.sm },
    dateLabel: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    logCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    logInfo: { flex: 1, gap: 2 },
    logType: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textPrimary },
    logValue: { fontSize: typography.size.md, fontWeight: '700', color: colors.primary },
    logNote: { fontSize: typography.size.xs, color: colors.textSecondary },
    logTime: { fontSize: typography.size.xs, color: colors.textSecondary },

    // ── Checkins ──
    checkinCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    checkinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    checkinHeaderInfo: { flex: 1 },
    checkinDate: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    checkinStatus: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      marginTop: 2,
    },
    resolvedBadge: {
      backgroundColor: '#dcfce7',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 8,
    },
    resolvedText: {
      fontSize: typography.size.xxs,
      fontWeight: '600',
      color: '#16a34a',
    },
    checkinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    severityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    checkinMeta: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    triageSummaryBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      padding: spacing.sm,
      gap: 3,
    },
    triageSummaryLabel: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    triageSummaryText: {
      fontSize: typography.size.xs,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
  });
}
