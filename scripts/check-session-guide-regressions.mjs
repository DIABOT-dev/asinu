import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function evaluate(source, imports = {}) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(name in imports, `Missing stub: ${name}`);
    return imports[name];
  });
  return module.exports;
}
function create(initializer) {
  if (!initializer) return create;
  let state;
  const get = () => state;
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  state = initializer(set, get);
  return { getState: get, setState: set };
}
const api = {};
const { useNotificationStore: store } = evaluate(fs.readFileSync('src/stores/notification.store.ts', 'utf8'), {
  zustand: { create }, '../features/notifications/notifications.api': api,
});
const notification = id => ({ id, type: 'general', title: id, message: id, created_at: '2026-10-05T07:00:00Z', is_read: false });
const response = id => ({ ok: true, notifications: [notification(id)], pagination: { unreadCount: 1, page: 1, total: 1, limit: 50 } });
await test('isolated inbox previews retain their real display category without altering ordinary notifications', async () => {
  store.getState().reset();
  const rows = [
    { ...notification('demo'), type: 'demo:care_circle_invitation', data: { demo: true, demoBatch: 'test-catalog', type: 'care_circle_invitation' } },
    { ...notification('real'), type: 'caregiver_alert', data: { type: 'emergency' } },
    { ...notification('unmarked'), type: 'demo:emergency', data: { type: 'emergency' } },
    { ...notification('no-batch'), type: 'demo:emergency', data: { demo: true, type: 'emergency' } },
    { ...notification('mismatch'), type: 'demo:health_alert', data: { demo: true, demoBatch: 'test-catalog', type: 'emergency' } },
  ];
  api.fetchNotifications = async () => ({ ok: true, notifications: rows, pagination: { unreadCount: 5, page: 1, total: 5, limit: 50 } });
  await store.getState().fetchFromBackend();
  assert.deepEqual(store.getState().notifications.map(item => item.type), ['care_circle_invitation', 'caregiver_alert', 'demo:emergency', 'demo:emergency', 'demo:health_alert']);
  assert.deepEqual(store.getState().notifications[0].data, rows[0].data);
  assert.equal(store.getState().unreadCount, 5);
  store.getState().reset();
});
await test('local reset clears the inbox without deleting server history', async () => {
  let deletes = 0;
  api.deleteAllNotifications = async () => { deletes++; return { ok: true }; };
  store.setState({ notifications: [notification('account-a')], unreadCount: 1 });
  store.getState().reset();
  assert.equal(deletes, 0);
  assert.equal(store.getState().notifications.length, 0);
  assert.equal(store.getState().unreadCount, 0);
});
await test('a delayed account-A fetch cannot replace account-B data', async () => {
  const old = deferred();
  api.fetchNotifications = () => old.promise;
  const first = store.getState().fetchFromBackend();
  store.getState().reset();
  api.fetchNotifications = async () => response('account-b');
  await store.getState().fetchFromBackend();
  old.resolve(response('account-a'));
  await first;
  assert.equal(store.getState().notifications[0].id, 'account-b');
});
await test('stale fetch failure/finally cannot clear a newer loading flag', async () => {
  store.getState().reset();
  const old = deferred(), current = deferred();
  api.fetchNotifications = () => old.promise;
  const first = store.getState().fetchFromBackend();
  store.getState().reset();
  api.fetchNotifications = () => current.promise;
  const second = store.getState().fetchFromBackend();
  old.reject(new Error('offline'));
  await first;
  assert.equal(store.getState()._fetching, true);
  assert.equal(store.getState().error, null);
  current.resolve(response('account-b'));
  await second;
});
for (const [method, apiMethod, argument] of [
  ['markAsRead', 'markNotificationAsRead', '1'], ['markAllAsRead', 'markAllNotificationsAsRead'],
  ['removeNotification', 'deleteNotification', '1'], ['clearAll', 'deleteAllNotifications'],
]) {
  await test(`${method} rollback cannot restore a logged-out inbox`, async () => {
    store.getState().reset();
    api.fetchNotifications = async () => response('1');
    await store.getState().fetchFromBackend();
    const pending = deferred();
    api[apiMethod] = () => pending.promise;
    const action = store.getState()[method](argument);
    store.getState().reset();
    pending.reject(new Error('old session'));
    await action;
    assert.deepEqual(store.getState().notifications, []);
    assert.equal(store.getState().unreadCount, 0);
  });
}
await test('auth logout uses local reset and never invokes delete-all', async () => {
  let resets = 0, deletes = 0;
  const resetStore = { getState: () => ({ reset: () => {} }) };
  const imports = {
    zustand: { create }, '../../lib/localCache': { localCache: { setUserId() {}, clearLegacyPlaintextCache: async () => {} } },
    '../../lib/tokenStore': { tokenStore: { clearToken: async () => {} } },
    '../../stores/notification.store': { useNotificationStore: { getState: () => ({ reset: () => { resets++; }, clearAll: () => { deletes++; } }) } },
    '../../stores/language.store': { useLanguageStore: resetStore }, '../../lib/apiClient': { apiClient: async () => {} },
    './auth.api': { authApi: { logout: async () => {} } }, './auth.service': { authService: {} },
  };
  for (const [name, exported] of [
    ['../care-pulse/store/carePulse.store','useCarePulseStore'], ['../logs/logs.store','useLogsStore'],
    ['../missions/missions.store','useMissionsStore'], ['../profile/profile.store','useProfileStore'],
    ['../tree/tree.store','useTreeStore'], ['../wellness/store/wellness.store','useWellnessStore'],
  ]) imports[name] = { [exported]: resetStore };
  const { useAuthStore } = evaluate(fs.readFileSync('src/features/auth/auth.store.ts', 'utf8'), imports);
  await useAuthStore.getState().logout();
  assert.equal(deletes, 0);
  assert.equal(resets, 2);
  assert.equal(useAuthStore.getState().profile, null);
});

