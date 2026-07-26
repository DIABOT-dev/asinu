import { useEffect, useState } from 'react';

/** Keeps the first loading state visible long enough to be perceived. */
export function useInitialLoadingGate(dataReady: boolean, duration = 650) {
  const [minimumDurationElapsed, setMinimumDurationElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumDurationElapsed(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return !minimumDurationElapsed || !dataReady;
}
