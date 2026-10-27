import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Platform } from 'react-native';
import { checkStoreUpdate, installAppUpdate, type StoreUpdateCheck, type UpdateProgress } from './app-update.service';
import { type AppUpdate, shouldPrompt } from './update-policy';

const STORAGE_KEY = '@app/update-dismissed';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
let inFlight: Promise<StoreUpdateCheck> | null = null;
let installInFlight: Promise<void> | null = null;
let checkedAt = 0;
let mutationRevision = 0;
let installGeneration = 0;
let lastResult: StoreUpdateCheck = { status: 'unavailable' };
export type AppUpdatePhase = 'available' | 'starting' | 'pending' | 'downloading' | 'downloaded' | 'installing' | 'error';
type State = {
  update: AppUpdate | null;
  visible: boolean;
  checking: boolean;
  phase: AppUpdatePhase;
  downloadedBytes: number;
  totalBytes: number;
  errorCode: number | null;
  userMinimized: boolean;
  check: (manual?: boolean) => Promise<StoreUpdateCheck>;
  applyProgress: (progress: UpdateProgress) => void;
  dismiss: () => void;
  minimize: () => void;
  open: () => void;
  install: () => Promise<void>;
};
const activePhase = (phase: AppUpdatePhase) => ['starting', 'pending', 'downloading', 'downloaded', 'installing'].includes(phase);
const idle = { phase: 'available' as const, downloadedBytes: 0, totalBytes: 0, errorCode: null };

export const useAppUpdateStore = create<State>((set, get) => ({
  update: null, visible: false, checking: false, userMinimized: false, ...idle,
  check: (manual = false) => {
    if (inFlight) {return inFlight;}
    const interval = lastResult.status === 'unavailable' ? 60_000 : Platform.OS === 'android' ? 10_000 : CHECK_INTERVAL;
    if (!manual && checkedAt && Date.now() - checkedAt < interval) {return Promise.resolve(lastResult);}
    set({ checking: true });
    const revision = mutationRevision;
    inFlight = (async () => {
      let result: StoreUpdateCheck;
      try { result = await checkStoreUpdate(); } catch { result = { status: 'unavailable' }; }
      checkedAt = Date.now();
      if (result.status === 'available') {
        let dismissed = null;
        try { dismissed = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Device storage must not prevent updates. */ }
        // A slow check or storage read must not rewind a newer Play event.
        if (revision !== mutationRevision) {return result;}
        lastResult = result;
        const same = get().update?.id === result.update.id;
        const progress = result.progress;
        if (same && activePhase(get().phase) && (!progress || progress.phase === 'available')) {
          if (manual) {get().open();}
          return result;
        }
        set({ update: result.update, ...(!same ? { ...idle, userMinimized: false } : {}) });
        if (progress && progress.phase !== 'available') {
          get().applyProgress(progress);
          if (manual && get().update) {get().open();}
        } else {
          const promptUpdate = same && get().userMinimized ? { ...result.update, inProgress: false } : result.update;
          set({ visible: manual || shouldPrompt(promptUpdate, dismissed, checkedAt), phase: 'available' });
        }
      } else if (revision === mutationRevision) {
        lastResult = result;
        if (result.status === 'current') {
          mutationRevision++; installGeneration++;
          set({ update: null, visible: false, userMinimized: false, ...idle });
        }
      }
      return result;
    })().finally(() => { inFlight = null; set({ checking: false }); });
    return inFlight;
  },
  applyProgress: progress => {
    const current = get().update;
    const incomingId = progress.versionCode ? `android:${progress.versionCode}` : current?.id;
    const existingCode = current?.platform === 'android' ? Number(current.id.split(':')[1]) : 0;
    if (current?.platform === 'ios' || (progress.versionCode && existingCode > progress.versionCode)) {return;}
    mutationRevision++;
    if (progress.phase === 'installed') {
      installGeneration++;
      lastResult = { status: 'current' };
      set({ update: null, visible: false, userMinimized: false, ...idle });
      return;
    }
    const update = incomingId ? { ...(current || {}), platform: 'android' as const, id: incomingId, downloaded: progress.phase === 'downloaded' } : null;
    if (progress.phase === 'cancelled') {
      installGeneration++;
      if (update) {lastResult = { status: 'available', update };}
      set({ update, visible: false, userMinimized: true, ...idle });
      if (update) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id: update.id, at: Date.now() })).catch(() => {});
      }
      return;
    }
    const changedVersion = Boolean(current && incomingId !== current.id);
    const minimized = !changedVersion && get().userMinimized;
    if (update) {lastResult = { status: 'available', update, progress };}
    set({
      update,
      phase: progress.phase,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      errorCode: progress.errorCode ?? null,
      userMinimized: minimized,
      visible: Boolean(update && !minimized),
    });
    if (progress.phase === 'error') {installGeneration++;}
  },
  dismiss: () => {
    const update = get().update;
    mutationRevision++;
    set({ visible: false, userMinimized: true });
    // Closing progress never cancels Play's background download or snoozes it.
    if (update && !activePhase(get().phase)) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id: update.id + (update.downloaded ? ':downloaded' : ''), at: Date.now() })).catch(() => {});
    }
  },
  minimize: () => { mutationRevision++; set({ visible: false, userMinimized: true }); },
  open: () => { mutationRevision++; set({ visible: Boolean(get().update), userMinimized: false }); },
  install: () => {
    if (installInFlight) {return installInFlight;}
    const update = get().update;
    if (!update) {return Promise.resolve();}
    if (['pending', 'downloading', 'installing'].includes(get().phase)) {get().open(); return Promise.resolve();}
    const generation = ++installGeneration;
    mutationRevision++;
    // Wait for native consent outside our modal. Play events open real progress.
    set({ phase: 'starting', visible: false, userMinimized: false, errorCode: null });
    installInFlight = (async () => {
      try {
        const result = await installAppUpdate(update);
        if (generation !== installGeneration || get().update?.id !== update.id) {return;}
        if (result.outcome === 'external') {
          set({ visible: false, phase: 'available' });
        } else if (result.outcome === 'cancelled') {
          get().applyProgress({ phase: 'cancelled', downloadedBytes: 0, totalBytes: 0 });
        } else if (result.outcome === 'error') {
          get().applyProgress({ phase: 'error', downloadedBytes: get().downloadedBytes, totalBytes: get().totalBytes });
        } else if (result.outcome === 'downloaded') {
          get().applyProgress({ phase: 'downloaded', downloadedBytes: get().downloadedBytes, totalBytes: get().totalBytes });
        } else if (result.outcome === 'installing') {
          // Play accepted the user-confirmed installation command; no fake %.
          get().applyProgress({ phase: 'installing', downloadedBytes: get().downloadedBytes, totalBytes: get().totalBytes });
        } else if (get().phase === 'starting' || get().phase === 'available') {
          get().applyProgress({ phase: 'pending', downloadedBytes: 0, totalBytes: 0 });
        }
      } catch (error) {
        if (generation === installGeneration && get().update?.id === update.id) {
          if (update.platform === 'ios') {
            set({ phase: 'error', visible: true, userMinimized: false, downloadedBytes: 0, totalBytes: 0, errorCode: null });
          } else {
            get().applyProgress({ phase: 'error', downloadedBytes: get().downloadedBytes, totalBytes: get().totalBytes });
          }
        }
        throw error;
      }
    })().finally(() => { installInFlight = null; });
    return installInFlight;
  },
}));
