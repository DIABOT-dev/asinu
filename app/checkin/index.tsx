/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → triage 3-5 questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { checkinApi, type CheckinStatus, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

const MAX_TRIAGE_QUESTIONS = 5;

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  labelKey: string;
  sublabelKey: string;
  color: string;
  bg: string;
  gradient: [string, string];
}> = [
  {
    status: 'fine',
    icon: 'emoticon-happy-outline',
    labelKey: 'checkinFine',
    sublabelKey: 'checkinFineSub',
    color: '#16a34a',
    bg: '#f0fdf4',
    gradient: ['#dcfce7', '#f0fdf4'],
  },
  {
    status: 'tired',
    icon: 'emoticon-sad-outline',
    labelKey: 'checkinTired',
    sublabelKey: 'checkinTiredSub',
    color: '#d97706',
    bg: '#fffbeb',
    gradient: ['#fef3c7', '#fffbeb'],
  },
  {
    status: 'very_tired',
    icon: 'emoticon-cry-outline',
    labelKey: 'checkinVeryTired',
    sublabelKey: 'checkinVeryTiredSub',
    color: '#dc2626',
    bg: '#fef2f2',
    gradient: ['#fee2e2', '#fef2f2'],
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

type Screen = 'status' | 'triage' | 'done';

export default function CheckinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const params = useLocalSearchParams<{ checkin_id?: string; mode?: string }>();
  const isFollowUp = params.mode === 'followup';
  const existingCheckinId = params.checkin_id ? parseInt(params.checkin_id) : null;

  const [screen, setScreen]       = useState<Screen>('status');
  const [loading, setLoading]     = useState(false);
  const [session, setSession]     = useState<CheckinSession | null>(null);

  // Triage state
  const [answers, setAnswers]      = useState<Array<{ question: string; answer: string }>>([]);
  const [currentQ, setCurrentQ]    = useState<string>('');
  const [currentOpts, setCurrentOpts] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState('');
  const [triageSummary, setTriageSummary] = useState<{
    summary: string; severity: string; recommendation: string; needsDoctor: boolean;
  } | null>(null);

  // ─── Status select ─────────────────────────────────────────────────────────

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

      if (status === 'fine') {
        setScreen('done');
        return;
      }

      // Start triage for tired/very_tired
      await fetchNextQuestion(sess, []);
      setScreen('triage');
    } catch {
      showAlert(t('error', { ns: 'common' }), t('checkinError'));
    } finally {
      setLoading(false);
    }
  }, [isFollowUp, existingCheckinId]);

  // ─── Triage ────────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (sess: CheckinSession, prevAnswers: typeof answers) => {
    setLoading(true);
    try {
      const result = await checkinApi.triage(sess.id, prevAnswers);
      if (result.isDone) {
        setTriageSummary({
          summary: result.summary || '',
          severity: result.severity || 'medium',
          recommendation: result.recommendation || '',
          needsDoctor: result.needsDoctor ?? false,
        });
        setScreen('done');
      } else {
        setCurrentQ(result.question || '');
        setCurrentOpts(result.options || []);
        setCustomAnswer('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!session || !answer.trim()) return;
    const newAnswers = [...answers, { question: currentQ, answer: answer.trim() }];
    setAnswers(newAnswers);

    // Hard limit on frontend — force done if we've asked enough
    if (newAnswers.length >= MAX_TRIAGE_QUESTIONS) {
      setTriageSummary({
        summary: '',
        severity: 'medium',
        recommendation: '',
        needsDoctor: false,
      });
      setScreen('done');
      // Still send final answers to backend to save
      checkinApi.triage(session.id, newAnswers).catch(() => {});
      return;
    }

    await fetchNextQuestion(session, newAnswers);
  };

  // ─── Render screens ────────────────────────────────────────────────────────

  if (loading && screen === 'status') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: isFollowUp ? t('checkinHeaderFollowUp') : t('checkinHeaderTitle'),
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      }} />
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {screen === 'status' && <StatusScreen styles={styles} onSelect={handleStatusSelect} isFollowUp={isFollowUp} />}
        {screen === 'triage' && (
          <TriageScreen
            styles={styles}
            question={currentQ}
            options={currentOpts}
            answers={answers}
            loading={loading}
            onAnswer={handleAnswer}
          />
        )}
        {screen === 'done' && (
          <DoneScreen
            styles={styles}
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

type Styles = ReturnType<typeof createStyles>;

function StatusScreen({
  styles,
  onSelect,
  isFollowUp,
}: {
  styles: Styles;
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
}) {
  const { t } = useTranslation('home');

  const getGreeting = () => {
    if (isFollowUp) return t('checkinGreetingFollowUp');
    const h = new Date().getHours();
    if (h < 12) return t('checkinGreetingMorning');
    if (h < 18) return t('checkinGreetingAfternoon');
    return t('checkinGreetingEvening');
  };

  return (
    <View style={styles.section}>
      {/* Asinu avatar */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.statusAvatarWrap}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.statusAvatar}
        >
          <Ionicons name="heart" size={28} color="#fff" />
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Text style={styles.heading}>{getGreeting()}</Text>
        <Text style={styles.subheading}>{t('checkinSubheading')}</Text>
      </Animated.View>

      <View style={styles.optionList}>
        {STATUS_OPTIONS.map((opt, idx) => (
          <Animated.View key={opt.status} entering={FadeInDown.delay(200 + idx * 80).duration(400)}>
            <Pressable
              style={({ pressed }) => [
                styles.statusCard,
                { borderColor: opt.color + '44' },
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => onSelect(opt.status)}
            >
              <LinearGradient
                colors={opt.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.statusIconCircle, { backgroundColor: opt.color + '1a' }]}>
                <MaterialCommunityIcons name={opt.icon} size={28} color={opt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: opt.color }]}>{t(opt.labelKey)}</Text>
                <Text style={styles.statusSub}>{t(opt.sublabelKey)}</Text>
              </View>
              <View style={[styles.statusArrow, { backgroundColor: opt.color + '15' }]}>
                <Ionicons name="chevron-forward" size={18} color={opt.color} />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── Triage screen ────────────────────────────────────────────────────────────

function TriageScreen({
  styles,
  question,
  options,
  answers,
  loading,
  onAnswer,
}: {
  styles: Styles;
  question: string;
  options: string[];
  answers: Array<{ question: string; answer: string }>;
  loading: boolean;
  onAnswer: (a: string) => void;
}) {
  const { t } = useTranslation('home');
  const [custom, setCustom] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  const progress = (answers.length + 1) / MAX_TRIAGE_QUESTIONS;

  const toggleOption = (opt: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  };

  const handleConfirm = () => {
    const parts: string[] = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    if (parts.length === 0) return;
    const combined = parts.join(', ');
    onAnswer(combined);
    setSelected(new Set());
    setCustom('');
  };

  const hasSelection = selected.size > 0 || custom.trim().length > 0;

  return (
    <View style={styles.section}>
      {/* Slim progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]}
        />
      </View>

      {/* Conversation history */}
      <View style={styles.chatArea}>
        {answers.map((a, i) => (
          <View key={i}>
            {/* AI question */}
            <Animated.View entering={FadeInLeft.delay(i * 30).duration(300)} style={styles.aiMsgRow}>
              <View style={styles.aiAvatarSmall}>
                <Ionicons name="heart" size={12} color="#fff" />
              </View>
              <View style={styles.aiBubble}>
                <Text style={styles.aiBubbleText}>{a.question}</Text>
              </View>
            </Animated.View>
            {/* User answer */}
            <Animated.View entering={FadeInRight.delay(i * 30 + 50).duration(300)} style={styles.userMsgRow}>
              <View style={styles.userAnswerCard}>
                {a.answer.split(', ').map((item, j) => (
                  <View key={j} style={styles.userAnswerTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.userAnswerTagText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        ))}

        {loading ? (
          <Animated.View entering={FadeInLeft.duration(300)} style={styles.aiMsgRow}>
            <View style={styles.aiAvatarSmall}>
              <Ionicons name="heart" size={12} color="#fff" />
            </View>
            <View style={styles.aiBubble}>
              <View style={styles.typingRow}>
                <View style={[styles.typingDot, { opacity: 0.8 }]} />
                <View style={[styles.typingDot, { opacity: 0.5 }]} />
                <View style={[styles.typingDot, { opacity: 0.3 }]} />
              </View>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Current AI question */}
            <Animated.View entering={FadeInLeft.duration(400)} style={styles.aiMsgRow}>
              <View style={styles.aiAvatar}>
                <Ionicons name="heart" size={16} color="#fff" />
              </View>
              <View style={styles.currentQuestionBubble}>
                <Text style={styles.currentQuestionText}>{question}</Text>
              </View>
            </Animated.View>

            {/* Hint */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.selectHintWrap}>
              <Ionicons name="hand-left-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.selectHintText}>{t('checkinSelectHint')}</Text>
            </Animated.View>

            {/* Multi-select option cards */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.optionsWrap}>
              {options.map((opt) => {
                const isSelected = selected.has(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => toggleOption(opt)}
                  >
                    <View style={[styles.optionCheckbox, isSelected && styles.optionCheckboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.optionCardText, isSelected && styles.optionCardTextSelected]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>

            {/* Custom text input */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.inputRow}>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder={t('checkinCustomPlaceholder')}
                  placeholderTextColor={colors.textSecondary + '77'}
                  value={custom}
                  onChangeText={setCustom}
                  returnKeyType="done"
                />
              </View>
            </Animated.View>

            {/* Confirm button */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.confirmWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !hasSelection && styles.confirmBtnDisabled,
                  pressed && hasSelection && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                ]}
                disabled={!hasSelection}
                onPress={handleConfirm}
              >
                <LinearGradient
                  colors={hasSelection ? [colors.primary, colors.primaryDark] : [colors.border, colors.border]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmBtnGradient}
                >
                  <Text style={[styles.confirmBtnText, !hasSelection && { color: colors.textSecondary }]}>
                    {t('checkinConfirmSelection')}
                    {selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={hasSelection ? '#fff' : colors.textSecondary}
                  />
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({
  styles,
  session,
  triageSummary,
  onClose,
}: {
  styles: Styles;
  session: CheckinSession | null;
  triageSummary: { summary: string; severity: string; recommendation: string; needsDoctor: boolean } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('home');
  const isFine = session?.current_status === 'fine';

  const severityColor = triageSummary?.severity === 'high' ? '#dc2626'
    : triageSummary?.severity === 'medium' ? '#d97706' : '#16a34a';
  const severityIcon = triageSummary?.severity === 'high' ? 'alert-circle' : triageSummary?.severity === 'medium' ? 'information-circle' : 'checkmark-circle';
  const severityBg = triageSummary?.severity === 'high' ? '#fef2f2' : triageSummary?.severity === 'medium' ? '#fffbeb' : '#f0fdf4';

  return (
    <View style={styles.section}>
      {/* Hero icon */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.doneHero}>
        <View style={[styles.doneCircleOuter, { backgroundColor: isFine ? '#dcfce7' : severityBg }]}>
          <View style={[styles.doneCircleInner, { backgroundColor: isFine ? '#16a34a' : severityColor }]}>
            {isFine
              ? <Ionicons name="checkmark" size={36} color="#fff" />
              : <Ionicons name={severityIcon as any} size={36} color="#fff" />
            }
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <Text style={styles.heading}>
          {isFine ? t('checkinDoneGreat') : t('checkinDoneNoted')}
        </Text>
      </Animated.View>

      {isFine ? (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.fineCard}>
          <View style={styles.fineIconWrap}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.fineCardText}>{t('checkinDoneFineSub')}</Text>
        </Animated.View>
      ) : triageSummary && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <View style={[styles.resultCard, { borderColor: severityColor + '33' }]}>
            {/* Severity strip */}
            <View style={[styles.severityStrip, { backgroundColor: severityColor }]} />

            <View style={styles.resultBody}>
              {/* Badge */}
              <View style={[styles.severityBadge, { backgroundColor: severityBg }]}>
                <Ionicons name={severityIcon as any} size={14} color={severityColor} />
                <Text style={[styles.severityBadgeText, { color: severityColor }]}>
                  {triageSummary.severity === 'high' ? t('checkinSeverityHigh')
                    : triageSummary.severity === 'medium' ? t('checkinSeverityMedium') : t('checkinSeverityLow')}
                </Text>
              </View>

              {/* Summary */}
              {triageSummary.summary ? (
                <Text style={styles.resultSummary}>{triageSummary.summary}</Text>
              ) : null}

              {/* Recommendation */}
              {triageSummary.recommendation ? (
                <View style={styles.adviceWrap}>
                  <View style={styles.adviceHeader}>
                    <Ionicons name="bulb-outline" size={16} color={colors.premium} />
                    <Text style={styles.adviceLabel}>{t('checkinAdvice')}</Text>
                  </View>
                  <Text style={styles.adviceText}>{triageSummary.recommendation}</Text>
                </View>
              ) : null}

              {/* Doctor banner */}
              {triageSummary.needsDoctor && (
                <View style={styles.doctorBanner}>
                  <View style={styles.doctorIcon}>
                    <Ionicons name="medical" size={14} color="#fff" />
                  </View>
                  <Text style={styles.doctorText}>{t('checkinSeeDoctor')}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {!isFine && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.followCard}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.followText}>
            {session?.flow_state === 'high_alert'
              ? t('checkinFollowUpHigh')
              : t('checkinFollowUpNormal')}
          </Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={onClose}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.doneBtnGradient}
          >
            <Text style={styles.doneBtnText}>{t('checkinClose')}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    container: { padding: spacing.xl },
    section: { gap: spacing.lg },

    heading: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subheading: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 4,
    },

    optionList: { gap: spacing.md, marginTop: spacing.sm },

    // ── Status screen ──
    statusAvatarWrap: { alignItems: 'center' },
    statusAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      gap: spacing.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    statusIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusLabel: { fontSize: typography.size.md, fontWeight: '700' },
    statusSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    statusArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Triage / chat ──
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border + '55',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: colors.primary,
    },

    chatArea: { gap: spacing.sm },

    // AI messages (left)
    aiMsgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      maxWidth: '88%',
    },
    aiAvatarSmall: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + '88',
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiBubble: {
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderTopLeftRadius: 4,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    aiBubbleText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // User messages (right)
    userMsgRow: {
      alignItems: 'flex-end',
      marginLeft: 36,
    },
    userAnswerCard: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderBottomRightRadius: 4,
      maxWidth: '90%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    userAnswerTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    userAnswerTagText: {
      fontSize: typography.size.xs,
      color: '#fff',
      fontWeight: '600',
      lineHeight: 18,
    },

    // Typing indicator
    typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
    typingDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.primary,
    },

    // Current question (bigger, emphasized)
    currentQuestionBubble: {
      flex: 1,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.xl,
      borderTopLeftRadius: 4,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    currentQuestionText: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 26,
    },

    // Select hint
    selectHintWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 40,
      marginTop: 2,
    },
    selectHintText: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
    },

    // Multi-select option cards
    optionsWrap: {
      gap: spacing.sm,
      marginTop: spacing.xs,
      paddingLeft: 36,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    optionCardSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.1,
    },
    optionCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionCheckboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionCardText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    optionCardTextSelected: {
      color: colors.primary,
    },

    // Custom text input
    inputRow: {
      marginTop: spacing.sm,
      paddingLeft: 36,
    },
    inputWrap: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    input: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },

    // Confirm button
    confirmWrap: {
      paddingLeft: 36,
      marginTop: spacing.sm,
    },
    confirmBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    confirmBtnDisabled: {
      shadowOpacity: 0,
    },
    confirmBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: spacing.md,
    },
    confirmBtnText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },

    // ── Done screen ──
    doneHero: { alignItems: 'center' },
    doneCircleOuter: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneCircleInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },

    fineCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + '28',
    },
    fineIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '1a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fineCardText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },

    // Result card with side strip
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    severityStrip: {
      height: 4,
      width: '100%',
    },
    resultBody: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    severityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.full,
    },
    severityBadgeText: {
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    resultSummary: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 22,
    },
    adviceWrap: {
      backgroundColor: '#fffbeb',
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 4,
    },
    adviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adviceLabel: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    adviceText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      lineHeight: 22,
      marginLeft: 22,
    },

    doctorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: '#fee2e2',
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    doctorIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#dc2626',
      alignItems: 'center',
      justifyContent: 'center',
    },
    doctorText: { fontSize: typography.size.xs, color: '#991b1b', fontWeight: '700', flex: 1 },

    followCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '22',
    },
    followText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },

    doneBtn: {
      borderRadius: radius.full,
      overflow: 'hidden',
      marginTop: spacing.xs,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    doneBtnGradient: {
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
    },
    doneBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },
  });
}
