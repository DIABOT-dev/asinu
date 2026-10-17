export type ModalRequest<T> = {
  content: T;
  priority?: number;
  interruptible?: boolean;
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
type NativeRequest = {
  operation: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
const nativePermissionPriority = 30;

/** A single native presenter. Never release its slot before native onDismiss. */
export class ModalQueue<T> {
  private requests = new Map<string, Entry<T>>();
  private listeners = new Set<() => void>();
  private order = 0;
  private presentation = 0;
  private nativeRequests: NativeRequest[] = [];
  private runningNative = false;
  private foreground: boolean;
  private snapshot: { active: ActiveModal<T> | null; nativeBusy: boolean } = { active: null, nativeBusy: false };

  constructor(foreground = true) { this.foreground = foreground; }

  setForeground(foreground: boolean) {
    this.foreground = foreground;
    if (foreground) { this.pumpNative(); this.advance(); }
  }

  /** OS sheets share the presenter slot with app dialogs, including dismissal actions. */
  runNative<R>(operation: () => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.nativeRequests.push({ operation, resolve: value => resolve(value as R), reject });
      this.publish(this.snapshot.active);
      this.pumpNative();
    });
  }

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
    const current = this.snapshot.active;
    if (current?.phase === 'open' && this.shouldYield(current)) this.publish({ ...current, phase: 'closing' });
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
    const stillRequested = this.requests.has(active.id) && !this.shouldYield(active);
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
      this.pumpNative();
      this.advance();
    };
    try {
      const action = active.request.onDismiss?.();
      if (action) {
        void action.then(finish, finish);
        this.pumpNative();
        return;
      }
    } catch (error) {
      finish();
      throw error;
    }
    finish();
  }

  private advance() {
    if (!this.foreground || this.snapshot.active || this.runningNative) return;
    const next = [...this.requests.entries()].sort(([, a], [, b]) =>
      (b.priority ?? 0) - (a.priority ?? 0) || a.order - b.order
    )[0];
    if (this.nativeRequests.length && (!next || (next[1].priority ?? 0) < nativePermissionPriority)) {
      this.pumpNative();
      return;
    }
    if (!next) return;
    const [id, request] = next;
    this.publish({ id, request, presentation: ++this.presentation, phase: 'opening' });
  }

  private shouldYield(active: ActiveModal<T>) {
    return active.request.interruptible === true && [...this.requests.entries()].some(([id, request]) => id !== active.id && (request.priority ?? 0) >= 100 && (request.priority ?? 0) > (active.request.priority ?? 0));
  }

  private publish(active: ActiveModal<T> | null) {
    this.snapshot = { active, nativeBusy: this.runningNative || this.nativeRequests.length > 0 };
    this.listeners.forEach(listener => listener());
  }

  private pumpNative() {
    if (!this.foreground || this.runningNative || !this.nativeRequests.length || (this.snapshot.active && this.snapshot.active.phase !== 'settling')) return;
    // Consent and safety dialogs come first; optional startup prompts wait.
    if (!this.snapshot.active && [...this.requests.values()].some(request => (request.priority ?? 0) >= nativePermissionPriority)) {
      this.advance();
      return;
    }
    const request = this.nativeRequests.shift();
    if (!request) return;
    this.runningNative = true;
    this.publish(this.snapshot.active);
    void Promise.resolve().then(request.operation).then(request.resolve, request.reject).finally(() => {
      this.runningNative = false;
      this.publish(this.snapshot.active);
      this.pumpNative();
      this.advance();
    });
  }
}
