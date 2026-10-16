import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function evaluate(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  // Execute the shipped queue and permission adapter together, with only OS APIs replaced.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), source)(
    module, module.exports, id => {
      assert.ok(id in imports, `Missing permission adapter: ${id}`);
      return imports[id];
    }, ...Object.values(globals)
  );
  return module.exports;
}
const { ModalQueue } = evaluate('src/lib/modalQueue.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function harness(initialState = 'active') {
  const listeners = new Set();
  const timers = new Map();
  let token = 'account-a';
  const AppState = {
    currentState: initialState,
    addEventListener(_event, listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const queue = new ModalQueue(initialState === 'active');
  const api = evaluate('src/lib/native-permissions.ts', {
    'react-native': { AppState }, './tokenStore': { tokenStore: { getToken: () => token } },
  }, {
    requestAnimationFrame: callback => callback(),
    setTimeout: (callback, delay) => { const id = {}; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const detach = api.attachNativePermissionPresenter(queue);
  AppState.addEventListener('change', state => queue.setForeground(state === 'active'));
  const state = value => {
    AppState.currentState = value;
    [...listeners].forEach(listener => listener(value));
  };
  const active = () => queue.getSnapshot().active;
  const show = () => queue.didShow(active().presentation);
  const requestModal = (id, priority = 0, onDismiss) => queue.request(id, { content: id, priority, onDismiss });
  const close = () => { const item = active(); queue.remove(item.id); queue.didDismiss(item.presentation); };
  return { queue, ...api, detach, state, active, show, requestModal, close, timers, listeners,
    setToken: value => { token = value; } };
}
let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };

await test('OS requests wait for the actual dismissal of the data consent dialog', async () => {
  const h = harness(); const seen = [];
  h.requestModal('data-consent', 60); h.show();
  const request = h.runNativePermission(async () => { seen.push('microphone'); return 'granted'; }, { key: 'microphone' });
  h.requestModal('notifications');
  await flush(); assert.deepEqual(seen, []);
  const presentation = h.active().presentation;
  h.queue.remove('data-consent');
  await flush(); assert.deepEqual(seen, []);
  assert.equal(h.active().phase, 'closing');
  h.queue.didDismiss(presentation);
  assert.equal(await request, 'granted'); await flush();
  assert.deepEqual(seen, ['microphone']);
  assert.equal(h.active().id, 'notifications'); h.detach();
});

await test('notification then full-screen settings can run from a dismissed queued alert without deadlocking', async () => {
  const h = harness(); const seen = []; const notification = deferred(); const settings = deferred();
  h.requestModal('enable-call', 0, async () => {
    await h.runNativePermission(() => { seen.push('notifications'); return notification.promise; }, { key: 'notifications' });
    await h.runNativePermission(() => { seen.push('full-screen'); h.state('background'); return settings.promise; }, { key: 'full-screen', settings: true });
    seen.push('done');
  }); h.show(); h.requestModal('next'); h.close();
  await flush(); assert.deepEqual(seen, ['notifications']);
  assert.equal(h.active().phase, 'settling');
  notification.resolve({ granted: true }); await flush();
  assert.deepEqual(seen, ['notifications', 'full-screen']);
  settings.resolve(true); await flush(); assert.equal(h.active().phase, 'settling');
  h.state('active'); await flush();
  assert.deepEqual(seen, ['notifications', 'full-screen', 'done']);
  assert.equal(h.active().id, 'next'); h.detach();
});

await test('two OS sheets and a waiting app prompt never share the presenter', async () => {
  const h = harness(); const seen = []; const first = deferred(); const second = deferred();
  const a = h.runNativePermission(() => { seen.push('camera'); return first.promise; }, { key: 'camera' });
  const b = h.runNativePermission(() => { seen.push('photos'); return second.promise; }, { key: 'photos' });
  h.requestModal('optional');
  await flush(); assert.deepEqual(seen, ['camera']); assert.equal(h.active(), null);
  first.resolve({ granted: false }); await a; await flush();
  assert.deepEqual(seen, ['camera', 'photos']); assert.equal(h.active(), null);
  second.resolve({ granted: true }); await b; await flush();
  assert.equal(h.active().id, 'optional'); assert.equal(h.queue.getSnapshot().nativeBusy, false); h.detach();
});

await test('foreground entry orders required consent before OS permissions before optional prompts', async () => {
  const h = harness('background'); const seen = [];
  const permission = h.runNativePermission(async () => { seen.push('camera'); }, { key: 'camera' });
  h.requestModal('notifications'); h.requestModal('ai-consent', 40); h.requestModal('medical', 50); h.requestModal('data', 60);
  await flush(); assert.equal(h.active(), null); assert.deepEqual(seen, []);
  h.state('active'); assert.equal(h.active().id, 'data'); h.show(); h.close();
  assert.equal(h.active().id, 'medical'); h.show(); h.close();
  assert.equal(h.active().id, 'ai-consent'); h.show(); h.close();
  await permission; await flush(); assert.deepEqual(seen, ['camera']);
  assert.equal(h.active().id, 'notifications'); h.detach();
});

await test('legacy settings APIs resolving early still wait for departure and return to the app', async () => {
  const h = harness(); const seen = [];
  const request = h.runNativePermission(async () => { seen.push('settings'); return true; }, { key: 'settings', settings: true });
  h.requestModal('next'); await flush();
  assert.equal(h.timers.size, 1); assert.equal(h.active(), null);
  h.state('background'); await flush();
  assert.equal(h.active(), null);
  h.state('active'); assert.equal(await request, true); await flush();
  assert.equal(h.active().id, 'next'); assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 1); h.detach();
});

await test('returning before a settings API resolves cannot orphan the next prompt', async () => {
  const h = harness(); const result = deferred();
  const request = h.runNativePermission(() => { h.state('inactive'); return result.promise; }, { key: 'settings', settings: true });
  h.requestModal('next'); await flush(); h.state('active'); await flush();
  assert.equal(h.active(), null);
  result.resolve(true); assert.equal(await request, true); await flush();
  assert.equal(h.active().id, 'next'); assert.equal(h.timers.size, 0); h.detach();
});

await test('multi-window settings hold the presenter until the activity result, even without AppState events', async () => {
  const h = harness(); const result = deferred();
  const request = h.runNativePermission(() => result.promise, { key: 'settings', settings: true });
  h.requestModal('next'); await flush();
  assert.equal(h.active(), null); assert.equal(h.timers.size, 0);
  result.resolve(true); await flush();
  assert.equal(h.active(), null);
  [...h.timers.values()].forEach(timer => timer.callback());
  assert.equal(await request, true); await flush(); assert.equal(h.active().id, 'next'); h.detach();
});

await test('rapid taps deduplicate the same permission while distinct permissions keep FIFO order', async () => {
  const h = harness(); const result = deferred(); let requests = 0;
  const a = h.runNativePermission(() => { requests++; return result.promise; }, { key: 'microphone' });
  const b = h.runNativePermission(() => { requests++; return result.promise; }, { key: 'microphone' });
  assert.equal(a, b); await flush(); assert.equal(requests, 1);
  result.resolve('denied'); assert.equal(await b, 'denied'); await flush();
  await h.runNativePermission(async () => { requests++; }, { key: 'microphone' });
  assert.equal(requests, 2); h.detach();
});

await test('OS failures and failed settings launches release the presenter and all listeners', async () => {
  const h = harness();
  const failed = h.runNativePermission(async () => { throw new Error('OS failure'); }, { key: 'camera' });
  const rejected = assert.rejects(failed, /OS failure/);
  const settings = h.runNativePermission(async () => false, { key: 'settings', settings: true });
  h.requestModal('next'); await rejected; assert.equal(await settings, false); await flush();
  assert.equal(h.active().id, 'next'); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 1); h.detach();
});

await test('a queued request from an old account cannot open an OS sheet for a new account', async () => {
  const h = harness(); const seen = [];
  h.requestModal('consent', 60); h.show();
  const old = h.runNativePermission(async () => { seen.push('old'); }, { key: 'camera' });
  const cancelled = assert.rejects(old, /no longer current/);
  h.setToken('account-b');
  const next = h.runNativePermission(async () => { seen.push('new'); }, { key: 'camera' });
  assert.notEqual(old, next); h.close(); await cancelled; await next; await flush();
  assert.deepEqual(seen, ['new']); h.detach();
});

await test('leaving a permission route before its turn cancels that OS request', async () => {
  const h = harness(); let focused = true, requests = 0;
  h.requestModal('consent', 60); h.show();
  const pending = h.runNativePermission(async () => { requests++; }, { key: 'location', canRun: () => focused });
  const cancelled = assert.rejects(pending, /no longer current/);
  focused = false; h.close(); await cancelled; await flush();
  assert.equal(requests, 0); assert.equal(h.queue.getSnapshot().nativeBusy, false); h.detach();
});

await test('logout while an OS sheet is open prevents a second permission action', async () => {
  const h = harness(); const result = deferred(); const seen = [];
  const pending = h.runNativePermission(() => { seen.push('microphone'); h.state('inactive'); return result.promise; }, { key: 'microphone' });
  const cancelled = assert.rejects(pending, /no longer current/);
  await flush(); h.setToken(null); result.resolve('granted'); await flush();
  assert.equal(h.queue.getSnapshot().nativeBusy, true);
  h.state('active'); await cancelled; await flush(); assert.deepEqual(seen, ['microphone']);
  assert.equal(h.queue.getSnapshot().nativeBusy, false); h.detach();
});

await test('a cancelled route cannot cancel a different screen asking for the same permission', async () => {
  const h = harness(); let focused = true; const seen = [];
  h.requestModal('consent', 60); h.show();
  const first = h.runNativePermission(async () => { seen.push('old-route'); }, { key: 'location', canRun: () => focused });
  const cancelled = assert.rejects(first, /no longer current/);
  const second = h.runNativePermission(async () => { seen.push('current-route'); }, { key: 'location' });
  assert.notEqual(first, second); focused = false; h.close();
  await cancelled; await second; await flush();
  assert.deepEqual(seen, ['current-route']); h.detach();
});

console.log(`Permission sequencing: ${checks} integration regressions passed.`);
