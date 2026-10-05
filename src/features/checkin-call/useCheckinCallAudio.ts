import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { Audio } from '../../lib/audio';
import { setVoipCallUIActive } from '../../lib/voip';
import { CheckinCallAudio, isFamilyNoticePrompt, type CallAudioPrompt, type CallAudioState } from './checkin-call.audio';
import { checkinCallApi, type CheckinCallAttempt } from './checkin-call.api';

export const CALL_AUDIO_TRANSLATIONS: Record<string, string> = {
  user_prompt: 'audio.userPrompt',
  triage_location_prompt: 'audio.triageLocationPrompt',
  triage_symptom_prompt: 'audio.triageSymptomPrompt',
  triage_intensity_prompt: 'audio.triageIntensityPrompt',
  user_ok: 'audio.userOk',
  user_mild: 'audio.userMild',
  user_urgent: 'audio.userUrgent',
  user_retry: 'audio.userRetry',
  family_mild: 'audio.familyMild',
  family_urgent: 'audio.familyUrgent',
  family_unknown: 'audio.familyUnknown',
};

// Cache identity includes the text, not just severity: a changed family notice
// or translation must never reuse a different person's/outdated recording.
function textHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function useCheckinCallAudio(
  attempt: CheckinCallAttempt | null,
  language: 'vi' | 'en',
  translate: (key: string) => string,
) {
  const [audio, setAudio] = useState<CallAudioState>({ phase: 'idle', prompt: null, fallback: false });
  const player = useRef<CheckinCallAudio | null>(null);
  const context = useRef({ attempt, language, translate });
  context.current = { attempt, language, translate };

  useEffect(() => {
    // Coalesce repeated replay taps. They invalidate playback, not the same
    // pending synthesis/download (which would otherwise hit rate limits).
    const downloads = new Map<string, Promise<string>>();
    const loaded = new Set<string>();
    const invalidations = new Map<string, Promise<void>>();
    let ownsNativeAudioSession = false;
    const identity = (prompt: CallAudioPrompt) => {
      const personalizedFamily = isFamilyNoticePrompt(prompt.key) && Boolean(prompt.attemptId);
      const key = prompt.language + '-' +
        (personalizedFamily ? prompt.attemptId + '-' : '') + prompt.key + '-' + textHash(prompt.text);
      const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + 'checkin-call-' + key + '.mp3';
      return { key, uri, personalizedFamily };
    };
    const owner = new CheckinCallAudio({
      load: async (prompt) => {
        const { key: localizedKey, uri, personalizedFamily } = identity(prompt);
        await invalidations.get(localizedKey);
        if (loaded.has(localizedKey)) return uri;
        const existing = downloads.get(localizedKey);
        if (existing) return existing;
        const download = (async () => {
          const info = await FileSystem.getInfoAsync(uri);
          // Identity includes locale, exact family attempt and spoken text.
          // Reopening a call can use a valid local recording without waiting
          // for another server request or another personalized TTS synthesis.
          if (info.exists && !info.isDirectory && info.size > 0) {
            loaded.add(localizedKey);
            return uri;
          }
          const result = personalizedFamily
            ? await checkinCallApi.familyAudio(prompt.attemptId!)
            : CALL_AUDIO_TRANSLATIONS[prompt.key]
              ? await checkinCallApi.audio(prompt.key)
              : await checkinCallApi.conclusionAudio(prompt.text);
          await FileSystem.writeAsStringAsync(uri, result.base64, { encoding: 'base64' });
          loaded.add(localizedKey);
          return uri;
        })();
        downloads.set(localizedKey, download);
        try { return await download; } finally { downloads.delete(localizedKey); }
      },
      invalidate: async prompt => {
        const { key, uri } = identity(prompt);
        loaded.delete(key);
        const removing = FileSystem.deleteAsync(uri, { idempotent: true });
        invalidations.set(key, removing);
        try { await removing; } finally { invalidations.delete(key); }
      },
      prepare: async () => {
        const current = context.current.attempt;
        ownsNativeAudioSession = current ? await setVoipCallUIActive(current.id, true,
          current.episode_state === 'TRIAGE_USER' ? current.next_action_at : current.confirm_deadline) : false;
        // CallKit owns category/activation. Expo must not replace it with a
        // playback session or deactivate it when a short prompt finishes.
        if (!ownsNativeAudioSession) await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      },
      create: async uri => (await Audio.Sound.createAsync({ uri }, { shouldPlay: false, keepAudioSessionActive: ownsNativeAudioSession })).sound,
      stopSpeech: () => Speech.stop(),
      speak: (prompt, callbacks) => Speech.speak(prompt.text, {
        language: prompt.language === 'en' ? 'en-US' : 'vi-VN',
        rate: 0.85,
        useApplicationAudioSession: true,
        ...callbacks,
      }),
      onState: setAudio,
    });
    player.current = owner;
    return () => {
      player.current = null;
      owner.dispose();
    };
  }, []);

  const stopAudio = useCallback((clearPrompt = true) => player.current?.stop(clearPrompt) ?? Promise.resolve(), []);
  const play = useCallback((key: string, text?: string) => {
    const current = context.current;
    const personalized = isFamilyNoticePrompt(key) ? current.attempt?.family_notice?.audio_text : null;
    const prompt: CallAudioPrompt = {
      key,
      text: text || personalized || current.translate(CALL_AUDIO_TRANSLATIONS[key] || 'audio.userRetry'),
      language: current.language,
      attemptId: current.attempt?.target_role === 'FAMILY' ? current.attempt.id : undefined,
    };
    return player.current?.play(prompt) ?? Promise.resolve();
  }, []);

  return { audio, play, stopAudio };
}
