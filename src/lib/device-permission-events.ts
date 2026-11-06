const listeners = new Set<() => void>();
const taskReminderListeners = new Set<() => void>();

export function subscribeNotificationPermissionChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyNotificationPermissionChanged() {
  listeners.forEach((listener) => listener());
}

export function subscribeTaskReminderPreferenceChanged(listener: () => void) {
  taskReminderListeners.add(listener);
  return () => {
    taskReminderListeners.delete(listener);
  };
}

export function notifyTaskReminderPreferenceChanged() {
  taskReminderListeners.forEach((listener) => listener());
}
