import { tokenStore } from './tokenStore';

type DeferredPresentation = { run: () => void | Promise<void>; expiresAt: number; reference?: string };

/** Check-in owns the foreground until its loading/result screen is left. */
export class CheckinPresentationPriority {
  private owners = new Set<symbol>();
  private listeners = new Set<() => void>();
  private deferred = new Map<string, DeferredPresentation>();
  private settling: ReturnType<typeof setTimeout> | undefined;
  private blocked = false;
  private draining = false;

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked = () => this.blocked;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  hold() {
    const owner = Symbol('checkin');
    this.owners.add(owner);
    clearTimeout(this.settling);
    this.publish(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.owners.delete(owner);
      if (this.owners.size) return;
      // Let the outgoing screen/native transition finish before presenting.
      this.settling = setTimeout(() => {
        this.settling = undefined;
        if (this.owners.size) return;
        this.publish(false);
        void this.drain();
      }, 350);
    };
  }

  defer(key: string, run: () => void | Promise<void>, ttlMs = 5 * 60_000, reference?: string) {
    if (!this.blocked) return false;
    this.deferred.set(key, { run, expiresAt: this.now() + ttlMs, reference });
    // Bound memory if a disconnected device receives a burst of events.
    if (this.deferred.size > 32) this.deferred.delete(this.deferred.keys().next().value!);
    return true;
  }

  cancel(key: string, reference: string) {
    if (this.deferred.get(key)?.reference === reference) this.deferred.delete(key);
  }

  /** Logout/account replacement invalidates queued effects, not health data. */
  clearDeferred() { this.deferred.clear(); }

  private publish(blocked: boolean) {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    this.listeners.forEach(listener => listener());
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (!this.blocked && this.deferred.size) {
        const [key, entry] = this.deferred.entries().next().value!;
        this.deferred.delete(key);
        if (entry.expiresAt <= this.now()) continue;
        try { await entry.run(); } catch { /* One expired effect cannot block the inbox. */ }
      }
    } finally { this.draining = false; }
  }
}

export const checkinPresentation = new CheckinPresentationPriority();
tokenStore.subscribeSession(() => {
  if (!tokenStore.isRotatingToken()) checkinPresentation.clearDeferred();
});
