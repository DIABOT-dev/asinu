/**
 * Wellness Monitoring Provider
 * Tích hợp wellness monitoring vào app
 * - Auto sync state khi mở app
 * - Auto log app open
 * - Check if should prompt user
 */

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import i18n from '../../../i18n';
import { useSession } from '../../../providers/SessionProvider';
import { useWellnessStore } from '../store/wellness.store';

// =====================================================
// CONTEXT
// =====================================================

type WellnessContextValue = {
  recordMoodCheck: (mood: 'OK' | 'TIRED' | 'NOT_OK') => Promise<void>;
  requestHelp: (message?: string) => Promise<{ success: boolean; alertsSent: number; message: string }>;
  refreshState: () => Promise<void>;
};

const WellnessContext = createContext<WellnessContextValue>({
  recordMoodCheck: async () => {},
  requestHelp: async () => ({ success: false, alertsSent: 0, message: '' }),
  refreshState: async () => {}
});

export const useWellness = () => useContext(WellnessContext);

// =====================================================
// PROVIDER
// =====================================================

type Props = {
  children: ReactNode;
};

export const WellnessProvider = ({ children }: Props) => {
  const { ready: sessionReady } = useSession();
  
  const hydrated = useWellnessStore((s) => s.hydrated);
  const syncState = useWellnessStore((s) => s.syncState);
  const recordAppOpen = useWellnessStore((s) => s.recordAppOpen);
  const recordMoodCheckStore = useWellnessStore((s) => s.recordMoodCheck);
  const requestHelpStore = useWellnessStore((s) => s.requestHelp);
  const checkPrompt = useWellnessStore((s) => s.checkPrompt);
  
  const lastAppOpenRef = useRef<number>(0);
  const APP_OPEN_COOLDOWN = 5 * 60 * 1000; // 5 minutes between app open logs

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleAppOpen = useCallback(async () => {
    if (!hydrated || !sessionReady) return;

    const now = Date.now();
    // Avoid logging multiple app opens in quick succession
    if (lastAppOpenRef.current && now - lastAppOpenRef.current < APP_OPEN_COOLDOWN) {
      // Still sync state, just don't log another APP_OPEN
      try {
        await syncState();
        await checkPrompt();
      } catch {
        // ignore
      }
      return;
    }

    lastAppOpenRef.current = now;

    try {
      await recordAppOpen();
    } catch (e) {
      console.warn('[WellnessProvider] Failed to record app open:', e);
    }

    try {
      await syncState();
    } catch {
      // ignore
    }

    try {
      await checkPrompt();
    } catch {
      // ignore
    }
  }, [hydrated, sessionReady, recordAppOpen, syncState, checkPrompt]);

  const recordMoodCheck = useCallback(async (mood: 'OK' | 'TIRED' | 'NOT_OK') => {
    if (!sessionReady) return;
    await recordMoodCheckStore(mood);
  }, [sessionReady, recordMoodCheckStore]);

  const requestHelp = useCallback(async (message?: string) => {
    if (!sessionReady) {
      return { success: false, alertsSent: 0, message: i18n.t('notLoggedIn') };
    }
    return requestHelpStore(message);
  }, [sessionReady, requestHelpStore]);

  const refreshState = useCallback(async () => {
    if (!sessionReady) return;
    await syncState();
    await checkPrompt();
  }, [sessionReady, syncState, checkPrompt]);

  // =====================================================
  // EFFECTS
  // =====================================================

  // Initial sync and app state listener
  useEffect(() => {
    handleAppOpen();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        handleAppOpen();
      }
    });

    return () => subscription.remove();
  }, [handleAppOpen]);

  // =====================================================
  // RENDER
  // =====================================================

  const contextValue = useMemo(
    () => ({ recordMoodCheck, requestHelp, refreshState }),
    [recordMoodCheck, requestHelp, refreshState]
  );

  return (
    <WellnessContext.Provider value={contextValue}>
      {children}
    </WellnessContext.Provider>
  );
};
