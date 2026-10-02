import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { HealthReportData } from '../features/checkin/checkin.api';
import { checkinApi } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { radius, shadows, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

const LEAF_DECO = require('../../assets/images/profile/footer_leaf_left.png');

type JournalSession = HealthReportData['sessions'][number];
type JournalStatus = 'fine' | 'tired' | 'very_tired' | 'specific_concern';

type Props = {
  refreshKey?: number;
};

const STATUS_COLORS: Record<JournalStatus, { background: string; foreground: string; border: string }> = {
  fine: { background: '#dcfce7', foreground: '#065f46', border: '#a7f3d0' },
  tired: { background: '#fef3c7', foreground: '#92400e', border: '#fde68a' },
  very_tired: { background: '#fee2e2', foreground: '#991b1b', border: '#fca5a5' },
  specific_concern: { background: '#f3e8ff', foreground: '#6b21a8', border: '#d8b4fe' },
};

const DARK_STATUS_COLORS: Record<JournalStatus, { background: string; foreground: string; border: string }> = {
  fine: { background: '#064e3b', foreground: '#a7f3d0', border: '#047857' },
  tired: { background: '#78350f', foreground: '#fde68a', border: '#b45309' },
  very_tired: { background: '#7f1d1d', foreground: '#fecaca', border: '#b91c1c' },
  specific_concern: { background: '#581c87', foreground: '#e9d5ff', border: '#7e22ce' },
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

function CalendarHeartIcon({ color = '#059669', size = 36 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      {/* Calendar body */}
      <Rect x="4" y="7" width="28" height="25" rx="6" stroke={color} strokeWidth="2.2" />
      {/* Top rings */}
      <Line x1="10" y1="4" x2="10" y2="9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="26" y1="4" x2="26" y2="9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Heart */}
      <Path
        d="M18 25.5l-5-4.6c-2.6-2.4-1.8-6 1.4-6 1.7 0 3.1 1 3.6 2.2.5-1.2 1.9-2.2 3.6-2.2 3.2 0 4 3.6 1.4 6L18 25.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Pulse line passing through heart */}
      <Path
        d="M9 20.5h3.5l1.6-3.2 2.6 5.8 1.8-3.4 1.2 1.8h7.3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
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
      <View style={styles.card}>
        {/* Month Navigation */}
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setMonth((value) => shiftMonth(value, -1))}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('journalPreviousMonth')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={isDark ? '#34d399' : '#059669'} />
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
              size={20}
              color={canMoveNext ? (isDark ? '#34d399' : '#059669') : (isDark ? '#475569' : '#cbd5e1')}
            />
          </Pressable>
        </View>

        {/* Summary Card */}
        {loading || hasMonthCheckins ? (
          <View style={styles.summaryCard}>
            <CalendarHeartIcon color={isDark ? '#34d399' : '#059669'} size={38} />
            <View style={styles.summaryContent}>
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
            </View>
            <Image
              source={LEAF_DECO}
              style={styles.summaryLeafDeco}
              contentFit="contain"
              pointerEvents="none"
            />
          </View>
        ) : null}

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
            {/* Weekdays */}
            <View style={styles.weekRow}>
              {WEEKDAY_KEYS.map((key) => (
                <Text key={key} style={styles.weekday}>{t(key)}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {calendarSlots.map((day, index) => {
                if (day === null) {
                  return (
                    <View key={`blank-${index}`} style={styles.daySlot}>
                      <View style={styles.dayCellBlank} />
                    </View>
                  );
                }
                const dateKey = toDateKey(month.getFullYear(), month.getMonth(), day);
                const session = sessionsByDate.get(dateKey);
                const status = session ? normalizeStatus(session.status) : null;
                const statusColors = status ? (isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status]) : null;
                const isToday = dateKey === todayKey;
                const isSelected = selectedSession?.date.slice(0, 10) === dateKey;

                return (
                  <View key={dateKey} style={styles.daySlot}>
                    <Pressable
                      onPress={() => session && setSelectedSession(session)}
                      disabled={!session}
                      accessibilityRole={session ? 'button' : undefined}
                      accessibilityLabel={
                        session
                          ? t('journalDayAccessibility', { day, status: statusLabel(status!) })
                          : t('journalMissingDayAccessibility', { day })
                      }
                      style={({ pressed }) => [
                        styles.dayCell,
                        !statusColors && !isToday && styles.dayCellEmpty,
                        statusColors && {
                          backgroundColor: statusColors.background,
                        },
                        isToday && (statusColors ? styles.dayCellTodayChecked : styles.dayCellToday),
                        isSelected && styles.dayCellSelected,
                        pressed && session && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          statusColors && { color: statusColors.foreground },
                          !statusColors && styles.dayTextEmpty,
                          isToday && !statusColors && styles.dayTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              {(['fine', 'tired', 'very_tired', 'specific_concern'] as JournalStatus[]).map((status) => {
                const itemColors = isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status];
                return (
                  <View key={status} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: itemColors.background }]} />
                    <Text
                      style={styles.legendText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {statusLabel(status)}
                    </Text>
                  </View>
                );
              })}
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
              const statusColors = isDark ? DARK_STATUS_COLORS[status] : STATUS_COLORS[status];
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
                      backgroundColor: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].background,
                      borderColor: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].border,
                    },
                  ]}>
                    <Text style={[styles.statusPillText, { color: (isDark ? DARK_STATUS_COLORS : STATUS_COLORS)[selectedStatus].foreground }]}>
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
    card: {
      backgroundColor: isDark ? palette.surface : '#ffffff',
      borderRadius: 32,
      borderWidth: 1,
      borderColor: isDark ? palette.border : '#f1f5f9',
      padding: 16,
      paddingTop: 18,
      paddingBottom: 22,
      ...shadows.sm,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    monthButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
    },
    monthButtonDisabled: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      opacity: 0.6,
    },
    monthTitle: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 22,
      fontWeight: '800',
    },
    summaryCard: {
      backgroundColor: isDark ? '#064e3b18' : '#f0fbf7',
      borderColor: isDark ? '#064e3b' : '#d1fae5',
      borderRadius: 24,
      borderWidth: 1,
      minHeight: 104,
      paddingHorizontal: 18,
      paddingVertical: 16,
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryContent: {
      flex: 1,
      marginLeft: 14,
      paddingRight: 40,
      zIndex: 2,
    },
    summaryTitle: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    summaryMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10b981',
    },
    summaryMeta: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: 13.5,
      fontWeight: '500',
    },
    summaryLeafDeco: {
      position: 'absolute',
      right: 6,
      bottom: -4,
      width: 76,
      height: 76,
      opacity: isDark ? 0.3 : 0.6,
      zIndex: 1,
    },
    weekRow: {
      flexDirection: 'row',
      marginTop: 18,
      marginBottom: 10,
    },
    weekday: {
      width: '14.2857%',
      textAlign: 'center',
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#94a3b8' : '#64748b',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
      rowGap: 4,
    },
    daySlot: {
      width: '14.2857%',
      padding: 4,
    },
    dayCellBlank: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: isDark ? '#1e293b30' : '#f8fafc',
    },
    dayCell: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellEmpty: {
      backgroundColor: isDark ? palette.surface : '#ffffff',
      borderWidth: 1,
      borderColor: isDark ? palette.border : '#f1f5f9',
    },
    dayCellToday: {
      backgroundColor: isDark ? palette.surface : '#ffffff',
      borderWidth: 2,
      borderColor: '#059669',
      borderStyle: 'dashed',
    },
    dayCellTodayChecked: {
      borderWidth: 2,
      borderColor: '#059669',
    },
    dayCellSelected: {
      borderWidth: 2.5,
      borderColor: palette.textPrimary,
      transform: [{ scale: 1.04 }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    dayText: {
      fontSize: 16,
      fontWeight: '700',
    },
    dayTextEmpty: {
      color: isDark ? '#94a3b8' : '#475569',
      fontWeight: '600',
    },
    dayTextToday: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontWeight: '800',
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginTop: 22,
      paddingHorizontal: 4,
    },
    legendItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 2,
    },
    legendSwatch: {
      width: 22,
      height: 18,
      borderRadius: 6,
    },
    legendMissing: {
      backgroundColor: 'transparent',
      borderColor: isDark ? '#475569' : '#cbd5e1',
      borderStyle: 'dashed',
      borderWidth: 1.5,
    },
    legendText: {
      width: '100%',
      fontSize: 11.5,
      fontWeight: '600',
      color: isDark ? '#94a3b8' : '#475569',
      marginTop: 6,
      textAlign: 'center',
    },
    errorState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    errorText: {
      color: palette.textSecondary,
      fontSize: typography.size.sm,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: palette.primaryLight,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
    },
    retryText: {
      color: palette.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    attentionSection: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    attentionTitle: {
      color: palette.textPrimary,
      fontSize: typography.size.sm,
      fontWeight: '800',
      paddingHorizontal: spacing.xs,
    },
    attentionCard: {
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
      minHeight: 72,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    attentionDate: {
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    attentionSummary: {
      color: palette.textSecondary,
      fontSize: typography.size.xxs,
      marginTop: 3,
      maxWidth: 210,
    },
    attentionStatusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
    },
    attentionStatus: {
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    noAttentionCard: {
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
    },
    noAttentionText: {
      color: palette.textSecondary,
      flex: 1,
      fontSize: typography.size.sm,
    },
    pressed: {
      opacity: 0.72,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: palette.overlay,
    },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      maxHeight: '82%',
      paddingHorizontal: spacing.xl,
      ...shadows.lg,
    },
    sheetHandle: {
      alignSelf: 'center',
      backgroundColor: isDark ? '#46505e' : '#d5dadd',
      borderRadius: 3,
      height: 5,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
      width: 46,
    },
    sheetContent: {
      gap: spacing.lg,
      paddingBottom: spacing.xl,
    },
    sheetHeaderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    sheetTitle: {
      color: palette.textPrimary,
      flex: 1,
      fontSize: typography.size.lg,
      fontWeight: '800',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: palette.surfaceMuted,
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    statusLine: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statusPill: {
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    statusPillText: {
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    reportedTime: {
      color: palette.textSecondary,
      fontSize: typography.size.sm,
    },
    detailBlock: {
      gap: spacing.sm,
    },
    detailLabel: {
      color: palette.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    detailChip: {
      backgroundColor: palette.surfaceMuted,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
    },
    detailChipText: {
      color: palette.textPrimary,
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    summaryQuote: {
      color: palette.textPrimary,
      fontSize: typography.size.sm,
      fontStyle: 'italic',
      lineHeight: 23,
    },
    resolvedRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    resolvedText: {
      color: palette.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    reminderCard: {
      backgroundColor: palette.primaryLight,
      borderRadius: radius.xl,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    reminderTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    reminderTitle: {
      color: palette.primaryDark,
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    reminderText: {
      color: palette.textPrimary,
      fontSize: typography.size.sm,
      lineHeight: 23,
    },
  });
}
