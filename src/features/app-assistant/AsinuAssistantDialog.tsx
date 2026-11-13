import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { QueuedModal } from '../../components/QueuedModal';
import { AiDataConsentModal, hasAiDataConsent } from '../../components/AiDataConsentModal';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ApiError } from '../../lib/apiClient';
import { useFontSizeStore } from '../../stores/font-size.store';
import { useLanguageStore } from '../../stores/language.store';
import { useAuthStore } from '../auth/auth.store';
import { useLogsStore } from '../logs/logs.store';
import { VoiceAnswerButton } from '../guidance/VoiceAnswerButton';
import { executeAssistantActions, planAssistantActions, saveAssistantReading, type AssistantAction } from './app-assistant.api';

const mascot = require('../../../assets/asinu_assistant_listening_v1.png');
type Preview = { actions: AssistantAction[]; requestId: string; recordedAt: string; completed: Set<number> };

export function AsinuAssistantDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings');
  const { t: tl } = useTranslation('logs');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const token = useAuthStore(state => state.token);
  const language = useLanguageStore(state => state.language);
  const fontSize = useFontSizeStore(state => state.scale);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState<'planning' | 'saving' | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [clarification, setClarification] = useState<{ original: string; question: string }>();
  const [consent, setConsent] = useState(false);
  const active = useRef(false);
  const locked = useRef(false);
  const revision = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const resume = useRef(false);
  const submit = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    active.current = focused;
    return () => { active.current = false; revision.current++; abort.current?.abort(); };
  }, [focused, token]);
  const current = (version: number) => active.current && revision.current === version && useAuthStore.getState().token === token;
  const beforeVoice = async () => {
    if (await hasAiDataConsent()) return active.current && useAuthStore.getState().token === token;
    if (active.current) { resume.current = false; setConsent(true); }
    return false;
  };
  const updateText = (value: string) => {
    setText(value); setPreview(null); setFeedback(''); setError(false);
  };
  const showActions = (actions: AssistantAction[]) => {
    setPreview({ actions, requestId: randomUUID(), recordedAt: new Date().toISOString(), completed: new Set() });
    setFeedback(''); setError(false); Keyboard.dismiss();
  };
  const plan = async () => {
    if (locked.current || voiceBusy || !text.trim() || !active.current) return;
    locked.current = true;
    const version = ++revision.current;
    abort.current = new AbortController();
    setBusy('planning'); setFeedback(''); setError(false);
    try {
      if (!(await hasAiDataConsent())) { if (current(version)) { resume.current = true; setConsent(true); } return; }
      if (!current(version)) return;
      const response = await planAssistantActions({ text: text.trim(), current: { language, fontSize }, clarification }, abort.current.signal);
      if (!current(version)) return;
      if (response.status === 'ready' && response.actions.length) showActions(response.actions);
      else {
        setFeedback(response.question || t('appAssistant.scope'));
        if (response.status === 'clarify') {
          const original = clarification ? `${clarification.original}\n${text.trim()}` : text.trim();
          setClarification(original.length <= 6000 ? { original, question: response.question } : undefined);
          setText('');
        } else setClarification(undefined);
      }
    } catch (reason) {
      if (!current(version) || abort.current.signal.aborted) return;
      if (reason instanceof ApiError && reason.code === 'AI_CONSENT_REQUIRED') { resume.current = false; setConsent(true); }
      setFeedback(t(reason instanceof ApiError && reason.code === 'APP_ASSISTANT_RATE_LIMITED' ? 'appAssistant.rateLimited' : 'appAssistant.error'));
      setError(true);
    } finally { if (current(version)) { setBusy(null); locked.current = false; } }
  };
  submit.current = plan;
  const apply = async () => {
    if (!preview || locked.current || !active.current) return;
    locked.current = true;
    const version = ++revision.current;
    setBusy('saving'); setError(false); setFeedback('');
    try {
      const done = await executeAssistantActions({ ...preview, isCurrent: () => current(version), saveReading: saveAssistantReading,
        setLanguage: value => useLanguageStore.getState().setLanguage(value),
        setFontSize: value => useFontSizeStore.getState().setScale(value) });
      if (!done) return;
      setPreview(null); setText(''); setClarification(undefined); setFeedback(t('appAssistant.saved'));
      void useLogsStore.getState().fetchRecent().catch(() => {});
    } catch {
      if (current(version)) { setError(true); setFeedback(t('appAssistant.saveError')); }
    } finally { if (current(version)) { locked.current = false; setBusy(null); } }
  };
  const describe = (action: AssistantAction) => {
    switch (action.type) {
      case 'language': return `${t('language')}: ${t(action.value === 'vi' ? 'languageVi' : 'languageEn')}`;
      case 'font_size': return `${t('fontSize')}: ${t({ small: 'fontSmall', normal: 'fontNormal', large: 'fontLarge', xlarge: 'fontXLarge' }[action.value])}`;
      case 'glucose': return `${tl('glucose')}: ${action.value} ${action.unit}${action.context ? ` · ${tl({ fasting: 'ctxFasting', pre_meal: 'ctxPreMeal', post_meal: 'ctxPostMeal', before_sleep: 'ctxBeforeSleep', random: 'ctxRandom' }[action.context])}` : ''}`;
      case 'blood_pressure': return `${tl('bloodPressure')}: ${action.systolic}/${action.diastolic} mmHg${action.pulse === undefined ? '' : ` · ${action.pulse} ${t('appAssistant.pulseUnit')}`}`;
      case 'water': return `${tl('water')}: ${action.volume_ml} ml`;
    }
  };
  const reset = () => { setText(''); setPreview(null); setClarification(undefined); setFeedback(''); setError(false); };
  const unavailable = !!busy || voiceBusy;
  return <>
    <AiDataConsentModal visible={consent} onDecline={() => { resume.current = false; setConsent(false); }}
      onAgree={() => { setConsent(false); if (resume.current) { resume.current = false; void submit.current(); } }} />
    <QueuedModal visible transparent animationType="fade" interruptible priority={10} statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.close')} onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
        <View accessibilityViewIsModal testID="asinu-assistant-dialog" style={[styles.dialog,
          { backgroundColor: isDark ? '#142e29' : '#f1faf7', marginTop: insets.top + 12, marginBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <Image source={mascot} accessible={false} resizeMode="contain" resizeMethod="resize" style={styles.mascot} />
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Asinu</Text>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>{t('appAssistant.greeting')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.close')} onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}>
            {preview && <View style={styles.review}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('appAssistant.review')}</Text>
              {preview.actions.map((action, index) => <View key={index} style={styles.reading}>
                <Ionicons name={preview.completed.has(index) ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={colors.primaryText} />
                <Text style={[styles.readingText, { color: colors.textPrimary }]}>{describe(action)}</Text>
              </View>)}
            </View>}
            {!!feedback && <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: error ? colors.danger : colors.primaryText }]}>{feedback}</Text>}
            {busy && <View accessibilityLiveRegion="polite" style={styles.working}>
              <ActivityIndicator color={colors.primaryText} />
              <Text style={[styles.feedback, { color: colors.primaryText }]}>{t(busy === 'saving' ? 'appAssistant.saving' : 'appAssistant.working')}</Text>
            </View>}
          </ScrollView>
          {preview ? <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={unavailable} onPress={() => void apply()} testID="asinu-assistant-apply"
              style={[styles.primary, { backgroundColor: colors.primaryText, opacity: unavailable ? 0.5 : 1 }]}>
              <Text style={[styles.primaryText, { color: colors.background }]}>{t('appAssistant.confirm')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={unavailable} onPress={reset} style={styles.edit}>
              <Text style={{ color: colors.primaryText, fontSize: 16 }}>{t('appAssistant.newRequest')}</Text>
            </Pressable>
          </View> : <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <TextInput testID="asinu-assistant-text" accessibilityLabel={t('appAssistant.input')} multiline maxLength={3000}
              placeholder={t(clarification ? 'appAssistant.answer' : 'appAssistant.placeholder')}
              placeholderTextColor={colors.textSecondary} editable={!unavailable} style={[styles.input, { color: colors.textPrimary }]}
              value={interim ? `${text.trimEnd()} ${interim}`.trim() : text} onChangeText={updateText} />
            <View style={styles.composerActions}>
              <VoiceAnswerButton purpose="assistant" disabled={!!busy} onBeforeAi={beforeVoice}
                onInterimText={setInterim} onProcessingChange={setVoiceBusy}
                onText={recognized => { setInterim(''); updateText(`${text.trimEnd()} ${recognized}`.trim().slice(0, 3000)); }} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.send')}
                accessibilityState={{ busy: !!busy, disabled: unavailable || !text.trim() }} disabled={unavailable || !text.trim()}
                onPress={() => void plan()} testID="asinu-assistant-send"
                style={[styles.send, { backgroundColor: colors.primaryText, opacity: unavailable || !text.trim() ? 0.45 : 1 }]}>
                <Ionicons name="arrow-up" size={24} color={colors.background} />
              </Pressable>
            </View>
          </View>}
        </View>
      </KeyboardAvoidingView>
    </QueuedModal>
  </>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 560, maxHeight: '88%', borderRadius: 28, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 12 },
  mascot: { width: 72, height: 80, marginLeft: -8 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  greeting: { fontSize: 16, lineHeight: 23 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 16, paddingBottom: 12 },
  review: { gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readingText: { flex: 1, fontSize: 17, lineHeight: 25 },
  feedback: { fontSize: 16, lineHeight: 24, flexShrink: 1 },
  working: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  footer: { paddingTop: 10, gap: 4 },
  primary: { minHeight: 50, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  edit: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  composer: { borderWidth: 1, borderRadius: 20, padding: 10, gap: 2 },
  input: { fontSize: 16, lineHeight: 24, minHeight: 54, maxHeight: 120, textAlignVertical: 'top', padding: 6 },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