// Execute the actual ended-progress useEffect, with two out-of-order responses.
const screen = fs.readFileSync('app/checkin-call/[episodeId].tsx', 'utf8');
const ast = ts.createSourceFile('screen.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let progressEffect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0]?.getText(ast).includes('if (!ended || !attempt) return;')) progressEffect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(progressEffect);
await test('terminal progress cannot regress when an older network response arrives', async () => {
  const pending = [deferred(), deferred()];
  const deps = { ended: true, attempt: { state: 'COMPLETED' }, episodeId: 'e',
    checkinCallApi: { episode: () => pending.shift().promise },
    setEpisodeProgress: () => {}, getClosedCheckinCallStatusKey: value => value.episode_state,
    getCheckinCallTime: () => 0, setCompletedAt: () => {},
  };
  let interval, state, cleared = false;
  const first = pending[0], second = pending[1];
  deps.setStatusKey = value => { state = value; };
  deps.setInterval = callback => { interval = callback; return 1; };
  deps.clearInterval = () => { cleared = true; };
  const source = `module.exports = deps => { const { ${Object.keys(deps).join(',')} } = deps; return (${progressEffect})(); };`;
  const cleanup = evaluate(source)(deps);
  interval(); interval();
  second.resolve({ episode: { state: 'RESOLVED' } });
  await tick();
  first.resolve({ episode: { state: 'URGENT_BROADCAST' } });
  await tick();
  assert.equal(state, 'RESOLVED');
  assert.equal(cleared, true);
  cleanup();
});

// Persistent React-hook harness: exercise the real carousel across show/hide.
let stateIndex = 0, refIndex = 0, effectIndex = 0, userId = 'account-a';
const states = [], refs = [], effects = [], scheduled = [];
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  memo: value => value, useMemo: value => value(), useCallback: value => value,
  useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
  useRef: initial => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; },
  useEffect: (effect, deps) => { const index = effectIndex++; if (!effects[index] || deps.some((value, i) => value !== effects[index][i])) { effects[index] = deps; scheduled.push(effect); } },
};
const native = { StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 850, width: 390 }), Platform: { select: options => options.ios } };
for (const name of ['FlatList','Modal','Pressable','ScrollView','View']) native[name] = name;
const { CheckinGuideCarousel } = evaluate(fs.readFileSync('src/components/CheckinGuideCarousel.tsx', 'utf8'), {
  react, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
  '@react-native-async-storage/async-storage': { setItem: async () => {} },
  './CheckinGuidePreview': { CheckinGuidePreview: 'Preview' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
  './QueuedModal': { QueuedModal: 'QueuedModal' },
  'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: { duration: () => ({}) } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  'react-i18next': { useTranslation: () => ({ t: (key, args) => `${key}${args?.current || ''}` }) },
  './ScaledText': { ScaledText: 'Text' }, '../features/auth/auth.store': { useAuthStore: selector => selector({ profile: { id: userId } }) },
  '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: true }) },
  '../stores/font-size.store': { useFontSizeStore: selector => selector({ scale: 'large' }) }, '../styles': { colors: {} },
});
function render(visible = true, props = {}) { stateIndex = refIndex = effectIndex = 0; const tree = CheckinGuideCarousel({ visible, ...props }); while (scheduled.length) scheduled.shift()(); return tree; }
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
await test('reopening guide starts at slide one, not the last visited slide', async () => {
  render();
  refs[0].current = { scrollToIndex() {}, scrollToOffset() {} };
  const tree = render();
  nodes(tree).find(node => node.props?.accessibilityLabel === 'checkinGuide.stepBadge5').props.onPress();
  assert.equal(states[0], 4);
  render(false); render(true);
  assert.equal(states[0], 0);
  assert.ok(nodes(render()).some(node => node.props?.accessibilityLabel === 'checkinGuide.next'));
});
await test('guide resets when the authenticated account changes', async () => {
  nodes(render()).find(node => node.props?.accessibilityLabel === 'checkinGuide.stepBadge4').props.onPress();
  userId = 'account-b'; render();
  assert.equal(states[0], 0);
});
await test('Skip closes exactly once and never starts check-in', async () => {
  let closes = 0, starts = 0;
  const tree = render(true, { onClose: () => { closes++; }, onStartCheckin: () => { starts++; } });
  assert.equal(tree.type, 'QueuedModal');
  const skip = nodes(tree).find(node => node.props?.accessibilityLabel === 'checkinGuide.skip').props.onPress;
  await Promise.all([skip(), skip()]);
  assert.equal(closes, 1);
  assert.equal(starts, 0);
  tree.props.onDismiss();
  assert.equal(starts, 0);
});
await test('Start waits for actual native dismissal before navigating, even on repeated taps', async () => {
  render(false); render(true);
  let closes = 0, starts = 0;
  const props = { onClose: () => { closes++; }, onStartCheckin: () => { starts++; } };
  nodes(render(true, props)).find(node => node.props?.accessibilityLabel === 'checkinGuide.stepBadge5').props.onPress();
  const tree = render(true, props);
  const start = nodes(tree).find(node => node.props?.accessibilityLabel === 'checkinGuide.start').props.onPress;
  await Promise.all([start(), start()]);
  assert.equal(closes, 1);
  assert.equal(starts, 0);
  tree.props.onDismiss();
  tree.props.onDismiss();
  assert.equal(starts, 1);
});
await test('inline guide completes without waiting for a nonexistent native modal', async () => {
  render(false); render(true);
  let starts = 0;
  const props = { asModal: false, onClose() {}, onStartCheckin: () => { starts++; } };
  nodes(render(true, props)).find(node => node.props?.accessibilityLabel === 'checkinGuide.stepBadge5').props.onPress();
  await nodes(render(true, props)).find(node => node.props?.accessibilityLabel === 'checkinGuide.start').props.onPress();
  assert.equal(starts, 1);
});
await test('preview text passes contrast in both themes, including light cards on dark mode', async () => {
  const previewSource = fs.readFileSync('src/components/CheckinGuidePreview.tsx', 'utf8');
  const fragment = previewSource.slice(previewSource.indexOf('const createStyles ='));
  const { createStyles } = evaluate(`import { StyleSheet } from 'react-native';\n${fragment}\nmodule.exports = { createStyles };`, { 'react-native': native });
  const luminance = hex => hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const dark of [false, true]) {
    const styles = createStyles(dark);
    for (const key of ['caption', 'heading', 'body', 'label']) assert.ok(contrast(styles[key].color, dark ? '#0f172a' : '#ffffff') >= 4.5, `${key}: ${dark ? 'dark' : 'light'}`);
    for (const key of ['cardBody', 'cardLabel']) {
      for (const background of ['#ffffff', '#eefaf5']) assert.ok(contrast(styles[key].color, background) >= 4.5, key);
    }
  }
});
console.log(`Session, guide and progress: ${checks} runtime regressions passed.`);
