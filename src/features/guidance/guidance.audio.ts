import { NativeModules, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from '../../lib/audio';
import { CheckinCallAudio } from '../checkin-call/checkin-call.audio';

/** Only fixed guidance text uses the permitted temporary device-voice fallback.
 * Check-in calls keep their existing Tuấn Anh recordings and audio policy. */
export class GuidanceAudio {
  private version = 0;
  private barrier: Promise<void> = Promise.resolve();
  private active = false;
  constructor() { CheckinCallAudio.registerExternalStop(() => this.stop()); }
  stop() {
    ++this.version;
    if (!this.active) return this.barrier;
    this.active = false;
    // Invoke native cancellation immediately, not after another async request.
    const stop = Speech.stop();
    this.barrier = Promise.all([this.barrier, stop]).then(() => {});
    void this.barrier.catch(() => {});
    return this.barrier;
  }
  async speak(text: string, language: string, manual = false) {
    const cancelled = this.stop();
    const version = this.version;
    this.active = true;
    try {
      await cancelled;
      await CheckinCallAudio.stopAll();
      if (version !== this.version) return;
      if (!manual && Platform.OS === 'android') {
        // Older builds cannot prove that ringing is enabled: stay silent there
        // automatically, while explicit Replay remains available.
        const native = NativeModules.AsinuCheckinCallModule;
        if (!native?.isGuidanceSoundAllowed || !(await native.isGuidanceSoundAllowed())) {
          if (version === this.version) this.active = false;
          return;
        }
      }
      if (version !== this.version) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: manual, allowsRecordingIOS: false });
      if (version !== this.version) return;
      const voices = await Speech.getAvailableVoicesAsync();
      if (version !== this.version) return;
      const locale = language.startsWith('en') ? 'en' : 'vi';
      const voice = voices.find(candidate => candidate.language.startsWith(locale));
      // Do not substitute an unrelated language if Vietnamese isn't installed.
      if (!voice) { this.active = false; return; }
      Speech.speak(text, { language: locale === 'vi' ? 'vi-VN' : 'en-US', voice: voice.identifier,
        rate: 0.82, pitch: 1, volume: 1, useApplicationAudioSession: true,
        onDone: () => { if (version === this.version) this.active = false; },
        onError: () => { if (version === this.version) this.active = false; },
      });
    } catch { if (version === this.version) this.active = false; }
  }
}
export const guidanceAudio = new GuidanceAudio();
