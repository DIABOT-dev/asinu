import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, Modal, type ModalProps, Platform } from 'react-native';
import { ModalQueue } from '../lib/modalQueue';
import { attachNativePermissionPresenter } from '../lib/native-permissions';
import { checkinPresentation } from '../lib/checkin-presentation';
import { useCheckinPresentationBlocked } from '../hooks/useCheckinPresentation';

type Content = Omit<ModalProps, 'visible' | 'onShow' | 'onDismiss'>;
type Props = Omit<ModalProps, 'onShow' | 'onDismiss'> & {
  priority?: number;
  interruptible?: boolean;
  onShow?: () => void;
  onDismiss?: () => void | Promise<void>;
};
const QueueContext = createContext<ModalQueue<Content> | null>(null);

export function QueuedModalProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(() => new ModalQueue<Content>(AppState.currentState === 'active'));
  useEffect(() => {
    const syncPriority = () => queue.setSuspended(checkinPresentation.isBlocked());
    syncPriority();
    const unsubscribePriority = checkinPresentation.subscribe(syncPriority);
    const detach = attachNativePermissionPresenter(queue);
    queue.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => queue.setForeground(state === 'active'));
    return () => { subscription.remove(); detach(); unsubscribePriority(); };
  }, [queue]);
  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

function useModalQueue() {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error('QueuedModal requires QueuedModalProvider');
  return queue;
}

/** Inline guidance yields to every native presenter, never occupying its slot. */
export function useQueuedModalBusy() {
  const checkinBlocked = useCheckinPresentationBlocked();
  const queue = useModalQueue();
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  return checkinBlocked || Boolean(snapshot.active || snapshot.nativeBusy);
}

/** Portal into the root presenter so route/unmount changes cannot orphan a modal. */
export function QueuedModal(props: Props) {
  const queue = useModalQueue();
  const id = useId();

  useEffect(() => {
    const { visible = true, priority, interruptible, onShow, onDismiss, ...content } = props;
    queue.setSuspended(checkinPresentation.isBlocked());
    if (visible) {
      queue.request(id, { content, priority, interruptible, onShow, onDismiss });
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
  // Android has no onDismiss event; avoid overlapping a fade-out window with
  // the next OS sheet after the native dialog is removed.
  return (
    <Modal
      {...active.request.content}
      animationType={Platform.OS === 'android' ? 'none' : active.request.content.animationType}
      key={active.presentation}
      visible={active.phase === 'opening' || active.phase === 'open'}
      onShow={() => queue.didShow(active.presentation)}
      onDismiss={() => queue.didDismiss(active.presentation)}
    />
  );
}
