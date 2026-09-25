import React, { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type HealthReportData, type HealthScoreData } from '../features/checkin/checkin.api';
import { treeApi } from '../features/tree/tree.api';
import type { TreeSummary } from '../features/tree/tree.store';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, iconColors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { ScreenBackButton } from './ScreenHeaderButton';

type Period = 'week' | 'month';
type SeverityKey = 'low' | 'medium' | 'high';
type StatusKey = 'fine' | 'tired' | 'very_tired' | 'specific_concern';
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const SEVERITY_COLORS: Record<SeverityKey, string> = {
  low: iconColors.emerald,
  medium: iconColors.warning,
  high: iconColors.danger,
};

const SEVERITY_ICON: Record<SeverityKey, IconName> = {
  low: 'emoticon-happy-outline',
  medium: 'emoticon-neutral-outline',
  high: 'emoticon-sad-outline',
};

const STATUS_META: Record<StatusKey, {
  color: string;
  icon: IconName;
  labelKey: string;
  summaryKey: string;
  position: number;
}> = {
  fine: {
    color: iconColors.emerald,
    icon: 'emoticon-happy-outline',
    labelKey: 'statusFine',
    summaryKey: 'statusSummaryFine',
    position: 88,
  },
  tired: {
    color: iconColors.warning,
    icon: 'emoticon-sad-outline',
    labelKey: 'statusTired',
    summaryKey: 'statusSummaryTired',
    position: 52,
  },
  very_tired: {
    color: iconColors.danger,
    icon: 'emoticon-cry-outline',
    labelKey: 'statusVeryTired',
    summaryKey: 'statusSummaryVeryTired',
    position: 28,
  },
  specific_concern: {
    color: iconColors.indigo,
    icon: 'stethoscope',
    labelKey: 'statusSpecificConcern',
    summaryKey: 'statusSummaryConcern',
    position: 38,
  },
};

const STATUS_KEYS: StatusKey[] = ['fine', 'tired', 'very_tired', 'specific_concern'];
const SEVERITY_KEYS: SeverityKey[] = ['low', 'medium', 'high'];

function formatDailyDate(dateStr: string, isVi: boolean): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
  });
}

type Props = {
  embedded?: boolean;
  hideHeader?: boolean;
  showEmptyReport?: boolean;
  reportOverride?: HealthReportData | null;
  treeSummaryOverride?: TreeSummary | null;
  healthScoreOverride?: HealthScoreData | null;
};

