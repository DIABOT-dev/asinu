import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HealthTreeStatusCard } from '../../src/components/HealthTreeStatusCard';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { SkeletonBlock as Skeleton } from '../../src/components/state/Skeleton';
import { StateError } from '../../src/components/state/StateError';
import { checkinApi, type CheckinSession, type HealthScoreData } from '../../src/features/checkin/checkin.api';
import { getCheckinAnswers, getRecentHealthReadings } from '../../src/features/checkin/health-status-details';
import { logsApi } from '../../src/features/logs/logs.api';
import type { LogEntry } from '../../src/features/logs/logs.store';
import { useGuardedRouter } from '../../src/hooks/useGuardedRouter';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { spacing } from '../../src/styles';

type Details = {
  score: HealthScoreData;
  session: CheckinSession | null;
  logs: LogEntry[];
  sessionFailed: boolean;
  logsFailed: boolean;
};

const STATUS_LABELS = {
  fine: 'healthStatusReportedFine',
  tired: 'healthStatusReportedTired',
  very_tired: 'healthStatusReportedVeryTired',
  specific_concern: 'healthStatusReportedConcern',
};

export default function HealthStatusDetailsScreen() {
  const { t, i18n } = useTranslation('home');
  const { colors } = useThemeColors();
  const typography = useScaledTypography();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.allSettled([
      checkinApi.getHealthScore(),
      checkinApi.getToday(),
      logsApi.fetchRecent({ signal: controller.signal }),
    ]).then(([score, session, logs]) => {
      if (!active) {
        return;
      }
      if (score.status === 'rejected') {
        setError(true);
      } else {
        setDetails({
          score: score.value,
          session: session.status === 'fulfilled' ? session.value.session : null,
          logs: logs.status === 'fulfilled' ? logs.value : [],
          sessionFailed: session.status === 'rejected',
          logsFailed: logs.status === 'rejected',
        });
      }
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
    // Retrying replaces the focus callback and cancels its preceding request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]));

  const retry = () => setRetryKey(value => value + 1);
  const session = details?.session ?? null;
  const answers = getCheckinAnswers(session);
  const readings = getRecentHealthReadings(details?.logs ?? []);
  const summary = session?.triage_summary?.trim();
  const statusKey = session && STATUS_LABELS[session.current_status];
  const recordedTime = (value: string) => new Date(value).toLocaleString(
    i18n.language.startsWith('vi') ? 'vi-VN' : 'en-US',
    { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' },
  );
  const partialError = (message: string) => (
    <View style={styles.partialError}>
      <Text style={styles.body}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
        <Text style={styles.link}>{t('healthStatusRetry')}</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenBackButton onPress={() => router.canGoBack() ? router.back() : router.replace('/tree')} />
        <Text accessibilityRole="header" style={styles.pageTitle}>{t('healthStatusDetailsTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {loading ? (
          <View style={styles.loading}>
            <Skeleton height={116} />
            <Skeleton height={180} />
            <Skeleton height={100} />
          </View>
        ) : error ? (
          <StateError message={t('healthStatusLoadError')} onRetry={retry} />
        ) : details ? (
          <>
            <HealthTreeStatusCard score={details.score} showDetails={false} />

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('healthStatusCheckinTitle')}</Text>
              </View>
              {details.sessionFailed ? partialError(t('healthStatusCheckinError')) : session ? (
                <>
                  {statusKey ? <Text style={styles.body}>{t('healthStatusReported', { status: t(statusKey) })}</Text> : null}
                  {summary ? <Text style={styles.body}>{summary}</Text> : null}
                  {answers.length > 0 ? answers.map((answer, index) => (
                    <View key={index} style={styles.answerRow}>
                      <Text style={styles.question}>{answer.question}</Text>
                      <Text style={styles.body}>{answer.answer}</Text>
                    </View>
                  )) : !summary ? <Text style={styles.secondary}>{t('healthStatusNoAnswers')}</Text> : null}
                </>
              ) : <Text style={styles.secondary}>{t('healthStatusNoCheckinDetail')}</Text>}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Ionicons name="pulse-outline" size={22} color={colors.primary} />
                <Text accessibilityRole="header" style={styles.sectionTitle}>{t('healthStatusReadingsTitle')}</Text>
              </View>
              <Text style={styles.secondary}>{t('healthStatusReadingsHint')}</Text>
              {details.logsFailed ? partialError(t('healthStatusReadingsError')) : readings.length > 0 ? readings.map(reading => (
                <View key={reading.type} style={styles.readingRow}>
                  <View style={styles.readingLabel}>
                    <Text style={styles.question}>{t(reading.labelKey)}</Text>
                    <Text style={styles.secondary}>{t('healthStatusRecordedAt', { time: recordedTime(reading.recordedAt) })}</Text>
                  </View>
                  <Text style={styles.readingValue}>{t('healthStatusReadingValue', { value: reading.value, unit: reading.unit })}</Text>
                </View>
              )) : <Text style={styles.secondary}>{t('healthStatusNoRecentReadings')}</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>['colors'], typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    pageTitle: { flex: 1, fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
    content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xl },
    loading: { gap: spacing.lg },
    section: { gap: spacing.md },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sectionTitle: { flex: 1, fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    body: { fontSize: typography.size.sm, lineHeight: Math.round(typography.size.sm * 1.6), color: colors.textPrimary },
    secondary: { fontSize: typography.size.sm, lineHeight: Math.round(typography.size.sm * 1.5), color: colors.textSecondary },
    answerRow: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    question: { fontSize: typography.size.sm, lineHeight: Math.round(typography.size.sm * 1.5), fontWeight: '600', color: colors.textPrimary },
    readingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    readingLabel: { flexGrow: 1, flexBasis: 160, gap: spacing.xs },
    readingValue: { fontSize: typography.size.md, fontWeight: '700', color: colors.textPrimary },
    partialError: { gap: spacing.xs },
    retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
    link: { fontSize: typography.size.sm, fontWeight: '600', color: colors.primary },
  });
}
