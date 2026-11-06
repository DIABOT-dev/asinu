import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useAuthStore } from './auth.store';

const MAIN_TAB_PATHS = new Set(['/home', '/care-circle', '/tree', '/profile', '/missions']);

/** Guard main screens even when an old tab or deep link bypasses the login redirect. */
export function useOnboardingGate(): boolean {
  const path = usePathname();
  const router = useGuardedRouter();
  const profile = useAuthStore(state => state.profile);
  const token = useAuthStore(state => state.token);
  const hydrated = useAuthStore(state => state.hydrated);
  const loading = useAuthStore(state => state.loading);
  const inMainTabs = MAIN_TAB_PATHS.has(path);
  const destination = !token ? '/login'
    : profile && profile.onboardingCompleted !== true ? '/onboarding' : null;

  useEffect(() => {
    // Native calls keep their own recovery flow, including during onboarding.
    if (inMainTabs && hydrated && !loading && destination) router.replace(destination);
  }, [destination, hydrated, inMainTabs, loading, router]);

  return !inMainTabs || hydrated && !loading && !destination;
}
