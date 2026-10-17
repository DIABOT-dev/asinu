import React, { useEffect, useRef, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { CheckinGiftFlow } from './CheckinGiftFlow';

type Props = Omit<PressableProps, 'onPress'> & {
  eligible: boolean;
  onBeforeClose: () => Promise<unknown>;
  onClose: () => void;
  autoOffer?: boolean;
  status?: string;
  familyAlerted?: boolean;
};

/** Keep the health result visible first; offer the optional gift when closing. */
export function CheckinGiftCloseButton({ eligible, onBeforeClose, onClose, disabled, autoOffer = false, status, familyAlerted, ...props }: Props) {
  const [showGift, setShowGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const autoShown = useRef(false);
  const automatic = useRef(false);
  const mounted = useRef(true);
  const finished = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setShowGift(false);
    setBusy(false);
    active.current = false;
    onClose();
  };
  const closeResult = async () => {
    if (disabled || active.current) { return; }
    active.current = true;
    setBusy(true);
    // Cancel pending synthesis/playback before displaying the gift sheet.
    try { await onBeforeClose(); } catch { /* Closing must remain available. */ }
    if (!mounted.current) return;
    if (eligible) { setShowGift(true); }
    else { onClose(); }
  };
  useEffect(() => {
    if (autoOffer && eligible && !disabled && !autoShown.current) {
      autoShown.current = true; automatic.current = true; void closeResult();
    }
  }, [autoOffer, eligible, disabled]);
  return <>
    <Pressable {...props} disabled={disabled || busy} onPress={closeResult} />
    {showGift && <CheckinGiftFlow status={status} familyAlerted={familyAlerted} onClose={finish}
      onUnavailable={() => {
        if (automatic.current) { setShowGift(false); setBusy(false); active.current = false; automatic.current = false; }
        else finish();
      }} />}
  </>;
}
