import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DoctorConnectButton } from '../../../src/components/DoctorConnectButton';
import { HealthReportPanel } from '../../../src/components/HealthReportPanel';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { careCircleApi, type MemberHealthSummary } from '../../../src/features/care-circle';
import type { HealthReportData } from '../../../src/features/checkin/checkin.api';
import type { TreeSummary } from '../../../src/features/tree/tree.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { colors, spacing, typography } from '../../../src/styles';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { ScreenBackButton } from '../../../src/components/ScreenHeaderButton';

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

const normalizeMemberReport = (raw: MemberHealthSummary['report']): HealthReportData | null => {
  if (!raw) return null;

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
    : Array.isArray(raw.recentSessions)
      ? raw.recentSessions
      : [];
  const severityDistribution = raw.severityDistribution || {};
  const statusDistribution = raw.statusDistribution || {};
  const alerts = raw.alerts || {};

  return {
    period: 'week',
    totalDays: Number(raw.totalDays ?? 7),
    checkinDays: Number(raw.checkinDays ?? 0),
    sessions: sessions.map((session: any) => ({
      date: session.date || session.session_date || session.created_at,
      status: session.status || session.initial_status || 'fine',
      severity: session.severity || session.triage_severity || null,
      summary: session.summary || session.triage_summary || null,
      flowState: session.flowState || session.flow_state || 'monitoring',
      resolved: Boolean(session.resolved ?? session.resolved_at),
    })),
    severityDistribution: {
      low: Number(severityDistribution.low || 0),
      medium: Number(severityDistribution.medium || 0),
      high: Number(severityDistribution.high || 0),
    },
    statusDistribution: {
      fine: Number(statusDistribution.fine || 0),
      tired: Number(statusDistribution.tired || 0),
      very_tired: Number(statusDistribution.very_tired || 0),
      specific_concern: Number(statusDistribution.specific_concern || 0),
    },
    commonSymptoms: Array.isArray(raw.commonSymptoms) ? raw.commonSymptoms : [],
    alerts: {
      familyAlerted: Number(alerts.familyAlerted || 0),
      emergencyTriggered: Number(alerts.emergencyTriggered || 0),
    },
    trend: raw.trend === 'improving' || raw.trend === 'worsening' ? raw.trend : 'stable',
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    responseRate: Number(raw.responseRate || 0),
    avgCheckinHour: Number(raw.avgCheckinHour || 0),
  };
};

const normalizeMemberTreeSummary = (raw: MemberHealthSummary['treeSummary']): TreeSummary | null => {
  if (!raw) return null;
  return {
    score: Number(raw.score || 0),
    streakDays: Number(raw.streakDays || 0),
    completedToday: Number(raw.completedToday || 0),
    totalMissions: Number(raw.totalMissions || 0),
  };
};

