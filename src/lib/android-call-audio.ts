import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { CallAudioSound } from '../features/checkin-call/checkin-call.audio';

type PlaybackStatus = Parameters<CallAudioSound['setOnPlaybackStatusUpdate']>[0] extends (status: infer S) => void ? S : never;
type CallAudioModule = {
  loadCallAudio(callId: string, playerId: string, uri: string): Promise<boolean>;
  playCallAudio(playerId: string): Promise<boolean>;
  pauseCallAudio(playerId: string): Promise<boolean>;
  releaseCallAudio(playerId: string): Promise<boolean>;
};
const native = NativeModules.AsinuCheckinCallModule as CallAudioModule | undefined;

/** Local recordings use Telecom's voice route; no second audio-focus owner. */
export async function createAndroidCallSound(callId: string, uri: string): Promise<CallAudioSound> {
  if (Platform.OS !== 'android' || !native?.loadCallAudio) throw new Error('Call audio is unavailable');
  const playerId = randomUUID();
  let listener: ((status: PlaybackStatus) => void) | undefined;
  const subscription = new NativeEventEmitter(native as never).addListener('onCheckinCallPlaybackStatus',
    (status: PlaybackStatus & { playerId: string }) => { if (status.playerId === playerId) listener?.(status); });
  try { await native.loadCallAudio(callId, playerId, uri); }
  catch (error) { subscription.remove(); throw error; }
  return {
    setOnPlaybackStatusUpdate(callback) { listener = callback; },
    play() { void native.playCallAudio(playerId).catch(() => listener?.({ isLoaded: false, didJustFinish: false, error: 'Call playback failed' })); },
    async pauseAsync() { await native.pauseCallAudio(playerId); },
    async unloadAsync() { subscription.remove(); listener = undefined; await native.releaseCallAudio(playerId); },
  };
}
