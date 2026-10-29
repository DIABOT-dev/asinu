import React, { useEffect, useRef, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';

type Props = Omit<PressableProps, 'onPress'> & {
  onBeforeClose: () => Promise<unknown>;
  onClose: () => void;
};

/** Close the health result first. Home owns presentation of its pending gift. */
export function CheckinGiftCloseButton({ onBeforeClose, onClose, disabled, ...props }: Props) {
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const closeResult = async () => {
    if (disabled || active.current) { return; }
    active.current = true;
    setBusy(true);
    // Cancel pending synthesis/playback before leaving the result screen.
    try { await onBeforeClose(); } catch { /* Closing must remain available. */ }
    if (!mounted.current) return;
    onClose();
  };
  return <Pressable {...props} disabled={disabled || busy} onPress={closeResult} />;
}
