import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Audio } from '../../lib/audio';
import { chatApi } from '../chat/chat.api';
import { showToast } from '../../stores/toast.store';
import { guidanceAudio } from './guidance.audio';
import { guideColors as c } from './guidance.model';

/** Reuses the existing, consented transcription endpoint, never submits an answer. */
export function VoiceAnswerButton({ onText, onBeforeAi, disabled = false, practice = false }: {
  onText: (text: string) => void; onBeforeAi: () => Promise<boolean>; disabled?: boolean; practice?: boolean;
}) {
  const { t, i18n } = useTranslation('onboarding');
  const focused = useIsFocused();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<any>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    alive.current = focused;
    const cancel = () => {
      ++revision.current;
      const previous = recorder.current; recorder.current = null;
      void previous?.stopAndUnloadAsync().catch(() => {});
      locked.current = false;
      if (alive.current) { setRecording(false); setBusy(false); }
    };
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => { alive.current = false; cancel(); sub.remove(); };
  }, [focused]);
  const press = async () => {
    if (locked.current || disabled) return;
    locked.current = true;
    const version = ++revision.current;
    const current = () => alive.current && version === revision.current;
    setBusy(true);
    try {
      await guidanceAudio.stop();
      if (!current()) return;
      if (practice) {
        if (recording) {
          setRecording(false); onText(t('guidance.practiceVoiceExample'));
          showToast(t('guidance.practiceVoiceNotice'), 'info');
        } else setRecording(true);
        return;
      }
      if (recorder.current) {
        const previous = recorder.current; recorder.current = null;
        await previous.stopAndUnloadAsync();
        if (!current()) return;
        setRecording(false);
        const uri = previous.getURI();
        if (!uri) return;
        const text = await chatApi.transcribeAudio(uri, i18n.language.startsWith('en') ? 'en' : 'vi');
        if (current() && text) onText(text);
      } else {
        if (!(await onBeforeAi()) || !current()) return;
        const permission = await Audio.requestPermissionsAsync();
        if (!current()) return;
        if (!permission.granted) { showToast(t('guidance.microphoneDenied'), 'info'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        if (!current()) return;
        const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        if (!current()) { await result.recording.stopAndUnloadAsync(); return; }
        recorder.current = result.recording; setRecording(true);
      }
    } catch { if (current()) showToast(t('guidance.voiceFailure'), 'error'); }
    finally { if (current()) { locked.current = false; setBusy(false); } }
  };
  const label = t(recording ? 'guidance.stopRecording' : 'guidance.speak');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled}
    accessibilityState={{ disabled: busy || disabled, busy }}
    onPress={() => void press()} style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 14,
      backgroundColor: c.actionBackground, alignItems: 'center', gap: 4, maxWidth: 110,
      opacity: busy || disabled ? 0.5 : pressed ? 0.8 : 1 })}>
    {busy ? <ActivityIndicator color={c.onAction} /> : <Ionicons name={recording ? 'stop-circle-outline' : 'mic-outline'} size={28} color={c.onAction} />}
    <Text allowFontScaling style={{ fontSize: 22, fontWeight: '700', color: c.onAction }}>{label}</Text>
  </Pressable>;
}
