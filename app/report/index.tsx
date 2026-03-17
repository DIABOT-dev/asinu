import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { checkinApi, type HealthReportData } from '../../src/features/checkin/checkin.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

type Period = 'week' | 'month';

const SEVERITY_COLORS = {
  low: '#16a34a',
  medium: '#f59e0b',
  high: '#dc2626',
};

const SEVERITY_BG = {
  low: '#f0fdf4',
  medium: '#fffbeb',
  high: '#fef2f2',
};

const SEVERITY_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  low: 'shield-check',
  medium: 'alert-circle-outline',
  high: 'alert-octagon',
};

const STATUS_META: Record<string, {
  color: string;
  bg: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = {
  fine: { color: '#16a34a', bg: '#f0fdf4', icon: 'emoticon-happy-outline' },
  tired: { color: '#f59e0b', bg: '#fffbeb', icon: 'emoticon-sad-outline' },
  very_tired: { color: '#dc2626', bg: '#fef2f2', icon: 'emoticon-cry-outline' },
  specific_concern: { color: '#6366f1', bg: '#eef2ff', icon: 'stethoscope' },
};

const TREND_META: Record<string, {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  bg: string;
  gradient: [string, string];
}> = {
  improving: { icon: 'trending-up', color: '#16a34a', bg: '#f0fdf4', gradient: ['#dcfce7', '#f0fdf4'] },
  stable: { icon: 'minus', color: colors.primary, bg: colors.primaryLight, gradient: [colors.primaryLight, '#fff'] },
  worsening: { icon: 'trending-down', color: '#dc2626', bg: '#fef2f2', gradient: ['#fee2e2', '#fef2f2'] },
};

export default function ReportScreen() {
  const router = useRouter();
  const { t } = useTranslation('report');
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography, insets), [scaledTypography, insets]);

  const [period, setPeriod] = useState<Period>('week');
  const [report, setReport] = useState<HealthReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    checkinApi.getReport(period)
      .then(res => setReport(res))
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="chart-line" size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>{t('title')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Period Tabs */}
      <View style={styles.tabRow}>
        {(['week', 'month'] as Period[]).map(p => (
          <Pressable
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => setPeriod(p)}
          >
            <MaterialCommunityIcons
              name={p === 'week' ? 'calendar-week' : 'calendar-month'}
              size={16}
              color={period === p ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {t(p === 'week' ? 'weekTab' : 'monthTab')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !report || report.checkinDays === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.border} />
          </View>
          <Text style={styles.emptyText}>{t('noData')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ─── Trend Hero Card ─── */}
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={styles.trendCard}>
              <LinearGradient
                colors={TREND_META[report.trend]?.gradient ?? [colors.primaryLight, '#fff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.trendTop}>
                <View style={[styles.trendIconWrap, { backgroundColor: TREND_META[report.trend]?.color + '1a' }]}>
                  <MaterialCommunityIcons
                    name={TREND_META[report.trend]?.icon ?? 'minus'}
                    size={28}
                    color={TREND_META[report.trend]?.color ?? colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendLabel}>{t('trendTitle')}</Text>
                  <Text style={[styles.trendValue, { color: TREND_META[report.trend]?.color }]}>
                    {t(report.trend === 'improving' ? 'trendImproving' : report.trend === 'worsening' ? 'trendWorsening' : 'trendStable')}
                  </Text>
                </View>
              </View>
              <View style={styles.trendStats}>
                <View style={styles.trendStat}>
                  <MaterialCommunityIcons name="calendar-check" size={18} color={colors.primary} />
                  <Text style={styles.trendStatValue}>{report.checkinDays}</Text>
                  <Text style={styles.trendStatLabel}>/{report.totalDays} {t('weekTab') === 'Tuần' ? 'ngày' : 'days'}</Text>
                </View>
                <View style={styles.trendStatDivider} />
                <View style={styles.trendStat}>
                  <MaterialCommunityIcons name="percent" size={18} color={colors.primary} />
                  <Text style={styles.trendStatValue}>{Math.round((report.checkinDays / report.totalDays) * 100)}</Text>
                  <Text style={styles.trendStatLabel}>%</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ─── Severity Distribution ─── */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#fff3e0' }]}>
                  <MaterialCommunityIcons name="chart-bar" size={18} color="#f59e0b" />
                </View>
                <Text style={styles.cardTitle}>{t('severityTitle')}</Text>
              </View>
              <View style={styles.barRow}>
                {(['low', 'medium', 'high'] as const).map(sev => {
                  const total = report.severityDistribution.low + report.severityDistribution.medium + report.severityDistribution.high;
                  const pct = total > 0 ? (report.severityDistribution[sev] / total) * 100 : 0;
                  return (
                    <View key={sev} style={styles.barItem}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${Math.max(pct, 6)}%`, backgroundColor: SEVERITY_COLORS[sev] }]}>
                          <LinearGradient
                            colors={[SEVERITY_COLORS[sev], SEVERITY_COLORS[sev] + 'cc']}
                            style={StyleSheet.absoluteFill}
                          />
                        </View>
                      </View>
                      <Text style={[styles.barCount, { color: SEVERITY_COLORS[sev] }]}>{report.severityDistribution[sev]}</Text>
                      <View style={[styles.barIconWrap, { backgroundColor: SEVERITY_BG[sev] }]}>
                        <MaterialCommunityIcons name={SEVERITY_ICON[sev]} size={14} color={SEVERITY_COLORS[sev]} />
                      </View>
                      <Text style={styles.barLabel}>
                        {t(sev === 'low' ? 'severityLow' : sev === 'medium' ? 'severityMedium' : 'severityHigh')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* ─── Status Distribution ─── */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <MaterialCommunityIcons name="emoticon-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>{t('statusTitle')}</Text>
              </View>
              {(['fine', 'tired', 'very_tired', 'specific_concern'] as const).map(st => {
                const count = report.statusDistribution[st];
                if (count === 0) return null;
                const total = Object.values(report.statusDistribution).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const meta = STATUS_META[st];
                const labelKey = st === 'fine' ? 'statusFine' : st === 'tired' ? 'statusTired' : st === 'very_tired' ? 'statusVeryTired' : 'statusSpecificConcern';
                return (
                  <View key={st} style={styles.statusRow}>
                    <View style={[styles.statusIconWrap, { backgroundColor: meta.bg }]}>
                      <MaterialCommunityIcons name={meta.icon} size={16} color={meta.color} />
                    </View>
                    <Text style={styles.statusLabel}>{t(labelKey)}</Text>
                    <View style={styles.statusBarTrack}>
                      <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                    </View>
                    <View style={[styles.statusCountBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusCount, { color: meta.color }]}>{count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* ─── Common Symptoms ─── */}
          {report.commonSymptoms.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#f3e8ff' }]}>
                    <MaterialCommunityIcons name="stethoscope" size={18} color="#8b5cf6" />
                  </View>
                  <Text style={styles.cardTitle}>{t('commonSymptoms')}</Text>
                </View>
                {report.commonSymptoms.map((s, i) => (
                  <View key={i} style={[styles.symptomRow, i === report.commonSymptoms.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.symptomRank}>
                      <Text style={styles.symptomRankText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.symptomText}>{s.symptom}</Text>
                    <View style={styles.symptomCountBadge}>
                      <MaterialCommunityIcons name="repeat" size={12} color={colors.textSecondary} />
                      <Text style={styles.symptomCount}>{s.count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ─── Alerts ─── */}
          {(report.alerts.familyAlerted > 0 || report.alerts.emergencyTriggered > 0) && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#fef2f2' }]}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#dc2626" />
                  </View>
                  <Text style={styles.cardTitle}>{t('alertsTitle')}</Text>
                </View>
                {report.alerts.familyAlerted > 0 && (
                  <View style={styles.alertCard}>
                    <LinearGradient
                      colors={['#fffbeb', '#fff']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.alertIconWrap, { backgroundColor: '#fef3c7' }]}>
                      <MaterialCommunityIcons name="account-group-outline" size={20} color="#f59e0b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertLabel}>{t('familyAlerted')}</Text>
                      <Text style={styles.alertValue}>{report.alerts.familyAlerted} {t('times')}</Text>
                    </View>
                  </View>
                )}
                {report.alerts.emergencyTriggered > 0 && (
                  <View style={[styles.alertCard, { marginTop: spacing.sm }]}>
                    <LinearGradient
                      colors={['#fef2f2', '#fff']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.alertIconWrap, { backgroundColor: '#fee2e2' }]}>
                      <MaterialCommunityIcons name="hospital-box-outline" size={20} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertLabel}>{t('emergencyTriggered')}</Text>
                      <Text style={[styles.alertValue, { color: '#dc2626' }]}>{report.alerts.emergencyTriggered} {t('times')}</Text>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ─── Daily History ─── */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#eff6ff' }]}>
                  <MaterialCommunityIcons name="history" size={18} color="#3b82f6" />
                </View>
                <Text style={styles.cardTitle}>{t('dailyHistory')}</Text>
              </View>
              {report.sessions.map((s, i) => {
                const dateStr = new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
                const statusMeta = STATUS_META[s.status] || STATUS_META.fine;
                return (
                  <View key={i} style={[styles.historyRow, i === report.sessions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyDayIcon, { backgroundColor: statusMeta.bg }]}>
                        <MaterialCommunityIcons name={statusMeta.icon} size={16} color={statusMeta.color} />
                      </View>
                      <View>
                        <Text style={styles.historyDate}>{dateStr}</Text>
                        {s.summary ? (
                          <Text style={styles.historySummary} numberOfLines={1}>{s.summary}</Text>
                        ) : null}
                      </View>
                    </View>
                    {s.severity && (
                      <View style={[styles.historySeverityBadge, { backgroundColor: SEVERITY_BG[s.severity] }]}>
                        <MaterialCommunityIcons name={SEVERITY_ICON[s.severity]} size={12} color={SEVERITY_COLORS[s.severity]} />
                        <Text style={[styles.historySeverityText, { color: SEVERITY_COLORS[s.severity] }]}>
                          {t(s.severity === 'low' ? 'severityLow' : s.severity === 'medium' ? 'severityMedium' : 'severityHigh')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    // Tabs
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      padding: 3,
      gap: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.lg,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },
    // Center / Empty
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    emptyIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },

    // ── Trend Hero Card ──
    trendCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    trendTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    trendIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    trendValue: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      marginTop: 2,
    },
    trendStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.7)',
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    trendStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    trendStatValue: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    trendStatLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    trendStatDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },

    // ── Cards ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    // ── Bar Chart ──
    barRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      height: 140,
    },
    barItem: {
      alignItems: 'center',
      flex: 1,
    },
    barTrack: {
      width: 40,
      height: 90,
      backgroundColor: colors.border + '33',
      borderRadius: radius.md,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    barCount: {
      fontSize: typography.size.md,
      fontWeight: '800',
      marginTop: 6,
    },
    barIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    barLabel: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '600',
    },

    // ── Status Distribution ──
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    statusIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusLabel: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textPrimary,
      width: 80,
    },
    statusBarTrack: {
      flex: 1,
      height: 10,
      backgroundColor: colors.border + '33',
      borderRadius: 5,
      overflow: 'hidden',
    },
    statusBarFill: {
      height: '100%',
      borderRadius: 5,
    },
    statusCountBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    statusCount: {
      fontSize: typography.size.xs,
      fontWeight: '700',
    },

    // ── Symptoms ──
    symptomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    symptomRank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    symptomRankText: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.primary,
    },
    symptomText: {
      fontSize: typography.size.xs,
      color: colors.textPrimary,
      flex: 1,
      fontWeight: '500',
    },
    symptomCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.background,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    symptomCount: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    // ── Alerts ──
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    alertIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertLabel: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },
    alertValue: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: '#f59e0b',
      marginTop: 1,
    },

    // ── Daily History ──
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border + '66',
      gap: spacing.sm,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    historyDayIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyDate: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    historySummary: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      marginTop: 1,
      maxWidth: 180,
    },
    historySeverityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radius.md,
      gap: 4,
    },
    historySeverityText: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
    },
  });
}
