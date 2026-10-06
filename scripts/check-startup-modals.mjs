import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute the actual queue and components, rather than a replica of their logic.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(name in imports, `Missing stub: ${name}`);
    return imports[name];
  });
  return module.exports;
}
const { ModalQueue } = evaluate(read('src/lib/modalQueue.ts'));
const active = queue => queue.getSnapshot().active;
const show = queue => queue.didShow(active(queue).presentation);
const dismiss = queue => queue.didDismiss(active(queue).presentation);

await test('Skip keeps the native slot until dismissal, while notification prompt waits', () => {
  const queue = new ModalQueue();
  queue.request('guide', { content: 'guide' }); show(queue);
  queue.request('permission', { content: 'permission' });
  queue.remove('guide');
  assert.equal(active(queue).id, 'guide');
  assert.equal(active(queue).phase, 'closing');
  dismiss(queue);
  assert.equal(active(queue).id, 'permission');
  assert.equal(active(queue).phase, 'opening');
  show(queue); queue.remove('permission'); dismiss(queue);
  assert.equal(active(queue), null);
});
await test('closing before onShow cannot toggle a presenting native modal off early', () => {
  const queue = new ModalQueue(); let shows = 0;
  queue.request('guide', { content: 'guide', onShow: () => { shows++; } });
  queue.remove('guide'); queue.request('next', { content: 'next' });
  assert.equal(active(queue).phase, 'opening');
  show(queue);
  assert.equal(shows, 0);
  assert.equal(active(queue).phase, 'closing');
  dismiss(queue);
  assert.equal(active(queue).id, 'next');
});
await test('unmounting an open route retains its modal content until native dismissal', () => {
  const queue = new ModalQueue(); const content = { title: 'Guide', button: 'Skip' };
  queue.request('guide', { content }); show(queue);
  queue.remove('guide');
  assert.equal(active(queue).request.content, content);
  assert.equal(active(queue).phase, 'closing');
  dismiss(queue);
  assert.equal(active(queue), null);
});
await test('cancelled waiting prompts never appear and never mark themselves seen', () => {
  const queue = new ModalQueue(); let marked = 0;
  queue.request('guide', { content: 'guide' }); show(queue);
  queue.request('permission', { content: 'permission', onShow: () => { marked++; } });
  queue.remove('permission'); queue.remove('guide'); dismiss(queue);
  assert.equal(active(queue), null);
  assert.equal(marked, 0);
});
await test('urgent caregiver alerts are next, ahead of optional prompts, without overlaying the guide', () => {
  const queue = new ModalQueue();
  queue.request('guide', { content: 'guide', priority: 30 }); show(queue);
  queue.request('permission', { content: 'permission' });
  queue.request('invitation', { content: 'invitation', priority: 20 });
  queue.request('emergency', { content: 'emergency', priority: 100 });
  assert.equal(active(queue).id, 'guide');
  queue.remove('guide'); dismiss(queue);
  assert.equal(active(queue).id, 'emergency');
  show(queue); queue.remove('emergency'); dismiss(queue);
  assert.equal(active(queue).id, 'invitation');
});
await test('reopening while closing waits for the previous native presentation to finish', () => {
  const queue = new ModalQueue(); let dismissed = 0;
  queue.request('guide', { content: 'old', onDismiss: () => { dismissed++; } }); show(queue);
  const oldPresentation = active(queue).presentation;
  queue.remove('guide'); queue.request('guide', { content: 'new' });
  assert.equal(active(queue).request.content, 'old');
  assert.equal(active(queue).phase, 'closing');
  dismiss(queue);
  assert.equal(dismissed, 1);
  assert.equal(active(queue).request.content, 'new');
  assert.notEqual(active(queue).presentation, oldPresentation);
  queue.didShow(oldPresentation); queue.didDismiss(oldPresentation);
  assert.equal(active(queue).phase, 'opening');
});
await test('content refresh does not open a second native modal or change queue ordering', () => {
  const queue = new ModalQueue();
  queue.request('a', { content: 'a' }); show(queue);
  const presentation = active(queue).presentation;
  queue.request('a', { content: 'updated' });
  queue.request('b', { content: 'b' }); queue.request('c', { content: 'c' });
  queue.request('b', { content: 'new b' });
  assert.equal(active(queue).presentation, presentation);
  queue.remove('a'); dismiss(queue);
  assert.equal(active(queue).id, 'b');
  assert.equal(active(queue).request.content, 'new b');
});
await test('duplicate and stale native callbacks never close a newer modal or repeat an action', () => {
  const queue = new ModalQueue(); let actions = 0;
  queue.request('a', { content: 'a', onDismiss: () => { actions++; } }); show(queue);
  const first = active(queue).presentation;
  queue.request('b', { content: 'b' });
  queue.didDismiss(first); // Not closing yet.
  assert.equal(actions, 0);
  queue.remove('a'); dismiss(queue);
  queue.didDismiss(first); queue.didShow(first);
  assert.equal(actions, 1);
  assert.equal(active(queue).id, 'b');
  assert.equal(active(queue).phase, 'opening');
});
await test('an action enqueueing a prompt during onDismiss cannot occupy two native slots', () => {
  const queue = new ModalQueue();
  queue.request('a', { content: 'a', onDismiss: () => {
    queue.request('b', { content: 'b' });
    assert.equal(active(queue).id, 'a');
  } }); show(queue); queue.remove('a'); dismiss(queue);
  assert.equal(active(queue).id, 'b');
});
await test('a throwing dismiss callback cannot permanently retain the presenter', () => {
  const queue = new ModalQueue();
  queue.request('a', { content: 'a', onDismiss: () => { throw new Error('action failed'); } });
  show(queue); queue.request('b', { content: 'b' }); queue.remove('a');
  assert.throws(() => dismiss(queue), /action failed/);
  assert.equal(active(queue).id, 'b');
});
for (const rejected of [false, true]) await test(`native permission ${rejected ? 'failure releases the queue' : 'sheet holds the queue until answered'} without repeating actions`, async () => {
  const queue = new ModalQueue(); let finish, actions = 0;
  const pending = new Promise((resolve, reject) => { finish = rejected ? reject : resolve; });
  queue.request('permission', { content: 'permission', onDismiss: () => { actions++; return pending; } }); show(queue);
  queue.request('next', { content: 'next' }); queue.remove('permission');
  const presentation = active(queue).presentation;
  dismiss(queue); queue.didDismiss(presentation);
  assert.equal(actions, 1); assert.equal(active(queue).phase, 'settling');
  assert.equal(active(queue).id, 'permission');
  finish(); await pending.catch(() => {}); await Promise.resolve();
  assert.equal(active(queue).id, 'next');
});

