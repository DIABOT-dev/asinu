'use client';

import { useEffect, useState } from 'react';

export function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;

    const resolve = () => {
      const prefers = prefersDark.matches;
      const hasDarkClass = root.classList.contains('dark');
      setIsDark(hasDarkClass || prefers);
    };

    resolve();

    const onPrefersChange = (event: MediaQueryListEvent) => {
      const hasDarkClass = root.classList.contains('dark');
      setIsDark(hasDarkClass || event.matches);
    };

    const observer = new MutationObserver(resolve);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    try {
      prefersDark.addEventListener('change', onPrefersChange);
    } catch {
      // Safari < 14
      prefersDark.addListener(onPrefersChange);
    }

    return () => {
      observer.disconnect();
      try {
        prefersDark.removeEventListener('change', onPrefersChange);
      } catch {
        prefersDark.removeListener(onPrefersChange);
      }
    };
  }, []);

  return isDark;
}
