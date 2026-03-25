import { create } from 'zustand';

type ToastType = 'success' | 'error';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  show: (message: string, type?: ToastType, duration?: number) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'success',
  duration: 2500,
  show: (message, type = 'success', duration = 2500) =>
    set({ visible: true, message, type, duration }),
  hide: () => set({ visible: false }),
}));

/** Dùng ngoài React component (không cần hook) */
export const showToast = (message: string, type: ToastType = 'success', duration = 2500) => {
  useToastStore.getState().show(message, type, duration);
};
