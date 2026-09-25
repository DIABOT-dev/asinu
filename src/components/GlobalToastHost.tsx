import { useCallback } from 'react';
import { useToastStore } from '../stores/toast.store';
import { Toast } from './Toast';

/** Render ở root _layout.tsx — ngoài Stack navigation */
export function GlobalToastHost() {
  const { toastId, visible, message, type, duration, hide } = useToastStore();
  const handleHide = useCallback(() => hide(toastId), [hide, toastId]);
  return (
    <Toast
      key={toastId}
      visible={visible}
      message={message}
      type={type}
      duration={duration}
      onHide={handleHide}
    />
  );
}
