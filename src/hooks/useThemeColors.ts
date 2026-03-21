/**
 * useThemeColors — Returns the correct color palette based on current theme.
 * Forces React re-render when theme changes (unlike the Proxy which is for non-React contexts).
 */
import { useMemo } from 'react';
import { useThemeStore } from '../stores/theme.store';
import {
  lightColors,
  darkColors,
  lightCategoryColors,
  darkCategoryColors,
  lightBrandColors,
  darkBrandColors,
} from '../styles/theme';

export function useThemeColors() {
  const resolved = useThemeStore((s) => s.resolved);
  const isDark = resolved === 'dark';

  return useMemo(() => ({
    colors: isDark ? darkColors : lightColors,
    categoryColors: isDark ? darkCategoryColors : lightCategoryColors,
    brandColors: isDark ? darkBrandColors : lightBrandColors,
    isDark,
  }), [isDark]);
}
