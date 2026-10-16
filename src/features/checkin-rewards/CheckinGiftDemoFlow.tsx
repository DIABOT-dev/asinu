import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlertModal } from '../../components/AppAlertModal';
import { useAuthStore } from '../auth/auth.store';
import { isProdBuild } from '../../lib/appEnv';
import { CheckinGiftModal, type CheckinGiftReceipt } from './CheckinGiftModal';
import { createCheckinGiftDemo, type DemoGiftReceipt } from './checkin-gift-demo';

// All entry points share the same lock and persisted daily quota.
const gifts = createCheckinGiftDemo(AsyncStorage);

type Props = { onClose: () => void; reviewExisting?: boolean };

/** Demo prizes are available in development/preview builds only. */
export function CheckinGiftDemoFlow(props: Props) {
  const account = useAuthStore(state => state.profile?.id);
  if (isProdBuild || !account) { return <CloseFlow onClose={props.onClose} />; }
  return <AccountGiftFlow key={String(account)} account={String(account)} {...props} />;
}

function CloseFlow({ onClose }: { onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => { closeRef.current(); }, []);
  return null;
}

function AccountGiftFlow({ account, onClose, reviewExisting = false }: Props & { account: string }) {
  const { t } = useTranslation('home');
  const [state, setState] = useState<'loading' | 'ready' | 'skipped' | 'error'>('loading');
  const [initialReceipt, setInitialReceipt] = useState<DemoGiftReceipt | null>(null);
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const finish = () => {
    if (closing.current) { return; }
    closing.current = true;
    closeRef.current();
  };

  useEffect(() => {
    let active = true;
    gifts.today(account).then(day => {
      if (!active) { return; }
      if (day.state === 'available') { setState('ready'); }
      else if (reviewExisting && day.state === 'opened') {
        setInitialReceipt(day.receipt);
        setState('ready');
      } else if (reviewExisting) { setState('skipped'); }
      else {
        closing.current = true;
        closeRef.current();
      }
    }).catch(() => {
      if (!active) { return; }
      if (reviewExisting) { setState('error'); }
      else {
        closing.current = true;
        closeRef.current();
      }
    });
    return () => { active = false; };
  }, [account, reviewExisting]);

  const display = useCallback((receipt: DemoGiftReceipt): CheckinGiftReceipt => ({
    id: receipt.id,
    title: t('checkinGift.demoPrize', { count: receipt.points }),
    description: t('checkinGift.demoPrizeDescription'),
  }), [t]);
  const displayedReceipt = useMemo(() => initialReceipt ? display(initialReceipt) : null, [display, initialReceipt]);

  if (state === 'loading') { return null; }
  if (state === 'skipped' || state === 'error') {
    return <AppAlertModal
      queued
      visible
      title={t(state === 'skipped' ? 'checkinGift.usedTitle' : 'checkinGift.title')}
      message={t(state === 'skipped' ? 'checkinGift.skippedToday' : 'checkinGift.error')}
      onDismiss={finish}
      buttons={[{ text: t('checkinGift.close'), onPress: finish }]}
    />;
  }
  return <CheckinGiftModal
    visible
    demo
    initialReceipt={displayedReceipt}
    onClose={finish}
    onSkip={() => gifts.skip(account)}
    onOpen={async box => display(await gifts.open(account, box))}
  />;
}
