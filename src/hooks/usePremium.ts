import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

/**
 * Shared hook — kiểm tra trạng thái gói premium của user hiện tại.
 * Kết quả được cache trong component lifecycle.
 */
export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<{ isPremium?: boolean }>('/api/subscriptions/status')
      .then(res => setIsPremium(res?.isPremium === true))
      .catch(() => setIsPremium(false))
      .finally(() => setLoading(false));
  }, []);

  return { isPremium, loading };
}
