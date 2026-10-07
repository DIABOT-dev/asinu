import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute checked-in code and the installed Expo stack reducer. Only native
  // adapters and React rendering are mocked; stack behavior is not replicated.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports,
    name => { assert.ok(name in imports, `Missing adapter: ${name}`); return imports[name]; },
    ...Object.values(globals));
  return module.exports;
}

const { StackRouter: BaseStackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
const { resolveHref } = require('expo-router/build/link/href');
const screensSource = read('node_modules/expo-router/build/useScreens.js');
const { getSingularId } = evaluate(`${screensSource.slice(screensSource.indexOf('function getSingularId('),
  screensSource.indexOf('//# sourceMappingURL'))}\nexports.getSingularId = getSingularId;`);
const { StackRouter } = evaluate(read('node_modules/expo-router/build/layouts/StackClient.js'), {
  'react/jsx-runtime': {}, 'nanoid/non-secure': require('nanoid/non-secure'), react: {},
  './withLayoutContext': { withLayoutContext: () => () => {} },
  '../fork/native-stack/createNativeStackNavigator': { createNativeStackNavigator: () => ({ Navigator: () => {} }) },
  '../link/preview/LinkPreviewContext': {}, '../navigationParams': require('expo-router/build/navigationParams'),
  '../useScreens': { getSingularId }, './stack-utils': {}, '../react-navigation/native': { StackRouter: BaseStackRouter },
  '../utils/children': {}, '../views/Protected': {},
});
const names = ['home', 'subscription/index', 'care-circle/index', 'checkin', 'login/index', 'logs/index',
  'logs/glucose', 'legal/content', 'checkin-call/settings', 'checkin-call/voice-settings',
  'checkin-call/[episodeId]', 'feed/[id]', 'doctor-consultation/[taskId]'];
const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
const stack = StackRouter({ initialRouteName: 'home' });

function harness() {
  let now = 1000;
  let state = stack.getInitialState(options);
  const queue = [];
  const actions = [];
  const listeners = new Set();
  const guards = evaluate(read('src/lib/navigation.guard.ts'), {}, { Date: { now: () => now } });
  const linkAction = (type, href, extra) => {
    const resolved = new URL(resolveHref(href), 'https://test.invalid');
    const pathname = resolved.pathname;
    const params = Object.fromEntries(resolved.searchParams);
    let name = names.find(route => `/${route.replace(/\/index$/, '')}` === pathname);
    if (!name) {
      const dynamic = names.filter(route => route.includes('[')).find(route => {
        const base = route.slice(0, route.indexOf('['));
        if (!pathname.startsWith(`/${base}`)) return false;
        const value = pathname.slice(base.length + 1);
        if (!value || value.includes('/')) return false;
        params[route.slice(route.indexOf('[') + 1, -1)] = decodeURIComponent(value);
        return true;
      });
      name = dynamic;
    }
    assert.ok(name, `Unknown test destination ${pathname}`);
    return { type, payload: { name, params, ...extra } };
  };
  const enqueue = action => { actions.push(action); queue.push(action); };
  const raw = {
    push: (href, extra) => enqueue(linkAction('PUSH', href, extra)),
    navigate: (href, extra) => enqueue(linkAction('NAVIGATE', href, extra)),
    replace: (href, extra) => enqueue(linkAction('REPLACE', href, extra)),
    back: () => enqueue({ type: 'GO_BACK' }), canGoBack: () => state.routes.length > 1,
    setParams: params => enqueue({ type: 'SET_PARAMS', payload: { params } }),
  };
  const rootState = () => ({ index: 0, routes: [{ key: 'expo-root', name: '__root', state }] });
  const navigation = { current: { getRootState: rootState }, addListener: (_event, callback) => {
    listeners.add(callback); return () => listeners.delete(callback);
  } };
  const { useGuardedRouter, useNavigationGuardObserver } = evaluate(read('src/hooks/useGuardedRouter.ts'), {
    react: { useCallback: value => value, useMemo: work => work(), useEffect: work => work() },
    'expo-router': { useRouter: () => raw, useNavigationContainerRef: () => navigation },
    '../lib/navigation.guard': guards,
  });
  useNavigationGuardObserver();
  return {
    ui: useGuardedRouter(), notification: useGuardedRouter({ external: true }), raw, actions, guards,
    get state() { return rootState(); },
    advance: milliseconds => { now += milliseconds; },
    commit: () => {
      for (const action of queue.splice(0)) {
        const next = stack.getStateForAction(state, action, options);
        assert.ok(next, `Unhandled action ${JSON.stringify(action)}`);
        state = next;
        listeners.forEach(listener => listener());
      }
    },
    current: () => state.routes[state.index],
    count: name => state.routes.filter(route => route.name === name).length,
  };
}

let checks = 0;
function test(label, work) { work(); checks++; console.log(`PASS ${label}`); }
const call = (attemptId = 'a', answered = false) => ({ pathname: '/checkin-call/[episodeId]',
  params: { episodeId: 'episode', attemptId, ...(answered ? { nativeAnswered: '1' } : {}) } });

test('reproduces the original raw PUSH screen-stacking bug using Expo', () => {
  const h = harness(); for (let i = 0; i < 10; i++) h.raw.push('/subscription');
  h.commit(); assert.equal(h.count('subscription/index'), 10);
});
test('100 rapid button taps queue exactly one screen', () => {
  const h = harness(); for (let i = 0; i < 100; i++) h.ui.push('/subscription');
  assert.equal(h.actions.length, 1); h.commit(); assert.equal(h.count('subscription/index'), 1);
});
test('a slow JS thread/transition cannot outlive the old 650 ms guard', () => {
  const h = harness();
  for (let i = 0; i < 20; i++) { h.ui.push('/subscription'); h.advance(2500); }
  assert.equal(h.actions.length, 1); h.commit(); assert.equal(h.count('subscription/index'), 1);
});
test('a screen already visible cannot be pushed again, including stale button callbacks', () => {
  const h = harness(); h.ui.push('/care-circle'); h.commit();
  for (let i = 0; i < 100; i++) { h.advance(1000); h.ui.push('/care-circle'); }
  assert.equal(h.actions.length, 1); assert.equal(h.count('care-circle/index'), 1);
});
test('two mounted UI components share one navigation gate', () => {
  const h = harness(); h.ui.push('/subscription'); h.notification.navigate('/subscription');
  h.commit(); assert.equal(h.actions.length, 1); assert.equal(h.count('subscription/index'), 1);
});
test('string query links and differently ordered route objects deduplicate', () => {
  const h = harness(); h.ui.push('/checkin?mode=followup&checkin_id=7'); h.advance(900);
  h.ui.push({ pathname: '/checkin', params: { checkin_id: 7, mode: 'followup' } });
  h.commit(); assert.equal(h.count('checkin'), 1);
});
test('dynamic IDs deduplicate across concrete paths and parameterized objects', () => {
  const h = harness(); h.ui.push('/feed/article-a'); h.advance(900);
  h.ui.push({ pathname: '/feed/[id]', params: { id: 'article-a' } });
  h.commit(); h.advance(900); h.ui.push('/feed/article-a');
  assert.equal(h.actions.length, 1); assert.equal(h.count('feed/[id]'), 1);
});
test('different entities and check-in modes are not incorrectly collapsed', () => {
  const h = harness();
  for (const route of ['/feed/a', '/feed/b', '/checkin', '/checkin?mode=followup&checkin_id=7']) {
    h.advance(900); h.ui.push(route); h.commit();
  }
  assert.equal(h.count('feed/[id]'), 2); assert.equal(h.count('checkin'), 2);
});
test('route groups, index aliases and internal navigator params do not create false duplicates', () => {
  const { navigationDestination, focusedNavigationDestination } = harness().guards;
  const current = focusedNavigationDestination({ index: 0, routes: [{ key: 'tabs', name: '(tabs)',
    params: { screen: 'home', params: { nested: 'metadata' }, initial: false },
    state: { index: 0, routes: [{ key: 'home', name: 'home', params: { __internal_expo_router_no_animation: true } }] } }] });
  assert.equal(current.key, navigationDestination('/(tabs)/home').key);
  assert.equal(navigationDestination('/subscription/index').key, navigationDestination('/subscription').key);
});
test('back followed by reopening is allowed, instead of a permanent visited-screen blacklist', () => {
  const h = harness(); h.ui.push('/subscription'); h.commit(); h.advance(900);
  h.ui.back(); h.commit(); h.advance(900); h.ui.push('/subscription'); h.commit();
  assert.equal(h.actions.length, 3); assert.equal(h.count('subscription/index'), 1);
});
test('native swipe or Android system back allows reopening without a guarded back callback', () => {
  const h = harness(); h.ui.push('/subscription'); h.commit(); h.advance(900);
  h.raw.back(); h.commit(); h.advance(900); h.ui.push('/subscription'); h.commit();
  assert.equal(h.current().name, 'subscription/index'); assert.equal(h.count('subscription/index'), 1);
});
test('rapid back taps cannot pop several screens before the first pop commits', () => {
  const h = harness(); h.ui.push('/subscription'); h.commit(); h.advance(900);
  h.ui.push('/care-circle'); h.commit(); h.advance(900);
  for (let i = 0; i < 20; i++) { h.ui.back(); h.advance(900); }
  h.commit(); assert.equal(h.current().name, 'subscription/index');
});
test('a history-free back is a no-op and does not lock the next real button', () => {
  const h = harness(); h.ui.back(); h.ui.push('/subscription'); h.commit();
  assert.equal(h.actions.length, 1); assert.equal(h.current().name, 'subscription/index');
});
test('authentication/startup replacement cannot be swallowed by a recent tap', () => {
  const h = harness(); h.ui.push('/subscription'); h.ui.replace('/login'); h.commit();
  assert.equal(h.current().name, 'login/index');
});
test('navigation exceptions release the pending destination and cooldown for immediate retry', () => {
  const h = harness(); const state = h.state; const guard = new h.guards.NavigationGuard(() => 1000);
  assert.throws(() => guard.run('push', '/subscription', state, () => { throw new Error('native failure'); }));
  let executed = 0;
  assert.equal(guard.run('push', '/subscription', state, () => executed++), true);
  assert.equal(executed, 1);
});
test('incoming calls are not dropped during another button transition', () => {
  const h = harness(); h.ui.push('/subscription'); h.notification.navigate(call()); h.commit();
  assert.equal(h.current().name, 'checkin-call/[episodeId]'); assert.equal(h.count('checkin-call/[episodeId]'), 1);
});
for (const nativeFirst of [true, false]) test(`${nativeFirst ? 'native-first' : 'push-first'}: notification receipt, tap, CallKit and foreground recovery share one call`, () => {
  const h = harness();
  if (nativeFirst) h.notification.navigate(call('a', true));
  for (let i = 0; i < 20; i++) {
    h.notification.navigate(call()); h.ui.push(call());
    h.notification.navigate(call('a', true)); h.advance(900);
  }
  assert.ok(h.actions.length <= 2); h.commit();
  assert.equal(h.count('checkin-call/[episodeId]'), 1); assert.equal(h.current().params.nativeAnswered, '1');
  const actions = h.actions.length;
  for (let i = 0; i < 20; i++) { h.notification.navigate(call()); h.notification.navigate(call('a', true)); }
  assert.equal(h.actions.length, actions); assert.equal(h.current().params.nativeAnswered, '1');
});
test('native acceptance upgrades the visible call using params, not a second screen', () => {
  const h = harness(); h.notification.navigate(call()); h.commit(); const key = h.current().key;
  for (let i = 0; i < 20; i++) h.notification.navigate(call('a', true));
  h.commit(); assert.equal(h.count('checkin-call/[episodeId]'), 1);
  assert.equal(h.current().key, key); assert.equal(h.current().params.nativeAnswered, '1');
  assert.equal(h.actions.length, 2); assert.equal(h.actions[1].type, 'SET_PARAMS');
});
test('a new attempt of the same episode replaces the old call instance', () => {
  const h = harness(); h.notification.navigate(call('a', true)); h.commit(); const key = h.current().key;
  h.notification.navigate(call('b', true)); h.commit();
  assert.equal(h.count('checkin-call/[episodeId]'), 1); assert.equal(h.current().params.attemptId, 'b');
  assert.notEqual(h.current().key, key); assert.equal(h.actions.at(-1).type, 'REPLACE');
});
test('two call attempts queued before a render still produce one call screen with the latest attempt', () => {
  const h = harness(); h.notification.navigate(call('a', true)); h.notification.navigate(call('b', true)); h.commit();
  assert.equal(h.count('checkin-call/[episodeId]'), 1); assert.equal(h.current().params.attemptId, 'b');
  assert.ok(read('app/checkin-call/[episodeId].tsx').includes('JSON.stringify([accountId, params.episodeId, params.attemptId])'));
});

// Execute SessionProvider's real notification callbacks with the same guarded
// router used above, instead of only checking that an import was changed.
const provider = read('src/providers/SessionProvider.tsx');
const providerAst = ts.createSourceFile('provider.tsx', provider, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let incomingHandler, routeHandler;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(providerAst) === 'Notifications.addNotificationReceivedListener') {
    incomingHandler = node.arguments[0].getText(providerAst);
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(providerAst) === 'handleNotificationRoute') {
    routeHandler = node.initializer.arguments[0].getText(providerAst);
  }
  ts.forEachChild(node, visit);
}
visit(providerAst);
const notificationsSource = read('src/lib/notifications.ts');
const notificationsAst = ts.createSourceFile('notifications.ts', notificationsSource, ts.ScriptTarget.Latest, true);
const routeFunction = notificationsAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'routeFromNotificationData');
const { routeFromNotificationData } = evaluate(routeFunction.getText(notificationsAst));
test('actual foreground push and notification-tap callbacks cannot duplicate the native call route', () => {
  assert.ok(incomingHandler && routeHandler);
  const h = harness();
  const handlers = evaluate(`exports.incoming = ${incomingHandler}; exports.tap = ${routeHandler};`, {}, {
    router: h.notification, routeFromNotificationData, dispatchRealtimeRefresh: () => {}, showToast: () => {},
  });
  const data = { checkinCall: true, kind: 'INCOMING_CALL', episodeId: 'episode', attemptId: 'a' };
  for (let i = 0; i < 20; i++) {
    handlers.incoming({ request: { content: { data } } }); handlers.tap(data);
    h.notification.navigate(call('a', true)); h.advance(900);
  }
  h.commit(); assert.equal(h.count('checkin-call/[episodeId]'), 1); assert.equal(h.current().params.nativeAnswered, '1');
});
test('actual notification callbacks do not repeatedly append other destination screens', () => {
  const h = harness(); const handlers = evaluate(`exports.tap = ${routeHandler};`, {}, {
    router: h.notification, routeFromNotificationData,
  });
  for (let i = 0; i < 20; i++) { handlers.tap({ type: 'care_circle_invitation' }); h.advance(900); }
  h.commit(); assert.equal(h.count('care-circle/index'), 1);
  for (let i = 0; i < 20; i++) handlers.tap({ type: 'care_circle_invitation' });
  assert.equal(h.actions.length, 1);
});
test('every active screen uses the guarded router instead of unguarded useRouter', () => {
  function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      if (entry.name === '_archive' || entry.name.startsWith('.')) return [];
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
    });
  }
  for (const file of [...files('app'), ...files('src')]) {
    if (file === 'src/hooks/useGuardedRouter.ts') continue;
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) || node.moduleSpecifier.text !== 'expo-router') continue;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        assert.ok(!bindings.elements.some(element => (element.propertyName ?? element.name).text === 'useRouter'), file);
      }
    }
  }
});
console.log(`Navigation stacking: ${checks} runtime/integration regression checks passed.`);
