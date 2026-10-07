import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let checks = 0;
const read = file => fs.readFileSync(file, 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(name in imports, `Missing stub: ${name}`);
    return imports[name];
  });
  return module.exports;
}

function effectFrom(file, marker) {
  const source = read(file);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes(marker)) callback = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(callback, `Missing effect: ${marker}`);
  return deps => evaluate(`module.exports = deps => {
    const { ${Object.keys(deps).join(',')} } = deps;
    return (${callback})();
  };`)(deps);
}

function tokenHarness() {
  let value = null, error = null, deletes = 0, reads = 0;
  const { tokenStore } = evaluate(read('src/lib/tokenStore.ts'), {
    'expo-secure-store': {
      getItemAsync: async () => { reads++; if (error) throw error; return value; },
      setItemAsync: async (_key, token) => { value = token; },
      deleteItemAsync: async () => { deletes++; value = null; },
    },
  });
  return { tokenStore, saved: token => { value = token; }, fail: failure => { error = failure; }, deleted: () => deletes, reads: () => reads };
}

await test('a locked Keychain read is retryable, distinct from a missing session', async () => {
  const h = tokenHarness();
  h.saved('protected-test-session'); h.fail(new Error('Keychain temporarily locked'));
  await assert.rejects(h.tokenStore.loadToken(), /temporarily locked/);
  assert.equal(h.deleted(), 0);
  h.fail(null);
  assert.equal(await h.tokenStore.loadToken(), 'protected-test-session');
});
await test('a successful empty Keychain read still means logged out', async () => {
  assert.equal(await tokenHarness().tokenStore.loadToken(), null);
});

function create(initializer) {
  if (!initializer) return create;
  let state;
  const get = () => state;
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  state = initializer(set, get);
  return { getState: get, setState: set };
}

function authHarness(tokenStore, fetchProfile = async () => ({ id: '7', name: 'Test', onboardingCompleted: true })) {
  let resets = 0;
  const resetStore = { getState: () => ({ reset() {} }) };
  const imports = {
    zustand: { create },
    '../../lib/localCache': { localCache: { clearLegacyPlaintextCache: async () => {}, setUserId() {} } },
    '../../lib/tokenStore': { tokenStore },
    '../../stores/notification.store': { useNotificationStore: { getState: () => ({ reset: () => { resets++; } }) } },
    '../../stores/language.store': { useLanguageStore: { getState: () => ({ applyLanguage() {} }) } },
    '../../lib/apiClient': { apiClient: async () => {} },
    './auth.api': { authApi: { fetchBasicProfile: fetchProfile } },
    './auth.service': { authService: {} },
  };
  for (const [name, exported] of [
    ['../care-pulse/store/carePulse.store', 'useCarePulseStore'], ['../logs/logs.store', 'useLogsStore'],
    ['../missions/missions.store', 'useMissionsStore'], ['../profile/profile.store', 'useProfileStore'],
    ['../tree/tree.store', 'useTreeStore'], ['../wellness/store/wellness.store', 'useWellnessStore'],
  ]) imports[name] = { [exported]: resetStore };
  const { useAuthStore: store } = evaluate(read('src/features/auth/auth.store.ts'), imports);
  return { store, resets: () => resets };
}

await test('locked startup keeps authentication unresolved until unlock succeeds', async () => {
  const token = tokenHarness();
  token.saved('protected-test-session'); token.fail(new Error('Keychain temporarily locked'));
  const h = authHarness(token.tokenStore);
  await h.store.getState().bootstrap();
  assert.equal(h.store.getState().hydrated, false);
  assert.equal(h.store.getState().loading, false);
  assert.equal(h.resets(), 0);
  token.fail(null);
  await h.store.getState().bootstrap();
  assert.equal(h.store.getState().hydrated, true);
  assert.equal(h.store.getState().token, 'protected-test-session');
  assert.equal(h.store.getState().profile.id, '7');
});
await test('a missing saved token completes startup without granting access', async () => {
  const h = authHarness(tokenHarness().tokenStore);
  await h.store.getState().bootstrap();
  assert.equal(h.store.getState().hydrated, true);
  assert.equal(h.store.getState().token, null);
});
await test('profile network failure retains the restored token for protected call requests', async () => {
  const token = tokenHarness(); token.saved('protected-test-session');
  const h = authHarness(token.tokenStore, async () => { throw new Error('Network request failed'); });
  await h.store.getState().bootstrap();
  assert.equal(h.store.getState().hydrated, true);
  assert.equal(h.store.getState().token, 'protected-test-session');
  assert.equal(h.store.getState().profile, null);
});
await test('foreground and root recovery share one in-flight bootstrap', async () => {
  const pending = deferred(); let reads = 0;
  const h = authHarness({ loadToken: () => { reads++; return pending.promise; } });
  const first = h.store.getState().bootstrap(), second = h.store.getState().bootstrap();
  await tick(); assert.equal(reads, 1);
  pending.resolve('protected-test-session'); await Promise.all([first, second]);
  assert.equal(h.store.getState().profile.id, '7');
});