const jsx = (type, props, key) => ({ type, props: { ...props, key: key ?? props?.key } });
const createElement = (type, props, ...children) => jsx(type, {
  ...props, ...(children.length ? { children } : {}),
});
const jsxRuntime = { jsx, jsxs: jsx };
function hostHarness(os = 'ios') {
  const queue = new ModalQueue(); const effects = [];
  const imports = {
    react: { createElement, createContext: () => ({}), useContext: () => queue, useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      useEffect: callback => effects.push(callback), useId: () => 'wrapper' },
    'react/jsx-runtime': jsxRuntime,
    'react-native': { Modal: 'NativeModal', Platform: { OS: os } },
    '../lib/modalQueue': { ModalQueue },
  };
  const components = evaluate(read('src/components/QueuedModal.tsx'), imports);
  return { queue, effects, ...components };
}
await test('the actual native host retains one controller/content through Skip and advances on onDismiss', () => {
  const h = hostHarness();
  h.queue.request('guide', { content: { children: 'Guide' } });
  let modal = h.QueuedModalHost(); modal.props.onShow();
  const firstKey = modal.props.key;
  h.queue.request('permission', { content: { children: 'Permission' } }); h.queue.remove('guide');
  modal = h.QueuedModalHost();
  assert.equal(modal.props.visible, false);
  assert.equal(modal.props.children, 'Guide');
  assert.equal(modal.props.key, firstKey);
  modal.props.onDismiss();
  modal = h.QueuedModalHost();
  assert.equal(modal.props.visible, true);
  assert.equal(modal.props.children, 'Permission');
  assert.notEqual(modal.props.key, firstKey);
});
await test('wrapper cleanup removes its request but does not unmount the closing native host', () => {
  const h = hostHarness();
  assert.equal(h.QueuedModal({ visible: true, children: 'Guide' }), null);
  h.effects.shift()(); const cleanup = h.effects.shift()();
  h.QueuedModalHost().props.onShow();
  cleanup();
  const modal = h.QueuedModalHost();
  assert.equal(modal.props.visible, false);
  assert.equal(modal.props.children, 'Guide');
  modal.props.onDismiss();
  assert.equal(h.QueuedModalHost(), null);
});
await test('Android closes without waiting for an iOS-only onDismiss callback', async () => {
  const h = hostHarness('android');
  h.queue.request('guide', { content: { children: 'Guide' } }); show(h.queue);
  h.queue.request('permission', { content: { children: 'Permission' } }); h.queue.remove('guide');
  assert.equal(h.QueuedModalHost().props.visible, false);
  const cleanup = h.effects.pop()();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(active(h.queue).id, 'permission');
  cleanup();
});

