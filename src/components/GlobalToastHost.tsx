import { useToastStore } from '../stores/toast.store';
import { Toast } from './Toast';

/** Render ở root _layout.tsx — ngoài Stack navigation */
export function GlobalToastHost() {
  const { visible, message, type, duration, hide } = useToastStore();
  return (
    <Toast visible={visible} message={message} type={type} duration={duration} onHide={hide} />
  );
}