const mountRecovery = effectFrom('src/providers/SessionProvider.tsx', 'setupNotificationHandler();');
function recoveryHarness({ state = 'background', failures = 0, pending = null, authStore = null, bootstrap = null } = {}) {
  const auth = { hydrated: false };
  const sessionStore = authStore ?? { getState: () => auth };
  const timers = new Map(); let nextTimer = 0, boots = 0, listener;
  const AppState = { currentState: state, addEventListener: (_name, callback) => {
    listener = callback; return { remove: () => { listener = null; } };
  } };
  const cleanup = mountRecovery({
    setupNotificationHandler() {}, AppState, useAuthStore: sessionStore,
    bootstrap: async () => {
      boots++;
      if (bootstrap) { await bootstrap(); return; }
      if (pending) await pending.promise;
      if (boots > failures) auth.hydrated = true;
    },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => { timers.delete(id); },
  });
  return {
    get auth() { return sessionStore.getState(); }, timers, cleanup, boots: () => boots,
    change: next => { AppState.currentState = next; listener?.(next); },
    fire: async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await tick(); },
  };
}
await test('a PushKit background launch waits for unlock before reading the saved session', async () => {
  const h = recoveryHarness(); await tick(); assert.equal(h.boots(), 0);
  h.change('active'); await tick();
  assert.equal(h.boots(), 1); assert.equal(h.auth.hydrated, true);
  h.cleanup();
});
await test('foreground immediately restores a session without waiting for another app-state event', async () => {
  const h = recoveryHarness({ state: 'active' }); await tick();
  assert.equal(h.boots(), 1); h.cleanup();
});
await test('unlock read failures retry without falsely reporting logout', async () => {
  const h = recoveryHarness({ state: 'active', failures: 1 }); await tick();
  assert.equal(h.auth.hydrated, false); assert.equal(h.timers.size, 1);
  assert.equal(h.timers.values().next().value.delay, 500);
  await h.fire(); assert.equal(h.auth.hydrated, true); assert.equal(h.timers.size, 0);
  h.cleanup();
});
await test('repeated foreground events do not duplicate pending session recovery', async () => {
  const pending = deferred(); const h = recoveryHarness({ state: 'active', pending });
  h.change('active'); h.change('active'); assert.equal(h.boots(), 1);
  pending.resolve(); await tick(); assert.equal(h.auth.hydrated, true); h.cleanup();
});
await test('storage retries are bounded and another foreground permits recovery again', async () => {
  const h = recoveryHarness({ state: 'active', failures: 10 }); await tick();
  for (let i = 0; i < 3; i++) await h.fire();
  assert.equal(h.boots(), 4); assert.equal(h.timers.size, 0);
  h.change('background'); h.change('active'); await tick();
  assert.equal(h.boots(), 5); h.cleanup();
});
await test('backgrounding and cleanup cancel recovery retries', async () => {
  const h = recoveryHarness({ state: 'active', failures: 5 }); await tick();
  h.change('inactive'); assert.equal(h.timers.size, 0);
  h.change('active'); await tick(); assert.equal(h.timers.size, 1);
  h.cleanup(); assert.equal(h.timers.size, 0); h.change('active'); await tick(); assert.equal(h.boots(), 2);
});
await test('a completed logged-out startup is not repeatedly retried', async () => {
  const h = recoveryHarness({ state: 'active' }); await tick();
  h.change('active'); await tick(); assert.equal(h.boots(), 1); h.cleanup();
});

