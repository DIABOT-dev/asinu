export type CallAudioPrompt = { key: string; text: string; language: 'vi' | 'en'; attemptId?: string; personalizedUser?: boolean; noticeVersion?: string; audioVersion?: string; mimeType?: string };
export type CallAudioState = {
  phase: 'idle' | 'loading' | 'playing' | 'finished' | 'error';
  prompt: CallAudioPrompt | null;
  fallback: boolean;
};

export type CallAudioSound = {
  pauseAsync(): Promise<void>;
  unloadAsync(): Promise<void>;
  play(): void;
  setOnPlaybackStatusUpdate(listener: (status: {
    didJustFinish: boolean; isLoaded: boolean; playing?: boolean; error?: string | null;
  }) => void): void;
};

export function isFamilyNoticePrompt(key: string) {
  return key === 'family_mild' || key === 'family_urgent' || key === 'family_unknown';
}

type AudioDependencies = {
  load: (prompt: CallAudioPrompt) => Promise<string>;
  invalidate?: (prompt: CallAudioPrompt) => Promise<void>;
  prepare: () => Promise<void>;
  create: (uri: string) => Promise<CallAudioSound>;
  stopSpeech: () => Promise<void>;
  allowDeviceSpeech?: (prompt: CallAudioPrompt) => boolean;
  speak: (prompt: CallAudioPrompt, callbacks: {
    onStart: () => void; onDone: () => void; onError: () => void;
  }) => void;
  onState: (state: CallAudioState) => void;
};

/** One owner for both TTS recordings and device speech. Latest intent wins,
 * including while a download, native player creation or Speech.stop is pending. */
export class CheckinCallAudio {
  private version = 0;
  private sound: CallAudioSound | null = null;
  private speechStop: Promise<void> = Promise.resolve();
  private disposed = false;
  private fallbackVersion: number | null = null;
  private state: CallAudioState = { phase: 'idle', prompt: null, fallback: false };

  constructor(private readonly dependencies: AudioDependencies) {}

  private current(version: number) {
    return !this.disposed && this.version === version;
  }

  private update(state: CallAudioState) {
    this.state = state;
    if (!this.disposed) this.dependencies.onState(state);
  }

  private release(sound: CallAudioSound | null) {
    if (!sound) return Promise.resolve();
    // pauseAsync calls native pause synchronously before its Promise resolves.
    // Do not wait for network or speech cancellation to silence a recording.
    const paused = sound.pauseAsync().catch(() => {});
    return paused.then(() => sound.unloadAsync()).catch(() => {});
  }

  private cancel() {
    this.version += 1;
    const previous = this.sound;
    this.sound = null;
    const released = this.release(previous);
    // Serialize native Speech.stop calls. A late stop from an older request
    // must never silence the new fallback voice after it has started.
    this.speechStop = this.speechStop.catch(() => {}).then(() => this.dependencies.stopSpeech());
    return { version: this.version, stopped: Promise.all([released, this.speechStop]) };
  }

  async stop(clearPrompt = false) {
    const { stopped } = this.cancel();
    this.update(clearPrompt
      ? { phase: 'idle', prompt: null, fallback: false }
      : { ...this.state, phase: 'idle' });
    // Cancellation failure must not block submitting a health response.
    await stopped.catch(() => {});
  }

  private async fallback(version: number, prompt: CallAudioPrompt) {
    if (!this.current(version) || this.fallbackVersion === version) return;
    this.fallbackVersion = version;
    const failed = this.sound;
    this.sound = null;
    await this.release(failed);
    if (!this.current(version)) return;
    if (failed) {
      // A corrupt native recording must not be reused forever on every replay.
      // Evict only this prompt's cache entry; fallback speech remains available.
      await this.dependencies.invalidate?.(prompt).catch(() => {});
    }
    if (!this.current(version)) return;
    if (this.dependencies.allowDeviceSpeech?.(prompt) === false) {
      this.update({ phase: 'error', prompt, fallback: false });
      return;
    }
    try {
      // If native Speech.stop itself failed, do not enqueue overlapping speech.
      await this.speechStop;
      if (!this.current(version)) return;
      this.update({ phase: 'loading', prompt, fallback: true });
      this.dependencies.speak(prompt, {
        onStart: () => {
          if (this.current(version)) this.update({ phase: 'playing', prompt, fallback: true });
        },
        onDone: () => {
          if (this.current(version)) this.update({ phase: 'finished', prompt, fallback: true });
        },
        onError: () => {
          if (this.current(version)) this.update({ phase: 'error', prompt, fallback: true });
        },
      });
    } catch {
      if (this.current(version)) this.update({ phase: 'error', prompt, fallback: true });
    }
  }

  async play(prompt: CallAudioPrompt) {
    if (this.disposed) return;
    const { version, stopped } = this.cancel();
    this.update({ phase: 'loading', prompt, fallback: false });
    try {
      await stopped;
      if (!this.current(version)) return;
      const uri = await this.dependencies.load(prompt);
      if (!this.current(version)) return;
      await this.dependencies.prepare();
      if (!this.current(version)) return;
      // Never autoplay an unowned player: cancellation cannot reach it yet.
      const sound = await this.dependencies.create(uri);
      if (!this.current(version)) {
        await this.release(sound);
        return;
      }
      this.sound = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (!this.current(version) || this.sound !== sound) return;
        if (status.error) {
          // expo-audio reports decode/playback failures asynchronously, after
          // createAsync has returned; catch alone cannot handle these errors.
          void this.fallback(version, prompt);
        } else if (status.didJustFinish) {
          this.sound = null;
          this.update({ phase: 'finished', prompt, fallback: false });
          void this.release(sound);
        } else if (status.playing && this.state.phase !== 'playing') {
          this.update({ phase: 'playing', prompt, fallback: false });
        }
      });
      sound.play();
    } catch {
      await this.fallback(version, prompt);
    }
  }

  dispose() {
    this.disposed = true;
    void this.cancel().stopped.catch(() => {});
  }
}
