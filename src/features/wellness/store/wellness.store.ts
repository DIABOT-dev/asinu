/**
 * Wellness Monitoring Store
 * Zustand store cho hệ thống theo dõi sức khỏe
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import {
    acknowledgeAlert,
    checkShouldPrompt,
    getCaregiverAlerts,
    getDailySummaries,
    getMyAlerts,
    getWellnessHistory,
    getWellnessState,
    logActivity,
    logAppOpen,
    logMoodCheck,
    sendHelpRequest,
    type ActivityData,
    type ActivityType,
    type CaregiverAlert,
    type DailySummary,
    type MoodType,
    type WellnessHistory,
    type WellnessState
} from '../api/wellness.api';

// =====================================================
// TYPES
// =====================================================

interface WellnessStore {
  // State
  state: WellnessState | null;
  history: WellnessHistory[];
  summaries: DailySummary[];
  alerts: CaregiverAlert[];
  caregiverAlerts: CaregiverAlert[];
  shouldPrompt: boolean;
  promptType: string | null;
  promptReason: string | null;
  isLoading: boolean;
  lastSyncAt: string | null;
  hydrated: boolean;

  // Actions
  setHydrated: (value: boolean) => void;
  syncState: () => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  fetchSummaries: (days?: number) => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchCaregiverAlerts: () => Promise<void>;
  checkPrompt: () => Promise<void>;
  
  // Activity logging
  recordAppOpen: () => Promise<void>;
  recordMoodCheck: (mood: MoodType) => Promise<void>;
  recordActivity: (type: ActivityType, data?: ActivityData) => Promise<void>;
  
  // Help request
  requestHelp: (message?: string) => Promise<{ success: boolean; alertsSent: number; message: string }>;
  
  // Alert management
  ackAlert: (alertId: string) => Promise<void>;
  
  // Reset
  reset: () => void;
}

// =====================================================
// HELPER
// =====================================================

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

// Session ID for this app session
let currentSessionId: string | null = null;

const getSessionId = () => {
  if (!currentSessionId) {
    currentSessionId = createSessionId();
  }
  return currentSessionId;
};

// =====================================================
// STORE
// =====================================================

export const useWellnessStore = create<WellnessStore>()(
  persist(
    (set, get) => ({
      // Initial state
      state: null,
      history: [],
      summaries: [],
      alerts: [],
      caregiverAlerts: [],
      shouldPrompt: false,
      promptType: null,
      promptReason: null,
      isLoading: false,
      lastSyncAt: null,
      hydrated: false,

      setHydrated: (value) => set({ hydrated: value }),

      // Sync wellness state from server
      syncState: async () => {
        const token = tokenStore.getToken();
        if (!token) {

          return;
        }

        try {
          set({ isLoading: true });
          const response = await getWellnessState();
          if (response?.ok && response.state) {
            set({ 
              state: response.state, 
              lastSyncAt: new Date().toISOString() 
            });
          }
        } catch (error) {

        } finally {
          set({ isLoading: false });
        }
      },

      // Fetch history
      fetchHistory: async (days = 7) => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await getWellnessHistory(days);
          if (response?.ok && response.history) {
            set({ history: response.history });
          }
        } catch (error) {

        }
      },

      // Fetch summaries
      fetchSummaries: async (days = 7) => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await getDailySummaries(days);
          if (response?.ok && response.summaries) {
            set({ summaries: response.summaries });
          }
        } catch (error) {

        }
      },

      // Fetch user's alerts
      fetchAlerts: async () => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await getMyAlerts();
          if (response?.ok && response.alerts) {
            set({ alerts: response.alerts });
          }
        } catch (error) {

        }
      },

      // Fetch caregiver alerts (for caregivers)
      fetchCaregiverAlerts: async () => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await getCaregiverAlerts(true);
          if (response?.ok && response.alerts) {
            set({ caregiverAlerts: response.alerts });
          }
        } catch (error) {

        }
      },

      // Check if should prompt user
      checkPrompt: async () => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await checkShouldPrompt();
          if (response?.ok) {
            set({
              shouldPrompt: response.shouldPrompt,
              promptType: response.promptType || null,
              promptReason: response.reason || null
            });
          }
        } catch (error) {

        }
      },

      // Record app open
      recordAppOpen: async () => {
        const token = tokenStore.getToken();
        if (!token) {

          return;
        }

        try {
          const response = await logAppOpen(getSessionId());
          if (response?.ok && response.evaluation) {
            // Update state with new evaluation
            const currentState = get().state;
            if (currentState) {
              set({
                state: {
                  ...currentState,
                  score: response.evaluation.score,
                  status: response.evaluation.status,
                  appOpensToday: (currentState.appOpensToday || 0) + 1
                }
              });
            }
          }
        } catch (error) {

        }
      },

      // Record mood check
      recordMoodCheck: async (mood) => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await logMoodCheck(mood, getSessionId());
          if (response?.ok && response.evaluation) {
            const currentState = get().state;
            if (currentState) {
              set({
                state: {
                  ...currentState,
                  score: response.evaluation.score,
                  status: response.evaluation.status
                },
                // Clear prompt after mood check
                shouldPrompt: false,
                promptType: null
              });
            }
          }
        } catch (error) {

        }
      },

      // Generic activity recording
      recordActivity: async (type, data = {}) => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await logActivity(type, data, getSessionId());
          if (response?.ok && response.evaluation) {
            const currentState = get().state;
            if (currentState) {
              set({
                state: {
                  ...currentState,
                  score: response.evaluation.score,
                  status: response.evaluation.status
                }
              });
            }
          }
        } catch (error) {

        }
      },

      // Request help
      requestHelp: async (message) => {
        const token = tokenStore.getToken();
        if (!token) {
          return { success: false, alertsSent: 0, message: i18n.t('notLoggedIn') };
        }

        try {
          const response = await sendHelpRequest(message);
          if (response?.ok) {
            // Refresh alerts
            get().fetchAlerts();
            return {
              success: true,
              alertsSent: response.alertsSent,
              message: response.message
            };
          }
          return { success: false, alertsSent: 0, message: i18n.t('cannotSendRequest') };
        } catch (error) {

          return { success: false, alertsSent: 0, message: i18n.t('connectionError') };
        }
      },

      // Acknowledge alert
      ackAlert: async (alertId) => {
        const token = tokenStore.getToken();
        if (!token) return;

        try {
          const response = await acknowledgeAlert(alertId);
          if (response?.ok) {
            // Update local state
            set({
              caregiverAlerts: get().caregiverAlerts.map(a =>
                a.id === alertId
                  ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() }
                  : a
              )
            });
          }
        } catch (error) {

        }
      },

      // Reset store
      reset: () => {
        currentSessionId = null;
        set({
          state: null,
          history: [],
          summaries: [],
          alerts: [],
          caregiverAlerts: [],
          shouldPrompt: false,
          promptType: null,
          promptReason: null,
          isLoading: false,
          lastSyncAt: null
        });
      }
    }),
    {
      name: 'wellness-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        state: state.state,
        lastSyncAt: state.lastSyncAt
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);

// =====================================================
// HOOKS
// =====================================================

/**
 * Hook to get current wellness status
 */
export const useWellnessStatus = () => {
  const state = useWellnessStore((s) => s.state);
  return {
    score: state?.score ?? 80,
    status: state?.status ?? 'OK',
    appOpensToday: state?.appOpensToday ?? 0,
    streakDays: state?.streakDays ?? 0,
    needsAttention: state?.needsAttention ?? false
  };
};

/**
 * Hook to check if user needs prompt
 */
export const useWellnessPrompt = () => {
  const shouldPrompt = useWellnessStore((s) => s.shouldPrompt);
  const promptType = useWellnessStore((s) => s.promptType);
  const promptReason = useWellnessStore((s) => s.promptReason);
  return { shouldPrompt, promptType, promptReason };
};

/**
 * Hook to get caregiver alerts count
 */
export const useCaregiverAlertsCount = () => {
  const alerts = useWellnessStore((s) => s.caregiverAlerts);
  return alerts.filter(a => a.status === 'sent' || a.status === 'pending').length;
};
