import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useIsFocused } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { QueuedModal } from '../../components/QueuedModal';
import { AiDataConsentModal, hasAiDataConsent } from '../../components/AiDataConsentModal';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ApiError, getApiErrorMessage } from '../../lib/apiClient';
import { useFontSizeStore } from '../../stores/font-size.store';
import { useLanguageStore } from '../../stores/language.store';
import { useAuthStore } from '../auth/auth.store';
import { useLogsStore } from '../logs/logs.store';
import { renderVoiceAnswerButton, useVoiceAnswer } from '../guidance/VoiceAnswerButton';
import { executeAssistantActions, planAssistantActions, saveAssistantReading, applyAssistantTool, type AssistantAction } from './app-assistant.api';
import { useAssistantConversation } from './useAssistantConversation';
import { assistantRoute, assistantScreenRoute } from './assistant-navigation';
import type { AssistantScreen } from './app-assistant.api';
import { useAssistantNativeActions } from './useAssistantNativeActions';
import { useCheckinCallAudio } from '../checkin-call/useCheckinCallAudio';
import { useNotificationStore } from '../../stores/notification.store';
import { notifyTaskReminderPreferenceChanged } from '../../lib/device-permission-events';
import { notifyHealthAction } from '../../lib/health-action-events';
import { useHealthFeedDismissals } from '../health-feed/useHealthFeedDismissals';
import { v21Api } from '../v21/v21.api';
import { prepareMedicationPhoto } from '../v21/medication-photo';
import { runNativePermission } from '../../lib/native-permissions';
import { checkNotificationPermission } from '../../lib/notifications';
import { getNotificationPreferences, applyReminderTimes } from '../notifications/notifications.api';

const mascot = require('../../../assets/asinu_assistant_listening_v1.png');
type Preview = { actions: AssistantAction[]; requestId: string; recordedAt: string; completed: Set<number> };
type PermissionDecision = { granted: boolean };
type PendingPermission = {
  operation: () => Promise<PermissionDecision>;
  resolve: (decision: PermissionDecision) => void;
  reject: (reason: Error) => void;
  token: string | null;
  started: boolean;
};