type Tab = 'overview' | 'logs' | 'checkins';

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
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [patientName, setPatientName] = useState(name || '');

  // Shared dashboard state
  const [summary, setSummary] = useState<MemberHealthSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

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
    setSummaryLoading(true);
    careCircleApi.getMemberHealthSummary(Number(id))
      .then(res => {
        if (res.ok) {
          setSummary(res);
          if (res.patientName) setPatientName(res.patientName);
        } else {
          setSummaryError(t('noPermissionViewLogs'));
        }
      })
      .catch(() => setSummaryError(t('cannotLoadLogs')))
      .finally(() => setSummaryLoading(false));

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

  const isLoading = activeTab === 'overview' ? summaryLoading : activeTab === 'logs' ? logsLoading : checkinsLoading;
  const report = useMemo(() => normalizeMemberReport(summary?.report), [summary?.report]);
  const treeSummary = useMemo(() => normalizeMemberTreeSummary(summary?.treeSummary), [summary?.treeSummary]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Flat in-app header: no native back-button bubble, shadow, or divider. */}
      <View style={[styles.topHeader, { paddingTop: insets.top + spacing.xs }]}>
        <ScreenBackButton style={styles.flatBackButton} onPress={() => router.back()} />
        <Text style={styles.topHeaderTitle} numberOfLines={1}>
          {patientName ? t('memberLogsTitle', { name: patientName }) : t('healthLogs')}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <MaterialCommunityIcons
            name="view-dashboard-outline"
            size={16}
            color={activeTab === 'overview' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Tổng quan
          </Text>
        </Pressable>
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

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && !summaryLoading && (
          <>
            {summaryError !== '' && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{summaryError}</Text>
              </View>
            )}
            {summaryError === '' && !summary && (
              <View style={styles.center}>
                <MaterialCommunityIcons name="view-dashboard-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Chưa có dữ liệu tổng quan</Text>
              </View>
            )}
            {summaryError === '' && summary && (
              <HealthReportPanel
                embedded
                hideHeader
                showEmptyReport
                reportOverride={report}
                treeSummaryOverride={treeSummary}
              />
            )}
          </>
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

                  {/* Connect doctor CTA — animated pulse + glow giống AsinuChatSticker.
                      Compact size cho session card. Context header đã hiển thị tên
                      patient → button không cần personalize.
                      TODO(future): wire onPress mở booking screen. */}
                  {(session.emergency_triggered
                    || session.triage_severity === 'high'
                    || session.triage_severity === 'medium') && (() => {
                    const isUrgent = session.emergency_triggered || session.triage_severity === 'high';
                    const ctaText = session.emergency_triggered
                      ? 'Liên hệ bác sĩ ngay'
                      : 'Đặt khám bác sĩ';
                    return (
                      <View style={{ marginTop: spacing.sm }}>
                        <DoctorConnectButton
                          variant={isUrgent ? 'urgent' : 'default'}
                          text={ctaText}
                          compact
                          onPress={() => {
                            // Placeholder cho tính năng tương lai.
                          }}
                        />
                      </View>
                    );
                  })()}
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
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: 'transparent',
    },
    flatBackButton: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    topHeaderTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center' },

    // ── Overview ──
    overviewWrap: {
      gap: spacing.md,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metricCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 5,
    },
    metricLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    metricValue: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    dashboardCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sectionInlineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    cardTitle: {
      fontSize: typography.size.sm,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    summaryStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: spacing.md,
    },
    summaryStat: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    summaryValue: {
      fontSize: typography.size.md,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    summaryLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    summaryDivider: {
      width: 1,
      height: 34,
      backgroundColor: colors.border,
    },
    severityBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    severityItem: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    verticalBarTrack: {
      width: '100%',
      height: 110,
      justifyContent: 'flex-end',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      overflow: 'hidden',
    },
    verticalBarFill: {
      width: '100%',
      borderRadius: 14,
    },
    severityCount: {
      fontSize: typography.size.lg,
      fontWeight: '900',
    },
    severityIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    severityLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
    },
    reportStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    reportStatusIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportStatusLabel: {
      width: 78,
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    reportStatusTrack: {
      flex: 1,
      height: 12,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    reportStatusFill: {
      height: '100%',
      borderRadius: 8,
    },
    reportStatusBadge: {
      minWidth: 40,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 999,
      alignItems: 'center',
    },
    reportStatusCount: {
      fontSize: typography.size.sm,
      fontWeight: '900',
    },
    symptomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    symptomRank: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    symptomRankText: {
      fontSize: typography.size.sm,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    symptomName: {
      flex: 1,
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    symptomCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    symptomCount: {
      fontSize: typography.size.xs,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    scoreFacts: {
      flex: 1,
      gap: 3,
    },
    factValue: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    factLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    overviewBody: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    alertItem: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.sm,
      gap: 2,
    },
    alertItemDanger: {
      backgroundColor: '#fef2f2',
    },
    alertTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    historyInfo: {
      flex: 1,
      gap: 2,
    },
    historyDate: {
      fontSize: typography.size.xs,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    historySummary: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    historySeverityBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 999,
    },
    historySeverityText: {
      fontSize: typography.size.xxs,
      fontWeight: '800',
    },

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
