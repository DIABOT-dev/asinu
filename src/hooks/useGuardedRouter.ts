import { useCallback, useEffect, useMemo } from 'react';
import { useNavigationContainerRef, useRouter as useExpoRouter } from 'expo-router';
import { focusedNavigationDestination, navigationDestination, navigationGuard } from '../lib/navigation.guard';

type ExpoRouter = ReturnType<typeof useExpoRouter>;

// Mounted once by SessionProvider. Observe native gestures/system back as well
// as JS commands, so returning to the origin can reopen a previously used route.
export function useNavigationGuardObserver() {
  const navigation = useNavigationContainerRef();
  useEffect(() => navigation.addListener('state', () => {
    navigationGuard.observe(navigation.current?.getRootState());
  }), [navigation]);
}

export function useGuardedRouter({ external = false }: { external?: boolean } = {}): ExpoRouter {
  const router = useExpoRouter();
  const navigation = useNavigationContainerRef();

  const open = useCallback((action: 'push' | 'navigate' | 'replace',
    href: Parameters<ExpoRouter['push']>[0], options?: Parameters<ExpoRouter['push']>[1]) => {
    const state = navigation.current?.getRootState();
    const target = navigationDestination(href);
    const current = focusedNavigationDestination(state);
    const isCall = target.call;
    navigationGuard.run(action, href, state, () => {
      if (isCall && current?.path === target.path) {
        if (current.key === target.key) {
          if (target.answered) router.setParams({ nativeAnswered: '1' });
        } else {
          // A new attempt needs fresh screen-local refs, not the previous call.
          router.replace(href, options);
        }
      } else if (isCall && action !== 'replace') {
        // A push and native-answer event may be queued together before the
        // navigator commits. NAVIGATE reuses the active call in that case.
        router.navigate(href, options);
      } else {
        router[action](href, options);
      }
    }, external || isCall);
  }, [external, navigation, router]);

  const push = useCallback<ExpoRouter['push']>(
    ((href: Parameters<ExpoRouter['push']>[0], options?: Parameters<ExpoRouter['push']>[1]) => {
      open('push', href, options);
    }) as ExpoRouter['push'],
    [open],
  );

  const replace = useCallback<ExpoRouter['replace']>(
    ((href: Parameters<ExpoRouter['replace']>[0], options?: Parameters<ExpoRouter['replace']>[1]) => {
      open('replace', href, options);
    }) as ExpoRouter['replace'],
    [open],
  );

  const back = useCallback<ExpoRouter['back']>(() => {
    if (!router.canGoBack()) return;
    navigationGuard.run('back', undefined, navigation.current?.getRootState(), () => router.back(), external);
  }, [external, navigation, router]);

  const navigate = useCallback<ExpoRouter['navigate']>(
    ((href: Parameters<ExpoRouter['navigate']>[0], options?: Parameters<ExpoRouter['navigate']>[1]) => {
      open('navigate', href, options);
    }) as ExpoRouter['navigate'],
    [open],
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
