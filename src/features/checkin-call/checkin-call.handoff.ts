import type { VoipCallPayload } from '../../lib/voip';

type RouteGate = {
  ready: boolean;
  active: boolean;
  pathname: string;
  attemptId?: string;
  nativeAnswered?: string;
};

export type CallHandoffRoute = {
  kind: 'navigate' | 'replace' | 'params';
  call: VoipCallPayload;
};

// Native events, cold-start recovery and foreground recovery refer to the same
// attempt. Keep one pending handoff until the response screen takes ownership.
export class CheckinCallHandoff {
  private pending: VoipCallPayload | null = null;
  private dispatched: string | null = null;

  receive(call: VoipCallPayload) {
    if (!call?.episodeId || !call?.attemptId) return;
    if (this.pending?.attemptId !== call.attemptId) this.dispatched = null;
    this.pending = call;
  }

  foreground() { this.dispatched = null; }

  clear(attemptId?: string) {
    if (attemptId && this.pending?.attemptId !== attemptId) return;
    this.pending = null;
    this.dispatched = null;
  }

  route(gate: RouteGate): CallHandoffRoute | null {
    const call = this.pending;
    // Index owns bootstrap/consent and prioritizes the same pending native call.
    // Never compete with its asynchronous home redirect or route before Stack.
    if (!call || !gate.ready || !gate.active || gate.pathname === '/') return null;
    if (gate.pathname === `/checkin-call/${call.episodeId}`) {
      if (gate.attemptId === call.attemptId && gate.nativeAnswered === '1') return null;
      if (this.dispatched === call.attemptId) return null;
      this.dispatched = call.attemptId;
      return { kind: gate.attemptId === call.attemptId ? 'params' : 'replace', call };
    }
    if (this.dispatched === call.attemptId) return null;
    this.dispatched = call.attemptId;
    return { kind: 'navigate', call };
  }
}

// Accept is not a health response. Share the request between the native event
// handler and the screen, without sharing it across authenticated sessions.
export class CheckinCallAcceptance<T> {
  private scope: string | null = null;
  private requests = new Map<string, Promise<T>>();

  constructor(private readonly request: (attemptId: string) => Promise<T>) {}

  accept(attemptId: string, scope: string | null): Promise<T> {
    if (!scope) return Promise.reject(new Error('No authenticated call session'));
    if (this.scope !== scope) {
      this.scope = scope;
      this.requests.clear();
    }
    const existing = this.requests.get(attemptId);
    if (existing) return existing;
    const pending = this.request(attemptId).catch(error => {
      if (this.requests.get(attemptId) === pending) this.requests.delete(attemptId);
      throw error;
    });
    this.requests.set(attemptId, pending);
    // Only a small bounded, in-memory session cache; no credentials persisted.
    if (this.requests.size > 32) this.requests.delete(this.requests.keys().next().value!);
    return pending;
  }
}