const mountStartupRoute = effectFrom('app/index.tsx', 'InteractionManager.runAfterInteractions');
function routeHarness({ authToken = 'protected-test-session', profile = null, call = { episodeId: 'episode', attemptId: 'attempt' }, hydrated = true, loading = false } = {}) {
  const routes = []; let work, reads = 0;
  const cleanup = mountStartupRoute({
    minSplashDone: true, hydrated, isNavReady: true, loading, consentReady: true, showConsent: false,
    profile, authToken, router: { replace: href => routes.push(href) },
    InteractionManager: { runAfterInteractions: callback => { work = callback; return { cancel() {} }; } },
    getPendingVoipCall: async () => { reads++; return await call; },
    Notifications: { getLastNotificationResponseAsync: async () => null },
    routeFromNotificationData: () => null,
  });
  return { routes, cleanup, reads: () => reads, run: () => work?.() };
}
await test('an answered call opens from the restored session even if the profile request failed', async () => {
  const h = routeHarness(); await h.run();
  assert.deepEqual(h.routes, [{ pathname: '/checkin-call/[episodeId]', params: {
    episodeId: 'episode', attemptId: 'attempt', nativeAnswered: '1',
  } }]);
});
await test('a genuinely logged-out call entry cannot bypass authentication', async () => {
  const h = routeHarness({ authToken: null }); await h.run();
  assert.deepEqual(h.routes, ['/login']); assert.equal(h.reads(), 0);
});
await test('unresolved storage never starts the splash login redirect', async () => {
  const h = routeHarness({ hydrated: false }); await h.run(); assert.deepEqual(h.routes, []);
});
await test('a cancelled splash cannot replace a newer call screen after a delayed getter', async () => {
  const pending = deferred(); const h = routeHarness({ call: pending.promise });
  const work = h.run(); h.cleanup(); pending.resolve({ episodeId: 'old', attemptId: 'old' }); await work;
  assert.deepEqual(h.routes, []);
});
await test('normal authenticated startup still respects profile onboarding', async () => {
  for (const onboarded of [false, true]) {
    const h = routeHarness({ call: null, profile: { id: '7', onboardingCompleted: onboarded } });
    await h.run(); assert.deepEqual(h.routes, [onboarded ? '/(tabs)/home' : '/onboarding']);
  }
});

await test('terminated app, locked phone, answer, unlock and delayed profile preserve the call without login', async () => {
  const token = tokenHarness(); token.saved('protected-test-session'); token.fail(new Error('Keychain temporarily locked'));
  const profileRequest = deferred();
  const { store } = authHarness(token.tokenStore, () => profileRequest.promise);
  const recovery = recoveryHarness({ authStore: store, bootstrap: () => store.getState().bootstrap() });
  const call = { episodeId: 'answered-episode', attemptId: 'answered-attempt' };
  const { CheckinCallHandoff } = evaluate(read('src/features/checkin-call/checkin-call.handoff.ts'));
  const handoff = new CheckinCallHandoff(); handoff.receive(call);
  const gate = () => ({ ready: recovery.auth.hydrated && !recovery.auth.loading && Boolean(recovery.auth.token), active: true, pathname: '/home' });
  await tick(); assert.equal(token.reads(), 0); assert.equal(handoff.route(gate()), null);
  recovery.change('inactive'); await tick(); assert.equal(token.reads(), 0);
  recovery.change('active'); await tick();
  assert.equal(recovery.auth.hydrated, false); assert.equal(handoff.route(gate()), null);
  token.fail(null); await recovery.fire();
  assert.equal(recovery.auth.token, 'protected-test-session'); assert.equal(recovery.auth.loading, true);
  assert.equal(handoff.route(gate()), null);
  const waiting = routeHarness({ authToken: recovery.auth.token, hydrated: recovery.auth.hydrated, loading: recovery.auth.loading, call });
  await waiting.run(); assert.deepEqual(waiting.routes, []);
  profileRequest.resolve({ id: '7', name: 'Test', onboardingCompleted: true }); await tick();
  const route = routeHarness({ authToken: recovery.auth.token, profile: recovery.auth.profile, hydrated: recovery.auth.hydrated, call });
  await route.run();
  assert.equal(route.routes.length, 1); assert.equal(route.routes[0].pathname, '/checkin-call/[episodeId]');
  assert.equal(route.routes[0].params.attemptId, call.attemptId);
  assert.equal(handoff.route(gate()).call.attemptId, call.attemptId); assert.equal(token.deleted(), 0);
  recovery.cleanup();
});
await test('an already-running app resumes the call using its existing authenticated session', async () => {
  const token = tokenHarness(); token.saved('protected-test-session');
  const { store } = authHarness(token.tokenStore); await store.getState().bootstrap();
  const recovery = recoveryHarness({ authStore: store, bootstrap: () => store.getState().bootstrap() });
  recovery.change('active'); await tick(); assert.equal(recovery.boots(), 0);
  const route = routeHarness({ authToken: recovery.auth.token, profile: recovery.auth.profile });
  await route.run(); assert.equal(route.routes[0].pathname, '/checkin-call/[episodeId]');
  assert.equal(token.reads(), 1); recovery.cleanup();
});

console.log(`\n${checks} call session recovery checks passed.`);
