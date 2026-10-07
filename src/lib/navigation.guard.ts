export type NavigationTarget = string | { pathname: string; params?: Record<string, unknown> };
type Action = 'push' | 'navigate' | 'replace' | 'back';

export type NavigationStateSnapshot = {
  index?: number;
  routes: readonly {
    key?: string;
    name: string;
    params?: Readonly<object>;
    state?: NavigationStateSnapshot;
  }[];
};

type Destination = { path: string; key: string; answered: boolean; call: boolean };
const reservedParams = new Set(['screen', 'params', 'initial', 'state']);
const decode = (value: string) => {
  try { return decodeURIComponent(value.replace(/\+/g, ' ')); }
  catch { return value; }
};

// String links, route objects, tab groups and dynamic path parameters must all
// identify the same destination. Query parameters still distinguish different
// patients, consultations and check-in modes.
export function navigationDestination(target: NavigationTarget): Destination {
  const href = typeof target === 'string' ? { pathname: target } : target;
  const [pathname, query = ''] = href.pathname.split('?');
  const params: Record<string, unknown> = {};
  for (const entry of query.split('&').filter(Boolean)) {
    const separator = entry.indexOf('=');
    const name = separator < 0 ? entry : entry.slice(0, separator);
    params[decode(name)] = decode(separator < 0 ? '' : entry.slice(separator + 1));
  }
  Object.assign(params, href.params);
  let path = pathname.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (segment, name: string) => {
    const value = params[name];
    if (value == null) return segment;
    delete params[name];
    return Array.isArray(value)
      ? value.map(part => encodeURIComponent(String(part))).join('/')
      : encodeURIComponent(String(value));
  });
  const segments = path.split('/').filter(segment => segment && !/^\(.+\)$/.test(segment));
  if (segments.at(-1) === 'index') segments.pop();
  path = `/${segments.join('/')}`;
  const isCall = /^\/checkin-call\/[^/]+$/.test(path) && params.attemptId != null;
  const answered = String(params.nativeAnswered ?? '') === '1';
  const entries = Object.entries(params)
    .filter(([name, value]) => value != null && !reservedParams.has(name) &&
      !name.startsWith('__internal') && !(isCall && name === 'nativeAnswered'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, String(value)]);
  return { path, key: JSON.stringify([path, entries]), answered, call: isCall };
}

export function focusedNavigationDestination(state: NavigationStateSnapshot | undefined) {
  const names: string[] = [];
  const params: Record<string, unknown> = {};
  let key = '';
  let current = state;
  while (current?.routes.length) {
    const route = current.routes[current.index ?? 0];
    if (!route) break;
    // Expo 57 wraps the app navigator in an internal __root screen; it is not
    // part of the public URL. Tabs/groups are normalized separately below.
    if (route.name !== '__root') names.push(route.name);
    Object.assign(params, route.params);
    key = route.key ?? key;
    current = route.state;
  }
  if (!names.length) return undefined;
  return { ...navigationDestination({ pathname: names.join('/'), params }), routeKey: key };
}

export class NavigationGuard {
  private origin = '';
  private pending = new Map<string, boolean>();
  private lockedUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  observe(state: NavigationStateSnapshot | undefined) {
    const current = focusedNavigationDestination(state);
    const origin = current ? `${current.routeKey}:${current.key}` : '';
    if (origin !== this.origin) {
      this.origin = origin;
      this.pending.clear();
    }
  }

  run(action: Action, target: NavigationTarget | undefined, state: NavigationStateSnapshot | undefined,
    execute: () => void, external = false): boolean {
    this.observe(state);
    const current = focusedNavigationDestination(state);
    const destination = target === undefined ? undefined : navigationDestination(target);
    const key = destination?.key ?? 'back';
    // CallKit answering an already opened call only upgrades its parameters;
    // it must not create another screen or lose native audio ownership.
    const upgrade = destination?.answered && this.pending.get(key) !== true &&
      ((current?.key === key && !current.answered) || this.pending.get(key) === false);
    if (current?.key === key && !upgrade) return false;
    if (this.pending.has(key) && !upgrade) return false;
    const now = this.now();
    // Auth/startup replacements and incoming calls cannot be lost just because
    // a user pressed another button in the last 650 ms.
    if (action !== 'replace' && !external && now < this.lockedUntil) return false;
    const previousLock = this.lockedUntil;
    const previousPending = this.pending.get(key);
    this.lockedUntil = now + 650;
    // Keep an in-flight destination until navigation state acknowledges it,
    // even if the JS thread/transition takes longer than the tap cooldown.
    if (current) this.pending.set(key, destination?.answered ?? false);
    try {
      execute();
      return true;
    } catch (error) {
      this.lockedUntil = previousLock;
      if (previousPending === undefined) this.pending.delete(key);
      else this.pending.set(key, previousPending);
      throw error;
    }
  }
}

// All mounted screens and notification handlers share the same in-flight gate.
export const navigationGuard = new NavigationGuard();
