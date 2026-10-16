import { AppState } from 'react-native';
import { tokenStore } from './tokenStore';

type Presenter = { runNative<T>(operation: () => Promise<T>): Promise<T> };
type Options = { key: string; settings?: boolean; canRun?: () => boolean };
let presenter: Presenter | null = null;
const pending = new Map<string, { token: string | null; canRun?: () => boolean; result: Promise<unknown> }>();

export function attachNativePermissionPresenter(value: Presenter) {
  presenter = value;
  return () => {
    if (presenter === value) {
      presenter = null;
      pending.clear();
    }
  };
}

const nextFrame = () => new Promise<void>(resolve => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => resolve());
  } else {
    setTimeout(resolve, 0);
  }
});

/** Serialize OS permission UI after app-modal dismissal and before the next prompt. */
export function runNativePermission<T>(operation: () => Promise<T>, options: Options): Promise<T> {
  const token = tokenStore.getToken();
  const existing = pending.get(options.key);
  if (existing?.token === token && existing.canRun === options.canRun) {
    return existing.result as Promise<T>;
  }
  const owner = presenter;
  if (!owner) {
    return Promise.reject(new Error('Permission presenter is not ready'));
  }
  const current = () => presenter === owner && tokenStore.getToken() === token && (options.canRun?.() ?? true);
  const result = owner.runNative(async () => {
    let left = AppState.currentState !== 'active';
    let returned = false;
    let enteredSettings: (() => void) | undefined;
    let becameActive: (() => void) | undefined;
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        left = true;
        enteredSettings?.();
      } else {
        if (left) { returned = true; }
        becameActive?.();
      }
    });
    const waitUntilActive = async () => {
      if (AppState.currentState !== 'active') {
        await new Promise<void>(resolve => { becameActive = resolve; });
      }
    };
    try {
      await waitUntilActive();
      if (!current()) { throw new Error('Permission request is no longer current'); }
      // Let the native commit removing the previous app dialog finish first.
      await nextFrame();
      await waitUntilActive();
      if (!current()) { throw new Error('Permission request is no longer current'); }
      left = false;
      returned = false;
      const decision = await operation();
      if (options.settings && decision !== false && !left) {
        // startActivity/openSettings resolve before the foreground event changes.
        await new Promise<void>(resolve => {
          enteredSettings = resolve;
          transitionTimer = setTimeout(resolve, 1000);
        });
      }
      if (left && !returned) { await waitUntilActive(); }
      await nextFrame();
      await waitUntilActive();
      if (!current()) { throw new Error('Permission request is no longer current'); }
      return decision;
    } finally {
      if (transitionTimer) { clearTimeout(transitionTimer); }
      subscription.remove();
    }
  });
  const entry = { token, canRun: options.canRun, result };
  pending.set(options.key, entry);
  const cleanup = () => {
    if (pending.get(options.key) === entry) { pending.delete(options.key); }
  };
  result.then(cleanup, cleanup);
  return result;
}
