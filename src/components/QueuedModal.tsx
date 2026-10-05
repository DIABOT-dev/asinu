import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from 'react';
import { Modal, type ModalProps, Platform } from 'react-native';
import { ModalQueue } from '../lib/modalQueue';

type Content = Omit<ModalProps, 'visible' | 'onShow' | 'onDismiss'>;
type Props = Omit<ModalProps, 'onShow' | 'onDismiss'> & {
  priority?: number;
  onShow?: () => void;
  onDismiss?: () => void | Promise<void>;
};
const QueueContext = createContext<ModalQueue<Content> | null>(null);

export function QueuedModalProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(() => new ModalQueue<Content>());
  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

function useModalQueue() {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error('QueuedModal requires QueuedModalProvider');
  return queue;
}

/** Portal into the root presenter so route/unmount changes cannot orphan a modal. */
export function QueuedModal(props: Props) {
  const queue = useModalQueue();
  const id = useId();

  useEffect(() => {
    const { visible = true, priority, onShow, onDismiss, ...content } = props;
    if (visible) {
      queue.request(id, { content, priority, onShow, onDismiss });
    } else {
      queue.remove(id);
    }
  }, [id, props, queue]);

  useEffect(() => () => queue.remove(id), [id, queue]);
  return null;
}

/** One native Modal for startup prompts, with the closing content retained. */
export function QueuedModalHost() {
  const queue = useModalQueue();
  const { active } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const closingPresentation = active?.phase === 'closing' ? active.presentation : undefined;

  useEffect(() => {
    // RN's onDismiss is iOS-only. On Android/web, advance after the commit
    // hiding the native dialog, not in the same button callback.
    if (Platform.OS === 'ios' || closingPresentation === undefined) return;
    const timer = setTimeout(() => queue.didDismiss(closingPresentation), 0);
    return () => clearTimeout(timer);
  }, [closingPresentation, queue]);

  if (!active) return null;
  return (
    <Modal
      {...active.request.content}
      key={active.presentation}
      visible={active.phase === 'opening' || active.phase === 'open'}
      onShow={() => queue.didShow(active.presentation)}
      onDismiss={() => queue.didDismiss(active.presentation)}
    />
  );
}
