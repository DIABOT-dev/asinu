import { create } from 'zustand';

type ToastType = 'success' | 'error';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  show: (message: string, type?: ToastType, duration?: number) => void;
  hide: () => void;
  /** Toast sẽ hiện khi màn hình kế tiếp mount */
  pending: { message: string; type: ToastType } | null;
  setPending: (message: string, type?: ToastType) => void;
  flushPending: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  visible: false,
  message: '',
  type: 'success',
  duration: 2500,
  show: (message, type = 'success', duration = 2500) =>
    set({ visible: true, message, type, duration }),
  hide: () => set({ visible: false }),
  pending: null,
  setPending: (message, type = 'success') => set({ pending: { message, type } }),
  flushPending: () => {
    const p = get().pending;
    if (p) {
      set({ pending: null, visible: true, message: p.message, type: p.type, duration: 2500 });
    }
  },
}));

/** Dùng ngoài React component (không cần hook) */
export const showToast = (message: string, type: ToastType = 'success', duration = 2500) => {
  useToastStore.getState().show(message, type, duration);
};

/** Set toast sẽ hiện ở màn hình kế tiếp khi mount */
export const setPendingToast = (message: string, type: ToastType = 'success') => {
  useToastStore.getState().setPending(message, type);
};
