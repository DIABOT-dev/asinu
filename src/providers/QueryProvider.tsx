import { reportError } from '../observability/sentry';
import { ApiError } from '../lib/apiClient';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useMemo } from 'react';

const captureQueryFailure = (error: unknown) => {
  if (!(error instanceof ApiError)) reportError(error, { component: 'query' });
};

const createClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: captureQueryFailure }),
    mutationCache: new MutationCache({ onError: captureQueryFailure }),
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
