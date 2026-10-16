import React, { useRef, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { isProdBuild } from '../../lib/appEnv';
import { CheckinGiftDemoFlow } from './CheckinGiftDemoFlow';

type Props = Omit<PressableProps, 'onPress'> & {
  eligible: boolean;
  onBeforeClose: () => Promise<unknown>;
  onClose: () => void;
};

/** Keep the health result visible first; offer the optional gift when closing. */
export function CheckinGiftCloseButton({ eligible, onBeforeClose, onClose, disabled, ...props }: Props) {
  const [showGift, setShowGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const finish = () => {
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
    if (eligible && !isProdBuild) { setShowGift(true); }
    else { onClose(); }
  };
  return <>
    <Pressable {...props} disabled={disabled || busy} onPress={closeResult} />
    {showGift && <CheckinGiftDemoFlow onClose={finish} />}
  </>;
}
