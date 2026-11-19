import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { AiDataConsentModal, hasAiDataConsent } from '../../components/AiDataConsentModal';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ApiError } from '../../lib/apiClient';
import { showToast } from '../../stores/toast.store';
import { useAuthStore } from '../auth/auth.store';
import { VoiceAnswerButton } from '../guidance/VoiceAnswerButton';
import { applyReminderTimes, getNotificationPreferences, planReminderTimes,
  type NotificationPreferences, type ReminderAssistantPlan } from '../notifications/notifications.api';

export function ReminderAssistant({ preferences, disabled, onPreferences, onBusyChange }: {
  preferences: NotificationPreferences;
  disabled: boolean;
  onPreferences: (preferences: NotificationPreferences) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation('settings');
  const { colors } = useThemeColors();
  const token = useAuthStore(state => state.token);
  const focused = useIsFocused();
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [clarification, setClarification] = useState<{ original: string; question: string } | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const resumeSubmit = useRef(false);
  const pendingPlan = useRef<ReminderAssistantPlan | null>(null);
  const active = useRef(false);
  const revision = useRef(0);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const submitRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    active.current = focused;
    pendingPlan.current = null;
    setClarification(null); setText(''); setFeedback('');
    setBusy(false); setVoiceBusy(false); setInterim(''); setShowConsent(false); locked.current = false;
    return () => { active.current = false; revision.current++; controller.current?.abort(); locked.current = false; };
  }, [focused, token]);
  useEffect(() => { onBusyChange(busy || voiceBusy); }, [busy, voiceBusy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  const beforeVoice = useCallback(async () => {
    const owner = useAuthStore.getState().token;
    if (await hasAiDataConsent()) return active.current && owner === useAuthStore.getState().token;
    if (active.current && owner === useAuthStore.getState().token) { resumeSubmit.current = false; setShowConsent(true); }
    return false;
  }, []);
  const updateText = (value: string) => { setText(value); pendingPlan.current = null; setFeedback(''); setError(false); };
  const acceptPreferences = (next: NotificationPreferences) => onPreferences({ ...next,
    reminder_assistant_enabled: preferences.reminder_assistant_enabled });

  const run = async () => {
    if (locked.current || disabled || voiceBusy || !active.current || !text.trim()) return;
    locked.current = true;
    const version = ++revision.current;
    const owner = useAuthStore.getState().token;
    const current = () => active.current && revision.current === version && useAuthStore.getState().token === owner;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true); setFeedback(''); setError(false);
    try {
      if (!(await hasAiDataConsent())) {
        if (current()) { resumeSubmit.current = true; setShowConsent(true); }
        return;
      }
      if (!current()) return;
      const request = clarification
        ? `${clarification.original}\nClarifying question: ${clarification.question}\nUser clarification: ${text.trim()}`
        : text.trim();
      if (request.length > 6000) { setError(true); setFeedback(t('reminderAssistant.tooLong')); return; }
      let plan = pendingPlan.current;
      if (!plan) plan = await planReminderTimes(request, signal);
      if (!current()) return;
      if (plan.status === 'clarify') {
        setClarification({ original: request, question: plan.question || t('reminderAssistant.clarify') });
        setText(''); return;
      }
      if (plan.status === 'unsupported') { setFeedback(plan.question || t('reminderAssistant.scope')); return; }
      if (plan.status === 'unchanged') { setFeedback(t('reminderAssistant.unchanged')); setClarification(null); return; }
      if (!plan.planToken) throw new Error('Missing reminder plan');
      // A timeout after commit is uncertain: retry this same signed plan rather
      // than interpreting the command and applying a relative shift twice.
      pendingPlan.current = plan;
      const result = await applyReminderTimes(plan.planToken, signal);
      if (!current()) return;
      acceptPreferences(result.preferences); pendingPlan.current = null;
      setClarification(null); setText('');
      showToast(t('reminderAssistant.saved'), 'success');
    } catch (reason) {
      if (!current() || signal.aborted) return;
      const code = reason instanceof ApiError ? reason.code : undefined;
      if (code === 'AI_CONSENT_REQUIRED') { resumeSubmit.current = false; setShowConsent(true); }
      if (code === 'REMINDER_ASSISTANT_CONFLICT' || code === 'REMINDER_ASSISTANT_EXPIRED') {
        pendingPlan.current = null;
      }
      if (code === 'REMINDER_ASSISTANT_DISABLED') {
        onPreferences({ ...preferences, reminder_assistant_enabled: false });
        return;
      }
      setError(true);
      setFeedback(t(code === 'REMINDER_ASSISTANT_CONFLICT' ? 'reminderAssistant.conflict'
        : code === 'REMINDER_ASSISTANT_EXPIRED' ? 'reminderAssistant.expired'
        : code === 'REMINDER_ASSISTANT_RATE_LIMITED' ? 'reminderAssistant.rateLimited'
        : 'reminderAssistant.error'));
      // Refresh the visible clock after an uncertain write; never announce that
      // nothing changed when the response might have been lost after commit.
      if (pendingPlan.current || code === 'REMINDER_ASSISTANT_CONFLICT' || code === 'REMINDER_ASSISTANT_REMINDERS_OFF') {
        try { const fresh = await getNotificationPreferences(); if (current() && fresh.ok) acceptPreferences(fresh); } catch { /* keep explicit uncertain status */ }
      }
    } finally {
      if (current()) { locked.current = false; setBusy(false); }
    }
  };
  submitRef.current = () => run();
  const unavailable = disabled || busy;
  return <View style={styles.section} testID="reminder-assistant">
    <AiDataConsentModal visible={showConsent} onDecline={() => { setShowConsent(false); resumeSubmit.current = false; }}
      onAgree={() => { setShowConsent(false); if (resumeSubmit.current) { resumeSubmit.current = false; void submitRef.current(); } }} />
    <View style={styles.heading}>
      <Ionicons name="sparkles-outline" size={22} color={colors.primaryText} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('reminderAssistant.title')}</Text>
    </View>
    <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('reminderAssistant.hint')}</Text>
    {clarification && <View accessibilityLiveRegion="polite" style={styles.clarification}>
      <Text style={[styles.body, { color: colors.primaryText }]}>{clarification.question}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setClarification(null); setText(''); pendingPlan.current = null; }}
        disabled={unavailable || voiceBusy} style={styles.textButton}>
        <Text style={{ color: colors.primaryText, fontWeight: '600' }}>{t('reminderAssistant.newRequest')}</Text>
      </Pressable>
    </View>}
    <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <TextInput testID="reminder-assistant-text" accessibilityLabel={t('reminderAssistant.title')}
        style={[styles.input, { color: colors.textPrimary }]} multiline maxLength={3000}
        editable={!unavailable && !voiceBusy} placeholderTextColor={colors.textSecondary}
        placeholder={t(clarification ? 'reminderAssistant.answerPlaceholder' : 'reminderAssistant.placeholder')}
        value={interim ? `${text.trimEnd()} ${interim}`.trim().slice(0, 3000) : text} onChangeText={updateText} />
      <VoiceAnswerButton purpose="reminder" disabled={unavailable} onBeforeAi={beforeVoice}
        onProcessingChange={setVoiceBusy} onInterimText={setInterim}
        onText={recognized => { setInterim(''); updateText(`${text.trimEnd()} ${recognized}`.trim().slice(0, 3000)); }} />
    </View>
    <Pressable testID="reminder-assistant-submit" accessibilityRole="button" accessibilityState={{ busy, disabled: unavailable || voiceBusy || !text.trim() }}
      disabled={unavailable || voiceBusy || !text.trim()} onPress={() => void run()}
      style={({ pressed }) => [styles.submit, { backgroundColor: colors.primaryText,
        opacity: unavailable || voiceBusy || !text.trim() ? 0.5 : pressed ? 0.8 : 1 }]}>
      {busy && <ActivityIndicator color={colors.background} />}
      <Text style={[styles.submitText, { color: colors.background }]}>{t(busy ? 'reminderAssistant.working' : 'reminderAssistant.submit')}</Text>
    </Pressable>
    {!!feedback && <Text accessibilityLiveRegion="polite" style={[styles.body, { color: error ? colors.danger : colors.textSecondary }]}>{feedback}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 19, fontWeight: '700', lineHeight: 26 },
  hint: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 23 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 8, gap: 4 },
  input: { flex: 1, fontSize: 16, lineHeight: 24, padding: 8, minHeight: 100, maxHeight: 180, textAlignVertical: 'top' },
  submit: { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  clarification: { gap: 4 },
  textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignSelf: 'flex-start' },
});
