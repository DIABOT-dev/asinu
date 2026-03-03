import { ReactNode, createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../features/auth/auth.store';
import { getExpoPushToken, requestNotificationPermissions, setupNotificationHandler } from '../lib/notifications';

const SessionContext = createContext<{ ready: boolean }>({ ready: false });

export const useSession = () => useContext(SessionContext);

type Props = {
  children: ReactNode;
};

export const SessionProvider = ({ children }: Props) => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    console.log('[SessionProvider] useEffect triggered - hydrated:', hydrated, 'loading:', loading);
    // Only bootstrap after store is hydrated
    if (hydrated) {
      console.log('[SessionProvider] Calling bootstrap()');
      bootstrap();
      
      // Set up notification handler before requesting permissions
      setupNotificationHandler();

      // Request notification permissions and get push token
      (async () => {
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
          const token = await getExpoPushToken();
          if (token) {
            console.log('[SessionProvider] Expo Push Token:', token);
            // TODO: Send token to backend to store in database
            // await api.savePushToken(token);
          }
        } else {
          console.log('[SessionProvider] Notification permissions denied');
        }
      })();
    }
  }, [bootstrap, hydrated]);

  const value = useMemo(() => ({ ready: !loading && hydrated }), [loading, hydrated]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
