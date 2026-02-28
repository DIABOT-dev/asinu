import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppLanguage = 'vi' | 'en';

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: (i18n.language as AppLanguage) || 'vi',
      setLanguage: (language: AppLanguage) => {
        i18n.changeLanguage(language);
        AsyncStorage.setItem('@app/language', language);
        set({ language });
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
