import { useMemo } from 'react';
import { useFontSizeStore } from '../stores/font-size.store';
import { typography as baseTypography } from '../styles/theme';

/**
 * Hook để lấy typography với font size đã được scale theo setting
 */
export const useScaledTypography = () => {
  const multiplier = useFontSizeStore((state) => state.multiplier);

  return useMemo(
    () => ({
      ...baseTypography,
      size: {
        xs: Math.round(baseTypography.size.xs * multiplier),
        sm: Math.round(baseTypography.size.sm * multiplier),
        md: Math.round(baseTypography.size.md * multiplier),
        lg: Math.round(baseTypography.size.lg * multiplier),
        xl: Math.round(baseTypography.size.xl * multiplier)
      }
    }),
    [multiplier]
  );
};

/**
 * Hook để scale một font size cụ thể
 */
export const useScaledFontSize = (baseSize: number): number => {
  const multiplier = useFontSizeStore((state) => state.multiplier);
  return useMemo(() => Math.round(baseSize * multiplier), [baseSize, multiplier]);
};