export function AsinuAssistantDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings');
  const { t: tl } = useTranslation('logs');
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const router = useGuardedRouter();
  const owner = useAuthStore(state => state.profile?.id);
  const token = useAuthStore(state => state.token);
  const language = useLanguageStore(state => state.language);
  const fontSize = useFontSizeStore(state => state.scale);
  const articles = useHealthFeedDismissals();
  const conclusion = useCheckinCallAudio(null, language, t, owner);
  const [speechText, setSpeechText] = useState('');
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState<'planning' | 'saving' | 'photo' | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [stalePreview, setStalePreview] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [clarification, setClarification] = useState<{ original: string; question: string }>();
  const [consent, setConsent] = useState(false);
  const [clearRequested, setClearRequested] = useState(false);
  const [navigationClosing, setNavigationClosing] = useState(false);
  const pendingNavigation = useRef<string | null>(null);
  const presented = useRef(false);
  const resumePhoto = useRef(false);
  const photoRequest = useRef<() => Promise<void>>(async () => {});
  const [permissionPending, setPermissionPending] = useState(false);
  const pendingPermission = useRef<PendingPermission | null>(null);
  const resumeVoice = useRef(false);
  const active = useRef(false);
  const locked = useRef(false);
  const revision = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const resume = useRef(false);
  const submit = useRef<() => Promise<void>>(async () => {});
  const history = useAssistantConversation({ text, clarification, feedback, stalePreview,
    preview: preview ? { ...preview, completed: [...preview.completed] } : null,
  }, saved => {
    const expired = !!saved.preview && Date.now() - Date.parse(saved.preview.recordedAt) > 10 * 60000;
    setText(saved.text); setClarification(saved.clarification); setFeedback(expired ? t('appAssistant.requestStale') : saved.feedback); setStalePreview(saved.stalePreview || expired);
    setPreview(saved.preview ? { ...saved.preview, completed: new Set(saved.preview.completed) } : null);
  });
  useEffect(() => {
    active.current = focused;
    return () => {
      active.current = false; revision.current++; abort.current?.abort();
      pendingPermission.current?.reject(new Error('Voice permission request cancelled'));
      pendingPermission.current = null;
      resumeVoice.current = false;
      resumePhoto.current = false; pendingNavigation.current = null;
    };
  }, [focused, token]);
  const current = (version: number) => active.current && revision.current === version && useAuthStore.getState().token === token;
  const beforeVoice = async () => {
    await conclusion.stopAudio();
    if (await hasAiDataConsent()) return active.current && useAuthStore.getState().token === token;
    if (active.current && useAuthStore.getState().token === token) { resume.current = false; resumeVoice.current = true; setConsent(true); }
    return false;
  };
  const withPermissionPrompt = (operation: () => Promise<PermissionDecision>) => new Promise<PermissionDecision>((resolve, reject) => {
    if (!active.current || useAuthStore.getState().token !== token || pendingPermission.current) { reject(new Error('Voice permission request cancelled')); return; }
    pendingPermission.current = { operation, resolve, reject, token, started: false };
    Keyboard.dismiss();
    setPermissionPending(true);
  });
  const afterDialogDismiss = async () => {
    presented.current = false;
    if (pendingNavigation.current && active.current && useAuthStore.getState().token === token) {
      const route = pendingNavigation.current; pendingNavigation.current = null;
      onClose(); router.push(route as any); return;
    }
    const pending = pendingPermission.current;
    if (!pending || pending.started) return;
    pending.started = true;
    const ownsRequest = () => active.current && pendingPermission.current === pending
      && useAuthStore.getState().token === pending.token;
    try {
      if (!ownsRequest()) throw new Error('Voice permission request cancelled');
      const decision = await pending.operation();
      if (!ownsRequest()) throw new Error('Voice permission request cancelled');
      pending.resolve(decision);
    } catch (reason) {
      pending.reject(reason instanceof Error ? reason : new Error('Voice permission request failed'));
    } finally {
      if (pendingPermission.current === pending) {
        pendingPermission.current = null;
        if (active.current) setPermissionPending(false);
      }
    }
  };
  const updateText = (value: string) => {
    history.edited();
    setText(value); setPreview(null); setFeedback(''); setError(false);
  };
  const showActions = (actions: AssistantAction[]) => {
    setPreview({ actions, requestId: randomUUID(), recordedAt: new Date().toISOString(), completed: new Set() });
    setFeedback(''); setError(false); setStalePreview(false); Keyboard.dismiss();
  };
  const plan = async () => {
    if (locked.current || voiceBusy || !text.trim() || !active.current) return;
    locked.current = true;
    const version = ++revision.current;
    abort.current = new AbortController();
    setBusy('planning'); setFeedback(''); setError(false);
    history.edited();
    try {
      if (!(await hasAiDataConsent())) { if (current(version)) { resume.current = true; setConsent(true); } return; }
      if (!current(version)) return;
      history.append('user', text.trim());
      const response = await planAssistantActions({ text: text.trim(), current: { language, fontSize }, clarification,
        hiddenArticles: [...articles.hiddenIds].slice(-100), allowCuratedArticles: articles.canShowCurated,
        conversation: history.messages.filter(message => message.role === 'user').slice(-8).map(({ role, text }) => ({ role, text: text.slice(0, 2000) })),
      }, abort.current.signal);
      if (!current(version)) return;
      if (response.answer) { history.append('assistant', response.answer); setFeedback(''); }
      if (response.status === 'ready' && response.actions.length) {
        if (response.actions.length === 1 && response.actions[0].type === 'navigate') queueNavigation(response.actions[0].destination);
        else if (response.actions.length === 1 && response.actions[0].type === 'screen') queueScreen(response.actions[0]);
        else if (response.actions.every(action => action.type === 'speech')) {
          const spoken = response.actions.map(action => action.type === 'speech' ? action.text : '').join('\n');
          setSpeechText(spoken); setText(''); setClarification(undefined);
          await conclusion.play('conclusion', spoken);
        }
        else showActions(response.actions);
      }
      else {
        const reply = response.question || (response.answer ? '' : t('appAssistant.scope'));
        if (reply) history.append('assistant', reply);
        setFeedback('');
        if (response.status === 'clarify') {
          const original = clarification ? `${clarification.original}\n${text.trim()}` : text.trim();
          setClarification(original.length <= 6000 ? { original, question: response.question } : undefined);
          setText('');
        } else { setClarification(undefined); setText(''); }
      }
    } catch (reason) {
      if (!current(version) || abort.current.signal.aborted) return;
      if (reason instanceof ApiError && reason.code === 'AI_CONSENT_REQUIRED') { resume.current = false; setConsent(true); }
      setFeedback(t(reason instanceof ApiError && reason.code === 'APP_ASSISTANT_RATE_LIMITED' ? 'appAssistant.rateLimited'
        : reason instanceof ApiError && ['CARE_CIRCLE_DISABLED', 'CAREGIVER_VIEW_DISABLED', 'V21_FEATURE_DISABLED'].includes(reason.code || '') ? 'appAssistant.featureUnavailable' : 'appAssistant.error'));
      setError(true);
    } finally { if (current(version)) { setBusy(null); locked.current = false; } }
  };
  submit.current = plan;
  const apply = async () => {
    if (!preview || stalePreview || locked.current || !active.current) return;
    locked.current = true;
    const version = ++revision.current;
    setBusy('saving'); setError(false); setFeedback('');
    try {
      const done = await executeAssistantActions({ ...preview, isCurrent: () => current(version), saveReading: saveAssistantReading,
        setLanguage: value => useLanguageStore.getState().setLanguage(value),
        setFontSize: value => useFontSizeStore.getState().setScale(value),
        onProfile: profile => useAuthStore.setState({ profile }), navigate: queueNavigation,
        applyTool: async planToken => {
          const action = preview.actions.find(action => action.type === 'app_tool' && action.planToken === planToken);
          if (action?.type === 'app_tool' && action.requirements?.includes('notifications') && !(await checkNotificationPermission())) {
            await performNative({ type: 'native', kind: 'device.permission', parameters: { kind: 'notifications', enabled: true } });
            if (!current(version) || !(await checkNotificationPermission())) throw new Error('REMINDERS_PERMISSION_REQUIRED');
          }
          if (action?.type === 'app_tool' && action.requirements?.includes('calls') && Platform.OS === 'android')
            await performNative({ type: 'native', kind: 'device.permission', parameters: { kind: 'calls', enabled: true } });
          if (!current(version)) throw new Error('Session changed');
          return applyAssistantTool(planToken);
        },
        openScreen: queueScreen, performNative, speak: async value => { setSpeechText(value); await conclusion.play('conclusion', value); },
        onReply: value => history.append('assistant', value),
        onToolApplied: tool => {
          if (tool.startsWith('notifications.')) void useNotificationStore.getState().fetchFromBackend().catch(() => {});
          if (tool === 'settings.configure') notifyTaskReminderPreferenceChanged();
          if (/^(gifts|coins|medication)\./.test(tool)) notifyHealthAction('/api/mobile/gift/open', 'POST');
        },
        applyReminders: async token => {
          const [allowed, prefs] = await Promise.all([checkNotificationPermission(), getNotificationPreferences()]);
          if (!current(version)) throw new Error('Session changed');
          if (!allowed || !prefs.ok || !prefs.reminders_enabled) throw new Error('REMINDERS_PERMISSION_REQUIRED');
          return applyReminderTimes(token);
        } });
      if (!done) return;
      setPreview(null); setText(''); setClarification(undefined); setFeedback('');
      history.append('assistant', `${t(preview.actions.some(action => ['native', 'speech', 'screen'].includes(action.type)) ? 'appAssistant.done' : 'appAssistant.saved')}\n${preview.actions.map(describe).join('\n')}`);
      void useLogsStore.getState().fetchRecent().catch(() => {});
      if (preview.actions.some(action => action.type === 'native' && action.kind === 'app.guide')) openRoute('/home');
    } catch (reason) {
      if (current(version)) {
        setError(true);
        const code = reason instanceof ApiError ? reason.code : undefined;
        const stale = ['APP_ASSISTANT_PLAN_EXPIRED', 'APP_ASSISTANT_TOOL_CONFLICT', 'APP_ASSISTANT_MEDICATION_CONFLICT', 'APP_ASSISTANT_PROFILE_CONFLICT', 'REMINDER_ASSISTANT_EXPIRED', 'REMINDER_ASSISTANT_CONFLICT', 'MED_SCHEDULE_NOT_FOUND', 'MED_ITEM_NOT_FOUND', 'MED_TIME_EXISTS'].includes(code || '');
        setStalePreview(stale);
        setFeedback(t(reason instanceof Error && reason.message === 'REMINDERS_PERMISSION_REQUIRED' ? 'appAssistant.reminderPermission'
          : stale ? 'appAssistant.requestStale' : code === 'MED_SCHEDULE_LIMIT' ? 'appAssistant.medicationLimit' : 'appAssistant.saveError'));
        if (!stale && reason instanceof ApiError && typeof reason.data?.error === 'string')
          setFeedback(getApiErrorMessage(reason, t, 'appAssistant.saveError'));
      }
    } finally { if (current(version)) { locked.current = false; setBusy(null); } }
  };
  const describe = (action: AssistantAction) => {
    switch (action.type) {
      case 'language': return `${t('language')}: ${t(action.value === 'vi' ? 'languageVi' : 'languageEn')}`;
      case 'font_size': return `${t('fontSize')}: ${t({ small: 'fontSmall', normal: 'fontNormal', large: 'fontLarge', xlarge: 'fontXLarge' }[action.value])}`;
      case 'glucose': return `${tl('glucose')}: ${action.value} ${action.unit}${action.context ? ` · ${tl({ fasting: 'ctxFasting', pre_meal: 'ctxPreMeal', post_meal: 'ctxPostMeal', before_sleep: 'ctxBeforeSleep', random: 'ctxRandom' }[action.context])}` : ''}`;
      case 'blood_pressure': return `${tl('bloodPressure')}: ${action.systolic}/${action.diastolic} mmHg${action.pulse === undefined ? '' : ` · ${action.pulse} ${t('appAssistant.pulseUnit')}`}`;
      case 'water': return `${tl('water')}: ${action.volume_ml} ml`;
      case 'meal': return `${tl('meal')}: ${action.meal_text}${action.calories_kcal === undefined ? '' : ` · ${action.calories_kcal} kcal`}`;
      case 'app_tool': return action.label;
      case 'screen': return t('appAssistant.openScreen', { screen: t(`appAssistant.screens.${action.screen}`) });
      case 'native': return action.kind === 'device.permission' ? t('appAssistant.permissionAction', {
        permission: t(`appAssistant.permissionNames.${action.parameters.kind}`), action: t(action.parameters.enabled ? 'appAssistant.permissionEnable' : 'appAssistant.permissionDisable'),
      }) : t(`appAssistant.nativeActions.${action.kind.replace('.', '_')}`);
      case 'speech': return t('appAssistant.listenConclusion');
      case 'medication': return action.changes.map(change => t(change.operation === 'move' ? 'appAssistant.medicationMove' : change.operation === 'create' ? 'appAssistant.medicationCreate' : 'appAssistant.medicationStatus', {
        name: change.name, times: change.times.join(', '), previousTime: change.previousTime, state: t(`appAssistant.medicationStates.${change.operation}`),
      })).join('\n');
      case 'navigate': return t('appAssistant.navigate', { destination: t(`appAssistant.destinations.${action.destination}`) });
      case 'profile': return Object.entries(action.changes).map(([field, value]) => `${t(`appAssistant.profileFields.${field}`)}: ${Array.isArray(value) ? value.length ? value.join(', ') : t('appAssistant.noConditions') : value}`).join('\n');
      case 'routine_reminders': return action.changes.map(change => t('appAssistant.reminderChange', { slot: t(`reminderAssistant.slots.${change.slot}`), before: change.before, time: change.time })).join('\n');
    }
  };
  const reset = () => { history.edited(); setText(''); setPreview(null); setClarification(undefined); setFeedback(''); setError(false); setStalePreview(false); };
  const clearHistory = async () => {
    if (locked.current || voiceBusy) return;
    locked.current = true; setBusy('saving');
    try { await history.clear(); if (active.current) { reset(); setClearRequested(false); } }
    catch { if (active.current) { setError(true); setFeedback(t('appAssistant.historyError')); } }
    finally { locked.current = false; if (active.current) setBusy(null); }
  };
  const queueNavigation = (destination: import('./app-assistant.api').AssistantDestination) => {
    const route = assistantRoute(destination, owner);
    if (!route) { setError(true); setFeedback(t('appAssistant.navigationUnavailable')); return; }
    const open = () => {
      if (!active.current || useAuthStore.getState().token !== token) return;
      history.append('assistant', t('appAssistant.navigate', { destination: t(`appAssistant.destinations.${destination}`) }));
      openRoute(route); setText(''); setClarification(undefined);
    };
    if (destination === 'reminders') {
      void Promise.all([checkNotificationPermission(), getNotificationPreferences()]).then(([allowed, prefs]) => {
        if (!active.current || useAuthStore.getState().token !== token) return;
        if (allowed && prefs.ok && prefs.reminders_enabled) open();
        else { setError(true); setFeedback(t('appAssistant.reminderPermission')); }
      }).catch(() => { if (active.current) { setError(true); setFeedback(t('appAssistant.navigationUnavailable')); } });
    } else open();
  };
  const openRoute = (route: string) => {
    if (!active.current || useAuthStore.getState().token !== token) return;
    pendingNavigation.current = route; setNavigationClosing(true);
    if (!presented.current) {
      pendingNavigation.current = null; onClose(); router.push(route as any);
    }
  };
  const queueScreen = (action: AssistantScreen) => {
    const route = assistantScreenRoute(action);
    if (!route || !active.current || useAuthStore.getState().token !== token) throw new Error('Navigation unavailable');
    history.append('assistant', t('appAssistant.openScreen', { screen: t(`appAssistant.screens.${action.screen}`) }));
    openRoute(route);
    setText(''); setClarification(undefined);
  };
  const pickPhoto = async () => {
    if (locked.current || voiceBusy || !active.current || !owner) return;
    if (!(await hasAiDataConsent())) { resume.current = false; resumePhoto.current = true; setConsent(true); return; }
    locked.current = true; history.edited();
    const version = ++revision.current;
    setBusy('photo'); setError(false); setFeedback('');
    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      await withPermissionPrompt(async () => {
        let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!permission.granted) permission = await runNativePermission(() => ImagePicker.requestMediaLibraryPermissionsAsync(), { key: 'photos', canRun: () => current(version) });
        if (!permission.granted) throw new Error('PHOTO_PERMISSION_DENIED');
        const result = await runNativePermission(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true }),
          { key: 'assistant-photo-picker', canRun: () => current(version) });
        if (!result.canceled) asset = result.assets?.[0];
        return { granted: true };
      });
      if (!asset || !current(version)) return;
      const upload = await prepareMedicationPhoto(asset);
      try {
        const result = await v21Api.scan(Number(owner), upload.body);
        if (!current(version)) return;
        const names = result.items.map(item => item.display_name || item.printed_name).filter(Boolean).join(', ');
        if (!result.readable || !names) throw new Error('PHOTO_UNREADABLE');
        updateText(`${text.trim()}\n${t('appAssistant.photoNames', { names })}`.trim().slice(0, 3000));
        history.append('assistant', t('appAssistant.photoReview', { names }));
      } finally { upload.dispose(); }
    } catch (reason) {
      if (current(version)) { setError(true); setFeedback(t(reason instanceof Error && reason.message === 'PHOTO_PERMISSION_DENIED' ? 'appAssistant.photoPermission' : 'appAssistant.photoError')); }
    } finally { if (current(version)) { setBusy(null); locked.current = false; } }
  };
  photoRequest.current = pickPhoto;
  const performNative = useAssistantNativeActions({ present: withPermissionPrompt,
    isCurrent: () => active.current && useAuthStore.getState().token === token,
    dismissArticle: articles.dismiss,
  });
  const voice = useVoiceAnswer({ purpose: 'assistant', sessionKey: token, disabled: !!busy, onBeforeAi: beforeVoice, withPermissionPrompt,
    onNotice: (message, tone) => { setFeedback(message); setError(tone === 'error'); },
    onInterimText: setInterim, onProcessingChange: setVoiceBusy,
    onText: recognized => { setInterim(''); updateText(`${text.trimEnd()} ${recognized}`.trim().slice(0, 3000)); } });
  const unavailable = !!busy || voiceBusy;
  return <>
    <AiDataConsentModal visible={consent && focused} onDecline={() => { resume.current = false; resumeVoice.current = false; resumePhoto.current = false; setConsent(false); }}
      onAgree={() => { setConsent(false); if (resume.current) { resume.current = false; void submit.current(); } }} />
    <QueuedModal visible={focused && !consent && !permissionPending && !navigationClosing} transparent animationType="fade" interruptible priority={10} statusBarTranslucent onRequestClose={onClose}
      onDismiss={afterDialogDismiss} onShow={() => {
        presented.current = true;
        if (resumeVoice.current) { resumeVoice.current = false; void voice.press(); }
        else if (resumePhoto.current) { resumePhoto.current = false; void photoRequest.current(); }
      }}>
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
            <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.clearHistory')} disabled={unavailable}
              onPress={() => setClearRequested(true)} style={styles.close}>
              <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.close')} onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}>
            {clearRequested && <View>
              <Text style={[styles.feedback, { color: colors.textPrimary }]}>{t('appAssistant.clearQuestion')}</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable accessibilityRole="button" onPress={() => void clearHistory()} disabled={unavailable} style={styles.edit}>
                  <Text style={{ color: colors.danger }}>{t('appAssistant.clearConfirm')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setClearRequested(false)} style={styles.edit}>
                  <Text style={{ color: colors.primaryText }}>{t('appAssistant.clearCancel')}</Text>
                </Pressable>
              </View>
            </View>}
            {history.messages.map(message => <View key={message.id} style={[styles.message,
              message.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: colors.primaryLight } : { alignSelf: 'flex-start' }]}>
              <Text style={[styles.feedback, { color: colors.textPrimary }]} selectable>{message.text}</Text>
            </View>)}
            {history.storageError && <Text style={{ color: colors.danger }}>{t('appAssistant.historyError')}</Text>}
            {!!speechText && <View style={styles.composerActions}>
              <Pressable accessibilityRole="button" onPress={() => void conclusion.play('conclusion', speechText)} style={styles.edit}>
                <Text style={{ color: colors.primaryText }}>{t('appAssistant.listenConclusion')}</Text>
              </Pressable>
              {['loading', 'playing'].includes(conclusion.audio.phase) && <Pressable accessibilityRole="button" onPress={() => void conclusion.stopAudio()} style={styles.edit}>
                <Text style={{ color: colors.primaryText }}>{t('appAssistant.stopAudio')}</Text>
              </Pressable>}
              {conclusion.audio.phase === 'error' && <Text style={{ color: colors.danger }}>{t('appAssistant.audioError')}</Text>}
            </View>}
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
              <Text style={[styles.feedback, { color: colors.primaryText }]}>{t(busy === 'saving' ? 'appAssistant.saving' : busy === 'photo' ? 'appAssistant.photoWorking' : 'appAssistant.working')}</Text>
            </View>}
          </ScrollView>
          {preview ? <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={unavailable || stalePreview} onPress={() => void apply()} testID="asinu-assistant-apply"
              style={[styles.primary, { backgroundColor: colors.primaryText, opacity: unavailable || stalePreview ? 0.5 : 1 }]}>
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
              <Pressable accessibilityRole="button" accessibilityLabel={t('appAssistant.attachPhoto')} disabled={unavailable}
                onPress={() => void pickPhoto()} style={styles.send} testID="asinu-assistant-photo">
                <Ionicons name="image-outline" size={25} color={colors.primaryText} />
              </Pressable>
              {renderVoiceAnswerButton(voice)}
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
  message: { maxWidth: '94%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
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
