/**
 * Daily Health Check-in Screen
 * Flows:
 *   fine       → confirm → done (evening check at 21h)
 *   tired      → triage 3-5 questions → summary
 *   very_tired → triage (more urgent) → summary
 *   followup   → same 3-button screen with context banner
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { checkinApi, type CheckinStatus, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { colors, radius, spacing } from '../../src/styles';

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{
  status: CheckinStatus;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  sublabel: string;
  color: string;
  bg: string;
}> = [
  {
    status: 'fine',
    icon: 'emoticon-happy-outline',
    label: 'Tôi ổn',
    sublabel: 'Cảm thấy bình thường, khoẻ mạnh',
    color: '#16a34a',
    bg: '#dcfce7',
  },
  {
    status: 'tired',
    icon: 'emoticon-sad-outline',
    label: 'Hơi mệt',
    sublabel: 'Có gì đó không ổn, cần theo dõi',
    color: '#d97706',
    bg: '#fef3c7',
  },
  {
    status: 'very_tired',
    icon: 'emoticon-cry-outline',
    label: 'Rất mệt',
    sublabel: 'Mệt nhiều, không thoải mái',
    color: '#dc2626',
    bg: '#fee2e2',
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

type Screen = 'status' | 'triage' | 'done';

export default function CheckinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      Alert.alert('Lỗi', 'Không thể lưu trạng thái. Vui lòng thử lại.');
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
        title: isFollowUp ? 'Cập nhật tình trạng' : 'Check-in sức khoẻ',
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
        {screen === 'status' && <StatusScreen onSelect={handleStatusSelect} isFollowUp={isFollowUp} />}
        {screen === 'triage' && (
          <TriageScreen
            question={currentQ}
            options={currentOpts}
            answers={answers}
            loading={loading}
            onAnswer={handleAnswer}
          />
        )}
        {screen === 'done' && (
          <DoneScreen
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
  onSelect,
  isFollowUp,
}: {
  onSelect: (s: CheckinStatus) => void;
  isFollowUp: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>
        {isFollowUp ? 'Tình trạng bây giờ thế nào?' : 'Sáng nay bạn cảm thấy thế nào?'}
      </Text>
      <Text style={styles.subheading}>Chọn trạng thái phù hợp nhất với bạn lúc này</Text>

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
              <Text style={[styles.statusLabel, { color: opt.color }]}>{opt.label}</Text>
              <Text style={styles.statusSub}>{opt.sublabel}</Text>
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
  question,
  options,
  answers,
  loading,
  onAnswer,
}: {
  question: string;
  options: string[];
  answers: Array<{ question: string; answer: string }>;
  loading: boolean;
  onAnswer: (a: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const { TextInput } = require('react-native');

  return (
    <View style={styles.section}>
      {/* Progress dots */}
      <View style={styles.progressDots}>
        {[0, 1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[styles.dot, i < answers.length && styles.dotFilled, i === answers.length && styles.dotActive]}
          />
        ))}
      </View>

      <Text style={styles.questionCount}>Câu {answers.length + 1} / tối đa 5</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.subheading, { marginTop: 12 }]}>Asinu đang phân tích...</Text>
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

          {/* Custom answer */}
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Hoặc tự nhập câu trả lời..."
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
  session,
  triageSummary,
  onClose,
}: {
  session: CheckinSession | null;
  triageSummary: { summary: string; severity: string; recommendation: string; needsDoctor: boolean } | null;
  onClose: () => void;
}) {
  const isFine = session?.current_status === 'fine';

  const severityColor = triageSummary?.severity === 'high' ? '#dc2626'
    : triageSummary?.severity === 'medium' ? '#d97706' : '#16a34a';

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

      <Text style={styles.heading}>
        {isFine ? 'Tuyệt! Vui lòng duy trì.' : 'Asinu đã ghi nhận'}
      </Text>

      {isFine ? (
        <Text style={styles.subheading}>
          Asinu sẽ hỏi thăm lại vào 9 giờ tối hôm nay để đảm bảo bạn luôn khoẻ.
        </Text>
      ) : triageSummary && (
        <View style={styles.summaryCard}>
          <View style={[styles.severityBadge, { borderColor: severityColor }]}>
            <Ionicons
              name={triageSummary.severity === 'high' ? 'warning' : 'ellipse'}
              size={12}
              color={severityColor}
            />
            <Text style={[styles.severityBadgeText, { color: severityColor }]}>
              {triageSummary.severity === 'high' ? 'Mức độ cao'
                : triageSummary.severity === 'medium' ? 'Mức độ vừa' : 'Mức độ nhẹ'}
            </Text>
          </View>
          <Text style={styles.summaryText}>{triageSummary.summary}</Text>
          <View style={styles.divider} />
          <Text style={styles.recommendationLabel}>Lời khuyên:</Text>
          <Text style={styles.recommendationText}>{triageSummary.recommendation}</Text>

          {triageSummary.needsDoctor && (
            <View style={styles.doctorBanner}>
              <Ionicons name="medical" size={16} color="#dc2626" />
              <Text style={styles.doctorText}>Nên đến gặp bác sĩ để được kiểm tra.</Text>
            </View>
          )}
        </View>
      )}

      {!isFine && (
        <Text style={styles.followUpHint}>
          {session?.flow_state === 'high_alert'
            ? 'Asinu sẽ hỏi thăm bạn lại sau 2 tiếng.'
            : 'Asinu sẽ hỏi thăm bạn lại sau 3 tiếng.'}
        </Text>
      )}

      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>Đóng</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  container: { padding: spacing.xl },
  section: { gap: spacing.lg },

  heading:    { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subheading: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  optionList: { gap: spacing.md, marginTop: spacing.sm },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: spacing.md,
  },
  statusLabel: { fontSize: 18, fontWeight: '700' },
  statusSub:   { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  progressDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotFilled:    { backgroundColor: colors.primary },
  dotActive:    { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: -2 },

  questionCount: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  question:      { fontSize: 18, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 },

  optionChip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  optionChipText: { fontSize: 15, fontWeight: '600', color: colors.primary },

  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },

  doneIcon: { alignItems: 'center', marginBottom: spacing.sm },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  severityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryText:        { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  divider:            { height: 1, backgroundColor: colors.border },
  recommendationLabel:{ fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  recommendationText: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },

  doctorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fee2e2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  doctorText: { fontSize: 13, color: '#dc2626', fontWeight: '600', flex: 1 },

  followUpHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
