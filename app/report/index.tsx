import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
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
import { colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

type Period = 'week' | 'month';

const SEVERITY_COLORS = {
  low: iconColors.emerald,
  medium: iconColors.warning,
  high: iconColors.danger,
};

const SEVERITY_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  low: 'shield-check',
  medium: 'alert-circle-outline',
  high: 'alert-octagon',
};

const STATUS_META: Record<string, {
  color: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = {
  fine: { color: iconColors.emerald, icon: 'emoticon-happy-outline' },
  tired: { color: iconColors.warning, icon: 'emoticon-sad-outline' },
  very_tired: { color: iconColors.danger, icon: 'emoticon-cry-outline' },
  specific_concern: { color: iconColors.indigo, icon: 'stethoscope' },
};

const TREND_META: Record<string, {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}> = {
  improving: { icon: 'trending-up', color: iconColors.emerald },
  stable: { icon: 'minus', color: colors.primary },
  worsening: { icon: 'trending-down', color: iconColors.danger },
};

export default function ReportScreen() {
  const router = useRouter();
  const { t } = useTranslation('report');
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, insets), [scaledTypography, insets, isDark]);

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

  const activeTrend = TREND_META[report?.trend ?? 'stable'] ?? TREND_META.stable;
  const checkinPercent = report && report.totalDays > 0
    ? Math.round((report.checkinDays / report.totalDays) * 100)
    : 0;
  const severityTotal = report
    ? report.severityDistribution.low + report.severityDistribution.medium + report.severityDistribution.high
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
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
              color={period === p ? colors.primaryDark : colors.textSecondary}
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

          {/* ─── Report overview ─── */}
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <View style={styles.overviewIcon}>
                  <MaterialCommunityIcons name={activeTrend.icon} size={25} color={activeTrend.color} />
                </View>
                <View style={styles.overviewTitleWrap}>
                  <Text style={styles.eyebrow}>{t('trendTitle')}</Text>
                  <Text style={[styles.overviewTitle, { color: activeTrend.color }]}>
                    {t(report.trend === 'improving' ? 'trendImproving' : report.trend === 'worsening' ? 'trendWorsening' : 'trendStable')}
                  </Text>
                </View>
                <View style={styles.periodPill}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.periodPillText}>{t(period === 'week' ? 'weekTab' : 'monthTab')}</Text>
                </View>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.consistencyRow}>
                <View>
                  <Text style={styles.consistencyLabel}>{t('checkinConsistency')}</Text>
                  <Text style={styles.consistencyValue}>
                    {t('daysOutOf', { count: report.checkinDays, total: report.totalDays })}
                  </Text>
                </View>
                <Text style={styles.consistencyPercent}>{checkinPercent}%</Text>
              </View>
              <View style={styles.consistencyTrack}>
                <View style={[styles.consistencyFill, { width: `${checkinPercent}%` }]} />
              </View>
            </View>
          </Animated.View>

          {/* ─── Key numbers ─── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.quickStatsRow}>
            <View style={styles.quickStat}>
              <MaterialCommunityIcons name="calendar-check-outline" size={18} color={iconColors.primary} />
              <Text style={styles.quickStatValue}>{report.checkinDays}</Text>
              <Text style={styles.quickStatLabel}>{t('daysUnit')}</Text>
            </View>
            <View style={styles.quickStat}>
              <MaterialCommunityIcons name="message-check-outline" size={18} color={iconColors.emerald} />
              <Text style={styles.quickStatValue}>{report.responseRate ?? 0}%</Text>
              <Text style={styles.quickStatLabel}>{t('responseRate')}</Text>
            </View>
            <View style={styles.quickStat}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={iconColors.indigo} />
              <Text style={styles.quickStatValue}>~{report.avgCheckinHour ?? 8}h</Text>
              <Text style={styles.quickStatLabel}>{t('avgCheckinTime')}</Text>
            </View>
          </Animated.View>

          {/* ─── Severity Distribution ─── */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="chart-bar" size={19} color={colors.primary} />
                <Text style={styles.cardTitle}>{t('severityTitle')}</Text>
              </View>
              <View style={styles.distributionTrack}>
                {(['low', 'medium', 'high'] as const).map(sev => {
                  const pct = severityTotal > 0 ? (report.severityDistribution[sev] / severityTotal) * 100 : 0;
                  return (
                    <View key={sev} style={[styles.distributionSegment, { width: `${pct}%`, backgroundColor: SEVERITY_COLORS[sev] }]} />
                  );
                })}
              </View>
              <View style={styles.legendList}>
                {(['low', 'medium', 'high'] as const).map(sev => (
                  <View key={sev} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLORS[sev] }]} />
                    <Text style={styles.legendLabel}>
                      {t(sev === 'low' ? 'severityLow' : sev === 'medium' ? 'severityMedium' : 'severityHigh')}
                    </Text>
                    <Text style={styles.legendValue}>{report.severityDistribution[sev]}</Text>
                    <Text style={styles.legendPercent}>
                      {severityTotal > 0 ? `${Math.round((report.severityDistribution[sev] / severityTotal) * 100)}%` : '0%'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ─── Status Distribution ─── */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="emoticon-outline" size={19} color={colors.primary} />
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
                    <MaterialCommunityIcons name={meta.icon} size={17} color={meta.color} />
                    <Text style={styles.statusLabel}>{t(labelKey)}</Text>
                    <View style={styles.statusBarTrack}>
                      <View style={[styles.statusBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                    </View>
                    <View style={styles.statusCountBadge}>
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
                  <MaterialCommunityIcons name="stethoscope" size={19} color={iconColors.violet} />
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
                  <MaterialCommunityIcons name="bell-ring-outline" size={19} color={iconColors.danger} />
                  <Text style={styles.cardTitle}>{t('alertsTitle')}</Text>
                </View>
                {report.alerts.familyAlerted > 0 && (
                  <View style={[styles.alertCard, { backgroundColor: colors.premiumLight }]}>
                    <MaterialCommunityIcons name="account-group-outline" size={20} color={iconColors.warning} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertLabel}>{t('familyAlerted')}</Text>
                      <Text style={styles.alertValue}>{report.alerts.familyAlerted} {t('times')}</Text>
                    </View>
                  </View>
                )}
                {report.alerts.emergencyTriggered > 0 && (
                  <View style={[styles.alertCard, { marginTop: spacing.sm, backgroundColor: colors.danger + '12' }]}>
                    <MaterialCommunityIcons name="hospital-box-outline" size={20} color={iconColors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertLabel}>{t('emergencyTriggered')}</Text>
                      <Text style={[styles.alertValue, { color: iconColors.danger }]}>{report.alerts.emergencyTriggered} {t('times')}</Text>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* ─── Habit / Engagement ─── */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={19} color={iconColors.cyan} />
                  <Text style={styles.cardTitle}>{t('habitTitle')}</Text>
              </View>
              {/* Response rate */}
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={17} color={iconColors.emerald} />
                <Text style={styles.statusLabel}>{t('responseRate')}</Text>
                <View style={styles.statusBarTrack}>
                  <View style={[styles.statusBarFill, { width: `${report.responseRate ?? 0}%`, backgroundColor: iconColors.emerald }]} />
                </View>
                <View style={styles.statusCountBadge}>
                  <Text style={[styles.statusCount, { color: iconColors.emerald }]}>{report.responseRate ?? 0}%</Text>
                </View>
              </View>
              {/* Average check-in hour */}
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="clock-outline" size={17} color={iconColors.indigo} />
                <Text style={styles.statusLabel}>{t('avgCheckinTime')}</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.statusCountBadge}>
                  <Text style={[styles.statusCount, { color: iconColors.indigo }]}>~{report.avgCheckinHour ?? 8}h {t('morningLabel')}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ─── Daily History ─── */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="history" size={19} color={iconColors.indigo} />
                  <Text style={styles.cardTitle}>{t('dailyHistory')}</Text>
              </View>
              {report.sessions.map((s, i) => {
                const dateStr = new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
                const statusMeta = STATUS_META[s.status] || STATUS_META.fine;
                return (
                  <View key={i} style={[styles.historyRow, i === report.sessions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.historyLeft}>
                      <MaterialCommunityIcons name={statusMeta.icon} size={17} color={statusMeta.color} />
                      <View>
                        <Text style={styles.historyDate}>{dateStr}</Text>
                        {s.summary ? (
                          <Text style={styles.historySummary} numberOfLines={1}>{s.summary}</Text>
                        ) : null}
                      </View>
                    </View>
                    {s.severity && (
                      <View style={styles.historySeverityBadge}>
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
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      padding: 4,
      gap: spacing.xs,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
    },
    tabText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primaryDark,
      fontWeight: '700',
    },
    // Center / Empty
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
      paddingTop: spacing.sm,
    },

    // ── Overview ──
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    overviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    overviewIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overviewTitleWrap: {
      flex: 1,
      gap: 2,
    },
    eyebrow: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    overviewTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
    },
    periodPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      paddingVertical: spacing.xs + 1,
      paddingHorizontal: spacing.sm,
      gap: 4,
    },
    periodPillText: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    overviewDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.lg,
    },
    consistencyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    consistencyLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    consistencyValue: {
      fontSize: typography.size.md,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },
    consistencyPercent: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.primaryDark,
    },
    consistencyTrack: {
      height: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.full,
      overflow: 'hidden',
      marginTop: spacing.md,
    },
    consistencyFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radius.full,
    },
    quickStatsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    quickStat: {
      flex: 1,
      minHeight: 92,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.xs,
      gap: 3,
    },
    quickStatValue: {
      fontSize: typography.size.md,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },
    quickStatLabel: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      textAlign: 'center',
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
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    cardTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    // ── Severity distribution ──
    distributionTrack: {
      flexDirection: 'row',
      width: '100%',
      height: 14,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.full,
      overflow: 'hidden',
    },
    distributionSegment: {
      height: '100%',
      minWidth: 0,
    },
    legendList: {
      marginTop: spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 32,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border + '88',
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      flex: 1,
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    legendValue: {
      fontSize: typography.size.xs,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    legendPercent: {
      width: 38,
      textAlign: 'right',
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },

    // ── Status Distribution ──
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    statusLabel: {
      fontSize: typography.size.xs,
      fontWeight: '600',
      color: colors.textPrimary,
      width: 72,
    },
    statusBarTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border + '22',
      borderRadius: 4,
      overflow: 'hidden',
    },
    statusBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    statusCountBadge: {
      minWidth: 30,
      minHeight: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 4,
    },
    statusCount: {
      fontSize: typography.size.sm,
      fontWeight: '800',
    },

    // ── Symptoms ──
    symptomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border + '66',
      gap: spacing.md,
    },
    symptomRank: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    symptomRankText: {
      fontSize: typography.size.xs,
      fontWeight: '800',
      color: colors.primary,
    },
    symptomText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      flex: 1,
      fontWeight: '500',
    },
    symptomCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    symptomCount: {
      fontSize: typography.size.xs,
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
    alertLabel: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },
    alertValue: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: iconColors.warning,
      marginTop: 1,
    },

    // ── Daily History ──
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border + '55',
      gap: spacing.sm,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    historyDate: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historySummary: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
      maxWidth: 200,
    },
    historySeverityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 5,
      borderRadius: radius.lg,
      gap: 4,
    },
    historySeverityText: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
    },
  });
}
