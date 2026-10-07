import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiClient } from '../../lib/apiClient';
import { defaultProgress, mergeProgress, type GuidePatch, type GuideProgress, type GuideStep } from './guidance.model';

type Cache = { progress: GuideProgress; pending: GuidePatch };
type State = {
  account: string | null;
  progress: GuideProgress;
  pending: GuidePatch;
  inFlight: GuidePatch;
  ready: boolean;
  syncing: boolean;
  load: (account: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  update: (patch: GuidePatch) => void;
  acknowledge: (step: GuideStep) => void;
  flush: () => Promise<void>;
  replay: () => Promise<void>;
};
let generation = 0;
let cacheWrites = Promise.resolve();
const keyFor = (account: string) => `guidance:account:${account}:v1`;
const combinePatches = (older: GuidePatch, newer: GuidePatch): GuidePatch => ({ ...older, ...newer,
  completed: [...new Set([...(older.completed || []), ...(newer.completed || [])])],
});
function cache(account: string, value: Cache) {
  cacheWrites = cacheWrites.catch(() => {}).then(() => AsyncStorage.setItem(keyFor(account), JSON.stringify(value)));
  void cacheWrites.catch(() => {});
}

export const useGuidanceStore = create<State>((set, get) => ({
  account: null, progress: defaultProgress(), pending: {}, inFlight: {}, ready: false, syncing: false,
  async load(account) {
    const epoch = ++generation;
    set({ account, progress: defaultProgress(), pending: {}, inFlight: {}, ready: false, syncing: false });
    if (!account) return;
    try {
      const raw = await AsyncStorage.getItem(keyFor(account));
      const saved: Cache | null = raw ? JSON.parse(raw) : null;
      if (epoch !== generation) return;
      if (saved?.progress && Array.isArray(saved.progress.completed) && Number.isInteger(saved.progress.epoch)) {
        set({ progress: saved.progress, pending: saved.pending || {}, ready: true });
      }
    } catch { /* Account cache is optional; the server remains authoritative. */ }
    if (epoch !== generation) return;
    await get().refresh();
  },
  async refresh() {
    const epoch = generation;
    const account = get().account;
    if (!account || get().syncing) return;
    try {
      const response = await apiClient<{ ok: boolean; progress: GuideProgress }>('/api/mobile/guidance');
      if (epoch !== generation || !response.ok) return;
      const current = get();
      if (current.ready && response.progress.epoch < current.progress.epoch) return;
      const sameEpoch = !current.ready || response.progress.epoch === current.progress.epoch;
      const pending = sameEpoch ? current.pending : {};
      const inFlight = sameEpoch ? current.inFlight : {};
      const allPending = combinePatches(inFlight, pending);
      const progress = mergeProgress(response.progress, allPending);
      if (!sameEpoch) ++generation;
      set({ progress, pending, inFlight, ready: true, syncing: sameEpoch && current.syncing });
      cache(account, { progress, pending: allPending });
      await get().flush();
    } catch { /* Never block health actions while guidance is offline. */ }
  },
  update(patch) {
    const state = get();
    if (!state.account || !state.ready) return;
    const progress = mergeProgress(state.progress, patch);
    const pending = combinePatches(state.pending, patch);
    set({ progress, pending });
    cache(state.account, { progress, pending: combinePatches(state.inFlight, pending) });
    void get().flush();
  },
  acknowledge(step) { get().update({ completed: [step] }); },
  async flush() {
    const state = get();
    if (!state.account || !state.ready || state.syncing || Object.keys(state.pending).length === 0) return;
    const epoch = generation;
    const sending = state.pending;
    // Detach this batch so taps during the request remain queued separately.
    set({ syncing: true, pending: {}, inFlight: sending });
    try {
      const response = await apiClient<{ ok: boolean; progress: GuideProgress }>('/api/mobile/guidance', {
        method: 'PUT', body: { ...sending, epoch: state.progress.epoch },
      });
      if (epoch !== generation) return;
      if (!response.ok) throw new Error('GUIDANCE_SAVE_FAILED');
      const remaining = get().pending;
      const progress = mergeProgress(response.progress, remaining);
      set({ progress, syncing: false, inFlight: {} });
      cache(state.account, { progress, pending: remaining });
      await get().flush();
    } catch (error: any) {
      if (epoch !== generation) return;
      const pending = combinePatches(sending, get().pending);
      set({ syncing: false, pending, inFlight: {} });
      cache(state.account, { progress: get().progress, pending });
      if (error?.code === 'GUIDANCE_STALE') await get().refresh();
    }
  },
  async replay() {
    const epoch = generation;
    const account = get().account;
    if (!account) return;
    // Replay is a server operation, not deletion of another device's local key.
    const response = await apiClient<{ ok: boolean; progress: GuideProgress }>('/api/mobile/guidance/replay', {
      method: 'POST', body: {},
    });
    if (epoch !== generation) return;
    ++generation; // Invalidate a pre-replay fetch/save still in flight.
    set({ progress: response.progress, pending: {}, inFlight: {}, ready: true, syncing: false });
    cache(account, { progress: response.progress, pending: {} });
  },
}));