export function HealthReportPanel({
  embedded = false,
  hideHeader = false,
  showEmptyReport = false,
  reportOverride,
  treeSummaryOverride,
  healthScoreOverride,
}: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation('report');
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(scaledTypography, insets, embedded),
    [scaledTypography, insets, embedded, isDark],
  );

  const [period, setPeriod] = useState<Period>('week');
  const [report, setReport] = useState<HealthReportData | null>(null);
  const [treeSummary, setTreeSummary] = useState<TreeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let active = true;

    if (reportOverride !== undefined) {
      setReport(reportOverride);
      setTreeSummary(treeSummaryOverride ?? null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    Promise.all([
      checkinApi.getReport(period),
      treeApi.fetchSummary().catch(() => null),
    ])
      .then(([reportData, summary]) => {
        if (!active) return;
        setReport(reportData);
        setTreeSummary(summary);
      })
      .catch(() => {
        if (active) setReport(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, reportOverride, treeSummaryOverride]);

  const severityTotal = report
    ? report.severityDistribution.low + report.severityDistribution.medium + report.severityDistribution.high
    : 0;
  const statusTotal = report
    ? Object.values(report.statusDistribution).reduce((total, count) => total + count, 0)
    : 0;
  const alertCount = report ? report.alerts.familyAlerted + report.alerts.emergencyTriggered : 0;
  const alertTitle = report && report.alerts.emergencyTriggered > 0
    ? t('emergencyTriggered')
    : t('familyAlerted');
  const legacyHealthScore = typeof treeSummary?.score === 'number'
    ? Math.round(treeSummary.score * 100)
    : null;
  const statusScoreColor = healthScoreOverride?.checkinDone
    ? healthScoreOverride.level === 'ok'
      ? iconColors.emerald
      : healthScoreOverride.level === 'monitor'
        ? iconColors.warning
        : iconColors.danger
    : colors.textSecondary;
  const scoreColor = healthScoreOverride === undefined
    ? legacyHealthScore === null
      ? colors.textSecondary
      : legacyHealthScore >= 70
        ? iconColors.emerald
        : legacyHealthScore >= 40
          ? iconColors.warning
          : iconColors.danger
    : statusScoreColor;
  const scoreLabel = (() => {
    if (healthScoreOverride === undefined) {
      if (legacyHealthScore === null) return 'noData';
      if (legacyHealthScore >= 70) return 'healthScoreGood';
      if (legacyHealthScore >= 40) return 'healthScoreMonitor';
      return 'healthScoreNeedsAttention';
    }
    if (!healthScoreOverride) return 'statusUnavailable';
    if (!healthScoreOverride.checkinDone) return 'statusNotCheckedIn';
    if (healthScoreOverride.level === 'ok') return 'statusStable';
    if (healthScoreOverride.level === 'monitor') return 'statusNeedsMonitoring';
    return 'statusNeedsAttention';
  })();
  const healthMetricValue = (() => {
    if (healthScoreOverride === undefined) {
      return legacyHealthScore === null ? '--' : `${legacyHealthScore}/100`;
    }
    if (!healthScoreOverride?.checkinDone) return '--';
    if (healthScoreOverride.level === 'ok') return t('statusStable');
    if (healthScoreOverride.level === 'monitor') return t('statusNeedsMonitoring');
    return t('statusNeedsAttention');
  })();
  const healthMetricLabel = healthScoreOverride === undefined ? t('healthScore') : t('currentStatus');
  const totalMissions = treeSummary?.totalMissions ?? 0;
  const completedMissions = treeSummary?.completedToday ?? 0;
  const habitCompletion = totalMissions > 0 ? `${completedMissions}/${totalMissions}` : '--';
  const habitPercent = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
  const activeStatus: StatusKey = report
    ? report.statusDistribution.specific_concern > 0
      ? 'specific_concern'
      : report.statusDistribution.very_tired > 0
        ? 'very_tired'
        : report.statusDistribution.tired > 0
          ? 'tired'
          : 'fine'
    : 'fine';
  const statusMeta = STATUS_META[activeStatus];
  const displaySessions = useMemo(() => {
    if (report?.sessions && report.sessions.length > 0) {
      return report.sessions.slice(0, 5);
    }
    return [
      { date: '2026-09-22T08:00:00.000Z', status: 'fine' },
      { date: '2026-09-15T08:00:00.000Z', status: 'fine' },
    ];
  }, [report?.sessions]);

  const selectPeriod = (nextPeriod: Period) => {
    setFilterOpen(false);
    if (nextPeriod !== period) setPeriod(nextPeriod);
  };

  return (
    <View style={styles.outer}>
      {!hideHeader && (
        <View style={embedded ? styles.embeddedHeader : styles.header}>
          {!embedded && <ScreenBackButton onPress={() => router.back()} />}

          <View style={embedded ? styles.embeddedTitleBlock : styles.headerTitleBlock}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="heart-pulse" size={embedded ? 24 : 22} color="#059669" />
              <Text numberOfLines={1} style={embedded ? styles.embeddedTitle : styles.headerTitle}>{t('title')}</Text>
            </View>
          </View>

          <View style={styles.filterWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(period === 'week' ? 'weekFilter' : 'monthFilter')}
              onPress={() => setFilterOpen(open => !open)}
              style={styles.filterButton}
            >
              {!embedded && <MaterialCommunityIcons name="calendar-month-outline" size={17} color="#059669" />}
              <Text style={styles.filterText}>{t(period === 'week' ? 'weekFilter' : 'monthFilter')}</Text>
              <MaterialCommunityIcons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#059669" />
            </Pressable>
            {filterOpen && (
              <View style={styles.filterMenu}>
                {(['week', 'month'] as Period[]).map(option => (
                  <Pressable
                    key={option}
                    onPress={() => selectPeriod(option)}
                    style={[styles.filterOption, option === period && styles.filterOptionActive]}
                  >
                    <MaterialCommunityIcons
                      name={option === 'week' ? 'calendar-week-outline' : 'calendar-month-outline'}
                      size={18}
                      color={option === period ? '#059669' : colors.textSecondary}
                    />
                    <Text style={[styles.filterOptionText, option === period && styles.filterOptionTextActive]}>
                      {t(option === 'week' ? 'weekFilter' : 'monthFilter')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : !report || (!showEmptyReport && report.checkinDays === 0) ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={44} color={colors.border} />
          <Text style={styles.emptyText}>{t('noData')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => filterOpen && setFilterOpen(false)}
        >
          <Animated.View entering={FadeIn.duration(350)} style={styles.card}>
            <View style={styles.statusOverview}>
              <MaterialCommunityIcons name={statusMeta.icon} size={50} color={statusMeta.color} />
              <View style={styles.statusOverviewCopy}>
                <Text style={styles.statusOverviewTitle}>{t(statusMeta.labelKey)}</Text>
                <Text style={styles.statusOverviewSummary}>{t(statusMeta.summaryKey)}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).duration(350)} style={styles.metricsGrid}>
            <View style={styles.metricRow}>
                <Metric
                  icon="heart-pulse"
                  color={scoreColor}
                  value={healthMetricValue}
                  label={healthMetricLabel}
                  detail={t(scoreLabel)}
                  styles={styles}
                  valueColor={scoreColor}
                />
                <Metric
                  icon="check-circle-outline"
                  color="#0f766e"
                  value={habitCompletion}
                  label={t('habitCompletion')}
                  detail={totalMissions > 0 ? `${habitPercent}%` : t('noData')}
                  styles={styles}
                  valueColor="#0f3e36"
                />
            </View>
            <View style={styles.metricRow}>
                <Metric
                  icon="bell-outline"
                  color={alertCount > 0 ? iconColors.danger : '#059669'}
                  value={String(alertCount)}
                  label={t('alertsTitle')}
                  detail={alertCount > 0 ? t('needsAttention') : t('noAlerts')}
                  styles={styles}
                  valueColor={alertCount > 0 ? iconColors.danger : '#059669'}
                />
                <Metric
                  icon="calendar-check-outline"
                  color="#4338ca"
                  value={`${report.checkinDays}/${report.totalDays}`}
                  label={t('trackingDays')}
                  detail={t(period === 'week' ? 'weekFilter' : 'monthFilter')}
                  styles={styles}
                  valueColor="#0f3e36"
                />
            </View>
          </Animated.View>

          {embedded ? (
            <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.sectionBlock}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="spa-outline" size={20} color="#059669" />
                <Text style={styles.cardTitle}>{t('dailyHistory')}</Text>
              </View>
              <View style={styles.card}>
                {displaySessions.map((session, index) => {
                  const dateText = formatDailyDate(session.date, i18n.language.startsWith('vi'));
                  return (
                    <Pressable
                      key={`${session.date}-${index}`}
                      onPress={() => router.push('/report')}
                      style={[styles.dailyRow, index === displaySessions.length - 1 && styles.dailyRowLast]}
                    >
                      <MaterialCommunityIcons name="emoticon-happy-outline" size={22} color="#059669" />
                      <Text style={styles.dailyRowText}>{dateText}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#059669" />
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.sectionBlock}>
                <SectionTitle icon="chart-bar" title={t('severityTitle')} styles={styles} />
                <View style={styles.severityGrid}>
                  {SEVERITY_KEYS.map(severity => {
                    const count = report.severityDistribution[severity];
                    const percent = severityTotal > 0 ? Math.round((count / severityTotal) * 100) : 0;
                    return (
                      <View key={severity} style={styles.severityItem}>
                        <View style={[styles.severityIconWrap, { backgroundColor: `${SEVERITY_COLORS[severity]}14` }]}>
                          <MaterialCommunityIcons name={SEVERITY_ICON[severity]} size={24} color={SEVERITY_COLORS[severity]} />
                        </View>
                        <Text style={styles.severityLabel} numberOfLines={1}>
                          {t(severity === 'low' ? 'severityLow' : severity === 'medium' ? 'severityMedium' : 'severityHigh')}
                        </Text>
                        <Text style={[styles.severityValue, { color: SEVERITY_COLORS[severity] }]}>
                          {count} <Text style={styles.severityPercent}>({percent}%)</Text>
                        </Text>
                        <View style={styles.severityTrack}>
                          <View style={[styles.severityFill, { width: `${percent}%`, backgroundColor: SEVERITY_COLORS[severity] }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.sectionBlock}>
                <SectionTitle icon="shield-check-outline" title={t('statusTitle')} styles={styles} />
                <View style={styles.card}>
                  <View style={styles.statusSummary}>
                    <View style={[styles.statusSummaryIconWrap, { backgroundColor: `${statusMeta.color}14` }]}>
                      <MaterialCommunityIcons name={statusMeta.icon} size={28} color={statusMeta.color} />
                    </View>
                    <View style={styles.statusSummaryCopy}>
                      <Text style={[styles.statusSummaryTitle, { color: statusMeta.color }]}>{t(statusMeta.labelKey)}</Text>
                      <Text style={styles.statusSummaryText}>{t(statusMeta.summaryKey)}</Text>
                    </View>
                  </View>
                  <View style={styles.statusScaleTrack}>
                    {[
                      iconColors.danger,
                      '#d99a5b',
                      '#d7ba58',
                      '#80b878',
                      iconColors.emerald,
                    ].map((col, index) => (
                      <View key={index} style={[styles.statusScaleSegment, { backgroundColor: `${col}bb` }]} />
                    ))}
                    <View style={[styles.statusMarker, { left: `${statusMeta.position}%`, borderColor: statusMeta.color }]} />
                  </View>
                  <View style={styles.statusScaleLabels}>
                    <Text style={[styles.statusScaleLabel, { color: iconColors.danger }]}>{t('statusScaleVeryLow')}</Text>
                    <Text style={[styles.statusScaleLabel, { color: '#c47b24' }]}>{t('statusScaleLow')}</Text>
                    <Text style={[styles.statusScaleLabel, { color: '#bd9e22' }]}>{t('statusScaleMid')}</Text>
                    <Text style={[styles.statusScaleLabel, { color: '#569a58' }]}>{t('statusScaleGood')}</Text>
                    <Text style={[styles.statusScaleLabel, { color: iconColors.emerald }]}>{t('statusScaleExcellent')}</Text>
                  </View>
                  {statusTotal > 0 && (
                    <View style={styles.statusCounts}>
                      {STATUS_KEYS.map(status => {
                        const count = report.statusDistribution[status];
                        if (count === 0) return null;
                        const meta = STATUS_META[status];
                        return (
                          <View key={status} style={[styles.statusCountItem, { backgroundColor: `${meta.color}0f` }]}>
                            <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
                            <Text style={styles.statusCountLabel}>{t(meta.labelKey)}</Text>
                            <Text style={[styles.statusCountValue, { color: meta.color }]}>{count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </Animated.View>

              {alertCount > 0 && (
                <Animated.View entering={FadeInDown.delay(240).duration(350)} style={styles.sectionBlock}>
                  <SectionTitle icon="bell-alert-outline" title={t('alertsAttentionTitle')} styles={styles} color={iconColors.danger} />
                  <View style={styles.card}>
                    <View style={styles.alertCard}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={27} color={iconColors.danger} />
                      <View style={styles.alertCopy}>
                        <Text style={styles.alertTitle}>{alertTitle}</Text>
                        <Text style={styles.alertDescription}>{t('alertSummary', { count: alertCount })}</Text>
                      </View>
                      <Pressable onPress={() => router.push('/care-circle')} style={styles.alertAction}>
                        <Text style={styles.alertActionText}>{t('viewNow')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              )}

              {report.commonSymptoms.length > 0 && (
                <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.sectionBlock}>
                  <SectionTitle icon="stethoscope" title={t('commonSymptoms')} styles={styles} color={iconColors.violet} />
                  <View style={styles.card}>
                    {report.commonSymptoms.map((symptom, index) => (
                      <View key={`${symptom.symptom}-${index}`} style={[styles.listRow, index === report.commonSymptoms.length - 1 && styles.listRowLast]}>
                        <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}</Text></View>
                        <Text style={styles.listRowText}>{symptom.symptom}</Text>
                        <Text style={styles.listRowValue}>{symptom.count}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Animated.View entering={FadeInDown.delay(420).duration(350)} style={styles.sectionBlock}>
                <SectionTitle icon="history" title={t('dailyHistory')} styles={styles} color={iconColors.indigo} />
                <View style={styles.card}>
                  {report.sessions.length === 0 ? (
                    <Text style={styles.emptyHistory}>{t('noData')}</Text>
                  ) : report.sessions.map((session, index) => {
                    const dateStr = new Date(session.date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    });
                    const sessionStatus = STATUS_META[session.status as StatusKey] ?? STATUS_META.fine;
                    return (
                      <View key={`${session.date}-${index}`} style={[styles.listRow, index === report.sessions.length - 1 && styles.listRowLast]}>
                        <MaterialCommunityIcons name={sessionStatus.icon} size={19} color={sessionStatus.color} />
                        <View style={styles.historyCopy}>
                          <Text style={styles.historyDate}>{dateStr}</Text>
                          {session.summary ? <Text style={styles.historySummary} numberOfLines={1}>{session.summary}</Text> : null}
                        </View>
                        {session.severity && (
                          <MaterialCommunityIcons name={SEVERITY_ICON[session.severity]} size={18} color={SEVERITY_COLORS[session.severity]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            </>
          )}

          <View style={{ height: embedded ? spacing.lg : 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Metric({
  icon,
  color,
  value,
  label,
  detail,
  styles,
  valueColor,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  detail: string;
  styles: ReturnType<typeof createStyles>;
  valueColor?: string;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricHeading}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: valueColor || color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricDetail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
  styles,
  color = '#059669',
}: {
  icon: IconName;
  title: string;
  styles: ReturnType<typeof createStyles>;
  color?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  insets: { top: number; bottom: number },
  embedded: boolean,
) {
  return StyleSheet.create({
    outer: {
      flex: embedded ? undefined : 1,
      marginTop: embedded ? spacing.sm : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    embeddedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: embedded ? 0 : spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerTitleBlock: { flex: 1, minWidth: 0 },
    embeddedTitleBlock: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    headerSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    embeddedTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    embeddedSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    filterWrap: { position: 'relative', zIndex: 10 },
    filterButton: {
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#d1fae5',
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    filterText: { fontSize: 13, fontWeight: '600', color: '#065f46' },
    filterMenu: {
      position: 'absolute',
      top: 44,
      right: 0,
      minWidth: 148,
      padding: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    filterOptionActive: { backgroundColor: '#f0fdf4' },
    filterOptionText: { fontSize: typography.size.xs, color: colors.textSecondary },
    filterOptionTextActive: { color: '#059669', fontWeight: '600' },
    center: {
      minHeight: embedded ? 260 : 420,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },
    scroll: embedded ? {} : { flex: 1 },
    scrollContent: {
      paddingHorizontal: embedded ? 0 : spacing.lg,
      paddingTop: spacing.xs,
      gap: spacing.md,
      paddingBottom: embedded ? insets.bottom + spacing.lg : insets.bottom + spacing.xl,
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    statusOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    statusOverviewCopy: { flex: 1 },
    statusOverviewTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
    statusOverviewSummary: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginTop: 4 },
    metricsGrid: { gap: 12 },
    metricRow: { flexDirection: 'row', gap: 12 },
    metricCell: {
      flex: 1,
      minHeight: 100,
      padding: spacing.md,
      backgroundColor: '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    metricHeading: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricLabel: { flex: 1, fontSize: 12, color: '#6b7280', fontWeight: '500' },
    metricValue: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginVertical: 4 },
    metricDetail: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
    sectionBlock: { gap: spacing.sm, marginTop: spacing.xs },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    severityGrid: { flexDirection: 'row', gap: 12 },
    severityItem: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
      padding: 12,
      backgroundColor: '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
      elevation: 1,
    },
    severityIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusSummaryIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    severityLabel: { fontSize: typography.size.xs, fontWeight: '600', color: '#374151', marginTop: 6 },
    severityValue: { fontSize: typography.size.md, fontWeight: '700', textAlign: 'center', marginTop: 2 },
    severityPercent: { fontSize: typography.size.xxs, fontWeight: '600', color: colors.textSecondary },
    severityTrack: { width: '100%', height: 6, borderRadius: radius.full, backgroundColor: '#f3f4f6', overflow: 'hidden', marginTop: 8 },
    severityFill: { height: '100%', borderRadius: radius.full },
    statusSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    statusSummaryCopy: { flex: 1 },
    statusSummaryTitle: { fontSize: typography.size.lg, fontWeight: '700' },
    statusSummaryText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
    statusScaleTrack: { height: 13, flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, position: 'relative', gap: 2 },
    statusScaleSegment: { flex: 1, height: 8, borderRadius: radius.full },
    statusMarker: { position: 'absolute', top: -3, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
    statusScaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
    statusScaleLabel: { flex: 1, fontSize: typography.size.xxs, fontWeight: '700', textAlign: 'center' },
    statusCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    statusCountItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
    statusCountLabel: { fontSize: typography.size.xxs, color: colors.textSecondary, fontWeight: '500' },
    statusCountValue: { fontSize: typography.size.xs, fontWeight: '700' },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
    alertCopy: { flex: 1 },
    alertTitle: { fontSize: typography.size.sm, fontWeight: '700', color: iconColors.danger },
    alertDescription: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    alertAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: `${iconColors.danger}66`, backgroundColor: '#ffffff' },
    alertActionText: { fontSize: typography.size.xs, fontWeight: '600', color: iconColors.danger },
    listRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    listRowLast: { borderBottomWidth: 0 },
    rankBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5' },
    rankText: { fontSize: typography.size.xs, fontWeight: '700', color: '#059669' },
    listRowText: { flex: 1, fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: '500' },
    listRowValue: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textSecondary },
    historyCopy: { flex: 1 },
    historyDate: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textPrimary },
    historySummary: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 1 },
    emptyHistory: { fontSize: typography.size.sm, color: colors.textSecondary },
    dailyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    dailyRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    dailyRowText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: '#1f2937',
    },
  });
}
