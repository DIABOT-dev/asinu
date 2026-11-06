import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { useAppAlert } from '../../components/AppAlertModal';
import { runNativePermission } from '../../lib/native-permissions';
import { showToast } from '../../stores/toast.store';
import { useAuthStore } from '../auth/auth.store';
import { QrMediaError, saveQrToPhotos, type QrImage } from './qr-media.service';

export function useSaveCareCircleQr(value?: string) {
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const image = useRef<QrImage | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const currentValue = useRef(value);
  currentValue.current = value;
  const [saving, setSaving] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const save = async () => {
    if (busy.current || !value || !image.current) {return;}
    const { profile, token } = useAuthStore.getState();
    if (!profile?.id || !token) {return;}
    const isCurrent = () => {
      const auth = useAuthStore.getState();
      return mounted.current && currentValue.current === value && auth.profile?.id === profile.id && auth.token === token;
    };
    busy.current = true;
    setSaving(true);
    try {
      if (await saveQrToPhotos(image.current, isCurrent) && isCurrent()) {showToast(t('qrSaved'), 'success');}
    } catch (error) {
      if (!isCurrent()) {return;}
      if (error instanceof QrMediaError && error.reason === 'permission') {
        showAlert(t('qrPhotoPermissionTitle'), t('qrPhotoPermissionBody'), [
          { text: tc('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => {
            void runNativePermission(() => Linking.openSettings(), {
              key: 'app-settings', settings: true, canRun: isCurrent,
            }).catch(() => { if (isCurrent()) {showToast(t('qrSaveError'), 'error');} });
          } },
        ]);
      } else {
        showToast(t(error instanceof QrMediaError && error.reason === 'unavailable' ? 'qrSaveNeedsUpdate' : 'qrSaveError'), 'error');
      }
    } finally {
      busy.current = false;
      if (mounted.current) {setSaving(false);}
    }
  };
  return { image, saving, save, alertState, dismissAlert };
}
