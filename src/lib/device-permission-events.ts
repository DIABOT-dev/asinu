const listeners = new Set<() => void>();

export function subscribeNotificationPermissionChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyNotificationPermissionChanged() {
  listeners.forEach((listener) => listener());
}
