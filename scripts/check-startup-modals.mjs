import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute the actual queue and components, rather than a replica of their logic.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports, name => {
    assert.ok(name in imports, `Missing stub: ${name}`);
    return imports[name];
  }, ...Object.values(globals));
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
await test('updated app-modal buttons have readable wrapping text and 48px touch targets', () => {
  const tree = alertHarness()({ visible: true, title: 'Long title', message: 'Long message',
    stackButtons: true, scrollable: true, onDismiss() {},
    buttons: [{ text: 'A long confirmation label that must wrap' }, { text: 'A long cancellation label' }] });
  for (const button of nodes(tree).filter(node => node.type === 'Pressable' && node.props.style instanceof Function)) {
    const style = Object.assign({}, ...button.props.style({ pressed: false }).filter(Boolean));
    assert.ok(style.minHeight >= 48);
    assert.equal(style.width, '100%');
    assert.equal(style.alignItems, 'center');
    assert.equal(style.justifyContent, 'center');
    const label = nodes(button).find(node => node.type === 'Text');
    const textStyle = Object.assign({}, ...label.props.style.filter(Boolean));
    assert.equal(textStyle.textAlign, 'center');
    assert.equal(textStyle.flexShrink, 1);
    assert.equal(label.props.numberOfLines, undefined);
  }
});
await test('the specialist busy/reopen modal opts into stacked buttons and scrolling', () => {
  const body = read('app/doctor-consultation/[taskId].tsx');
  const file = ts.createSourceFile('doctor.tsx', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let modal;
  const find = node => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'AppAlertModal'
      && node.attributes.properties.some(attr => attr.name?.getText(file) === 'visible'
        && attr.initializer?.expression?.getText(file) === 'busyModalVisible')) modal = node;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === 'AppAlertModal'
      && node.attributes.properties.some(attr => attr.name?.getText(file) === 'visible'
        && attr.initializer?.expression?.getText(file) === 'busyModalVisible')) modal = node;
    ts.forEachChild(node, find);
  };
  find(file); assert.ok(modal);
  for (const prop of ['stackButtons', 'scrollable']) {
    assert.ok(modal.attributes.properties.some(attr => attr.name?.getText(file) === prop
      && (attr.initializer === undefined || attr.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword)));
  }
});

