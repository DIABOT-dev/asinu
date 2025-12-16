import { ReactNode, createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../features/auth/auth.store';

const SessionContext = createContext<{ ready: boolean }>({ ready: false });

export const useSession = () => useContext(SessionContext);

type Props = {
  children: ReactNode;
};

export const SessionProvider = ({ children }: Props) => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return <SessionContext.Provider value={{ ready: !loading }}>{children}</SessionContext.Provider>;
};
