import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HealthReportData } from '../features/checkin/checkin.api';
import { checkinApi } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { radius, shadows, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

type JournalSession = HealthReportData['sessions'][number];
type JournalStatus = 'fine' | 'tired' | 'very_tired' | 'specific_concern';

type Props = {
  refreshKey?: number;
};

const STATUS_COLORS: Record<JournalStatus, { background: string; foreground: string; border: string }> = {
  fine: { background: '#e3f7f3', foreground: '#08786f', border: '#a9ddd5' },
  tired: { background: '#fff0d6', foreground: '#a85c09', border: '#f4b354' },
  very_tired: { background: '#fee4df', foreground: '#c83d32', border: '#ef6a5d' },
  specific_concern: { background: '#f2eafc', foreground: '#7450a4', border: '#a98acc' },
};

const WEEKDAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeStatus(status?: string): JournalStatus {
  if (status === 'tired' || status === 'very_tired' || status === 'specific_concern') {
    return status;
  }
  return 'fine';
}

function uniqueDetailAnswers(session: JournalSession, bodyLabels: string[]): string[] {
  const ignored = new Set([
    'có',
    'không',
    'ổn',
    'ok',
    'rồi',
    'chưa',
    'fine',
    'nothing new',
    'không có gì thêm',
  ]);
  const answers = (session.messages || []).flatMap((message) => {
    if (Array.isArray(message.answer)) {
      return message.answer;
    }
    return typeof message.answer === 'string' ? [message.answer] : [];
  });
  const values = [...answers, ...bodyLabels]
    .map((answer) => answer.trim())
    .filter((answer) => answer.length > 1 && answer.length <= 80 && !ignored.has(answer.toLowerCase()));
  return [...new Map(values.map((answer) => [answer.toLocaleLowerCase(), answer])).values()].slice(0, 6);
}

export function HealthJournalCalendar({ refreshKey = 0 }: Props) {
  const { t, i18n } = useTranslation('tree');
  const { t: th } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const typography = useScaledTypography();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(typography, colors, isDark),
    [typography, colors, isDark],
  );
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [report, setReport] = useState<HealthReportData | null>(null);
  const [selectedSession, setSelectedSession] = useState<JournalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const monthKey = toMonthKey(month);
  const currentMonth = startOfMonth(new Date());
  const canMoveNext = month.getTime() < currentMonth.getTime();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSelectedSession(null);
    checkinApi
      .getReport('month', monthKey)
      .then((result) => {
        if (active) {
          setReport(result);
        }
      })
      .catch(() => {
        if (active) {
          setReport(null);
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [monthKey, refreshKey, retryKey]);

  const sessionsByDate = useMemo(
    () => new Map((report?.sessions || []).map((session) => [session.date.slice(0, 10), session])),
    [report?.sessions],
  );
  const attentionSessions = useMemo(
    () => (report?.sessions || []).filter((session) => normalizeStatus(session.status) !== 'fine'),
    [report?.sessions],
  );
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = (month.getDay() + 6) % 7;
  const calendarSlots = Array.from({ length: leadingBlanks + daysInMonth }, (_, index) =>
    index < leadingBlanks ? null : index - leadingBlanks + 1,
  );
  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const locale = i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US';

  const statusLabel = (status: JournalStatus): string => {
    const keys: Record<JournalStatus, string> = {
      fine: 'journalStatusFine',
      tired: 'journalStatusTired',
      very_tired: 'journalStatusVeryTired',
      specific_concern: 'journalStatusConcern',
    };
    return t(keys[status]);
  };

  const formatTime = (value?: string | null): string => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const formatDayMonth = (value: string): string => {
    const date = parseCalendarDate(value);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const selectedStatus = selectedSession ? normalizeStatus(selectedSession.status) : 'fine';
  const selectedBodyLabels = selectedSession
    ? [
        ...(selectedSession.bodyLocations || []).map((location) => {
          const keyMap: Record<string, string> = {
            head: 'checkinLocationHead',
            chest: 'checkinLocationChest',
            abdomen: 'checkinLocationAbdomen',
            limbs: 'checkinLocationLimbs',
            skin: 'checkinLocationSkin',
            whole_body: 'checkinLocationWholeBody',
            mental: 'checkinLocationMental',
          };
          return keyMap[location] ? th(keyMap[location]) : location;
        }),
        ...(selectedSession.bodyLocationOther ? [selectedSession.bodyLocationOther] : []),
      ]
    : [];
  const selectedDetails = selectedSession
    ? uniqueDetailAnswers(selectedSession, selectedBodyLabels)
    : [];
  const repeatedStatusCount = selectedSession
    ? (report?.sessions || []).filter(
        (session) => normalizeStatus(session.status) === selectedStatus,
      ).length
    : 0;

  const summary = report?.statusDistribution;
  const fineDays = summary?.fine || 0;
  const attentionDays =
    (summary?.tired || 0) + (summary?.very_tired || 0) + (summary?.specific_concern || 0);
  const latestSession = report?.sessions?.[0];
  const hasMonthCheckins = Boolean(report?.checkinDays);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="calendar-clear-outline" size={21} color={colors.primaryDark} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{t('journalTitle')}</Text>
          {/* Tạm ẩn mô tả "Xem lại trạng thái check-in theo từng ngày". */}
          {/* <Text style={styles.subtitle}>{t('journalSubtitle')}</Text> */}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setMonth((value) => shiftMonth(value, -1))}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('journalPreviousMonth')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {t('journalMonthLabel', { month: month.getMonth() + 1, year: month.getFullYear() })}
          </Text>
          <Pressable
            onPress={() => canMoveNext && setMonth((value) => shiftMonth(value, 1))}
            disabled={!canMoveNext}
            style={({ pressed }) => [
              styles.monthButton,
              !canMoveNext && styles.monthButtonDisabled,
              pressed && canMoveNext && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('journalNextMonth')}
            accessibilityState={{ disabled: !canMoveNext }}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={canMoveNext ? colors.primaryDark : colors.textSecondary}
            />
          </Pressable>
        </View>

        {loading || hasMonthCheckins ? (
          <LinearGradient
            colors={
              isDark
                ? ['#0f766e', '#115e59']
                : ['#13b8a6', '#079889']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <>
                <Text style={styles.summaryTitle}>
                  {attentionDays > 0
                    ? t('journalSummaryAttention', { fine: fineDays, attention: attentionDays })
                    : t('journalSummaryFine', { fine: fineDays })}
                </Text>
                {latestSession ? (
                  <View style={styles.summaryMetaRow}>
                    <View style={styles.summaryDot} />
                    <Text style={styles.summaryMeta}>
                      {t('journalLatestStatus', {
                        status: statusLabel(normalizeStatus(latestSession.status)),
                      })}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </LinearGradient>
        ) : null}
        {/* Tạm ẩn thẻ "Chưa có check-in trong tháng này" khi tháng đang xem chưa có dữ liệu. */}

        {error ? (
          <View style={styles.errorState}>
            <Ionicons name="cloud-offline-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.errorText}>{t('journalLoadError')}</Text>
            <Pressable onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('journalRetry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.weekRow}>
              {WEEKDAY_KEYS.map((key) => (
                <Text key={key} style={styles.weekday}>{t(key)}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarSlots.map((day, index) => {
                if (day === null) {
                  return <View key={`blank-${index}`} style={styles.daySlot} />;
                }
                const dateKey = toDateKey(month.getFullYear(), month.getMonth(), day);
                const session = sessionsByDate.get(dateKey);
                const status = session ? normalizeStatus(session.status) : null;
                const statusColors = status ? STATUS_COLORS[status] : null;
                const isToday = dateKey === todayKey;
                const isSelected = selectedSession?.date.slice(0, 10) === dateKey;
                const isFuture = parseCalendarDate(dateKey).getTime() > new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                ).getTime();
                return (
                  <View key={dateKey} style={styles.daySlot}>
                    <Pressable
                      onPress={() => session && setSelectedSession(session)}
                      disabled={!session}
                      accessibilityRole={session ? 'button' : undefined}
                      accessibilityLabel={session
                        ? t('journalDayAccessibility', { day, status: statusLabel(status!) })
                        : t('journalMissingDayAccessibility', { day })}
                      style={({ pressed }) => [
                        styles.dayCell,
                        statusColors
                          ? {
                              backgroundColor: statusColors.background,
                              borderColor: statusColors.border,
                              borderStyle: 'solid',
                            }
                          : styles.dayCellMissing,
                        isFuture && styles.dayCellFuture,
                        isToday && styles.dayCellToday,
                        isSelected && styles.dayCellSelected,
                        pressed && session && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          statusColors && { color: statusColors.foreground },
                          !statusColors && styles.dayTextMissing,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.legendRow}>
              {(['fine', 'tired', 'very_tired', 'specific_concern'] as JournalStatus[]).map((status) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, {
                    backgroundColor: STATUS_COLORS[status].background,
                    borderColor: STATUS_COLORS[status].border,
                  }]} />
                  <Text
                    style={styles.legendText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {statusLabel(status)}
                  </Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.legendMissing]} />
                <Text
                  style={styles.legendText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {t('journalStatusMissing')}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {!loading && !error && (
        <View style={styles.attentionSection}>
          <Text style={styles.attentionTitle}>{t('journalAttentionDays')}</Text>
          {attentionSessions.length > 0 ? (
            attentionSessions.map((session) => {
              const status = normalizeStatus(session.status);
              const statusColors = STATUS_COLORS[status];
              return (
                <Pressable
                  key={`${session.id || session.date}`}
                  onPress={() => setSelectedSession(session)}
                  style={({ pressed }) => [
                    styles.attentionCard,
                    { backgroundColor: statusColors.background, borderColor: statusColors.border },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('journalDayAccessibility', {
                    day: formatDayMonth(session.date),
                    status: statusLabel(status),
                  })}
                >
                  <View>
                    <Text style={[styles.attentionDate, { color: statusColors.foreground }]}>
                      {t('journalDateShort', { date: formatDayMonth(session.date) })}
                    </Text>
                    {session.summary ? (
                      <Text style={styles.attentionSummary} numberOfLines={1}>{session.summary}</Text>
                    ) : null}
                  </View>
                  <View style={styles.attentionStatusRow}>
                    <Text style={[styles.attentionStatus, { color: statusColors.foreground }]}>
                      {statusLabel(status)}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={statusColors.foreground} />
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.noAttentionCard}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} />
              <Text style={styles.noAttentionText}>
                {report?.checkinDays ? t('journalNoAttention') : t('journalNoEntries')}
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={Boolean(selectedSession)}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedSession(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedSession(null)}
            accessibilityRole="button"
            accessibilityLabel={t('journalCloseDetails')}
          />
          {selectedSession ? (
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <View style={styles.sheetHandle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetContent}
              >
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>
                    {t('journalDayTitle', {
                      date: formatDayMonth(selectedSession.date),
                      year: parseCalendarDate(selectedSession.date).getFullYear(),
                    })}
                  </Text>
                  <Pressable
                    onPress={() => setSelectedSession(null)}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('journalCloseDetails')}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={21} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.statusLine}>
                  <View style={[
                    styles.statusPill,
                    {
                      backgroundColor: STATUS_COLORS[selectedStatus].background,
                      borderColor: STATUS_COLORS[selectedStatus].border,
                    },
                  ]}>
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[selectedStatus].foreground }]}>
                      {statusLabel(selectedStatus)}
                    </Text>
                  </View>
                  {formatTime(selectedSession.createdAt) ? (
                    <Text style={styles.reportedTime}>
                      {t('journalReportedAt', { time: formatTime(selectedSession.createdAt) })}
                    </Text>
                  ) : null}
                </View>

                {selectedDetails.length > 0 ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>{t('journalReportedDetails')}</Text>
                    <View style={styles.chipRow}>
                      {selectedDetails.map((detail) => (
                        <View key={detail} style={styles.detailChip}>
                          <Text style={styles.detailChipText}>{detail}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {selectedSession.summary ? (
                  <Text style={styles.summaryQuote}>“{selectedSession.summary}”</Text>
                ) : (
                  <Text style={styles.summaryQuote}>{t('journalNoDetailSummary')}</Text>
                )}

                {selectedSession.resolved && selectedStatus !== 'fine' ? (
                  <View style={styles.resolvedRow}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryDark} />
                    <Text style={styles.resolvedText}>{t('journalResolved')}</Text>
                  </View>
                ) : null}

                <View style={styles.reminderCard}>
                  <View style={styles.reminderTitleRow}>
                    <Ionicons name="sparkles" size={17} color={colors.primaryDark} />
                    <Text style={styles.reminderTitle}>{t('journalAsinuReminder')}</Text>
                  </View>
                  <Text style={styles.reminderText}>
                    {selectedStatus === 'fine'
                      ? t('journalFineReminder')
                      : repeatedStatusCount > 1
                        ? t('journalRepeatedReminder', {
                            count: repeatedStatusCount,
                            status: statusLabel(selectedStatus).toLocaleLowerCase(),
                          })
                        : t('journalAttentionReminder')}
                  </Text>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  palette: ReturnType<typeof useThemeColors>['colors'],
  isDark: boolean,
) {
  return StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    titleIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primaryLight,
    },
    titleCopy: { flex: 1 },
    title: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    subtitle: {
      fontSize: typography.size.xs,
      color: palette.textSecondary,
      marginTop: 2,
    },
    card: {
      backgroundColor: palette.surface,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: palette.border,
      padding: spacing.md,
      gap: spacing.md,
      ...shadows.sm,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    monthButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceMuted,
    },
    monthButtonDisabled: { opacity: 0.42 },
    monthTitle: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    summaryCard: {
      minHeight: 112,
      borderRadius: radius.xl,
      padding: spacing.lg,
      justifyContent: 'center',
      gap: spacing.sm,
      overflow: 'hidden',
    },
    summaryTitle: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: '#ffffff',
      lineHeight: 25,
    },
    summaryMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    summaryDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#d9fff8',
    },
    summaryMeta: {
      fontSize: typography.size.xs,
      color: '#e5fffb',
      flex: 1,
    },
    emptySummaryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptySummaryTitle: {
      color: palette.textPrimary,
      flex: 1,
    },
    emptySummaryMeta: {
      color: palette.textSecondary,
    },
    weekRow: {
      flexDirection: 'row',
    },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: palette.textSecondary,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -3,
      rowGap: 2,
    },
    daySlot: {
      width: `${100 / 7}%`,
      padding: 3,
    },
    dayCell: {
      width: '100%',
      aspectRatio: 1,
      minHeight: 38,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellMissing: {
      backgroundColor: 'transparent',
      borderColor: palette.border,
      borderStyle: 'dashed',
    },
    dayCellFuture: { opacity: 0.46 },
    dayCellToday: { borderColor: palette.primaryDark, borderWidth: 2 },
    dayCellSelected: {
      borderColor: palette.textPrimary,
      borderWidth: 2.5,
      transform: [{ scale: 1.03 }],
    },
    dayText: {
      fontSize: typography.size.sm,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    dayTextMissing: { color: palette.textSecondary, fontWeight: '600' },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: spacing.xs,
    },
    legendItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 2,
    },
    legendSwatch: { width: 16, height: 16, borderRadius: 5, borderWidth: 1 },
    legendMissing: { backgroundColor: 'transparent', borderColor: palette.border, borderStyle: 'dashed' },
    legendText: {
      width: '100%',
      fontSize: typography.size.xxs,
      color: palette.textSecondary,
      textAlign: 'center',
      fontWeight: '600',
    },
    errorState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    errorText: { fontSize: typography.size.sm, color: palette.textSecondary, textAlign: 'center' },
    retryButton: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full, backgroundColor: palette.primaryLight },
    retryText: { fontSize: typography.size.sm, color: palette.primaryDark, fontWeight: '700' },
    attentionSection: { gap: spacing.sm },
    attentionTitle: { fontSize: typography.size.sm, fontWeight: '800', color: palette.textPrimary, paddingHorizontal: spacing.xs },
    attentionCard: {
      minHeight: 72,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    attentionDate: { fontSize: typography.size.sm, fontWeight: '800' },
    attentionSummary: { fontSize: typography.size.xxs, color: palette.textSecondary, marginTop: 3, maxWidth: 210 },
    attentionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    attentionStatus: { fontSize: typography.size.sm, fontWeight: '800' },
    noAttentionCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noAttentionText: { fontSize: typography.size.sm, color: palette.textSecondary, flex: 1 },
    pressed: { opacity: 0.72 },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: palette.overlay },
    sheet: {
      maxHeight: '82%',
      backgroundColor: palette.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: spacing.xl,
      ...shadows.lg,
    },
    sheetHandle: {
      width: 46,
      height: 5,
      borderRadius: 3,
      backgroundColor: isDark ? '#46505e' : '#d5dadd',
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    sheetContent: { paddingBottom: spacing.xl, gap: spacing.lg },
    sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sheetTitle: { fontSize: typography.size.lg, fontWeight: '800', color: palette.textPrimary, flex: 1 },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceMuted,
    },
    statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    statusPill: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
    statusPillText: { fontSize: typography.size.sm, fontWeight: '800' },
    reportedTime: { fontSize: typography.size.sm, color: palette.textSecondary },
    detailBlock: { gap: spacing.sm },
    detailLabel: { fontSize: typography.size.sm, fontWeight: '700', color: palette.textSecondary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    detailChip: { backgroundColor: palette.surfaceMuted, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 9 },
    detailChipText: { fontSize: typography.size.sm, fontWeight: '700', color: palette.textPrimary },
    summaryQuote: { fontSize: typography.size.sm, color: palette.textPrimary, fontStyle: 'italic', lineHeight: 23 },
    resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    resolvedText: { fontSize: typography.size.sm, color: palette.primaryDark, fontWeight: '800' },
    reminderCard: { backgroundColor: palette.primaryLight, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    reminderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    reminderTitle: { fontSize: typography.size.sm, color: palette.primaryDark, fontWeight: '800' },
    reminderText: { fontSize: typography.size.sm, color: palette.textPrimary, lineHeight: 23 },
  });
}
