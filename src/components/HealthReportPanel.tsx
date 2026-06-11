import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type HealthReportData } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { brandColors, colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Period = 'week' | 'month';

const SEVERITY_COLORS = {
  low: '#16a34a',
  medium: '#f59e0b',
  high: '#dc2626',
};

const SEVERITY_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  low: 'shield-check',
  medium: 'alert-circle-outline',
  high: 'alert-octagon',
};

const STATUS_META: Record<string, { color: string; bg: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }> = {
  fine: { color: '#16a34a', bg: '#f0fdf4', icon: 'emoticon-happy-outline' },
  tired: { color: '#f59e0b', bg: '#fffbeb', icon: 'emoticon-sad-outline' },
  very_tired: { color: '#dc2626', bg: '#fef2f2', icon: 'emoticon-cry-outline' },
  specific_concern: { color: '#6366f1', bg: '#eef2ff', icon: 'stethoscope' },
};

const TREND_META: Record<string, { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string; gradient: [string, string] }> = {
  improving: { icon: 'trending-up', color: '#16a34a', gradient: ['#dcfce7', '#f0fdf4'] },
  stable: { icon: 'minus', color: colors.primary, gradient: [colors.primaryLight, '#fff'] },
  worsening: { icon: 'trending-down', color: '#dc2626', gradient: ['#fee2e2', '#fef2f2'] },
};

type Props = {
  embedded?: boolean;
};

