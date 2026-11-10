import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HealthReportData } from '../features/checkin/checkin.api';
import { checkinApi } from '../features/checkin/checkin.api';
import { useScaledFontSize } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { ApiError } from '../lib/apiClient';
import { shadows, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

type JournalSession = HealthReportData['sessions'][number];
type JournalStatus = 'fine' | 'tired' | 'very_tired' | 'specific_concern';

type Props = {
  refreshKey?: number;
  loadReport?: (month: string) => Promise<HealthReportData>;
  subjectName?: string;
  plain?: boolean;
  showSummary?: boolean;
  showAttention?: boolean;
  attentionOnly?: boolean;
  initialMonth?: string;
  onMonthChange?: (month: string) => void;
};

type JournalLoadState = {
  monthKey: string;
  loader: Props['loadReport'];
  report: HealthReportData | null;
  loading: boolean;
  error: boolean;
  accessDenied: boolean;
};

const STATUS_COLORS: Record<JournalStatus, { background: string; foreground: string; border: string }> = {
  fine: { background: '#E6F3ED', foreground: '#206A52', border: '#CBE3D7' },
  tired: { background: '#FBF0DC', foreground: '#805B20', border: '#EDDDBD' },
  very_tired: { background: '#F9E9E4', foreground: '#9B4437', border: '#EDCFC6' },
  specific_concern: { background: '#EEEBF7', foreground: '#6B5793', border: '#DCD4EC' },
};

const DARK_STATUS_COLORS: Record<JournalStatus, { background: string; foreground: string; border: string }> = {
  fine: { background: '#193D34', foreground: '#A7DCC5', border: '#305D4E' },
  tired: { background: '#3F3322', foreground: '#E6C78F', border: '#6B5432' },
  very_tired: { background: '#462D2B', foreground: '#E7B3A9', border: '#70443D' },
  specific_concern: { background: '#342F47', foreground: '#C7BBDC', border: '#514663' },
};

const WEEKDAY_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
const STATUS_ICONS = { fine: 'checkmark', tired: 'remove', very_tired: 'alert', specific_concern: 'ellipsis-horizontal' } as const;

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

export function HealthJournalCalendar({ refreshKey = 0, loadReport, subjectName, plain = false, showSummary = true, showAttention = true, attentionOnly = false, initialMonth, onMonthChange }: Props) {
  const { t, i18n } = useTranslation('tree');
  const { t: th } = useTranslation('home');
  const { t: tc } = useTranslation('careCircle');
  const { colors, isDark } = useThemeColors();
  const { fontScale } = useWindowDimensions();
  const legendFontSize = useScaledFontSize(12);
  const largeLegend = legendFontSize * fontScale > 16;
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark],
  );
  const [month, setMonth] = useState(() => initialMonth ? parseCalendarDate(`${initialMonth}-01`) : startOfMonth(new Date()));
  const [loadState, setLoadState] = useState<JournalLoadState | null>(null);
  const [selectedEntry, setSelectedSession] = useState<JournalSession | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const monthKey = toMonthKey(month);
  const sameSource = loadState?.monthKey === monthKey && loadState.loader === loadReport;
  const report = sameSource ? loadState.report : null;
  const loading = !sameSource || loadState.loading;
  const error = sameSource && loadState.error;
  const accessDenied = sameSource && loadState.accessDenied;
  const selectedSession = selectedEntry && report
    ? report.sessions.find((session) => session.id === selectedEntry.id && session.date === selectedEntry.date) ?? null
    : null;
  const currentMonth = startOfMonth(new Date());
  useEffect(() => { onMonthChange?.(monthKey); }, [monthKey, onMonthChange]);
  const canMoveNext = month.getTime() < currentMonth.getTime();

  useEffect(() => { setSelectedSession(null); }, [monthKey, loadReport]);

  useEffect(() => {
    let active = true;
    setLoadState((previous) => ({
      monthKey,
      loader: loadReport,
      report: previous?.monthKey === monthKey && previous.loader === loadReport ? previous.report : null,
      loading: true,
      error: false,
      accessDenied: false,
    }));
    const load = async () => {
      try {
        const result = await (loadReport ? loadReport(monthKey) : checkinApi.getReport('month', monthKey));
        if (active) {
          setLoadState({ monthKey, loader: loadReport, report: result, loading: false, error: false, accessDenied: false });
        }
      } catch (failure) {
        if (active) {
          const denied = failure instanceof ApiError && [401, 403, 404].includes(failure.statusCode);
          setLoadState((previous) => ({
            monthKey,
            loader: loadReport,
            report: !denied && previous?.monthKey === monthKey && previous.loader === loadReport ? previous.report : null,
            loading: false,
            error: true,
            accessDenied: denied,
          }));
          if (denied) setSelectedSession(null);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [monthKey, refreshKey, retryKey, loadReport]);

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
      {!attentionOnly && <View style={[styles.card, plain && styles.plain]}>
        <View style={styles.monthHeader}>
          <View style={styles.monthHeading}>
            <Text allowFontScaling accessibilityRole="header" style={styles.monthTitle}>
              {t('journalMonthLabel', {
                month: i18n.language.startsWith('vi') ? month.getMonth() + 1 : month.toLocaleDateString(locale, { month: 'short' }),
                year: month.getFullYear(),
              })}
            </Text>
            <View style={styles.loadingIndicator}>
              {loading && <ActivityIndicator size="small" color={colors.primaryDark}
                accessibilityLabel={t(report ? 'journalUpdating' : 'journalLoading')} />}
            </View>
          </View>
          <View style={styles.monthNavigation}>
            <Pressable onPress={() => setMonth((value) => shiftMonth(value, -1))}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              accessibilityRole="button" accessibilityLabel={t('journalPreviousMonth')}>
              <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
            </Pressable>
            <Pressable onPress={() => canMoveNext && setMonth((value) => shiftMonth(value, 1))}
              disabled={!canMoveNext}
              style={({ pressed }) => [styles.monthButton, !canMoveNext && styles.monthButtonDisabled,
                pressed && canMoveNext && styles.pressed]}
              accessibilityRole="button" accessibilityLabel={t('journalNextMonth')}
              accessibilityState={{ disabled: !canMoveNext }}>
              <Ionicons name="chevron-forward" size={20}
                color={canMoveNext ? colors.primaryText : colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {error && !report ? (
          <View style={styles.errorState}>
            <Ionicons name="cloud-offline-outline" size={24} color={colors.textSecondary} />
            <Text allowFontScaling style={styles.errorText}>{accessDenied ? tc('healthAccessRequired') : t('journalLoadError')}</Text>
            <Pressable onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton} accessibilityRole="button">
              <Text allowFontScaling style={styles.retryText}>{t('journalRetry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Weekdays */}
            <View style={styles.weekRow}>
              {WEEKDAY_KEYS.map((key) => (
                <Text key={key} allowFontScaling maxFontSizeMultiplier={1.1}
                  accessibilityLabel={t(key)} style={styles.weekday}>
                  {i18n.language.startsWith('vi') ? t(key) : t(key).slice(0, 1)}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid} accessibilityState={{ busy: loading }}>
              {calendarSlots.map((day, index) => {
                if (day === null) {
                  return (
                    <View key={`blank-${index}`} style={styles.daySlot}>
                      <View style={styles.dayCellBlank} />
                    </View>
                  );
                }
                const dateKey = toDateKey(month.getFullYear(), month.getMonth(), day);
                if (loading && !report) {
                  return <View key={dateKey} style={styles.daySlot}>
                    <View testID="journal-day-loading" style={[styles.dayCell, styles.loadingDay]} accessible={false} />
                  </View>;
                }
                const session = sessionsByDate.get(dateKey);
                const status = session ? normalizeStatus(session.status) : null;
                const statusColors = status ? (isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status]) : null;
                const isToday = dateKey === todayKey;
                const isFuture = dateKey > todayKey && !session;
                const isSelected = selectedSession?.date.slice(0, 10) === dateKey;

                return (
                  <View key={dateKey} style={styles.daySlot}>
                    <Pressable
                      onPress={() => session && setSelectedSession(session)}
                      disabled={!session}
                      testID={`journal-day-${dateKey}`}
                      accessibilityState={{ selected: isSelected, disabled: !session }}
                      accessibilityRole={session ? 'button' : undefined}
                      accessibilityLabel={
                        session
                          ? t('journalDayAccessibility', { day, status: statusLabel(status!) })
                          : t(isFuture ? 'journalFutureDayAccessibility' : 'journalMissingDayAccessibility', { day })
                      }
                      style={({ pressed }) => [
                        styles.dayCell,
                        !statusColors && !isToday && styles.dayCellEmpty,
                        isFuture && styles.dayCellFuture,
                        statusColors && {
                          backgroundColor: statusColors.background,
                        },
                        isToday && (statusColors ? styles.dayCellTodayChecked : styles.dayCellToday),
                        isSelected && styles.dayCellSelected,
                        pressed && session && styles.pressed,
                      ]}
                    >
                      <Text allowFontScaling maxFontSizeMultiplier={1.2}
                        style={[
                          styles.dayText,
                          statusColors && { color: statusColors.foreground },
                          !statusColors && styles.dayTextEmpty,
                          isToday && !statusColors && styles.dayTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                      <View style={styles.dayMarker} accessible={false}>
                        {status && statusColors ? <Ionicons name={STATUS_ICONS[status]} size={12}
                          color={statusColors.foreground} /> : !isFuture ? (
                          <View style={styles.missingDot} />
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendRow} testID="journal-legend">
              {(['fine', 'tired', 'very_tired', 'specific_concern'] as JournalStatus[]).map((status) => {
                const itemColors = isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status];
                return (
                  <View key={status} style={[styles.legendItem, largeLegend && styles.legendItemWide]}>
                    <View style={[styles.legendSwatch, { backgroundColor: itemColors.background }]} accessible={false}>
                      <Ionicons name={STATUS_ICONS[status]} size={12} color={itemColors.foreground} />
                    </View>
                    <Text allowFontScaling
                      style={styles.legendText}
                    >
                      {statusLabel(status)}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.legendItem, largeLegend && styles.legendItemWide]}>
                <View style={[styles.legendSwatch, styles.legendMissing]} accessible={false}>
                  <View style={styles.missingDot} />
                </View>
                <Text allowFontScaling
                  style={styles.legendText}
                >
                  {t('journalStatusMissing')}
                </Text>
              </View>
              <View style={[styles.legendItem, largeLegend && styles.legendItemWide]}>
                <View style={[styles.legendSwatch, styles.legendToday]} accessible={false} />
                <Text allowFontScaling style={styles.legendText}>{t('todayLabel')}</Text>
              </View>
            </View>
          </>
        )}
        {showSummary && (!error || report) ? (
          <View style={styles.summaryCard} testID="journal-month-summary">
            {loading && !report ? (
              <View style={styles.loadingLines} accessible={false}>
                <View style={styles.loadingLine} />
                <View style={[styles.loadingLine, { width: '65%' }]} />
              </View>
            ) : (
              <>
                <Text allowFontScaling style={styles.summaryTitle}>
                  {!hasMonthCheckins ? t('journalNoCheckin') : subjectName
                    ? tc(attentionDays > 0 ? 'memberSummaryAttention' : 'memberSummaryFine', { name: subjectName, fine: fineDays, attention: attentionDays })
                    : attentionDays > 0 ? t('journalSummaryAttention', { fine: fineDays, attention: attentionDays })
                      : t('journalSummaryFine', { fine: fineDays })}
                </Text>
                <Text allowFontScaling style={styles.summaryMeta}>
                  {latestSession ? t('journalLatestStatus', {
                    status: statusLabel(normalizeStatus(latestSession.status)),
                  }) : t('journalNoCheckinHint')}
                </Text>
              </>
            )}
          </View>
        ) : null}
      </View>}

      {error && report && <View style={styles.errorState}>
        <Text allowFontScaling style={styles.errorText}>{t('journalRefreshError')}</Text>
        <Pressable onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton} accessibilityRole="button"><Text allowFontScaling style={styles.retryText}>{t('journalRetry')}</Text></Pressable>
      </View>}

      {showAttention && report && !accessDenied && (
        <View style={styles.attentionSection}>
          {!attentionOnly && <Text allowFontScaling style={styles.attentionTitle}>{t('journalAttentionDays')}</Text>}
          {attentionSessions.length > 0 ? (
            attentionSessions.map((session) => {
              const status = normalizeStatus(session.status);
              const statusColors = isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status];
              return (
                <Pressable
                  key={`${session.id || session.date}`}
                  onPress={() => setSelectedSession(session)}
                  disabled={attentionOnly}
                  style={({ pressed }) => [
                    styles.attentionCard,
                    { borderColor: statusColors.border },
                    plain && styles.plain,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole={attentionOnly ? undefined : 'button'}
                  accessibilityLabel={t('journalDayAccessibility', {
                    day: formatDayMonth(session.date),
                    status: statusLabel(status),
                  })}
                >
                  <View style={styles.attentionCopy}>
                    <Text allowFontScaling style={[styles.attentionDate, { color: statusColors.foreground }]}>
                      {t('journalDateShort', { date: formatDayMonth(session.date) })}
                    </Text>
                    {session.summary ? (
                      <Text allowFontScaling style={styles.attentionSummary} numberOfLines={attentionOnly ? undefined : 1}>{session.summary}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.attentionStatusRow, { backgroundColor: statusColors.background }]}>
                    <Text allowFontScaling style={[styles.attentionStatus, { color: statusColors.foreground }]}>
                      {statusLabel(status)}
                    </Text>
                    {!plain && <Ionicons name="chevron-forward" size={18} color={statusColors.foreground} />}
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={[styles.noAttentionCard, plain && styles.plain]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primaryDark} />
              <Text allowFontScaling style={styles.noAttentionText}>
                {report?.checkinDays ? t('journalNoAttention') : t('journalNoEntries')}
              </Text>
            </View>
          )}
        </View>
      )}
      {attentionOnly && loading && !report && <View style={styles.attentionSection} accessibilityRole="progressbar" accessibilityLabel={t('journalLoading')}>
        {[0, 1, 2].map((index) => <View key={index} testID="journal-attention-loading" style={[styles.attentionCard, styles.loadingDay]} accessible={false} />)}
      </View>}
      {attentionOnly && error && !report && <View style={styles.errorState}>
        <Text allowFontScaling style={styles.errorText}>{accessDenied ? tc('healthAccessRequired') : t('journalLoadError')}</Text>
        <Pressable onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton} accessibilityRole="button"><Text allowFontScaling style={styles.retryText}>{t('journalRetry')}</Text></Pressable>
      </View>}

      {/* Details Sheet Modal */}
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
                  <Text allowFontScaling style={styles.sheetTitle}>
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
                      backgroundColor: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].background,
                      borderColor: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].border,
                    },
                  ]}>
                    <Text allowFontScaling style={[styles.statusPillText, { color: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].foreground }]}>
                      {statusLabel(selectedStatus)}
                    </Text>
                  </View>
                  {formatTime(selectedSession.createdAt) ? (
                    <Text allowFontScaling style={styles.reportedTime}>
                      {t('journalReportedAt', { time: formatTime(selectedSession.createdAt) })}
                    </Text>
                  ) : null}
                </View>

                {selectedDetails.length > 0 ? (
                  <View style={styles.detailBlock}>
                    <Text allowFontScaling style={styles.detailLabel}>{t('journalReportedDetails')}</Text>
                    <View style={styles.chipRow}>
                      {selectedDetails.map((detail) => (
                        <View key={detail} style={styles.detailChip}>
                          <Text allowFontScaling style={styles.detailChipText}>{detail}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {selectedSession.summary ? (
                  <Text allowFontScaling style={styles.summaryQuote}>“{selectedSession.summary}”</Text>
                ) : (
                  <Text allowFontScaling style={styles.summaryQuote}>{t('journalNoDetailSummary')}</Text>
                )}

                {selectedSession.resolved && selectedStatus !== 'fine' ? (
                  <View style={styles.resolvedRow}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primaryDark} />
                    <Text allowFontScaling style={styles.resolvedText}>{t('journalResolved')}</Text>
                  </View>
                ) : null}

                <View style={styles.reminderCard}>
                  <View style={styles.reminderTitleRow}>
                    <Ionicons name="heart-outline" size={17} color={colors.primaryDark} />
                    <Text allowFontScaling style={styles.reminderTitle}>{t('journalAsinuReminder')}</Text>
                  </View>
                  <Text allowFontScaling style={styles.reminderText}>
                    {subjectName
                      ? tc('memberJournalReminder', { name: subjectName })
                      : selectedStatus === 'fine'
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
  palette: ReturnType<typeof useThemeColors>['colors'],
  isDark: boolean,
) {
  return StyleSheet.create({
    section: { gap: 20 },
    plain: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, paddingHorizontal: 0 },
    card: {
      backgroundColor: isDark ? palette.surface : '#FDFFFE',
      borderRadius: 24, borderWidth: 1, borderColor: isDark ? palette.border : '#DFE9E3',
      paddingHorizontal: 12, paddingTop: 16, paddingBottom: 20,
    },
    monthHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'space-between', columnGap: 8, rowGap: 4, paddingHorizontal: 4, marginBottom: 16 },
    monthHeading: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4 },
    monthNavigation: { flexDirection: 'row', alignItems: 'center' },
    monthButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center',
      justifyContent: 'center', backgroundColor: 'transparent' },
    monthButtonDisabled: { opacity: 0.35 },
    monthTitle: { color: palette.textPrimary, fontSize: 20, fontWeight: '700', flexShrink: 1 },
    loadingIndicator: { width: 20, minHeight: 20 },
    loadingDay: { backgroundColor: isDark ? '#213B36' : '#E8F0EB', borderColor: 'transparent' },
    loadingLines: { gap: 10, width: '100%' },
    loadingLine: { height: 14, width: '90%', borderRadius: 7,
      backgroundColor: isDark ? '#213B36' : '#E8F0EB' },
    summaryCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border,
      marginTop: 20, paddingHorizontal: 4, paddingTop: 16, gap: 6 },
    summaryTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
    summaryMeta: { color: palette.textSecondary, fontSize: 13 },
    weekRow: { flexDirection: 'row', marginBottom: 8 },
    weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11.5,
      fontWeight: '600', color: palette.textSecondary },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
    daySlot: { width: '14.2857%', paddingHorizontal: 2 },
    dayCellBlank: { width: '100%', minHeight: 48 },
    dayCell: { width: '100%', minHeight: 48, borderRadius: 14,
      paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 2 },
    dayCellEmpty: { backgroundColor: 'transparent' },
    dayCellFuture: { opacity: 0.4 },
    dayCellToday: { backgroundColor: palette.primaryLight, borderWidth: 1.5, borderColor: palette.primaryText },
    dayCellTodayChecked: { borderWidth: 1.5, borderColor: palette.primaryText },
    dayCellSelected: { borderWidth: 2, borderColor: palette.textPrimary },
    dayText: { fontSize: 14, fontWeight: '600' },
    dayTextEmpty: { color: palette.textSecondary },
    dayTextToday: { color: palette.primaryText, fontWeight: '700' },
    dayMarker: { height: 12, alignItems: 'center', justifyContent: 'center' },
    missingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.textSecondary, opacity: 0.55 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12,
      marginTop: 24, paddingHorizontal: 4 },
    legendItem: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    legendItemWide: { width: '100%' },
    legendSwatch: { width: 20, height: 20, borderRadius: 7, flexShrink: 0,
      alignItems: 'center', justifyContent: 'center' },
    legendMissing: { backgroundColor: palette.surfaceMuted },
    legendToday: { borderWidth: 1.5, borderColor: palette.primaryText, backgroundColor: palette.primaryLight },
    legendText: { flex: 1, fontSize: 12, fontWeight: '500', color: palette.textSecondary },
    errorState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    errorText: { color: palette.textSecondary, fontSize: 14, textAlign: 'center' },
    retryButton: { minHeight: 44, justifyContent: 'center', backgroundColor: palette.primaryLight,
      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
    retryText: { color: palette.primaryText, fontSize: 14, fontWeight: '600' },
    attentionSection: { gap: 12 },
    attentionTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: '600', paddingHorizontal: 4 },
    attentionCard: { backgroundColor: isDark ? palette.surface : '#FDFFFE',
      alignItems: 'center', borderRadius: 20, borderWidth: 1, flexDirection: 'row',
      flexWrap: 'wrap', gap: 12, minHeight: 76, paddingHorizontal: 16, paddingVertical: 16 },
    attentionCopy: { flex: 1, minWidth: 120 },
    attentionDate: { fontSize: 15, fontWeight: '600' },
    attentionSummary: { color: palette.textSecondary, fontSize: 13, marginTop: 4 },
    attentionStatusRow: { alignItems: 'center', flexDirection: 'row', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, maxWidth: '100%' },
    attentionStatus: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
    noAttentionCard: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 16 },
    noAttentionText: { color: palette.textSecondary, flex: 1, fontSize: 14 },
    pressed: { opacity: 0.7 },
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: palette.overlay },
    sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      maxHeight: '86%', paddingHorizontal: 20, ...shadows.lg },
    sheetHandle: { alignSelf: 'center', backgroundColor: palette.border, borderRadius: 3,
      height: 5, marginBottom: 16, marginTop: 10, width: 40 },
    sheetContent: { gap: 20, paddingBottom: 24 },
    sheetHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    sheetTitle: { color: palette.textPrimary, flex: 1, fontSize: 22, fontWeight: '700' },
    closeButton: { alignItems: 'center', borderRadius: 16, height: 44, justifyContent: 'center', width: 44 },
    statusLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statusPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
    statusPillText: { fontSize: 14, fontWeight: '600' },
    reportedTime: { color: palette.textSecondary, fontSize: 14 },
    detailBlock: { gap: 10 },
    detailLabel: { color: palette.textSecondary, fontSize: 14, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailChip: { backgroundColor: palette.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
    detailChipText: { color: palette.textPrimary, fontSize: 14 },
    summaryQuote: { color: palette.textPrimary, fontSize: 16 },
    resolvedRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    resolvedText: { color: palette.primaryText, fontSize: 14, fontWeight: '600', flex: 1 },
    reminderCard: { backgroundColor: palette.primaryLight, borderRadius: 20, gap: 10, padding: 16 },
    reminderTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    reminderTitle: { color: palette.primaryText, fontSize: 14, fontWeight: '600', flex: 1 },
    reminderText: { color: palette.textPrimary, fontSize: 14 },
  });
}
