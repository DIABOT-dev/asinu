import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { getApiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../auth/auth.store';
import { careCircleApi } from './care-circle.api';
import { pickQrToken, QrMediaError, tokenFromQr } from './qr-media.service';

export function useCareCircleScanner(inboundToken?: string) {
  const { t } = useTranslation('careCircle');
  const router = useGuardedRouter();
  const mounted = useRef(false);
  const busy = useRef(false);
  const failed = useRef(false);
  const inboundHandled = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const begin = useCallback(() => {
    if (busy.current || !mounted.current) {return null;}
    const { profile, token } = useAuthStore.getState();
    if (!profile?.id || !token) {return null;}
    busy.current = true;
    failed.current = false;
    setError('');
    setScanning(true);
    return () => {
      const auth = useAuthStore.getState();
      return mounted.current && auth.profile?.id === profile.id && auth.token === token;
    };
  }, []);

  const preview = useCallback(async (token: string, isCurrent: () => boolean) => {
    if (!isCurrent()) {return;}
    await careCircleApi.previewQrToken(token);
    if (isCurrent()) {router.replace({ pathname: '/care-circle/invite', params: { qrToken: token } } as never);}
  }, [router]);

  const scan = useCallback(async ({ data }: { data: string }) => {
    const isCurrent = begin();
    if (!isCurrent) {return;}
    try {
      const token = tokenFromQr(data);
      if (!token) {throw new QrMediaError('invalidCode');}
      await preview(token, isCurrent);
    } catch (err) {
      if (isCurrent()) {
        failed.current = true;
        setError(err instanceof QrMediaError ? t('qrInvalidFormat') : getApiErrorMessage(err, t, 'qrPreviewError'));
      }
    }
    // Keep the camera paused on success or failure until leaving or explicitly retrying.
  }, [begin, preview, t]);

  const pickImage = async () => {
    if (busy.current && !failed.current) {return;}
    busy.current = false; // Allow replacing a failed scan with a different image.
    const isCurrent = begin();
    if (!isCurrent) {return;}
    setPickingImage(true);
    try {
      const token = await pickQrToken(isCurrent);
      if (!isCurrent()) {return;}
      if (!token) { busy.current = false; setScanning(false); return; }
      await preview(token, isCurrent);
    } catch (err) {
      if (isCurrent()) {
        failed.current = true;
        const key = err instanceof QrMediaError ? {
          noCode: 'qrImageNoCode', multipleCodes: 'qrImageMultiple', invalidCode: 'qrInvalidFormat',
          unavailable: 'qrImageError', permission: 'qrImageError',
        }[err.reason] : undefined;
        setError(key ? t(key) : getApiErrorMessage(err, t, 'qrImageError'));
      }
    } finally { if (mounted.current) {setPickingImage(false);} }
  };

  useEffect(() => {
    if (inboundToken && !inboundHandled.current) {
      inboundHandled.current = true;
      void scan({ data: inboundToken });
    }
  }, [inboundToken, scan]);

  const retry = () => { if (busy.current && !failed.current) {return;} busy.current = false; failed.current = false; setError(''); setScanning(false); };
  return { scanning, pickingImage, error, scan, pickImage, retry };
}
