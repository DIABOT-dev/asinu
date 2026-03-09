import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../../auth/auth.store';
import { tokenStore } from '../../../lib/tokenStore';
import { useSession } from '../../../providers/SessionProvider';
import { PulsePopup } from '../components/PulsePopup';
import { useCarePulseStore } from '../store/carePulse.store';
import { EngineState } from '../types';

type CarePulseContextValue = {
  openPulsePopup: () => void;
};

const CarePulseContext = createContext<CarePulseContextValue>({ openPulsePopup: () => undefined });

export const useCarePulse = () => useContext(CarePulseContext);

type Props = {
  children: ReactNode;
};

const shouldOpenPopupFromState = (state: EngineState, now: Date) => {
  if (!state.nextAskAt) return false;
  const nextAsk = new Date(state.nextAskAt);
  if (now < nextAsk) return false;
  if (state.cooldownUntil) {
    const cooldown = new Date(state.cooldownUntil);
    if (now < cooldown) return false;
  }
  return true;
};

export const CarePulseProvider = ({ children }: Props) => {
  const engineState = useCarePulseStore((state) => state.engineState);
  const hydrated = useCarePulseStore((state) => state.hydrated);
  const recordPopupShown = useCarePulseStore((state) => state.recordPopupShown);
  const sendAppOpened = useCarePulseStore((state) => state.sendAppOpened);
  const syncState = useCarePulseStore((state) => state.syncState);
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = !!profile;
  const [popupVisible, setPopupVisible] = useState(false);
  const engineStateRef = useRef(engineState);
  const popupVisibleRef = useRef(popupVisible);
  
  // Wait for session to be ready before making API calls
  const { ready: sessionReady } = useSession();

  useEffect(() => {
    engineStateRef.current = engineState;
  }, [engineState]);

  useEffect(() => {
    popupVisibleRef.current = popupVisible;
  }, [popupVisible]);

  const openPulsePopup = useCallback(() => {
    if (popupVisibleRef.current) return;
    recordPopupShown();
    setPopupVisible(true);
  }, [recordPopupShown]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPopupVisible(false);
    }
  }, [isAuthenticated]);

  const runScheduler = useCallback(async () => {
    // Don't run scheduler if not ready or no token available
    if (!hydrated || !sessionReady || !isAuthenticated) return;
    
    const token = tokenStore.getToken();
    if (!token) {

      return;
    }
    
    try {
      await sendAppOpened();
    } catch {
      // ignore
    }
    try {
      await syncState();
    } catch {
      // ignore
    }

    const now = new Date();
    const latestState = engineStateRef.current;
    if (!latestState) return;
    const shouldShow = shouldOpenPopupFromState(latestState, now);
    if (shouldShow && !popupVisibleRef.current) {
      openPulsePopup();
    }
  }, [hydrated, sessionReady, isAuthenticated, openPulsePopup, sendAppOpened, syncState]);

  useEffect(() => {
    runScheduler();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runScheduler();
      }
    });
    return () => subscription.remove();
  }, [runScheduler]);

  const handleClosePopup = useCallback(() => setPopupVisible(false), []);
  
  const contextValue = useMemo(
    () => ({ openPulsePopup }),
    [openPulsePopup]
  );

  return (
    <CarePulseContext.Provider value={contextValue}>
      {children}
      <PulsePopup visible={popupVisible} onClose={handleClosePopup} />
    </CarePulseContext.Provider>
  );
};
