// MOCK MODE: Bỏ qua API, trả về dữ liệu giả để test UI
const MOCK_MODE = false;
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL ?? 'http://localhost:3000';

export type MobileRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function mobileRequest<T>(path: string, options: MobileRequestOptions = {}): Promise<T> {
    if (MOCK_MODE) {
      // Trả về dữ liệu mock cho từng màn hình, có thể mở rộng thêm các file mock khác
      if (path.includes('/home')) {
        return require('../../demo/mock_home.json');
      }
      if (path.includes('/missions')) {
        return require('../../demo/mock_missions.json');
      }
      if (path.includes('/tree')) {
        return require('../../demo/mock_tree.json');
      }
      if (path.includes('/rewards')) {
        return require('../../demo/mock_rewards.json');
      }
      // Mặc định trả về object rỗng nếu chưa có file mock
      return {} as T;
    }
  const url = `${DEFAULT_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export function useMobileEndpoint<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await mobileRequest<T>(path);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData
  };
}
