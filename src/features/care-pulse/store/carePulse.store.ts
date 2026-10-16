import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '../../../lib/secureStorage';
import { healthStoreSession, createHealthStoreStorage } from '../../../lib/healthStoreSession';
import { fetchCarePulseState, sendCarePulseEvent } from '../api/carePulse.api';
import { EngineState, PulseStatus, TriggerSource, initialEngineState } from '../types';

type CarePulseStore = {
  engineState: EngineState;
  hydrated: boolean;
  popupSessionId: string | null;
  setEngineState: (engineState: EngineState) => void;
  setHydrated: (value: boolean) => void;
  syncState: () => Promise<void>;
  sendAppOpened: () => Promise<void>;
  recordPopupShown: () => Promise<void>;
  recordPopupDismiss: () => Promise<void>;
  checkIn: (status: PulseStatus, subStatus: string | undefined, triggerSource: TriggerSource) => Promise<void>;
  reset: () => void;
};

const createSessionId = (): string => {
  const globalAny = globalThis as any;
  if (typeof globalAny.crypto?.randomUUID === 'function') {
    return globalAny.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const resolveSource = (triggerSource: TriggerSource) => {
  if (triggerSource === 'POPUP') return 'scheduler';
  return 'manual';
};

let storeGeneration = 0;

export const useCarePulseStore = create<CarePulseStore>()(
  persist(
    (set, get) => ({
      engineState: initialEngineState,
      hydrated: true,
      popupSessionId: null,
      setEngineState: (engineState) => set({ engineState }),
      setHydrated: (value) => set({ hydrated: value }),
      syncState: async () => {
        const session = healthStoreSession.capture();
        const requestGeneration = storeGeneration;
        if (!healthStoreSession.isCurrent(session)) {

          return;
        }
        
        try {
          const response = await fetchCarePulseState();
          if (!healthStoreSession.isCurrent(session) || requestGeneration !== storeGeneration) return;
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      sendAppOpened: async () => {
        const session = healthStoreSession.capture();
        const requestGeneration = storeGeneration;
        if (!healthStoreSession.isCurrent(session)) {

          return;
        }
        
        try {
          const response = await sendCarePulseEvent({
            eventType: 'APP_OPENED',
            source: 'system',
            uiSessionId: createSessionId()
          });
          if (!healthStoreSession.isCurrent(session) || requestGeneration !== storeGeneration) return;
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      recordPopupShown: async () => {
        const session = healthStoreSession.capture();
        const requestGeneration = storeGeneration;
        if (!healthStoreSession.isCurrent(session)) {

          return;
        }
        
        const sessionId = createSessionId();
        set({ popupSessionId: sessionId });
        try {
          const response = await sendCarePulseEvent({
            eventType: 'POPUP_SHOWN',
            source: 'scheduler',
            uiSessionId: sessionId
          });
          if (!healthStoreSession.isCurrent(session) || requestGeneration !== storeGeneration) return;
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      recordPopupDismiss: async () => {
        const session = healthStoreSession.capture();
        const requestGeneration = storeGeneration;
        if (!healthStoreSession.isCurrent(session)) {

          set({ popupSessionId: null });
          return;
        }
        
        const sessionId = get().popupSessionId || createSessionId();
        try {
          const response = await sendCarePulseEvent({
            eventType: 'POPUP_DISMISSED',
            source: 'scheduler',
            uiSessionId: sessionId
          });
          if (!healthStoreSession.isCurrent(session) || requestGeneration !== storeGeneration) return;
          set({ popupSessionId: null });
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {
          if (healthStoreSession.isCurrent(session) && requestGeneration === storeGeneration) set({ popupSessionId: null });

        }
      },
      reset: () => {
        storeGeneration++;
        set({ engineState: initialEngineState, popupSessionId: null });
      },
      checkIn: async (status, _subStatus, triggerSource) => {
        const session = healthStoreSession.capture();
        const requestGeneration = storeGeneration;
        if (!healthStoreSession.isCurrent(session)) {

          set({ popupSessionId: null });
          return;
        }
        
        const sessionId = triggerSource === 'POPUP' ? get().popupSessionId || createSessionId() : createSessionId();
        try {
          const response = await sendCarePulseEvent({
            eventType: 'CHECK_IN',
            source: resolveSource(triggerSource),
            uiSessionId: sessionId,
            selfReport: status
          });
          if (!healthStoreSession.isCurrent(session) || requestGeneration !== storeGeneration) return;
          set({ popupSessionId: null });
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {
          if (healthStoreSession.isCurrent(session) && requestGeneration === storeGeneration) set({ popupSessionId: null });

        }
      }
    }),
    {
      name: 'care_pulse_v2',
      skipHydration: true,
      storage: createJSONStorage(() => createHealthStoreStorage('care_pulse_v2')),
      partialize: (state) => ({ engineState: state.engineState }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);

// Never rehydrate legacy state without an account owner.
void secureStorage.removeItem('care_pulse_v1').catch(() => {});
healthStoreSession.subscribe(() => {
  useCarePulseStore.getState().reset();
  if (healthStoreSession.isCurrent(healthStoreSession.capture())) {
    void useCarePulseStore.persist.rehydrate();
  }
});