// Run the actual updated splash with native adapters: assets, consent/auth
// gates and cold-start call routing must survive a visual-only replacement.
function splashHarness({ language = 'vi', profile = null, hydrated = true, loading = false,
  navigationReady = true, consent = Promise.resolve(true), call = null, response = null } = {}) {
  let cursor = 0, pending = [], live = true;
  let now = 0, nextTimerId = 0;
  const timers = new Map();
  const slots = [];
  const state = { profile, hydrated, loading, navigationReady };
  const calls = { routes: [], native: 0, push: 0, loopStarts: 0, loopStops: 0 };
  const tasks = [];
  const router = { replace: route => calls.routes.push(route) };
  class Value {
    constructor(value) { this.value = value; this.listeners = new Map(); }
    setValue(value) { this.value = value; this.listeners.forEach(listener => listener({ value })); }
    interpolate(config) { return { value: this.value, ...config }; }
    addListener(listener) { const id = String(this.listeners.size); this.listeners.set(id, listener); return id; }
    removeListener(id) { this.listeners.delete(id); }
  }
  const animation = (value, options) => ({ start: callback => {
    value.setValue(options.toValue); callback?.({ finished: true });
  } });
  const imports = {
    react: {
      useRef: value => slots[cursor++] ??= { current: value },
      useState: initial => {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: initial };
        return [slots[index].value, value => {
          assert.ok(live, 'Cannot update unmounted splash');
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        }];
      },
      useEffect: (work, deps) => {
        const index = cursor++;
        if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
          const previous = slots[index];
          slots[index] = { deps };
          pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = work(); });
        }
      },
    },
    'react/jsx-runtime': jsxRuntime,
    'react-native': {
      Animated: { Value, View: 'AnimatedView', timing: animation, spring: animation,
        parallel: items => ({ start: callback => { items.forEach(item => item.start()); callback?.(); } }),
        sequence: value => value, delay: value => value,
        loop: () => ({ start: () => calls.loopStarts++, stop: () => calls.loopStops++ }) },
      Easing: { out: value => value, cubic: () => {}, bezier: (...points) => points },
      Image: 'Image', View: 'View', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } },
      InteractionManager: { runAfterInteractions: work => {
        const task = { work, cancelled: false, cancel() { this.cancelled = true; } };
        tasks.push(task); return task;
      } },
    },
    'expo-router': { useRootNavigationState: () => state.navigationReady ? { key: 'ready' } : null },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-notifications': { getLastNotificationResponseAsync: async () => { calls.push++; return response; } },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language } }) },
    '../src/components/ScaledText': { ScaledText: 'Text' },
    '../src/components/DataConsentModal': { DataConsentModal: 'ConsentModal', hasDataConsent: () => consent },
    '../src/features/auth/auth.store': { useAuthStore: select => select(state) },
    '../src/lib/notifications': { routeFromNotificationData: data => data.route },
    '../src/lib/voip': { getPendingVoipCall: async () => { calls.native++; return await call; } },
    '../src/styles': { spacing: { lg: 24 } },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => router },
  };
  for (const asset of ['asinu_splash_bg_vi.png', 'asinu_splash_bg_en.png', 'asinu_brand_logo.png']) {
    assert.ok(fs.existsSync(`assets/images/splash/${asset}`));
    imports[`../assets/images/splash/${asset}`] = asset;
  }
  const components = evaluate(`${read('app/index.tsx')}\nexport { LoadingDot };`, imports, {
    setTimeout: (work, delay = 0) => {
      const id = ++nextTimerId;
      timers.set(id, { work, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  const render = () => { cursor = 0; return components.default(); };
  const settle = async () => {
    render(); const effects = pending; pending = []; effects.forEach(work => work());
    await Promise.resolve(); await Promise.resolve();
    return render();
  };
  return { state, calls, render, settle,
    advanceTime: milliseconds => {
      const target = now + milliseconds;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].work();
      }
      now = target;
    },
    runTasks: async () => {
      const queued = tasks.splice(0);
      for (const task of queued) { if (!task.cancelled) await task.work(); }
    },
    dot: () => { cursor = 0; return components.LoadingDot({ delay: 200 }); },
    runEffects: () => { const effects = pending; pending = []; effects.forEach(work => work()); },
    unmount: () => { live = false; slots.forEach(slot => slot.cleanup?.()); },
  };
}
for (const language of ['vi', 'en-US']) await test(`${language}: splash uses its localized artwork without a duplicate logo overlay`, async () => {
  const h = splashHarness({ language });
  const tree = await h.settle();
  const images = nodes(tree).filter(node => node.type === 'Image');
  assert.equal(images[0].props.source, language === 'vi' ? 'asinu_splash_bg_vi.png' : 'asinu_splash_bg_en.png');
  assert.equal(images.length, 1);
  assert.equal(images[0].props.resizeMode, 'cover');
  assert.ok(nodes(tree).some(node => node.type === 'Text' && [node.props.children].flat().join('') === '100%'));
  h.advanceTime(1800); await h.settle(); await h.runTasks();
  assert.deepEqual(h.calls.routes, ['/login']); h.unmount();
});
await test('splash cannot navigate before consent, auth hydration and navigator are ready', async () => {
  let finishConsent;
  const consent = new Promise(resolve => { finishConsent = resolve; });
  const h = splashHarness({ consent, hydrated: false, loading: true, navigationReady: false });
  await h.settle(); await h.runTasks(); assert.deepEqual(h.calls.routes, []);
  h.advanceTime(1800); await h.settle(); await h.runTasks(); assert.deepEqual(h.calls.routes, []);
  finishConsent(false); await h.settle();
  h.state.hydrated = true; h.state.loading = false; h.state.navigationReady = true;
  const tree = await h.settle(); await h.runTasks(); assert.deepEqual(h.calls.routes, []);
  const modal = nodes(tree).find(node => node.type === 'ConsentModal');
  assert.equal(modal.props.visible, true);
  modal.props.onAgree(); await h.settle(); await h.runTasks();
  assert.deepEqual(h.calls.routes, ['/login']); h.unmount();
});
await test('splash preserves onboarding and Home routing after its minimum display time', async () => {
  for (const completed of [false, true]) {
    const h = splashHarness({ profile: { id: '7', onboardingCompleted: completed } });
    await h.settle(); await h.settle(); await h.runTasks();
    assert.deepEqual(h.calls.routes, []);
    h.advanceTime(1799); await h.settle(); await h.runTasks();
    assert.deepEqual(h.calls.routes, []);
    h.advanceTime(1); await h.settle(); await h.runTasks();
    assert.deepEqual(h.calls.routes, [completed ? '/(tabs)/home' : '/onboarding']); h.unmount();
  }
});
await test('leaving splash cancels its pending minimum-display timer', async () => {
  const h = splashHarness();
  await h.settle(); h.unmount(); h.advanceTime(1800);
  await h.runTasks(); assert.deepEqual(h.calls.routes, []);
});
await test('an answered CallKit call still outranks a stale notification tap on the new splash', async () => {
  const h = splashHarness({ profile: { id: '7', onboardingCompleted: true },
    call: { episodeId: 'episode', attemptId: 'attempt' },
    response: { notification: { date: Date.now() / 1000, request: { content: { data: { route: '/care-circle' } } } } } });
  await h.settle(); h.advanceTime(1800); await h.settle(); await h.runTasks();
  assert.deepEqual(h.calls.routes, [{ pathname: '/checkin-call/[episodeId]', params: {
    episodeId: 'episode', attemptId: 'attempt', nativeAnswered: '1',
  } }]);
  assert.equal(h.calls.push, 0); h.unmount();
});
await test('leaving splash during pending native recovery cannot navigate the unmounted route', async () => {
  let finish;
  const h = splashHarness({ profile: { id: '7', onboardingCompleted: true },
    call: new Promise(resolve => { finish = resolve; }) });
  await h.settle(); h.advanceTime(1800); await h.settle();
  const running = h.runTasks(); h.unmount(); finish({ episodeId: 'episode', attemptId: 'attempt' });
  await running; assert.deepEqual(h.calls.routes, []);
});
await test('updated loading-dot animation stops its loop on unmount', () => {
  const h = splashHarness(); h.dot(); h.runEffects();
  assert.equal(h.calls.loopStarts, 1); h.unmount();
  assert.equal(h.calls.loopStops, 1);
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
