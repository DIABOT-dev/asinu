export type ModalRequest<T> = {
  content: T;
  priority?: number;
  onShow?: () => void;
  onDismiss?: () => void | Promise<void>;
};

type Entry<T> = ModalRequest<T> & { order: number };
type ActiveModal<T> = {
  id: string;
  presentation: number;
  phase: 'opening' | 'open' | 'closing' | 'settling';
  request: ModalRequest<T>;
};

/** A single native presenter. Never release its slot before native onDismiss. */
export class ModalQueue<T> {
  private requests = new Map<string, Entry<T>>();
  private listeners = new Set<() => void>();
  private order = 0;
  private presentation = 0;
  private snapshot: { active: ActiveModal<T> | null } = { active: null };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  request(id: string, request: ModalRequest<T>) {
    this.requests.set(id, {
      ...request,
      order: this.requests.get(id)?.order ?? ++this.order,
    });
    const active = this.snapshot.active;
    if (active?.id === id && (active.phase === 'opening' || active.phase === 'open')) {
      this.publish({ ...active, request });
    } else if (!active) {
      this.advance();
    }
  }

  remove(id: string) {
    this.requests.delete(id);
    const active = this.snapshot.active;
    if (active?.id === id && active.phase === 'open') {
      this.publish({ ...active, phase: 'closing' });
    }
    // If closed during presentation, keep visible until onShow. Toggling
    // visible before UIKit finishes presenting can leave an invisible blocker.
  }

  didShow(presentation: number) {
    const active = this.snapshot.active;
    if (!active || active.presentation !== presentation || active.phase !== 'opening') return;
    const stillRequested = this.requests.has(active.id);
    this.publish({ ...active, phase: stillRequested ? 'open' : 'closing' });
    if (stillRequested) active.request.onShow?.();
  }

  didDismiss(presentation: number) {
    const active = this.snapshot.active;
    if (!active || active.presentation !== presentation || active.phase !== 'closing') return;
    // A dismissed app prompt may open an OS permission sheet. Keep the slot
    // until that async action completes too, without retaining a touch blocker.
    this.publish({ ...active, phase: 'settling' });
    const finish = () => {
      if (this.snapshot.active?.presentation !== presentation) return;
      this.publish(null);
      this.advance();
    };
    try {
      const action = active.request.onDismiss?.();
      if (action) {
        void action.then(finish, finish);
        return;
      }
    } catch (error) {
      finish();
      throw error;
    }
    finish();
  }

  private advance() {
    if (this.snapshot.active || this.requests.size === 0) return;
    const [id, request] = [...this.requests.entries()].sort(([, a], [, b]) =>
      (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order
    )[0];
    this.publish({ id, request, presentation: ++this.presentation, phase: 'opening' });
  }

  private publish(active: ActiveModal<T> | null) {
    this.snapshot = { active };
    this.listeners.forEach(listener => listener());
  }
}
