import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
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
import { checkinApi, type HealthReportData } from '../features/checkin/checkin.api';
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

type Props = {
  embedded?: boolean;
};

export function HealthReportPanel({ embedded = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation('report');
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
  }, [period]);

  const severityTotal = report
    ? report.severityDistribution.low + report.severityDistribution.medium + report.severityDistribution.high
    : 0;
  const statusTotal = report
    ? Object.values(report.statusDistribution).reduce((total, count) => total + count, 0)
    : 0;
  const checkinPercent = report && report.totalDays > 0
    ? Math.round((report.checkinDays / report.totalDays) * 100)
    : 0;
  const alertCount = report ? report.alerts.familyAlerted + report.alerts.emergencyTriggered : 0;
  const alertTitle = report && report.alerts.emergencyTriggered > 0
    ? t('emergencyTriggered')
    : t('familyAlerted');
  const healthScore = treeSummary ? Math.round(treeSummary.score * 100) : null;
  const scoreColor = healthScore === null
    ? colors.textSecondary
    : healthScore >= 70
      ? iconColors.emerald
      : healthScore >= 40
        ? iconColors.warning
        : iconColors.danger;
  const scoreLabel = healthScore === null
    ? 'noData'
    : healthScore >= 70
      ? 'healthScoreGood'
      : healthScore >= 40
        ? 'healthScoreMonitor'
        : 'healthScoreNeedsAttention';
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
  const selectPeriod = (nextPeriod: Period) => {
    setFilterOpen(false);
    if (nextPeriod !== period) setPeriod(nextPeriod);
  };

  return (
    <View style={styles.outer}>
      <View style={embedded ? styles.embeddedHeader : styles.header}>
        {!embedded && <ScreenBackButton onPress={() => router.back()} />}

        <View style={embedded ? styles.embeddedTitleBlock : styles.headerTitleBlock}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="chart-line" size={embedded ? 21 : 22} color={colors.primary} />
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
            <MaterialCommunityIcons name="calendar-month-outline" size={19} color={colors.primary} />
            <Text style={styles.filterText}>{t(period === 'week' ? 'weekFilter' : 'monthFilter')}</Text>
            <MaterialCommunityIcons name={filterOpen ? 'chevron-up' : 'chevron-down'} size={21} color={colors.primary} />
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
                    color={option === period ? colors.primary : colors.textSecondary}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !report || report.checkinDays === 0 ? (
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
              <MaterialCommunityIcons name={statusMeta.icon} size={52} color={statusMeta.color} />
              <View style={styles.statusOverviewCopy}>
                <Text style={[styles.statusOverviewTitle, { color: statusMeta.color }]}>{t(statusMeta.labelKey)}</Text>
                <Text style={styles.statusOverviewSummary}>{t(statusMeta.summaryKey)}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).duration(350)} style={styles.metricsGrid}>
            <View style={styles.metricRow}>
                <Metric
                  icon="heart-pulse"
                  color={scoreColor}
                  value={healthScore === null ? '--' : `${healthScore}/100`}
                  label={t('healthScore')}
                  detail={t(scoreLabel)}
                  styles={styles}
                />
                <Metric
                  icon="check-circle-outline"
                  color={iconColors.glucose}
                  value={habitCompletion}
                  label={t('habitCompletion')}
                  detail={totalMissions > 0 ? `${habitPercent}%` : t('noData')}
                  styles={styles}
                />
            </View>
            <View style={styles.metricRow}>
                <Metric
                  icon="bell-outline"
                  color={alertCount > 0 ? iconColors.danger : iconColors.emerald}
                  value={String(alertCount)}
                  label={t('alertsTitle')}
                  detail={alertCount > 0 ? t('needsAttention') : t('noAlerts')}
                  styles={styles}
                />
                <Metric
                  icon="calendar-check-outline"
                  color={iconColors.violet}
                  value={`${report.checkinDays}/${report.totalDays}`}
                  label={t('trackingDays')}
                  detail={t(period === 'week' ? 'weekFilter' : 'monthFilter')}
                  styles={styles}
                />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.sectionBlock}>
            <SectionTitle icon="chart-bar" title={t('severityTitle')} styles={styles} />
            <View style={styles.severityGrid}>
              {SEVERITY_KEYS.map(severity => {
                const count = report.severityDistribution[severity];
                const percent = severityTotal > 0 ? Math.round((count / severityTotal) * 100) : 0;
                return (
                  <View key={severity} style={styles.severityItem}>
                    <MaterialCommunityIcons name={SEVERITY_ICON[severity]} size={28} color={SEVERITY_COLORS[severity]} />
                    <Text style={styles.severityLabel} numberOfLines={1}>
                      {t(severity === 'low' ? 'severityLow' : severity === 'medium' ? 'severityMedium' : 'severityHigh')}
                    </Text>
                    <Text style={[styles.severityValue, { color: SEVERITY_COLORS[severity] }]}>
                      {count} <Text style={styles.severityPercent}>({percent}%)</Text>
                    </Text>
                    <View style={styles.severityTrack}>
                      <View style={[styles.severityFill, { width: `${percent}%`, backgroundColor: `${SEVERITY_COLORS[severity]}99` }]} />
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
                <MaterialCommunityIcons name={statusMeta.icon} size={30} color={statusMeta.color} />
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
                ].map((color, index) => (
                  <View key={index} style={[styles.statusScaleSegment, { backgroundColor: `${color}bb` }]} />
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
                      <View key={status} style={styles.statusCountItem}>
                        <MaterialCommunityIcons name={meta.icon} size={16} color={meta.color} />
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
                const dateStr = new Date(session.date).toLocaleDateString('vi-VN', {
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
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  detail: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricHeading}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricDetail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
  styles,
  color = colors.primary,
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
      marginTop: embedded ? spacing.lg : 0,
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
      paddingHorizontal: embedded ? spacing.sm : spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerTitleBlock: { flex: 1, minWidth: 0 },
    embeddedTitleBlock: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerTitle: { fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
    headerSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    embeddedTitle: { fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
    embeddedSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    filterWrap: { position: 'relative', zIndex: 10 },
    filterButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: `${colors.primary}38`,
    },
    filterText: { fontSize: typography.size.xs, fontWeight: '600', color: colors.primaryDark },
    filterMenu: {
      position: 'absolute',
      top: 50,
      right: 0,
      minWidth: 148,
      padding: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
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
    filterOptionActive: { backgroundColor: colors.primaryLight },
    filterOptionText: { fontSize: typography.size.xs, color: colors.textSecondary },
    filterOptionTextActive: { color: colors.primaryDark, fontWeight: '600' },
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
      paddingTop: spacing.sm,
      gap: spacing.lg,
      paddingBottom: embedded ? insets.bottom + spacing.lg : insets.bottom + spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    statusOverview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    statusOverviewCopy: { flex: 1 },
    statusOverviewTitle: { fontSize: typography.size.lg, fontWeight: '700' },
    statusOverviewSummary: { fontSize: typography.size.xs, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.xs },
    metricsGrid: { gap: spacing.md },
    metricRow: { flexDirection: 'row', gap: spacing.md },
    metricCell: { flex: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
    metricHeading: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.xs },
    metricLabel: { flex: 1, fontSize: typography.size.xs, color: colors.textSecondary, textAlign: 'center' },
    metricValue: { fontSize: typography.size.xl, fontWeight: '700', textAlign: 'center', marginTop: 2 },
    metricDetail: { fontSize: typography.size.xxs, color: colors.textSecondary, textAlign: 'center', marginTop: 1 },
    sectionBlock: { gap: spacing.sm },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
    cardTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    severityGrid: { flexDirection: 'row', gap: spacing.md },
    severityItem: { flex: 1, alignItems: 'center', minWidth: 0, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
    severityLabel: { fontSize: typography.size.xs, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm },
    severityValue: { fontSize: typography.size.lg, fontWeight: '700', textAlign: 'center', marginTop: 2 },
    severityPercent: { fontSize: typography.size.xxs, fontWeight: '600', color: colors.textSecondary },
    severityTrack: { width: '100%', height: 7, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: spacing.md },
    severityFill: { height: '100%', borderRadius: radius.full },
    statusSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    statusSummaryCopy: { flex: 1 },
    statusSummaryTitle: { fontSize: typography.size.lg, fontWeight: '700' },
    statusSummaryText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
    statusScaleTrack: { height: 13, flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, position: 'relative', gap: 2 },
    statusScaleSegment: { flex: 1, height: 9, borderRadius: radius.full },
    statusMarker: { position: 'absolute', top: -3, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
    statusScaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
    statusScaleLabel: { flex: 1, fontSize: typography.size.xxs, fontWeight: '700', textAlign: 'center' },
    statusCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    statusCountItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.sm },
    statusCountLabel: { fontSize: typography.size.xxs, color: colors.textSecondary },
    statusCountValue: { fontSize: typography.size.xs, fontWeight: '600' },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: `${colors.danger}0d` },
    alertCopy: { flex: 1 },
    alertTitle: { fontSize: typography.size.sm, fontWeight: '700', color: iconColors.danger },
    alertDescription: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    alertAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: `${iconColors.danger}66` },
    alertActionText: { fontSize: typography.size.xs, fontWeight: '600', color: iconColors.danger },
    listRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    listRowLast: { borderBottomWidth: 0 },
    rankBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
    rankText: { fontSize: typography.size.xs, fontWeight: '600', color: colors.textPrimary },
    listRowText: { flex: 1, fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: '500' },
    listRowValue: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textSecondary },
    historyCopy: { flex: 1 },
    historyDate: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textPrimary },
    historySummary: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 1 },
    emptyHistory: { fontSize: typography.size.sm, color: colors.textSecondary },
  });
}
