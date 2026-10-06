import { useCallback, useId, useLayoutEffect } from 'react';
import { create } from 'zustand';
import { useToastStore } from '../stores/toast.store';
import { Toast } from './Toast';

type ToastHosts = {
  modalHosts: string[];
  register: (id: string) => void;
  unregister: (id: string) => void;
};

// Native modals render above the root navigation view. Move the single toast
// presentation into the topmost registered modal, without duplicating events.
const useToastHosts = create<ToastHosts>((set) => ({
  modalHosts: [],
  register: id => set(state => state.modalHosts.includes(id)
    ? state : { modalHosts: [...state.modalHosts, id] }),
  unregister: id => set(state => ({ modalHosts: state.modalHosts.filter(host => host !== id) })),
}));

function ToastPresentation() {
  const { toastId, visible, message, type, duration, lastShownAt, hide } = useToastStore();
  const handleHide = useCallback(() => hide(toastId), [hide, toastId]);
  // Switching between modal and root must not restart the toast's lifetime.
  const remaining = visible ? Math.max(1, duration - Math.max(0, Date.now() - lastShownAt)) : duration;
  return (
    <Toast
      key={toastId}
      visible={visible}
      message={message}
      type={type}
      duration={remaining}
      onHide={handleHide}
    />
  );
}

/** The one root host remains mounted outside Stack navigation. */
export function GlobalToastHost() {
  const hasModalHost = useToastHosts(state => state.modalHosts.length > 0);
  return hasModalHost ? null : <ToastPresentation />;
}

/** Mount inside a visible native app modal; the root pauses while it is mounted. */
export function ModalToastHost() {
  const id = useId();
  const activeHost = useToastHosts(state => state.modalHosts[state.modalHosts.length - 1]);
  useLayoutEffect(() => {
    useToastHosts.getState().register(id);
    return () => useToastHosts.getState().unregister(id);
  }, [id]);
  return activeHost === id ? <ToastPresentation /> : null;
}
