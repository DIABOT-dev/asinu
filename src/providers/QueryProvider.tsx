import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useMemo } from 'react';

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1
      }
    }
  });

type Props = {
  children: ReactNode;
};

export const QueryProvider = ({ children }: Props) => {
  const client = useMemo(() => createClient(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
