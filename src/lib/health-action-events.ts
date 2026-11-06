// A signal only: no health answers, names or payloads are copied into the UI bus.
const listeners = new Set<() => void>();
export function subscribeHealthAction(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyHealthAction(path: string, method: string) {
  if (
    method !== "POST" ||
    !/^\/api\/mobile\/(?:checkin\/(?:start|followup|triage)|logs(?:\/|$)|gifts?\/.*open|gift\/open|med-doses\/[^/]+\/(?:answer|checkin))/.test(
      path,
    )
  )
    return;
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* Coin feedback never affects the original action. */
    }
  }
}
