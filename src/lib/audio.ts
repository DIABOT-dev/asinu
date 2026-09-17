import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync as setExpoAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';

type LegacyAudioMode = {
  allowsRecordingIOS?: boolean;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
};

type RecordingStatus = {
  metering?: number;
  isFinished?: boolean;
  hasError?: boolean;
  error?: string | null;
  url?: string | null;
};

type RecordingStatusListener = (status: RecordingStatus) => void;

type RecordingOptions = Record<string, any>;

function normalizeRecordingOptions(options: RecordingOptions, metering = false) {
  const platformOptions = Platform.OS === 'ios'
    ? options.ios
    : Platform.OS === 'android'
      ? options.android
      : options.web;

  return {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: metering || options.isMeteringEnabled || false,
    ...(options.directory ? { directory: options.directory } : {}),
    ...(platformOptions ?? {}),
  };
}

class LegacyRecording {
  private readonly nativeRecorder: any;
  private readonly statusSubscription?: { remove: () => void };
  private readonly statusTimer?: ReturnType<typeof setInterval>;

  constructor(options: RecordingOptions, listener?: RecordingStatusListener) {
    const Recorder = (AudioModule as any).AudioRecorder ?? (AudioModule as any).AudioRecorderWeb;
    this.nativeRecorder = new Recorder(normalizeRecordingOptions(options, Boolean(listener)));
    if (listener) {
      this.statusSubscription = this.nativeRecorder.addListener('recordingStatusUpdate', listener);
      this.statusTimer = setInterval(() => {
        try {
          listener(this.nativeRecorder.getStatus());
        } catch {
          // The native recorder can be released while a status tick is queued.
        }
      }, 100);
    }
  }

  async startAsync() {
    await this.nativeRecorder.prepareToRecordAsync();
    this.nativeRecorder.record();
  }

  async stopAndUnloadAsync() {
    await this.nativeRecorder.stop();
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.statusSubscription?.remove();
    this.nativeRecorder.remove?.();
    this.nativeRecorder.clearTimeouts?.();
  }

  getURI() {
    return this.nativeRecorder.uri ?? null;
  }
}

class LegacySound {
  private readonly player: any;
  private playbackSubscription?: { remove: () => void };

  constructor(source: any) {
    this.player = createAudioPlayer(source);
  }

  async pauseAsync() {
    this.player.pause();
  }

  async unloadAsync() {
    this.playbackSubscription?.remove();
    this.playbackSubscription = undefined;
    this.player.remove();
  }

  setOnPlaybackStatusUpdate(listener: (status: { didJustFinish: boolean; isLoaded: boolean }) => void) {
    this.playbackSubscription?.remove();
    this.playbackSubscription = this.player.addListener('playbackStatusUpdate', (status: any) => {
      listener({
        didJustFinish: Boolean(status.didJustFinish),
        isLoaded: Boolean(status.isLoaded),
      });
    });
  }

  play() {
    this.player.play();
  }
}

export const Audio = {
  RecordingOptionsPresets: {
    HIGH_QUALITY: RecordingPresets.HIGH_QUALITY,
  },
  Recording: {
    async createAsync(
      options: RecordingOptions,
      listener?: RecordingStatusListener,
      _progressUpdateInterval?: number,
    ) {
      const recording = new LegacyRecording(options, listener);
      await recording.startAsync();
      return { recording };
    },
  },
  Sound: {
    async createAsync(source: any, initialStatus?: { shouldPlay?: boolean }) {
      const sound = new LegacySound(source);
      if (initialStatus?.shouldPlay) sound.play();
      return { sound, status: { isLoaded: true } };
    },
  },
  requestPermissionsAsync: requestRecordingPermissionsAsync,
  getPermissionsAsync: getRecordingPermissionsAsync,
  setAudioModeAsync: async (mode: LegacyAudioMode) => {
    const mapped: Record<string, boolean> = {};
    if (mode.allowsRecordingIOS !== undefined) mapped.allowsRecording = mode.allowsRecordingIOS;
    if (mode.playsInSilentModeIOS !== undefined) mapped.playsInSilentMode = mode.playsInSilentModeIOS;
    if (mode.staysActiveInBackground !== undefined) mapped.shouldPlayInBackground = mode.staysActiveInBackground;
    await setExpoAudioModeAsync(mapped);
  },
};
