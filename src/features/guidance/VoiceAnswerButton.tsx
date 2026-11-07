import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Audio } from '../../lib/audio';
import { chatApi } from '../chat/chat.api';
import { showToast } from '../../stores/toast.store';
import { guidanceAudio } from './guidance.audio';
import { guideColors as c } from './guidance.model';
import { ScaledText as Text } from '../../components/ScaledText';

/** Reuses the existing, consented transcription endpoint, never submits an answer. */
export function VoiceAnswerButton({ onText, onBeforeAi, onProcessingChange, disabled = false, practice = false }: {
  onText: (text: string) => void; onBeforeAi: () => Promise<boolean>; onProcessingChange?: (busy: boolean) => void; disabled?: boolean; practice?: boolean;
}) {
  const { t, i18n } = useTranslation('onboarding');
  const focused = useIsFocused();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<any>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const revision = useRef(0);
  const permissionRequest = useRef<number | null>(null);
  useEffect(() => { onProcessingChange?.(busy || recording); }, [busy, recording, onProcessingChange]);
  useEffect(() => {
    alive.current = focused;
    if (focused) { setRecording(false); setBusy(false); }
    const cancel = () => {
      ++revision.current;
      permissionRequest.current = null;
      const previous = recorder.current; recorder.current = null;
      void previous?.stopAndUnloadAsync().catch(() => {});
      locked.current = false;
      if (alive.current) { setRecording(false); setBusy(false); }
    };
    const sub = AppState.addEventListener('change', state => {
      // iOS temporarily becomes inactive while its microphone dialog is open.
      // A real background/blur still cancels the request and any recording.
      if (state !== 'active' && !(state === 'inactive' && permissionRequest.current !== null)) cancel();
    });
    return () => { alive.current = false; cancel(); sub.remove(); };
  }, [focused]);
  const press = async () => {
    if (locked.current || disabled || !alive.current) return;
    locked.current = true;
    const version = ++revision.current;
    const current = () => alive.current && version === revision.current;
    let transcribing = false;
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
        setRecording(false);
        await previous.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        if (!current()) return;
        const uri = previous.getURI();
        if (!uri) throw new Error('RECORDING_FILE_UNAVAILABLE');
        transcribing = true;
        const text = (await chatApi.transcribeAudio(uri, i18n.language.startsWith('en') ? 'en' : 'vi', 'checkin')).trim();
        if (current()) {
          if (text) onText(text);
          else showToast(t('guidance.voiceFailure'), 'info');
        }
      } else {
        if (!(await onBeforeAi()) || !current()) return;
        permissionRequest.current = version;
        let permission;
        try { permission = await Audio.requestPermissionsAsync(); }
        finally { if (permissionRequest.current === version) permissionRequest.current = null; }
        if (!current()) return;
        if (!permission.granted) { showToast(t('guidance.microphoneDenied'), 'info'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        if (!current()) return;
        const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        if (!current()) { await result.recording.stopAndUnloadAsync(); return; }
        recorder.current = result.recording; setRecording(true);
      }
    } catch {
      if (current()) {
        const previous = recorder.current; recorder.current = null;
        await previous?.stopAndUnloadAsync().catch(() => {});
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        if (current()) {
          setRecording(false);
          showToast(t(transcribing ? 'guidance.voiceTranscriptionFailure' : 'guidance.voiceRecordingFailure'), 'error');
        }
      }
    }
    finally { if (current()) { locked.current = false; setBusy(false); } }
  };
  const label = t(recording ? 'guidance.stopRecording' : 'guidance.speak');
  return <Pressable testID="checkin-voice-answer" accessibilityRole="button" accessibilityLabel={label} disabled={busy || disabled || !focused}
    accessibilityHint={recording ? t('guidance.voiceStopHint') : undefined}
    accessibilityState={{ disabled: busy || disabled || !focused, busy }}
    onPress={() => void press()} style={({ pressed }) => ({ minHeight: 56, minWidth: 56, padding: 12, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center', gap: 4,
      opacity: busy || disabled ? 0.5 : pressed ? 0.8 : 1 })}>
    {busy ? <ActivityIndicator color={c.primary} /> : <Ionicons name={recording ? 'stop-circle-outline' : 'mic-outline'} size={28} color={c.primary} />}
    <Text allowFontScaling style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>
      {busy ? t('guidance.voiceProcessing') : label}
    </Text>
  </Pressable>;
}
