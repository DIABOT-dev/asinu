import { useCallback, useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';

type ExpoRouter = ReturnType<typeof useExpoRouter>;
type NavigationAction = 'push' | 'replace' | 'back' | 'navigate';

const NAVIGATION_COOLDOWN_MS = 650;

let navigationLockedUntil = 0;
let lastNavigationKey = '';

function routeKey(target: unknown): string {
  if (typeof target === 'string') return target;
  try {
    return JSON.stringify(target);
  } catch {
    return String(target);
  }
}

function runGuardedNavigation(action: NavigationAction, target: unknown, run: () => void) {
  const now = Date.now();
  const key = `${action}:${routeKey(target)}`;

  if (now < navigationLockedUntil) {
    if (__DEV__) {
      console.warn('[navigation] blocked rapid navigation', {
        action,
        target,
        lastNavigationKey,
      });
    }
    return;
  }

  lastNavigationKey = key;
  navigationLockedUntil = now + NAVIGATION_COOLDOWN_MS;
  run();
}

export function useGuardedRouter(): ExpoRouter {
  const router = useExpoRouter();

  const push = useCallback<ExpoRouter['push']>(
    ((href: Parameters<ExpoRouter['push']>[0], options?: Parameters<ExpoRouter['push']>[1]) => {
      runGuardedNavigation('push', href, () => router.push(href as any, options as any));
    }) as ExpoRouter['push'],
    [router],
  );

  const replace = useCallback<ExpoRouter['replace']>(
    ((href: Parameters<ExpoRouter['replace']>[0], options?: Parameters<ExpoRouter['replace']>[1]) => {
      runGuardedNavigation('replace', href, () => router.replace(href as any, options as any));
    }) as ExpoRouter['replace'],
    [router],
  );

  const back = useCallback<ExpoRouter['back']>(() => {
    runGuardedNavigation('back', 'back', () => router.back());
  }, [router]);

  const navigate = useCallback<ExpoRouter['navigate']>(
    ((href: Parameters<ExpoRouter['navigate']>[0]) => {
      runGuardedNavigation('navigate', href, () => router.navigate(href as any));
    }) as ExpoRouter['navigate'],
    [router],
  );

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
      back,
      navigate,
    }),
    [back, navigate, push, replace, router],
  );
}
