import { env } from './env';
import { tokenStore } from './tokenStore';
import { logError, logWarn } from './logger';

type RetryOptions = {
  attempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = Omit<RequestInit, 'body'> & {
  method?: HttpMethod;
  body?: any;
  retry?: RetryOptions;
};

const DEFAULT_TIMEOUT_MS = 12000;
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const userSignal = options.signal;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timeout);
      controller.abort();
    } else {
      userSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

const shouldRetry = (method: HttpMethod, error: unknown, response?: Response) => {
  if (method !== 'GET') return false;
  if (response && response.status >= 500) return true;
  if (response) return false;
  if (error instanceof Error && error.name === 'AbortError') return false;
  return true;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${env.apiBaseUrl}${path}`;
  const token = tokenStore.getToken();
  const method: HttpMethod = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const attempts = options.retry?.attempts ?? 1;
  const initialDelay = options.retry?.initialDelayMs ?? 400;
  const factor = options.retry?.backoffFactor ?? 2;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          ...options,
          method,
          credentials: 'include',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined
        },
        DEFAULT_TIMEOUT_MS
      );

      if (!response.ok) {
        if (shouldRetry(method, null, response) && attempt < attempts) {
          const delay = initialDelay * Math.pow(factor, attempt - 1);
          logWarn('api retry', { url, method, attempt, delay });
          await sleep(delay);
          continue;
        }
        const errorText = await response.text();
        logError(new Error(errorText || `Request failed: ${response.status}`), { url, method, status: response.status });
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      if (shouldRetry(method, error) && attempt < attempts && !isTimeout) {
        const delay = initialDelay * Math.pow(factor, attempt - 1);
        logWarn('api retry after error', { url, method, attempt, delay, error: (error as Error)?.message });
        await sleep(delay);
        continue;
      }
      logError(error, { url, method, attempt });
      throw error;
    }
  }

  throw lastError ?? new Error('Unknown network error');
}
