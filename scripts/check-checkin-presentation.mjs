import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports,
    id => { assert.ok(id in imports, `Missing native adapter ${id}`); return imports[id]; }, ...Object.values(globals));
  return module.exports;
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function runtime() {
  let now = 1000, timerId = 0;
  const timers = new Map(), sessionListeners = new Set();
  const clock = {
    Date: { now: () => now },
    setTimeout: (work, duration) => { const id = ++timerId; timers.set(id, { at: now + duration, work }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const tokenStore = { subscribeSession: work => { sessionListeners.add(work); return () => sessionListeners.delete(work); }, isRotatingToken: () => false };
  const module = evaluate(read('src/lib/checkin-presentation.ts'), { './tokenStore': { tokenStore } }, clock);
  const priority = module.checkinPresentation;
  const { ModalQueue } = evaluate(read('src/lib/modalQueue.ts'));
  const queue = new ModalQueue();
  priority.subscribe(() => queue.setSuspended(priority.isBlocked()));
  const toast = evaluate(read('src/stores/toast.store.ts'), {
    zustand: require('zustand'), '../lib/checkin-presentation': { checkinPresentation: priority }, '../lib/tokenStore': { tokenStore },
  }, clock).useToastStore;
  const navigationActions = [];
  let state = { index: 0, routes: [{ key: 'checkin', name: 'checkin' }] };
  const raw = Object.fromEntries(['push', 'navigate', 'replace', 'setParams', 'back'].map(action =>
    [action, value => navigationActions.push([action, value])]));
  raw.canGoBack = () => true;
  const navigation = { current: { getRootState: () => state } };
  const react = { useCallback: work => work, useMemo: work => work() };
  const guards = evaluate(read('src/lib/navigation.guard.ts'), {}, clock);
  const { useGuardedRouter } = evaluate(read('src/hooks/useGuardedRouter.ts'), {
    react, 'expo-router': { useRouter: () => raw, useNavigationContainerRef: () => navigation },
    '../lib/navigation.guard': guards, '../lib/checkin-presentation': { checkinPresentation: priority },
  });
  return { ...module, priority, queue, toast, navigationActions,
    external: useGuardedRouter({ external: true }), ui: useGuardedRouter(), clock,
    home: () => { state = { index: 0, routes: [{ key: 'home', name: 'home' }] }; },
    sessionChange: () => sessionListeners.forEach(work => work()),
    advance: async duration => {
      const end = now + duration;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].work(); await tick();
      }
      now = end; await tick();
    },
  };
}
let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }

await test('concurrent call, modal, permission and toast wait through preparation AND visible conclusion', async () => {
  const h = runtime(), release = h.priority.hold();
  let permission = 0;
  h.queue.request('family-alert', { content: 'alert', priority: 100 });
  const native = h.queue.runNative(async () => { permission++; });
  h.toast.getState().show('Bác sĩ đã trả lời', 'info');
  h.external.navigate('/checkin-call/episode?attemptId=attempt');
  await h.advance(5000); // Text ready, audio still preparing.
  assert.equal(h.queue.getSnapshot().active, null);
  assert.equal(h.toast.getState().visible, false);
  assert.deepEqual(h.navigationActions, []);
  assert.equal(permission, 0);
  await h.advance(5000); // Audio is now ready: do not release at this boundary.
  assert.equal(h.priority.isBlocked(), true);
  assert.equal(h.queue.getSnapshot().active, null);
  h.home(); release();
  await h.advance(349);
  assert.equal(h.priority.isBlocked(), true);
  await h.advance(1);
  assert.equal(h.queue.getSnapshot().active.id, 'family-alert');
  assert.equal(h.toast.getState().visible, true);
  // Toasts are serialized; the call follows without dropping the intent.
  await h.advance(3000);
  assert.equal(h.navigationActions.length, 1);
  const modal = h.queue.getSnapshot().active;
  h.queue.didShow(modal.presentation); h.queue.remove(modal.id); h.queue.didDismiss(modal.presentation);
  await native; assert.equal(permission, 1);
});

