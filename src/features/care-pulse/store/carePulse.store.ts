import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tokenStore } from '../../../lib/tokenStore';
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
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
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

export const useCarePulseStore = create<CarePulseStore>()(
  persist(
    (set, get) => ({
      engineState: initialEngineState,
      hydrated: false,
      popupSessionId: null,
      setEngineState: (engineState) => set({ engineState }),
      setHydrated: (value) => set({ hydrated: value }),
      syncState: async () => {
        const token = tokenStore.getToken();
        if (!token) {

          return;
        }
        
        try {
          const response = await fetchCarePulseState();
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      sendAppOpened: async () => {
        const token = tokenStore.getToken();
        if (!token) {

          return;
        }
        
        try {
          const response = await sendCarePulseEvent({
            eventType: 'APP_OPENED',
            source: 'system',
            uiSessionId: createSessionId()
          });
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      recordPopupShown: async () => {
        const token = tokenStore.getToken();
        if (!token) {

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
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {

        }
      },
      recordPopupDismiss: async () => {
        const token = tokenStore.getToken();
        if (!token) {

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
          set({ popupSessionId: null });
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {
          set({ popupSessionId: null });

        }
      },
      reset: () => {
        set({ engineState: initialEngineState, popupSessionId: null });
      },
      checkIn: async (status, _subStatus, triggerSource) => {
        const token = tokenStore.getToken();
        if (!token) {

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
          set({ popupSessionId: null });
          if (response?.state) {
            set({ engineState: response.state });
          }
        } catch (error) {
          set({ popupSessionId: null });

        }
      }
    }),
    {
      name: 'care_pulse_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ engineState: state.engineState }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);
