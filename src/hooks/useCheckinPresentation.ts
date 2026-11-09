import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useIsFocused } from 'expo-router';
import { checkinPresentation } from '../lib/checkin-presentation';

export function useCheckinPresentationBlocked() {
  return useSyncExternalStore(checkinPresentation.subscribe, checkinPresentation.isBlocked,
    checkinPresentation.isBlocked);
}

/** Hold through both text/audio preparation and the visible conclusion. */
export function useCheckinPresentationPriority(enabled: boolean) {
  const focused = useIsFocused();
  useLayoutEffect(() => {
    if (enabled && focused) return checkinPresentation.hold();
  }, [enabled, focused]);
}