function alertHarness() {
  const refs = []; let index = 0;
  const native = { Modal: 'NativeModal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: value => value } };
  const imports = {
    react: { createElement, useRef: value => refs[index++] ??= { current: value }, useMemo: callback => callback() },
    'react/jsx-runtime': jsxRuntime, 'react-native': native,
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, './ScaledText': { ScaledText: 'Text' },
    './QueuedModal': { QueuedModal: 'QueuedModal' },
    '../hooks/useScaledTypography': { useScaledTypography: () => ({ size: { md: 17, sm: 14 } }) },
    '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../styles': { colors: {}, iconColors: {}, radius: {}, spacing: {} },
  };
  const { AppAlertModal } = evaluate(read('src/components/AppAlertModal.tsx'), imports);
  return props => { index = 0; return AppAlertModal(props); };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
for (const queued of [true, false]) await test(`actual AppAlert ${queued ? 'defers OS permission until dismissed' : 'preserves existing non-startup action behavior'}`, () => {
  let closes = 0, actions = 0;
  const render = alertHarness();
  const props = { queued, visible: true, title: 'Enable notifications', onDismiss: () => { closes++; },
    buttons: [{ text: 'Enable', onPress: () => { actions++; } }] };
  const tree = render(props);
  const button = nodes(tree).find(node => node.type === 'Pressable' && node.props.style instanceof Function);
  button.props.onPress();
  assert.equal(closes, 1);
  assert.equal(actions, queued ? 0 : 1);
  if (queued) {
    button.props.onPress();
    assert.equal(closes, 1);
    const closing = render({ ...props, visible: false });
    closing.props.onDismiss(); closing.props.onDismiss();
    assert.equal(actions, 1);
  }
});

await test('the actual personalized-consent modal bounds scrolling content and stacks two accessible buttons', () => {
  const render = alertHarness();
  const tree = render({ visible: true, title: 'Consent', message: 'Long consent content', scrollable: true, stackButtons: true,
    onDismiss() {}, buttons: [{ text: 'Cancel' }, { text: 'Agree' }] });
  const all = nodes(tree);
  const scroll = all.find(node => node.type === 'ScrollView');
  assert.ok(scroll); assert.equal(scroll.props.style.flexShrink, 1);
  assert.ok(nodes(scroll).some(node => node.type === 'Text' && node.props.children === 'Long consent content'));
  const card = all.find(node => node.type === 'Pressable' && Array.isArray(node.props.style));
  assert.equal(card.props.style[1].maxHeight, '85%');
  const buttons = all.filter(node => node.type === 'Pressable' && node.props.style instanceof Function);
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    const style = Object.assign({}, ...button.props.style({ pressed: false }).filter(Boolean));
    assert.equal(style.width, '100%'); assert.ok(style.minHeight >= 48); assert.equal(style.flex, undefined);
  }
});
await test('ordinary two-button alerts preserve their original horizontal layout', () => {
  const tree = alertHarness()({ visible: true, title: 'Ordinary alert', onDismiss() {}, buttons: [{ text: 'Cancel' }, { text: 'Agree' }] });
  assert.equal(nodes(tree).some(node => node.type === 'ScrollView'), false);
  const buttons = nodes(tree).filter(node => node.type === 'Pressable' && node.props.style instanceof Function);
  for (const button of buttons) assert.equal(Object.assign({}, ...button.props.style({ pressed: false }).filter(Boolean)).flex, 1);
});

// Execute the real preparation effect and onShow handler from SessionProvider.
const source = read('src/providers/SessionProvider.tsx');
const ast = ts.createSourceFile('SessionProvider.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let prepareEffect, markShown, enableAccess;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0]?.getText(ast).includes('const prepareNotificationAccess =')) prepareEffect = node.arguments[0].getText(ast);
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onShow'
    && node.initializer?.expression?.getText(ast).includes('notification_permission_prompted')) markShown = node.initializer.expression.getText(ast);
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'enableNotifications') enableAccess = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(prepareEffect); assert.ok(markShown); assert.ok(enableAccess);
const withDeps = (body, deps) => evaluate(`module.exports = deps => { const { ${Object.keys(deps).join(',')} } = deps; return (${body})(); };`)(deps);
await test('notification prompt is persisted only on actual display, not during async preparation/queueing', async () => {
  const writes = []; const timers = []; const visibility = [];
  const deps = {
    hydrated: true, authToken: 'session', profile: { id: 'account-a', onboardingCompleted: true },
    setNotificationPromptVisible: value => visibility.push(value),
    checkNotificationPermission: async () => false, getNotificationPreferences: async () => ({}), syncExistingPushToken: async () => {},
    AsyncStorage: { getItem: async () => null, setItem: async (...args) => writes.push(args) },
    setTimeout: callback => { timers.push(callback); return 1; }, clearTimeout() {},
  };
  const cleanup = withDeps(prepareEffect, deps);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 0); assert.equal(timers.length, 1);
  timers[0](); assert.deepEqual(visibility, [false, true]); assert.equal(writes.length, 0);
  withDeps(markShown, deps);
  assert.deepEqual(writes, [['@asinu/notification_permission_prompted:v2:account-a', '1']]);
  cleanup();
});
await test('logout during permission preparation cannot queue another account’s first-launch prompt', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; }); let timers = 0;
  const deps = {
    hydrated: true, authToken: 'session', profile: { id: 'account-a', onboardingCompleted: true }, setNotificationPromptVisible() {},
    checkNotificationPermission: () => pending, getNotificationPreferences: async () => ({}), syncExistingPushToken: async () => {},
    AsyncStorage: { getItem: async () => null }, setTimeout: () => { timers++; }, clearTimeout() {},
  };
  withDeps(prepareEffect, deps)(); finish(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timers, 0);
});
await test('only the OS permission sheet holds the presenter, not slow push registration APIs', async () => {
  let finishPermission, finishRegistration, complete = false, registrations = 0;
  const permission = new Promise(resolve => { finishPermission = resolve; });
  const registration = new Promise(resolve => { finishRegistration = resolve; });
  const feedback = [];
  const deps = {
    requestNotificationPermissions: () => permission,
    syncExistingPushToken: () => { registrations++; return registration; },
    updateNotificationPreferences: () => { registrations++; return registration; },
    showToast: (...args) => feedback.push(args), t: key => key,
  };
  const action = withDeps(enableAccess, deps).then(() => { complete = true; });
  await Promise.resolve(); assert.equal(complete, false); assert.equal(registrations, 0);
  finishPermission(true); await new Promise(resolve => setImmediate(resolve));
  assert.equal(complete, true); assert.equal(registrations, 2); assert.equal(feedback.length, 0);
  finishRegistration(); await action; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(feedback, [['scheduleSaved', 'success']]);
});
await test('a failed native permission request is handled in-app and does not reject dismissal', async () => {
  const feedback = [];
  await withDeps(enableAccess, {
    requestNotificationPermissions: async () => { throw new Error('unavailable'); },
    showToast: (...args) => feedback.push(args), t: key => key,
    syncExistingPushToken: () => assert.fail('must not register without permission'),
    updateNotificationPreferences: () => assert.fail('must not update without permission'),
  });
  assert.deepEqual(feedback, [['scheduleSaveError', 'error']]);
});
await test('leaving Home cancels delayed guide loading and dismisses any visible guide', async () => {
  const home = read('app/(tabs)/home/index.tsx');
  const homeAst = ts.createSourceFile('Home.tsx', home, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let focusEffect;
  function find(node) {
    if (ts.isCallExpression(node) && node.expression.getText(homeAst) === 'useFocusEffect'
      && node.arguments[0]?.getText(homeAst).includes('hasSeenCheckinGuide(profile.id)')) focusEffect = node.arguments[0].arguments[0].getText(homeAst);
    ts.forEachChild(node, find);
  }
  find(homeAst); assert.ok(focusEffect);
  let finish; const loading = new Promise(resolve => { finish = resolve; }); const visibility = [];
  const cleanup = withDeps(focusEffect, {
    profile: { id: 'account-a' }, hasSeenCheckinGuide: () => loading,
    setShowCheckinGuide: value => visibility.push(value),
  });
  cleanup(); finish(false); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(visibility, [false]);
});
await test('all automatically displayed first-launch dialogs use the shared presenter', () => {
  for (const file of ['CheckinGuideCarousel', 'CareCircleInvitationModal', 'CaregiverAlertModal', 'AiDataConsentModal']) {
    const body = read(`src/components/${file}.tsx`);
    assert.match(body, /<QueuedModal\b/);
    assert.doesNotMatch(body, /<Modal\b/);
  }
  assert.match(source, /<AppAlertModal\s+queued\s+visible=\{notificationPromptVisible && pathname === "\/home"\}/);
  const layout = read('app/_layout.tsx');
  assert.match(layout, /<QueuedModalProvider>/); assert.match(layout, /<QueuedModalHost\s*\/>/);
  assert.ok(layout.indexOf('<QueuedModalProvider>') < layout.indexOf('<SessionProvider>'));
  const guide = read('src/components/CheckinGuideCarousel.tsx');
  assert.doesNotMatch(guide, /entering=|FadeInDown/);
});
console.log(`Startup modal lifecycle: ${checks} regressions passed.`);
