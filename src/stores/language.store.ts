import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { authApi } from '../features/auth/auth.api';

export type AppLanguage = 'vi' | 'en';

interface LanguageStore {
  language: AppLanguage;
  applyLanguage: (language: AppLanguage) => void;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: (i18n.language as AppLanguage) || 'vi',
      applyLanguage: (language: AppLanguage) => {
        i18n.changeLanguage(language);
        AsyncStorage.setItem('@app/language', language);
        set({ language });
      },
      setLanguage: (language: AppLanguage) => {
        i18n.changeLanguage(language);
        AsyncStorage.setItem('@app/language', language);
        set({ language });
        authApi.updateProfile({ language }).catch(() => {});
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Sync i18n với ngôn ngữ đã lưu khi Zustand rehydrate từ AsyncStorage
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
