import { useEffect, useRef, useState } from 'react';

/**
 * Shows a first-load skeleton without delaying data that is already available.
 * `hasCachedData` is supplied by the screen/store so the gate stays
 * independent from the cache implementation.
 */
export function useInitialLoadingGate(
  dataReady: boolean,
  duration = 650,
  hasCachedData = false,
) {
  const hasHadData = useRef(hasCachedData);
  if (hasCachedData) {
    hasHadData.current = true;
  }

  const [minimumDurationElapsed, setMinimumDurationElapsed] = useState(hasCachedData);

  useEffect(() => {
    if (hasHadData.current) {
      setMinimumDurationElapsed(true);
      return;
    }

    const timer = setTimeout(() => setMinimumDurationElapsed(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  if (hasHadData.current) {
    return false;
  }

  return !minimumDurationElapsed || !dataReady;
}
