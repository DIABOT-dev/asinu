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
      mode: 'system',
      resolved: 'light',
      setMode: (mode) => {
        const resolved = mode === 'system' ? get().resolved : mode;
        set({ mode, resolved });
      },
      setSystemScheme: (scheme) => {
        const { mode } = get();
        set({ resolved: mode === 'system' ? scheme : (mode as 'light' | 'dark') });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
