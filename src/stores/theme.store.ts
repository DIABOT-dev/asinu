import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  /** Resolved mode after applying system preference */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setSystemScheme: (scheme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'light',
      resolved: 'light',
      setMode: (mode) => {
        set({ mode, resolved: 'light' });
      },
      setSystemScheme: (_scheme) => {
        // Dark mode disabled — always light
        set({ resolved: 'light' });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
