import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
export type LiveDictation = { start(): void; stop(): void; cancel(): void };

/** Older development clients keep the existing recording/upload path until rebuilt. */
export function getLiveDictationModule(): SpeechModule | null {
  if (Platform.OS === 'web') {return null;}
  try {
    const module = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');
    return module?.isRecognitionAvailable() ? module : null;
  } catch {
    return null;
  }
}

/** One short utterance. Interim hypotheses replace each other, never append. */
export function createLiveDictation(module: SpeechModule, options: {
  language: string;
  onInterim(text: string): void;
  onDone(result: { text: string; error?: string }): void;
}): LiveDictation {
  let settled = false;
  let stopping = false;
  let latest = '';
  let terminalError: string | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let limitTimer: ReturnType<typeof setTimeout> | undefined;
  const subscriptions: { remove(): void }[] = [];
  const clean = () => {
    subscriptions.splice(0).forEach(subscription => subscription.remove());
    clearTimeout(stopTimer);
    clearTimeout(limitTimer);
  };
  const finish = (error = terminalError) => {
    if (settled) {return;}
    settled = true;
    clean();
    options.onDone({ text: latest, ...(error ? { error } : {}) });
  };
  const waitForEnd = () => {
    if (stopTimer || settled) {return;}
    stopTimer = setTimeout(() => {
      try { module.abort(); } catch {}
      finish();
    }, 2500);
  };
  const stop = () => {
    if (settled || stopping) {return;}
    stopping = true;
    // Some recognizers never emit a final event after Stop. Preserve the latest
    // visible hypothesis instead of leaving the input locked indefinitely.
    waitForEnd();
    try { module.stop(); } catch { finish('audio-capture'); }
  };
  return {
    start() {
      if (settled || subscriptions.length) {return;}
      subscriptions.push(
        module.addListener('result', event => {
          if (settled) {return;}
          const text = event.results[0]?.transcript?.trim();
          if (text && text !== latest) {
            latest = text;
            options.onInterim(text);
          }
          if (event.isFinal) {waitForEnd();}
        }),
        module.addListener('error', event => { terminalError = event.error; waitForEnd(); }),
        module.addListener('nomatch', waitForEnd),
        module.addListener('end', () => finish()),
      );
      limitTimer = setTimeout(stop, 60000);
      try {
        module.start({
          lang: options.language.startsWith('en') ? 'en-US' : 'vi-VN',
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          recordingOptions: { persist: false },
        });
      } catch { finish('audio-capture'); }
    },
    stop,
    cancel() {
      if (settled) {return;}
      settled = true;
      clean();
      try { module.abort(); } catch {}
    },
  };
}
