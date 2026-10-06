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

// Cache identity includes the backend voice revision, transcript and recipient.
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
    const downloads = new Map<string, Promise<{ uri: string; audioVersion?: string }>>();
    const versions = new Map<string, Promise<string | undefined>>();
    const loaded = new Set<string>();
    const invalidations = new Map<string, Promise<void>>();
    let ownsNativeAudioSession = false;
    const currentVersion = async (locale: 'vi' | 'en') => {
      let pending = versions.get(locale);
      if (!pending) {
        pending = checkinCallApi.audioConfig(locale)
          .then(result => typeof result.version === 'string' && result.version ? result.version : undefined)
          // Older backends still work, but their unversioned recordings are
          // downloaded afresh instead of trusting a potentially stale cache.
          .catch(() => undefined);
        versions.set(locale, pending);
      }
      try { return await pending; } finally {
        if (versions.get(locale) === pending) versions.delete(locale);
      }
    };
    const identity = (prompt: CallAudioPrompt) => {
      const personalizedFamily = isFamilyNoticePrompt(prompt.key) && Boolean(prompt.attemptId);
      const personalizedUser = Boolean(prompt.personalizedUser && prompt.attemptId);
      const key = 'audio-v2-' + encodeURIComponent(prompt.audioVersion || 'unversioned') + '-' + prompt.language + '-' +
        (personalizedFamily || personalizedUser ? prompt.attemptId + '-' : '') +
        (personalizedUser ? (prompt.noticeVersion || '') + '-' : '') + prompt.key + '-' + textHash(prompt.text);
      const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + 'checkin-call-' + key + '.mp3';
      return { key, uri, personalizedFamily, personalizedUser };
    };
    const owner = new CheckinCallAudio({
      load: async (prompt) => {
        // Revalidate on each playback, including replay in an already open call.
        prompt.audioVersion = await currentVersion(prompt.language);
        const { key: localizedKey, uri, personalizedFamily, personalizedUser } = identity(prompt);
        await invalidations.get(localizedKey);
        if (prompt.audioVersion && loaded.has(localizedKey)) return uri;
        let download = downloads.get(localizedKey);
        if (!download) {
          download = (async () => {
            if (prompt.audioVersion) {
              const info = await FileSystem.getInfoAsync(uri);
              if (info.exists && !info.isDirectory && info.size > 0) {
                loaded.add(localizedKey);
                return { uri, audioVersion: prompt.audioVersion };
              }
            }
            const result = personalizedUser
              ? await checkinCallApi.userAudio(prompt.attemptId!, prompt.key, prompt.noticeVersion, prompt.language)
              : personalizedFamily
                ? await checkinCallApi.familyAudio(prompt.attemptId!, prompt.language)
                : CALL_AUDIO_TRANSLATIONS[prompt.key]
                  ? await checkinCallApi.audio(prompt.key, prompt.language)
                  : await checkinCallApi.conclusionAudio(prompt.text, prompt.language);
            // The voice can change between metadata and synthesis. Store under
            // the actual response version so the old version cannot be poisoned.
            const saved = identity({ ...prompt, audioVersion: result.audioVersion });
            await invalidations.get(saved.key);
            await FileSystem.writeAsStringAsync(saved.uri, result.base64, { encoding: 'base64' });
            if (result.audioVersion) loaded.add(saved.key);
            return { uri: saved.uri, audioVersion: result.audioVersion };
          })();
          downloads.set(localizedKey, download);
        }
        try {
          const result = await download;
          prompt.audioVersion = result.audioVersion;
          return result.uri;
        } finally {
          if (downloads.get(localizedKey) === download) downloads.delete(localizedKey);
        }
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
      // Vietnamese calls keep the configured backend voice on load failure.
      allowDeviceSpeech: prompt => prompt.language === 'en',
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
    const userText = current.attempt?.target_role === 'USER' ? current.attempt.user_notice?.prompts[key] : null;
    const personalized = isFamilyNoticePrompt(key) ? current.attempt?.family_notice?.audio_text : userText;
    const prompt: CallAudioPrompt = {
      key,
      text: text || personalized || current.translate(CALL_AUDIO_TRANSLATIONS[key] || 'audio.userRetry'),
      language: current.language,
      attemptId: current.attempt?.id,
      personalizedUser: !!userText,
      noticeVersion: userText ? current.attempt?.user_notice?.version : undefined,
    };
    return player.current?.play(prompt) ?? Promise.resolve();
  }, []);

  return { audio, play, stopAudio };
}
