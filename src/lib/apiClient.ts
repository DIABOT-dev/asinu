import i18n from '../i18n';
import { env } from './env';
import { logError, logWarn } from './logger';
import { tokenStore } from './tokenStore';

let isLoggingOut = false;

export class ApiError extends Error {
  statusCode: number;
  /** Stable machine-readable code from the server response body, when present. */
  code?: string;
  /** Full error response body so callers can read tier-specific fields (limit, used, ...). */
  data?: Record<string, any>;
  constructor(message: string, statusCode: number, opts: { code?: string; data?: Record<string, any> } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = opts.code;
    this.data = opts.data;
  }
}

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
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12000;
const sleep = (ms: number) => new Promise<void>((res) => setTimeout(() => res(), ms));

class RequestTimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'RequestTimeoutError';
  }
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const userSignal = options.signal;
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

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
    if (didTimeout && error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutError();
    }
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

const isNetworkFailure = (error: unknown): error is Error =>
  error instanceof Error && /network request failed|failed to fetch|network error/i.test(error.message);

const isAbortError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'AbortError';

const isRequestTimeout = (error: unknown): error is RequestTimeoutError =>
  error instanceof RequestTimeoutError || (error instanceof Error && error.name === 'RequestTimeoutError');

const createUserFacingTimeoutError = () => {
  const error = new Error(i18n.t('requestTimedOut', { ns: 'common' }));
  error.name = 'RequestTimeoutError';
  return error;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${env.apiBaseUrl}${path}`;
  const token = tokenStore.getToken();
  const method: HttpMethod = options.method || 'GET';
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    'Accept-Language': i18n.language || 'vi',
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
          body: options.body
            ? isFormDataBody ? options.body : JSON.stringify(options.body)
            : undefined
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

      if (!response.ok) {
        // Auto-logout khi JWT hết hạn (401)
        if (response.status === 401 && token && !path.includes('/auth/') && !isLoggingOut) {
          isLoggingOut = true;
          const { useAuthStore } = require('../features/auth/auth.store');
          useAuthStore.getState().logout().finally(() => { isLoggingOut = false; });
        }

        if (shouldRetry(method, null, response) && attempt < attempts) {
          const delay = initialDelay * Math.pow(factor, attempt - 1);
          logWarn('api retry', { url, method, attempt, delay });
          await sleep(delay);
          continue;
        }
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Request failed: ${response.status}` };
        }
        logError(new Error(errorData.error || errorText || `Request failed: ${response.status}`), {
          url,
          method,
          status: response.status,
          code: errorData.code,
          details: errorData.details
        });
        throw new ApiError(
          errorData.error || errorText || `Request failed: ${response.status}`,
          response.status,
          { code: typeof errorData.code === 'string' ? errorData.code : undefined, data: errorData }
        );
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      const userFacingError = isRequestTimeout(error)
        ? createUserFacingTimeoutError()
        : isNetworkFailure(error)
          ? new Error(i18n.t('networkErrorUnknown', { ns: 'common' }))
          : error;
      lastError = userFacingError;
      const aborted = isAbortError(error);
      const timedOut = isRequestTimeout(error);
      
      // Don't log AbortError - it's expected when request is cancelled
      if (!aborted && !timedOut) {
        if (shouldRetry(method, error) && attempt < attempts) {
          const delay = initialDelay * Math.pow(factor, attempt - 1);
          logWarn('api retry after error', { url, method, attempt, delay, error: (error as Error)?.message });
        } else {
          logError(error, { url, method, attempt });
        }
      }
      
      if (shouldRetry(method, error) && attempt < attempts && !timedOut) {
        const delay = initialDelay * Math.pow(factor, attempt - 1);
        await sleep(delay);
        continue;
      }
      throw userFacingError;
    }
  }

  throw lastError ?? new Error(i18n.t('networkErrorUnknown'));
}
