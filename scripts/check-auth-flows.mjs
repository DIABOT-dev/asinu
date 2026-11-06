import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'require', '__DEV__', 'process', compiled)(module, module.exports, id => {
    assert.ok(id in imports, `Missing auth adapter ${id}`); return imports[id];
  }, false, { env: {} });
  return module.exports;
}
function create(initializer) {
  if (!initializer) return create;
  let state;
  const getState = () => state;
  const setState = patch => { state = { ...state, ...patch }; };
  state = initializer(setState, getState);
  return { getState, setState };
}
function authHarness({ language = 'vi', nativeError, nativeSignIn, backendError, completed = false, platform = 'ios' } = {}) {
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/auth.json`));
  const t = key => { assert.equal(typeof catalog[key], 'string'); return catalog[key]; };
  const calls = { native: 0, api: [], savedTokens: [], profiles: 0 };
  const oauth = evaluate(read('src/features/auth/oauth.service.ts'), {
    '../../observability/sentry': {}, 'expo-auth-session': {}, 'expo-crypto': {}, 'expo-web-browser': {},
    'react-native': { Platform: { OS: platform }, NativeModules: {} },
    '../../i18n': { __esModule: true, default: { t } },
    'expo-apple-authentication': { AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 }, signInAsync: async () => {
      calls.native++;
      if (nativeError !== undefined) throw nativeError;
      if (nativeSignIn) return nativeSignIn();
      return { user: 'apple-subject', identityToken: 'apple-identity-fixture', fullName: { givenName: 'New', familyName: 'User' }, email: 'fixture@example.invalid' };
    } },
  });
  const service = evaluate(read('src/features/auth/auth.service.ts'), {
    '../../i18n': { __esModule: true, default: { t } }, './oauth.service': oauth,
    '../../lib/apiClient': { apiClient: async (url, config) => {
      calls.api.push([url, config]); if (backendError) throw backendError;
      return { ok: true, token: 'asinu-session-fixture', user: { id: 'new-user', full_name: 'New User' } };
    } },
  });
  const resetStore = { getState: () => ({ reset() {}, applyLanguage() {} }) };
  const imports = {
    zustand: { create }, './auth.service': service,
    '../doctor-ivr/ivr-voice-queue': { clearIvrVoiceQueue: async () => {} },
    '../../lib/localCache': { localCache: { setUserId() {}, clearLegacyPlaintextCache: async () => {} } },
    '../../lib/tokenStore': { tokenStore: { setToken: async token => calls.savedTokens.push(token) } },
    '../../stores/notification.store': { useNotificationStore: resetStore },
    '../../stores/language.store': { useLanguageStore: resetStore },
    '../../lib/apiClient': {}, './auth.api': { authApi: { fetchBasicProfile: async () => {
      calls.profiles++; return { id: 'new-user', name: 'New User', onboardingCompleted: completed };
    } } },
  };
  for (const [path, name] of [
    ['../care-pulse/store/carePulse.store', 'useCarePulseStore'], ['../logs/logs.store', 'useLogsStore'],
    ['../missions/missions.store', 'useMissionsStore'], ['../profile/profile.store', 'useProfileStore'],
    ['../tree/tree.store', 'useTreeStore'], ['../wellness/store/wellness.store', 'useWellnessStore'],
  ]) imports[path] = { [name]: resetStore };
  const { useAuthStore: store } = evaluate(read('src/features/auth/auth.store.ts'), imports);
  store.setState({ hydrated: true });
  return { oauth, service, store, calls, t };
}

// Execute the actual login handler and navigation callback, including its finally block.
const screen = ts.createSourceFile('email.tsx', read('app/login/email.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['navigateAfterLogin', 'handleSocialLogin'].includes(node.name.getText(screen))) handlers[node.name.getText(screen)] = node.initializer.getText(screen);
  ts.forEachChild(node, visit);
}
visit(screen);
assert.equal(Object.keys(handlers).length, 2);
const { pressApple } = evaluate(`export async function pressApple(deps) {
  const { loading, navigatingRef, useAuthStore, loginWithSocial, setPendingAction, setPendingToast, router, t } = deps;
  const navigateAfterLogin = ${handlers.navigateAfterLogin};
  const handleSocialLogin = ${handlers.handleSocialLogin};
  await handleSocialLogin('apple');
}`);
function loginScreen(h) {
  const routes = [], toasts = [], pending = [], navigatingRef = { current: false };
  return { routes, toasts, pending, navigatingRef, press: () => pressApple({
    loading: h.store.getState().loading, navigatingRef, useAuthStore: h.store,
    loginWithSocial: provider => h.store.getState().loginWithSocial(provider),
    setPendingAction: value => pending.push(value), setPendingToast: (...args) => toasts.push(args),
    router: { replace: route => routes.push(route) }, t: h.t,
  }) };
}

for (const language of ['vi', 'en']) {
  for (const code of ['ERR_REQUEST_CANCELED', 'ERR_CANCELED']) {
    await test(`${language}: Apple cancellation ${code} clears loading without errors, backend calls or navigation`, async () => {
      const h = authHarness({ language, nativeError: Object.assign(new Error('RequestCanceledException: native Swift details'), { code }) });
      h.store.setState({ error: 'previous failure' });
      const ui = loginScreen(h); await ui.press();
      assert.equal(h.store.getState().error, undefined); assert.equal(h.store.getState().loading, false);
      assert.equal(h.store.getState().token, null); assert.equal(h.store.getState().profile, null);
      assert.deepEqual(h.calls.api, []); assert.deepEqual(h.calls.savedTokens, []);
      assert.deepEqual(ui.routes, []); assert.deepEqual(ui.toasts, []); assert.deepEqual(ui.pending, ['apple', null]);
    });
  }
  await test(`${language}: a real Apple failure is visible and does not expose the SDK exception`, async () => {
    const h = authHarness({ language, nativeError: Object.assign(new Error('RequestFailedException at AppleAuthenticationExceptions.swift:63'), { code: 'ERR_REQUEST_FAILED' }) });
    const ui = loginScreen(h); await ui.press();
    assert.equal(h.store.getState().error, h.t('appleAuthFailed')); assert.equal(h.store.getState().loading, false);
    assert.doesNotMatch(h.store.getState().error, /Exception|swift/); assert.deepEqual(ui.routes, []); assert.equal(h.calls.api.length, 0);
  });
  await test(`${language}: cancelling and retrying Apple with a fresh account opens onboarding`, async () => {
    let cancelled = true;
    const h = authHarness({ language, nativeSignIn: () => {
      if (cancelled) throw { code: 'ERR_REQUEST_CANCELED' };
      return { identityToken: 'apple-identity-fixture', user: 'new-subject', fullName: null, email: null };
    } });
    const ui = loginScreen(h); await ui.press(); cancelled = false; await ui.press();
    assert.equal(h.calls.native, 2); assert.equal(h.calls.api.length, 1);
    assert.equal(h.calls.api[0][0], '/api/auth/apple'); assert.equal(h.calls.api[0][1].body.token, 'apple-identity-fixture');
    assert.deepEqual(ui.routes, ['/onboarding']); assert.equal(h.store.getState().profile.authProvider, 'apple');
    assert.equal(h.store.getState().error, undefined);
  });
}
await test('an Apple account with a completed profile opens home', async () => {
  const h = authHarness({ completed: true }); const ui = loginScreen(h); await ui.press();
  assert.deepEqual(ui.routes, ['/(tabs)/home']); assert.equal(h.calls.savedTokens.length, 1);
});
await test('backend verification failures remain errors and never authenticate or navigate', async () => {
  const error = new Error('Account could not be verified');
  const h = authHarness({ backendError: error }); const ui = loginScreen(h); await ui.press();
  assert.equal(h.store.getState().error, error.message); assert.equal(h.store.getState().loading, false);
  assert.equal(h.calls.savedTokens.length, 0); assert.equal(h.calls.profiles, 0); assert.deepEqual(ui.routes, []);
});
await test('a pending Apple dialog keeps loading until cancellation and then unlocks the form', async () => {
  const pending = deferred(); const h = authHarness({ nativeSignIn: () => pending.promise });
  const ui = loginScreen(h); const work = ui.press(); assert.equal(h.store.getState().loading, true);
  pending.resolve(Promise.reject({ code: 'ERR_REQUEST_CANCELED' })); await work;
  assert.equal(h.store.getState().loading, false); assert.equal(h.store.getState().error, undefined);
});

function onboardingGate(state) {
  const routes = [];
  const { useOnboardingGate } = evaluate(read('src/features/auth/useOnboardingGate.ts'), {
    react: { useEffect: effect => effect() }, 'expo-router': { usePathname: () => state.path },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ replace: route => routes.push(route) }) },
    './auth.store': { useAuthStore: select => select(state) },
  });
  return { allowed: useOnboardingGate(), routes };
}
const session = { hydrated: true, loading: false, token: 'session-fixture', profile: { id: 'new-user', onboardingCompleted: false } };
await test('every main tab redirects an incomplete new account to onboarding', () => {
  for (const path of ['/home', '/care-circle', '/tree', '/profile', '/missions']) {
    assert.deepEqual(onboardingGate({ ...session, path }), { allowed: false, routes: ['/onboarding'] });
  }
});
await test('unknown completion flags also require onboarding; completed accounts can enter', () => {
  assert.deepEqual(onboardingGate({ ...session, path: '/home', profile: { id: 'new-user' } }), { allowed: false, routes: ['/onboarding'] });
  assert.deepEqual(onboardingGate({ ...session, path: '/home', profile: { id: 'old-user', onboardingCompleted: true } }), { allowed: true, routes: [] });
});
await test('restoring or changing a login cannot display tabs before the session settles', () => {
  for (const state of [{ hydrated: false }, { loading: true }]) {
    assert.deepEqual(onboardingGate({ ...session, path: '/home', ...state }), { allowed: false, routes: [] });
  }
});
await test('logged-out deep links to main tabs return to login', () => {
  assert.deepEqual(onboardingGate({ ...session, path: '/profile', token: null, profile: null }), { allowed: false, routes: ['/login'] });
});
await test('native call recovery and onboarding screens retain their own navigation', () => {
  for (const path of ['/checkin-call/episode', '/doctor-call/session', '/medication/call/dose', '/onboarding', '/login']) {
    assert.deepEqual(onboardingGate({ ...session, path }), { allowed: true, routes: [] });
  }
});
console.log(`Apple sign-in and onboarding gates: ${checks} runtime checks passed.`);
