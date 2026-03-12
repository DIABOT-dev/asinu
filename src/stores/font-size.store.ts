import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FontSizeScale = 'small' | 'normal' | 'large' | 'xlarge';

interface FontSizeStore {
  scale: FontSizeScale;
  multiplier: number;
  setScale: (scale: FontSizeScale) => void;
  increase: () => void;
  decrease: () => void;
}

const SCALE_MULTIPLIERS: Record<FontSizeScale, number> = {
  small: 0.875,   // -12.5%
  normal: 1.0,    // 0%
  large: 1.125,   // +12.5%
  xlarge: 1.25    // +25%
};

const SCALE_ORDER: FontSizeScale[] = ['small', 'normal', 'large', 'xlarge'];

const getMultiplier = (scale: FontSizeScale): number => SCALE_MULTIPLIERS[scale] || 1.0;

export const useFontSizeStore = create<FontSizeStore>()(
  persist(
    (set, get) => ({
      scale: 'normal',
      multiplier: 1.0,
      setScale: (scale: FontSizeScale) => {
        set({ scale, multiplier: getMultiplier(scale) });
      },
      increase: () => {
        const current = get().scale;
        const currentIndex = SCALE_ORDER.indexOf(current);
        if (currentIndex < SCALE_ORDER.length - 1) {
          const newScale = SCALE_ORDER[currentIndex + 1];
          set({ scale: newScale, multiplier: getMultiplier(newScale) });
        }
      },
      decrease: () => {
        const current = get().scale;
        const currentIndex = SCALE_ORDER.indexOf(current);
        if (currentIndex > 0) {
          const newScale = SCALE_ORDER[currentIndex - 1];
          set({ scale: newScale, multiplier: getMultiplier(newScale) });
        }
      }
    }),
    {
      name: 'font-size-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
