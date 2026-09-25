import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  toastId: number;
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  lastSignature: string;
  lastShownAt: number;
  show: (message: string, type?: ToastType, duration?: number) => void;
  hide: (toastId?: number) => void;
  /** Toast sẽ hiện khi màn hình kế tiếp mount */
  pending: { message: string; type: ToastType } | null;
  setPending: (message: string, type?: ToastType) => void;
  flushPending: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toastId: 0,
  visible: false,
  message: '',
  type: 'success',
  duration: 2500,
  lastSignature: '',
  lastShownAt: 0,
  show: (message, type = 'success', duration = 2500) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    const state = get();
    const now = Date.now();
    const signature = `${type}:${normalizedMessage}`;

    // A push listener and a screen callback can receive the same event almost
    // simultaneously. Keep one toast instead of displaying the duplicate.
    if (
      (state.visible && state.message === normalizedMessage && state.type === type) ||
      (state.lastSignature === signature && now - state.lastShownAt < 2000)
    ) {
      return;
    }

    set({
      toastId: state.toastId + 1,
      visible: true,
      message: normalizedMessage,
      type,
      duration,
      lastSignature: signature,
      lastShownAt: now,
    });
  },
  hide: (toastId) =>
    set((state) => {
      if (toastId !== undefined && state.toastId !== toastId) return state;
      return { visible: false };
    }),
  pending: null,
  setPending: (message, type = 'success') => set({ pending: { message, type } }),
  flushPending: () => {
    const p = get().pending;
    if (p) {
      set({ pending: null });
      get().show(p.message, p.type);
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
