/**
 * Daily Health Check-in Screen — Asinu 4-Phase Flow
 *
 * Phase 1 — Initial Check-in: 4 options
 * Phase 2 — Clinical Interview (buổi sáng, lần đầu báo cáo không khoẻ)
 * Phase 3 — Follow-up Monitoring (định kỳ 1-4h): 3-layer Q&A
 * Phase 4 — Resolution / Escalation
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useModal } from '../../src/hooks/useModal';
import { checkinApi, type CheckinStatus, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

// ─── Status options (4 options) ───────────────────────────────────────────────

const STATUS_OPTIONS: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  labelKey: string;
  subKey: string;
  color: string;
  bg: string;
}> = [
  { status: 'fine',             icon: 'emoticon-happy-outline',    labelKey: 'statusFineLabel',     subKey: 'statusFineSub',     color: '#16a34a', bg: '#dcfce7' },
  { status: 'tired',            icon: 'emoticon-sad-outline',      labelKey: 'statusTiredLabel',    subKey: 'statusTiredSub',    color: '#d97706', bg: '#fef3c7' },
  { status: 'very_tired',       icon: 'emoticon-cry-outline',      labelKey: 'statusVeryTiredLabel', subKey: 'statusVeryTiredSub', color: '#dc2626', bg: '#fee2e2' },
  { status: 'specific_concern', icon: 'comment-question-outline',  labelKey: 'statusSpecificLabel', subKey: 'statusSpecificSub', color: '#7c3aed', bg: '#ede9fe' },
];

type Styles = ReturnType<typeof createStyles>;
type ScreenName = 'status' | 'triage' | 'done';

// ─── Main component ────────────────────────────────────────────────────────────

export default function CheckinScreen() {
  const { t } = useTranslation('checkin');
  const typography = useScaledTypography();
  const styles = useMemo(() => createStyles(typography), [typography]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ checkin_id?: string; mode?: string }>();
  const isFollowUp = params.mode === 'followup';
  const existingCheckinId = params.checkin_id ? parseInt(params.checkin_id) : null;
  const { showInfo, modal } = useModal();

  const [screen, setScreen]   = useState<ScreenName>('status');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<CheckinSession | null>(null);
  const [continuityMessage, setContinuityMessage] = useState<string | null>(null);

  const [answers, setAnswers]             = useState<Array<{ question: string; answer: string }>>([]);
  const [currentQ, setCurrentQ]           = useState<string>('');
  const [currentOpts, setCurrentOpts]     = useState<string[]>([]);
  const [triageSummary, setTriageSummary] = useState<{
    summary: string;
    severity: string;
    recommendation: string;
    needsDoctor: boolean;
    hasRedFlag: boolean;
    followUpHours?: number;
    closeMessage?: string;
    progression?: string;
  } | null>(null);

  // Load continuity message khi mở màn hình lần đầu
  useEffect(() => {
    if (!isFollowUp) {
      checkinApi.getToday().then(res => {
        if (res.continuityMessage) setContinuityMessage(res.continuityMessage);
      }).catch(() => {});
    }
  }, [isFollowUp]);

  const handleStatusSelect = useCallback(async (status: CheckinStatus) => {
    setLoading(true);
    try {
      let sess: CheckinSession;
      if (isFollowUp && existingCheckinId) {
        const res = await checkinApi.followUp(existingCheckinId, status);
        sess = res.session;
      } else {
        const res = await checkinApi.start(status);
        sess = res.session;
      }
      setSession(sess);
      if (status === 'fine') { setScreen('done'); return; }
      await fetchNextQuestion(sess, []);
      setScreen('triage');
    } catch {
      showInfo(t('errorTitle'), t('errorSaveStatus'));
    } finally {
      setLoading(false);
    }
  }, [isFollowUp, existingCheckinId, t]);

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: typeof answers) => {
    setLoading(true);
    try {
      const result = await checkinApi.triage(sess.id, prevAnswers);
      if (result.isDone) {
        setTriageSummary({
          summary:      result.summary || '',
          severity:     result.severity || 'medium',
          recommendation: result.recommendation || '',
          needsDoctor:  result.needsDoctor ?? false,
          hasRedFlag:   result.hasRedFlag ?? false,
          followUpHours: result.followUpHours,
          closeMessage: result.closeMessage,
          progression:  result.progression,
        });
        setScreen('done');
      } else {
        setCurrentQ(result.question || '');
        setCurrentOpts(result.options || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!session || !answer.trim()) return;
    const newAnswers = [...answers, { question: currentQ, answer: answer.trim() }];
    setAnswers(newAnswers);
    await fetchNextQuestion(session, newAnswers);
  };

  if (loading && screen === 'status') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      {modal}
      <Stack.Screen options={{
        headerShown: true,
        title: isFollowUp ? t('titleFollowUp') : t('titleCheckin'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {screen === 'status' && (
          <StatusScreen
            styles={styles}
            t={t}
            onSelect={handleStatusSelect}
            isFollowUp={isFollowUp}
            continuityMessage={continuityMessage}
          />
        )}
        {screen === 'triage' && (
          <TriageScreen
            styles={styles}
            t={t}
            typography={typography}
            question={currentQ}
            options={currentOpts}
            answers={answers}
            loading={loading}
            onAnswer={handleAnswer}
            isFollowUp={isFollowUp}
          />
        )}
        {screen === 'done' && (
          <DoneScreen
            styles={styles}
            t={t}
            session={session}
            triageSummary={triageSummary}
            onClose={() => router.back()}
          />
        )}
      </ScrollView>
    </>
  );
}

// ─── Status screen ────────────────────────────────────────────────────────────

function StatusScreen({
  styles, t, onSelect, isFollowUp, continuityMessage,
}: {
  styles: Styles;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
  continuityMessage: string | null;
}) {
  return (
    <View style={styles.section}>
      {/* Continuity Check Banner */}
      {continuityMessage ? (
        <View style={styles.continuityBanner}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.continuityText}>{continuityMessage}</Text>
        </View>
      ) : null}

      <Text style={styles.heading}>
        {isFollowUp ? t('headingFollowUp') : t('headingMorning')}
      </Text>
      <Text style={styles.subheading}>{t('chooseStatus')}</Text>

      <View style={styles.optionList}>
        {STATUS_OPTIONS.map(opt => (
          <Pressable
            key={opt.status}
            style={({ pressed }) => [
              styles.statusCard,
              { backgroundColor: opt.bg, borderColor: opt.color + '44' },
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => onSelect(opt.status)}
          >
            <MaterialCommunityIcons name={opt.icon} size={36} color={opt.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: opt.color }]}>{t(opt.labelKey)}</Text>
              <Text style={styles.statusSub}>{t(opt.subKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={opt.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Triage screen ────────────────────────────────────────────────────────────

function TriageScreen({
  styles, t, typography, question, options, answers, loading, onAnswer, isFollowUp,
}: {
  styles: Styles;
  t: (key: string, opts?: Record<string, unknown>) => string;
  typography: ReturnType<typeof useScaledTypography>;
  question: string;
  options: string[];
  answers: Array<{ question: string; answer: string }>;
  loading: boolean;
  onAnswer: (a: string) => void;
  isFollowUp: boolean;
}) {
  const [custom, setCustom] = useState('');
  const maxDots = isFollowUp ? 3 : 8;

  return (
    <View style={styles.section}>
      <View style={styles.progressDots}>
        {Array.from({ length: maxDots }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < answers.length && styles.dotFilled,
              i === answers.length && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <Text style={styles.questionCount}>{t('questionCount', { n: answers.length + 1 })}</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.subheading, { marginTop: 12 }]}>{t('analyzing')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.question}>{question}</Text>

          <View style={styles.optionList}>
            {options.map(opt => (
              <Pressable
                key={opt}
                style={({ pressed }) => [styles.optionChip, pressed && { opacity: 0.8 }]}
                onPress={() => onAnswer(opt)}
              >
                <Text style={styles.optionChipText}>{opt}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { fontSize: typography.size.md }]}
              placeholder={t('customAnswerPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={custom}
              onChangeText={setCustom}
              returnKeyType="send"
              onSubmitEditing={() => { if (custom.trim()) { onAnswer(custom); setCustom(''); } }}
            />
            <Pressable
              style={[styles.sendBtn, !custom.trim() && { opacity: 0.4 }]}
              disabled={!custom.trim()}
              onPress={() => { onAnswer(custom); setCustom(''); }}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({
  styles, t, session, triageSummary, onClose,
}: {
  styles: Styles;
  t: (key: string, opts?: Record<string, unknown>) => string;
  session: CheckinSession | null;
  triageSummary: {
    summary: string;
    severity: string;
    recommendation: string;
    needsDoctor: boolean;
    hasRedFlag: boolean;
    followUpHours?: number;
    closeMessage?: string;
    progression?: string;
  } | null;
  onClose: () => void;
}) {
  const isFine = session?.current_status === 'fine';
  const progression = triageSummary?.progression;

  const severityColor = triageSummary?.severity === 'high' ? '#dc2626'
    : triageSummary?.severity === 'medium' ? '#d97706' : '#16a34a';
  const severityLabel = triageSummary?.severity === 'high' ? t('severityHigh')
    : triageSummary?.severity === 'medium' ? t('severityMedium') : t('severityLow');

  // Câu kết follow-up
  const followUpText = triageSummary?.closeMessage
    || (triageSummary?.followUpHours
      ? t('followUpIn', { hours: triageSummary.followUpHours })
      : session?.flow_state === 'high_alert'
        ? t('followUpHighAlert')
        : t('followUpNormal'));

  // Màn hình red flag escalation
  if (triageSummary?.hasRedFlag) {
    return (
      <View style={styles.section}>
        <View style={styles.doneIcon}>
          <Ionicons name="warning" size={64} color="#dc2626" />
        </View>
        <Text style={styles.heading}>{t('redFlagTitle')}</Text>
        <Text style={[styles.subheading, { color: '#dc2626', fontWeight: '600' }]}>
          {triageSummary.summary}
        </Text>
        <View style={[styles.summaryCard, { borderColor: '#dc2626', backgroundColor: '#fff1f2' }]}>
          <Text style={styles.recommendationLabel}>{t('recommendationLabel')}</Text>
          <Text style={styles.recommendationText}>{triageSummary.recommendation}</Text>
          <View style={styles.doctorBanner}>
            <Ionicons name="medical" size={16} color="#dc2626" />
            <Text style={styles.doctorText}>{t('seeDoctor')}</Text>
          </View>
        </View>
        <Pressable style={[styles.closeBtn, { backgroundColor: '#dc2626' }]} onPress={onClose}>
          <Text style={styles.closeBtnText}>{t('redFlagAction')}</Text>
        </Pressable>
      </View>
    );
  }

  // Progression result (follow-up done)
  if (progression) {
    const progIcon: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
      improved: 'checkmark-circle',
      same:     'time-outline',
      worsened: 'trending-down-outline',
    };
    const progColor = progression === 'improved' ? '#16a34a'
      : progression === 'same' ? '#d97706' : '#dc2626';
    const progMsg = progression === 'improved' ? t('progressionImproved')
      : progression === 'same' ? t('progressionSame') : t('progressionWorsened');

    return (
      <View style={styles.section}>
        <View style={styles.doneIcon}>
          <Ionicons name={progIcon[progression] ?? 'information-circle'} size={64} color={progColor} />
        </View>
        <Text style={styles.heading}>{t('doneHeading')}</Text>
        <Text style={styles.subheading}>{progMsg}</Text>
        {triageSummary?.recommendation ? (
          <View style={styles.summaryCard}>
            <Text style={styles.recommendationLabel}>{t('recommendationLabel')}</Text>
            <Text style={styles.recommendationText}>{triageSummary.recommendation}</Text>
          </View>
        ) : null}
        <Text style={styles.followUpHint}>{followUpText}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>{t('close')}</Text>
        </Pressable>
      </View>
    );
  }

  // Normal done (fine or initial triage completed)
  return (
    <View style={styles.section}>
      <View style={styles.doneIcon}>
        {isFine
          ? <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          : triageSummary?.severity === 'high'
            ? <Ionicons name="warning" size={64} color="#dc2626" />
            : <Ionicons name="clipboard-outline" size={64} color="#d97706" />
        }
      </View>

      <Text style={styles.heading}>{isFine ? t('doneFineHeading') : t('doneHeading')}</Text>

      {isFine ? (
        <Text style={styles.subheading}>{t('doneFineSubheading')}</Text>
      ) : triageSummary && (
        <View style={styles.summaryCard}>
          <View style={[styles.severityBadge, { borderColor: severityColor }]}>
            <Ionicons name={triageSummary.severity === 'high' ? 'warning' : 'ellipse'} size={12} color={severityColor} />
            <Text style={[styles.severityBadgeText, { color: severityColor }]}>{severityLabel}</Text>
          </View>
          <Text style={styles.summaryText}>{triageSummary.summary}</Text>
          <View style={styles.divider} />
          <Text style={styles.recommendationLabel}>{t('recommendationLabel')}</Text>
          <Text style={styles.recommendationText}>{triageSummary.recommendation}</Text>
          {triageSummary.needsDoctor && (
            <View style={styles.doctorBanner}>
              <Ionicons name="medical" size={16} color="#dc2626" />
              <Text style={styles.doctorText}>{t('seeDoctor')}</Text>
            </View>
          )}
        </View>
      )}

      {!isFine && (
        <Text style={styles.followUpHint}>{followUpText}</Text>
      )}

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>{t('close')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    container:  { padding: spacing.xl },
    section:    { gap: spacing.lg },

    continuityBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    continuityText: {
      flex: 1,
      fontSize: typography.size.sm,
      color: colors.primary,
      lineHeight: 20,
      fontWeight: '500',
    },

    heading:    { fontSize: typography.size.xl, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    subheading: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

    optionList: { gap: spacing.md, marginTop: spacing.sm },

    statusCard: {
      flexDirection: 'row', alignItems: 'center',
      padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, gap: spacing.md,
    },
    statusLabel: { fontSize: typography.size.lg, fontWeight: '700' },
    statusSub:   { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },

    progressDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
    dot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
    dotFilled:    { backgroundColor: colors.primary },
    dotActive:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: -1.5 },

    questionCount: { fontSize: typography.size.xs, color: colors.textSecondary, textAlign: 'center' },
    question:      { fontSize: typography.size.lg, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 },

    optionChip: {
      paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
      borderRadius: radius.full, backgroundColor: colors.primaryLight,
      borderWidth: 1, borderColor: colors.primary + '44',
    },
    optionChipText: { fontSize: typography.size.md, fontWeight: '600', color: colors.primary },

    customRow:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    customInput: {
      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      color: colors.textPrimary, backgroundColor: colors.surface,
    },
    sendBtn: {
      backgroundColor: colors.primary, borderRadius: radius.md,
      paddingHorizontal: 14, justifyContent: 'center',
    },

    doneIcon: { alignItems: 'center', marginBottom: spacing.sm },

    summaryCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
    },
    severityBadge: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      gap: 4, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3,
    },
    severityBadgeText:   { fontSize: typography.size.xs, fontWeight: '700' },
    summaryText:         { fontSize: typography.size.md, fontWeight: '600', color: colors.textPrimary },
    divider:             { height: 1, backgroundColor: colors.border },
    recommendationLabel: { fontSize: typography.size.xs, fontWeight: '700', color: colors.textSecondary },
    recommendationText:  { fontSize: typography.size.sm, color: colors.textPrimary, lineHeight: 22 },

    doctorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: '#fee2e2', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs,
    },
    doctorText:  { fontSize: typography.size.xs, color: '#dc2626', fontWeight: '600', flex: 1 },

    followUpHint: {
      fontSize: typography.size.sm,
      color: colors.primary,
      textAlign: 'center',
      lineHeight: 20,
      fontWeight: '500',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      padding: spacing.md,
    },

    closeBtn:     { backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
    closeBtnText: { color: '#fff', fontSize: typography.size.md, fontWeight: '700' },
  });
}
