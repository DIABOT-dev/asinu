import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/auth.store';
import { getApiErrorMessage } from '../../lib/apiClient';
import { careCircleApi, type CareCircleQrToken } from './care-circle.api';

export function useCareCircleQr() {
  const { t } = useTranslation('careCircle');
  const accountId = useAuthStore((state) => state.profile?.id);
  const authToken = useAuthStore((state) => state.token);
  const account = accountId == null ? null : String(accountId);
  const [code, setCode] = useState<{
    account: string;
    session: string;
    qr: CareCircleQrToken;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const loadCode = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!account || !authToken) {
      setCode(null);
      setLoading(false);
      setError('');
      return;
    }
    const isCurrent = () => {
      const current = useAuthStore.getState();
      return version === requestVersion.current
        && String(current.profile?.id) === account
        && current.token === authToken;
    };
    setLoading(true);
    setError('');
    try {
      const next = await careCircleApi.createQrToken();
      if (isCurrent()) setCode({ account, session: authToken, qr: next });
    } catch (err) {
      if (isCurrent()) {
        setCode(null);
        setError(getApiErrorMessage(err, t, 'qrCreateError'));
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [account, authToken, t]);

  useEffect(() => {
    void loadCode();
    return () => { ++requestVersion.current; };
  }, [loadCode]);

  const qr = code?.account === account && code?.session === authToken ? code.qr : null;
  return { qr, loading, error, loadCode };
}