await test('expired calls never open after a long conclusion; the latest external destination wins', async () => {
  const h = runtime(), release = h.priority.hold();
  h.external.navigate('/checkin-call/episode?attemptId=old');
  await h.advance(31_000); release(); await h.advance(350);
  assert.deepEqual(h.navigationActions, []);
  const second = h.priority.hold();
  h.external.navigate('/feed/old'); h.external.navigate('/feed/new');
  h.home(); second(); await h.advance(350);
  assert.deepEqual(h.navigationActions, [['navigate', '/feed/new']]);
});

await test('the end of a queued incoming call removes its push route without cancelling a different notification', async () => {
  const h = runtime(), release = h.priority.hold();
  h.external.navigate('/checkin-call/episode?attemptId=ended');
  h.priority.cancel('external-navigation', 'ended');
  release(); await h.advance(350); assert.deepEqual(h.navigationActions, []);
  const next = h.priority.hold(); h.external.navigate('/feed/new');
  h.priority.cancel('external-navigation', 'ended');
  h.home(); next(); await h.advance(350);
  assert.deepEqual(h.navigationActions, [['navigate', '/feed/new']]);
});

await test('a notification phone action cannot open the dialer or mark called while the conclusion owns the screen', async () => {
  const h = runtime(), release = h.priority.hold(), calls = [];
  const file = ts.createSourceFile('SessionProvider.tsx', read('src/providers/SessionProvider.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'addNotificationResponseReceivedListener') handler = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(file); assert.ok(handler);
  const respond = evaluate(`module.exports.respond = ${handler.getText(file)};`, {}, {
    checkinPresentation: h.priority, useAuthStore: { getState: () => ({ token: 'synthetic' }) },
    checkinApi: { confirmAlert: async (...args) => { calls.push(['confirm', ...args]); } },
    Linking: { openURL: async url => { calls.push(['phone', url]); } },
  }).respond;
  respond({ actionIdentifier: 'CALL', notification: { request: { content: { data: { alertId: '7', patientPhone: 'fixture' } } } } });
  assert.deepEqual(calls, []); release(); await h.advance(350);
  assert.deepEqual(calls, [['confirm', 7, 'called'], ['phone', 'tel:fixture']]);
});

await test('logout discards pending presentations and toasts instead of leaking them into another account', async () => {
  const h = runtime(), release = h.priority.hold();
  h.external.navigate('/doctor-consultation/private');
  h.toast.getState().show('Thông tin riêng', 'info');
  h.toast.getState().setPending('Riêng tư');
  h.sessionChange(); release(); await h.advance(5000);
  assert.deepEqual(h.navigationActions, []);
  assert.equal(h.toast.getState().visible, false);
  assert.equal(h.toast.getState().pending, null);
});

await test('an already visible toast disappears immediately and resumes once, deduplicated', async () => {
  const h = runtime();
  h.toast.getState().show('Đã cập nhật', 'info');
  assert.equal(h.toast.getState().visible, true);
  const release = h.priority.hold();
  assert.equal(h.toast.getState().visible, false);
  for (let i = 0; i < 10; i++) h.toast.getState().show('Đã cập nhật', 'info');
  release(); await h.advance(350);
  assert.equal(h.toast.getState().visible, true);
  const id = h.toast.getState().toastId;
  await h.advance(3000);
  assert.equal(h.toast.getState().visible, false);
  assert.equal(h.toast.getState().toastId, id);
});

await test('suspending an open update dialog never runs its onDismiss install action', async () => {
  const h = runtime(); let installed = 0;
  h.queue.request('update', { content: 'update', onDismiss: () => { installed++; } });
  let active = h.queue.getSnapshot().active;
  h.queue.didShow(active.presentation);
  const release = h.priority.hold();
  assert.equal(h.queue.getSnapshot().active.phase, 'closing');
  h.queue.didDismiss(active.presentation);
  assert.equal(installed, 0); assert.equal(h.queue.getSnapshot().active, null);
  release(); await h.advance(350);
  active = h.queue.getSnapshot().active;
  assert.equal(active.id, 'update'); h.queue.didShow(active.presentation);
  h.queue.remove('update'); h.queue.didDismiss(active.presentation);
  assert.equal(installed, 1);
});

await test('opening a modal cannot flash onShow or start its actions after check-in takes priority', async () => {
  const h = runtime(); let shown = 0, dismissed = 0;
  h.queue.request('invitation', { content: 'invite', onShow: () => shown++, onDismiss: () => { dismissed++; } });
  const id = h.queue.getSnapshot().active.presentation, release = h.priority.hold();
  h.queue.didShow(id); assert.equal(shown, 0);
  h.queue.didDismiss(id); assert.equal(dismissed, 0);
  h.queue.remove('invitation'); release(); await h.advance(350);
  assert.equal(h.queue.getSnapshot().active, null);
});

await test('back/explicit actions still work; overlapping holds and React effect replay cannot release early', async () => {
  const h = runtime(), first = h.priority.hold(), second = h.priority.hold();
  h.ui.back(); assert.deepEqual(h.navigationActions, [['back', undefined]]);
  first(); first(); await h.advance(1000); assert.equal(h.priority.isBlocked(), true);
  second(); await h.advance(200); const replay = h.priority.hold();
  await h.advance(1000); assert.equal(h.priority.isBlocked(), true);
  replay(); await h.advance(350); assert.equal(h.priority.isBlocked(), false);
});

await test('the actual lifecycle hook stays held from API waiting through audio/visible result and releases on blur', async () => {
  const h = runtime(); let effect, cleanup, dependencies, focused = true;
  const hook = evaluate(read('src/hooks/useCheckinPresentation.ts'), {
    react: {
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      useLayoutEffect: (work, deps) => {
        if (!dependencies || deps.some((value, i) => value !== dependencies[i])) {
          cleanup?.(); effect = work; dependencies = deps;
        }
      },
    }, 'expo-router': { useIsFocused: () => focused },
    '../lib/checkin-presentation': { checkinPresentation: h.priority },
  });
  const render = (loading, screen) => {
    hook.useCheckinPresentationPriority(loading || screen === 'done');
    if (effect) { cleanup = effect(); effect = null; }
  };
  render(true, 'triage'); assert.equal(h.priority.isBlocked(), true);
  render(false, 'done'); await h.advance(1000); assert.equal(h.priority.isBlocked(), true);
  render(false, 'done'); await h.advance(1000); assert.equal(h.priority.isBlocked(), true);
  focused = false; render(false, 'done'); await h.advance(350);
  assert.equal(h.priority.isBlocked(), false);
});

await test('foreground pushes stay in notification history without banner, sound or badge while preparing', async () => {
  const h = runtime(); let handler;
  const file = ts.createSourceFile('notifications.ts', read('src/lib/notifications.ts'), ts.ScriptTarget.Latest, true);
  const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'setupNotificationHandler');
  const { setupNotificationHandler } = evaluate(declaration.getText(file), {}, {
    Notifications: { setNotificationHandler: value => { handler = value; } },
    checkinPresentation: h.priority, registerNotificationCategories() {},
  });
  setupNotificationHandler(); const release = h.priority.hold();
  const push = { request: { content: { data: { type: 'health_alert' } } } };
  const blocked = await handler.handleNotification(push);
  assert.equal(blocked.shouldShowBanner, false); assert.equal(blocked.shouldPlaySound, false);
  assert.equal(blocked.shouldShowAlert, false); assert.equal(blocked.shouldSetBadge, false);
  assert.equal(blocked.shouldShowList, true);
  release(); await h.advance(350);
  assert.equal((await handler.handleNotification(push)).shouldShowBanner, true);
});

await test('ended native calls are cleared during preparation, live handoffs only route after leaving', async () => {
  const h = runtime();
  const { CheckinCallHandoff } = evaluate(read('src/features/checkin-call/checkin-call.handoff.ts'));
  const handoff = new CheckinCallHandoff(), routes = [];
  const file = ts.createSourceFile('SessionProvider.tsx', read('src/providers/SessionProvider.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let flushNode;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'flushVoipHandoff') flushNode = node.initializer; ts.forEachChild(node, visit); };
  visit(file); assert.ok(flushNode);
  const flush = evaluate(`module.exports.flush = ${flushNode.getText(file)};`, {}, {
    useCallback: work => work, checkinPresentation: h.priority,
    callHandoff: { current: handoff },
    callContext: { current: { hydrated: true, loading: false, authToken: 'synthetic', navigationState: { key: 'ready' }, pathname: '/home', callParams: {} } },
    AppState: { currentState: 'active' }, isDoctorFeaturesEnabled: true,
    router: { navigate: route => routes.push(route) },
  }).flush;
  const release = h.priority.hold();
  handoff.receive({ episodeId: 'episode', attemptId: 'ended' }); flush();
  assert.deepEqual(routes, []); handoff.clear('ended');
  release(); await h.advance(350); flush(); assert.deepEqual(routes, []);
  const next = h.priority.hold();
  handoff.receive({ episodeId: 'episode', attemptId: 'live' }); flush();
  next(); await h.advance(350); flush(); assert.equal(routes.length, 1);
  flush(); assert.equal(routes.length, 1);
});

await test('the +coin celebration remains passive and available while check-in is preparing', async () => {
  const h = runtime(), release = h.priority.hold();
  let listener, cursor = 0, effects = [], slots = [], balance = 10;
  const profile = { token: 'synthetic', profile: { id: 7 } };
  const jsx = (type, props) => ({ type, props });
  const react = {
    useRef: value => slots[cursor++] ??= { current: value },
    useState: initial => { const index = cursor++; slots[index] ??= initial; return [slots[index], value => { slots[index] = value; }]; },
    useEffect: work => { const index = cursor++; if (!slots[index]) { slots[index] = true; effects.push(work); } },
  };
  class AnimatedValue { stopAnimation() {} setValue() {} interpolate() {} }
  const store = Object.assign(selector => selector(profile), { getState: () => profile });
  const { CoinEarnedHost } = evaluate(read('src/features/v21/CoinEarnedHost.tsx'), {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Animated: { Value: AnimatedValue, timing: () => ({ start() {} }), View: 'Coin' }, StyleSheet: { create: value => value } },
    'react-i18next': { useTranslation: () => ({ t: (_key, args) => `+${args.count} xu` }) },
    '../../components/ScaledText': { ScaledText: 'Text' }, '../auth/auth.store': { useAuthStore: store },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../../lib/health-action-events': { subscribeHealthAction: work => { listener = work; return () => {}; } },
    './v21.api': { v21Api: { flags: async () => ({ coins: true }), coins: async () => ({ balance }) } },
    './HealthCoinIcon': { HealthCoinIcon: 'CoinIcon' },
  }, h.clock);
  CoinEarnedHost(); effects.splice(0).forEach(work => work()); await tick();
  balance += 10; listener(); await tick(); cursor = 0;
  const toast = CoinEarnedHost();
  assert.equal(h.priority.isBlocked(), true);
  assert.ok(toast); assert.equal(toast.props.pointerEvents, 'none');
  assert.deepEqual(h.navigationActions, []); assert.equal(h.queue.getSnapshot().active, null);
  release(); await h.advance(350);
});

console.log(`Check-in presentation: ${checks} runtime checks passed.`);
