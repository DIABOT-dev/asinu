import type { CallAutoplayScope } from './checkin-call.autoplay';

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
  claimAutoplay?: (scope: CallAutoplayScope, key: string) => Promise<boolean>;
};

/** One owner for both TTS recordings and device speech. Latest intent wins,
 * including while a download, native player creation or Speech.stop is pending. */
export class CheckinCallAudio {
  // Navigation/remounts can briefly leave more than one call screen alive.
  // All instances share the same output ownership, not just their own player.
  private static activeOwner: CheckinCallAudio | null = null;
  private static readonly owners = new Set<CheckinCallAudio>();
  private version = 0;
  private sound: CallAudioSound | null = null;
  private readonly retiringSounds = new Set<CallAudioSound>();
  private readonly releases = new Map<CallAudioSound, Promise<void>>();
  private speechStop: Promise<void> = Promise.resolve();
  private speechVersion: number | null = null;
  private disposed = false;
  private fallbackVersion: number | null = null;
  private state: CallAudioState = { phase: 'idle', prompt: null, fallback: false };

  constructor(private readonly dependencies: AudioDependencies) {}

  private current(version: number) {
    return !this.disposed && this.version === version && CheckinCallAudio.activeOwner === this;
  }

  private update(state: CallAudioState) {
    this.state = state;
    if (!this.disposed) this.dependencies.onState(state);
  }

  private release(sound: CallAudioSound | null) {
    if (!sound) return Promise.resolve();
    const pending = this.releases.get(sound);
    if (pending) return pending;
    this.retiringSounds.add(sound);
    // pauseAsync calls native pause synchronously before its Promise resolves.
    // Do not wait for network or speech cancellation to silence a recording.
    const released = (async () => {
      let paused = false;
      try { await sound.pauseAsync(); paused = true; } catch {}
      try { await sound.unloadAsync(); } catch (error) {
        // A paused sound is already silent even if disposing it fails. If both
        // operations fail, do not start another recording or fallback voice.
        if (!paused) throw error;
      }
    })();
    this.releases.set(sound, released);
    void released.then(() => {
      this.retiringSounds.delete(sound);
      this.releases.delete(sound);
    }, () => {
      // Retain the resource so a later explicit replay/stop can retry cleanup.
      this.releases.delete(sound);
    });
    return released;
  }

  private cancel() {
    this.version += 1;
    const previous = this.sound;
    this.sound = null;
    if (previous) this.retiringSounds.add(previous);
    // A rapid third intent must also wait for the first recording's cleanup,
    // even though the second intent already detached it from this.sound.
    const released = Promise.all([...this.retiringSounds].map(sound => this.release(sound)));
    // Serialize native Speech.stop calls. A late stop from an older request
    // must never silence the new fallback voice after it has started.
    if (CheckinCallAudio.activeOwner === this || CheckinCallAudio.owners.has(this)) {
      this.speechStop = this.speechStop.catch(() => {}).then(() => this.dependencies.stopSpeech())
        .then(() => { this.speechVersion = null; });
    }
    const version = this.version;
    const stopped = Promise.all([released, this.speechStop]);
    void stopped.then(() => {
      if (this.version === version && (this.disposed || CheckinCallAudio.activeOwner !== this)) {
        CheckinCallAudio.owners.delete(this);
        if (CheckinCallAudio.activeOwner === this) CheckinCallAudio.activeOwner = null;
      }
    }, () => {
      // An unmounted instance that never started speech and owns no recording
      // has nothing audible left to block future call screens.
      if (this.disposed && this.version === version && this.retiringSounds.size === 0 && this.speechVersion === null) {
        CheckinCallAudio.owners.delete(this);
        if (CheckinCallAudio.activeOwner === this) CheckinCallAudio.activeOwner = null;
      }
    });
    return { version, stopped };
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
    try { await this.release(failed); } catch {
      if (this.current(version)) this.update({ phase: 'error', prompt, fallback: false });
      return;
    }
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
      this.speechVersion = version;
      this.dependencies.speak(prompt, {
        onStart: () => {
          if (this.current(version)) this.update({ phase: 'playing', prompt, fallback: true });
        },
        onDone: () => {
          if (this.speechVersion === version) this.speechVersion = null;
          if (this.current(version)) this.update({ phase: 'finished', prompt, fallback: true });
        },
        onError: () => {
          if (this.speechVersion === version) this.speechVersion = null;
          if (this.current(version)) this.update({ phase: 'error', prompt, fallback: true });
        },
      });
    } catch {
      if (this.current(version)) this.update({ phase: 'error', prompt, fallback: true });
    }
  }

  showPrompt(prompt: CallAudioPrompt) {
    const { stopped } = this.cancel();
    this.update({ phase: 'idle', prompt, fallback: false });
    return stopped.catch(() => {});
  }

  async play(prompt: CallAudioPrompt, options: { automatic?: boolean; scope?: CallAutoplayScope } = {}) {
    if (this.disposed) return;
    CheckinCallAudio.activeOwner = this;
    const otherStops = [...CheckinCallAudio.owners]
      .filter(owner => owner !== this)
      .map(owner => {
        const interrupted = owner.cancel();
        owner.update({ ...owner.state, phase: 'idle' });
        return interrupted.stopped;
      });
    CheckinCallAudio.owners.add(this);
    const { version, stopped } = this.cancel();
    this.update({ phase: 'loading', prompt, fallback: false });
    try {
      await Promise.all([stopped, ...otherStops]);
    } catch {
      // Failed cancellation is not a synthesis failure: falling back to TTS
      // here could speak over a recording that native code could not silence.
      if (this.current(version)) this.update({ phase: 'error', prompt, fallback: false });
      return;
    }
    try {
      if (!this.current(version)) return;
      // A manual replay also consumes this prompt's automatic allowance, but
      // never depends on storage succeeding. Claim before download/playback so
      // remounts, duplicate joins and interrupted recordings cannot start over.
      const allowed = options.scope
        ? await this.dependencies.claimAutoplay?.(options.scope, prompt.key).catch(() => false)
        : false;
      if (!this.current(version)) return;
      if (options.automatic && !allowed) {
        this.update({ phase: 'idle', prompt, fallback: false });
        return;
      }
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
          void this.release(sound).catch(() => {});
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