export function HealthReportPanel({ embedded = false }: Props) {
  const router = useRouter();
  const { t } = useTranslation('report');
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, insets, embedded), [scaledTypography, insets, embedded, isDark]);

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
    <View style={styles.outer}>
      {!embedded ? (
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
      ) : (
        <View style={styles.embeddedHeader}>
          <View style={styles.embeddedTitleRow}>
            <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />
            <Text style={styles.embeddedTitle}>{t('title')}</Text>
          </View>
          <Text style={styles.embeddedSub}>{t('healthReportSub')}</Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(['week', 'month'] as Period[]).map(p => (
          <Pressable key={p} style={[styles.tab, period === p && styles.tabActive]} onPress={() => setPeriod(p)}>
            <MaterialCommunityIcons
              name={p === 'week' ? 'calendar-week' : 'calendar-month'}
              size={16}
              color={period === p ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>{t(p === 'week' ? 'weekTab' : 'monthTab')}</Text>
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
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={styles.trendCard}>
              <LinearGradient
                colors={TREND_META[report.trend]?.gradient ?? [colors.primaryLight, '#fff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.trendTop}>
                <View style={styles.trendIconWrap}>
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
                  <Text style={styles.trendStatLabel}>/{report.totalDays} {t('daysUnit')}</Text>
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

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
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
                          <LinearGradient colors={[SEVERITY_COLORS[sev], SEVERITY_COLORS[sev] + 'cc']} style={StyleSheet.absoluteFill} />
                        </View>
                      </View>
                      <Text style={[styles.barCount, { color: SEVERITY_COLORS[sev] }]}>{report.severityDistribution[sev]}</Text>
                      <View style={styles.barIconWrap}>
                        <MaterialCommunityIcons name={SEVERITY_ICON[sev]} size={14} color={SEVERITY_COLORS[sev]} />
                      </View>
                      <Text style={styles.barLabel}>{t(sev === 'low' ? 'severityLow' : sev === 'medium' ? 'severityMedium' : 'severityHigh')}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
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
                    <View style={styles.statusIconWrap}>
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

          {report.commonSymptoms.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconWrap}>
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

          {(report.alerts.familyAlerted > 0 || report.alerts.emergencyTriggered > 0) && (
            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconWrap}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#dc2626" />
                  </View>
                  <Text style={styles.cardTitle}>{t('alertsTitle')}</Text>
                </View>
                {report.alerts.familyAlerted > 0 && (
                  <View style={styles.alertCard}>
                    <LinearGradient colors={['#fffbeb', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    <View style={styles.alertIconWrap}>
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
                    <LinearGradient colors={['#fef2f2', '#fff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    <View style={styles.alertIconWrap}>
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

          <Animated.View entering={FadeInDown.delay(450).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#0284c7" />
                </View>
                <Text style={styles.cardTitle}>{t('habitTitle')}</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusIconWrap}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color="#16a34a" />
                </View>
                <Text style={styles.statusLabel}>{t('responseRate')}</Text>
                <View style={styles.statusBarTrack}>
                  <View style={[styles.statusBarFill, { width: `${report.responseRate ?? 0}%`, backgroundColor: '#16a34a' }]} />
                </View>
                <View style={[styles.statusCountBadge, { backgroundColor: colors.emeraldLight }]}>
                  <Text style={[styles.statusCount, { color: '#16a34a' }]}>{report.responseRate ?? 0}%</Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusIconWrap}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#3b82f6" />
                </View>
                <Text style={styles.statusLabel}>{t('avgCheckinTime')}</Text>
                <View style={{ flex: 1 }} />
                <View style={[styles.statusCountBadge, { backgroundColor: brandColors.indigo + '18' }]}>
                  <Text style={[styles.statusCount, { color: '#3b82f6' }]}>~{report.avgCheckinHour ?? 8}h {t('morningLabel')}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconWrap}>
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
                      <View style={styles.historyDayIcon}>
                        <MaterialCommunityIcons name={statusMeta.icon} size={16} color={statusMeta.color} />
                      </View>
                      <View>
                        <Text style={styles.historyDate}>{dateStr}</Text>
                        {s.summary ? <Text style={styles.historySummary} numberOfLines={1}>{s.summary}</Text> : null}
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

          <View style={{ height: embedded ? 0 : 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, insets: { top: number; bottom: number }, embedded: boolean) {
  return StyleSheet.create({
    outer: {
      flex: embedded ? undefined : 1,
      marginTop: embedded ? spacing.lg : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    embeddedHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      gap: 2,
    },
    embeddedTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    embeddedTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    embeddedSub: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1.5,
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
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    center: { minHeight: embedded ? 220 : 360, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    emptyIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    emptyText: { fontSize: typography.size.sm, color: colors.textSecondary },
    scroll: embedded ? {} : { flex: 1 },
    scrollContent: { paddingHorizontal: embedded ? 0 : spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
    trendCard: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
    trendTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    trendIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    trendLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
    trendValue: { fontSize: typography.size.xl, fontWeight: '800' },
    trendStats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    trendStat: { flex: 1, alignItems: 'center', gap: 2 },
    trendStatDivider: { width: 1, height: 36, backgroundColor: colors.border },
    trendStatValue: { fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
    trendStatLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
    card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.border },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    cardIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
    cardTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    barRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-end' },
    barItem: { flex: 1, alignItems: 'center', gap: 6 },
    barTrack: { width: '100%', height: 96, backgroundColor: colors.surfaceMuted, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
    barCount: { fontSize: typography.size.lg, fontWeight: '800' },
    barIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    barLabel: { fontSize: typography.size.xs, color: colors.textSecondary, textAlign: 'center' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    statusIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    statusLabel: { width: 90, fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: '600' },
    statusBarTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
    statusBarFill: { height: '100%', borderRadius: 999 },
    statusCountBadge: { minWidth: 44, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, alignItems: 'center' },
    statusCount: { fontSize: typography.size.xs, fontWeight: '800' },
    symptomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    symptomRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    symptomRankText: { fontSize: typography.size.xs, fontWeight: '800', color: colors.textPrimary },
    symptomText: { flex: 1, fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: '600' },
    symptomCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    symptomCount: { fontSize: typography.size.xs, fontWeight: '700', color: colors.textSecondary },
    alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 16, padding: spacing.md, overflow: 'hidden' },
    alertIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    alertLabel: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: '600' },
    alertValue: { fontSize: typography.size.md, color: colors.textPrimary, fontWeight: '800' },
    historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    historyDayIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    historyDate: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    historySummary: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 1 },
    historySeverityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted },
    historySeverityText: { fontSize: typography.size.xs, fontWeight: '700' },
  });
}
