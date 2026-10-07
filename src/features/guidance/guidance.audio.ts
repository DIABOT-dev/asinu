import { NativeModules, Platform } from 'react-native';
import { Audio } from '../../lib/audio';
import { CheckinCallAudio, type CallAudioSound } from '../checkin-call/checkin-call.audio';
import { guidanceAssets, type GuidanceClip } from './guidance.assets';

/** Bundled Asinu Tuấn Anh v4 only, never the platform's default TTS voice. */
export class GuidanceAudio {
  private version = 0;
  private barrier: Promise<void> = Promise.resolve();
  private sound: CallAudioSound | null = null;
  private readonly retiring = new Set<CallAudioSound>();
  private readonly releases = new Map<CallAudioSound, Promise<void>>();

  constructor() { CheckinCallAudio.registerExternalStop(() => this.stop()); }

  private release(sound: CallAudioSound) {
    const existing = this.releases.get(sound);
    if (existing) return existing;
    this.retiring.add(sound);
    const release = (async () => {
      let paused = false;
      // Native pause begins now, not after awaiting an older cancellation.
      try { await sound.pauseAsync(); paused = true; } catch {}
      try { await sound.unloadAsync(); } catch (error) { if (!paused) throw error; }
    })();
    this.releases.set(sound, release);
    void release.then(() => {
      this.retiring.delete(sound); this.releases.delete(sound);
    }, () => { this.releases.delete(sound); });
    return release;
  }

  stop() {
    ++this.version;
    const previous = this.sound; this.sound = null;
    if (previous) this.retiring.add(previous);
    const releases = [...this.retiring].map(sound => this.release(sound));
    this.barrier = Promise.all([this.barrier.catch(() => {}), ...releases]).then(() => {});
    void this.barrier.catch(() => {});
    return this.barrier;
  }

  async speak(clip: GuidanceClip, language: string, manual = false) {
    const cancelled = this.stop();
    const version = this.version;
    try {
      await cancelled;
      if (version !== this.version) return;
      await CheckinCallAudio.stopAll();
      if (version !== this.version) return;
      if (!manual && Platform.OS === 'android') {
        // Older builds cannot prove that ringing is enabled: stay silent there
        // automatically, while explicit Replay remains available.
        const native = NativeModules.AsinuCheckinCallModule;
        if (!native?.isGuidanceSoundAllowed || !(await native.isGuidanceSoundAllowed())) {
          return;
        }
      }
      if (version !== this.version) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: manual, allowsRecordingIOS: false });
      if (version !== this.version) return;
      const locale = language.startsWith('en') ? 'en' : 'vi';
      const source = guidanceAssets[locale][clip];
      if (typeof source !== 'number') return;
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false });
      if (version !== this.version) { await this.release(sound); return; }
      this.sound = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (version !== this.version || this.sound !== sound) return;
        if (status.didJustFinish || status.error) {
          this.sound = null;
          void this.release(sound).catch(() => {});
        }
      });
      sound.play();
    } catch {
      // Keep text and health actions usable on audio failure. No OS-voice fallback.
      if (version === this.version) await this.stop().catch(() => {});
    }
  }
}
export const guidanceAudio = new GuidanceAudio();
