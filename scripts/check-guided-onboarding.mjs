import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const read = file => fs.readFileSync(file, 'utf8');
function evaluateSource(source, imports = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports, id => {
    assert.ok(Object.hasOwn(imports, id), `Missing guidance adapter: ${id}`); return imports[id];
  }, ...Object.values(globals));
  return module.exports;
}
const evaluate = (file, imports = {}, globals = {}) => evaluateSource(read(file), imports, globals);
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const theme = evaluate('src/styles/theme.ts');
const model = evaluate('src/features/guidance/guidance.model.ts', { '../../styles/theme': theme });
const completedWelcome = () => ({ ...model.defaultProgress(), welcomeSeen: true, role: 'self' });

// Render the real provider and run its real effects, including narration.
function guidanceHarness(overrides = {}) {
  const slots = []; let cursor = 0, pending = [];
  const intervals = new Map(); let nextInterval = 0;
  const state = { hydrated: true, token: 'session', profile: { id: 'a', onboardingCompleted: true },
    path: '/home', foreground: true, modalBusy: false, ...overrides };
  const calls = { audio: [], updates: [], routes: [], stops: 0 };
  const backListeners = new Set();
  const translate = key => key;
  const router = { replace: route => calls.routes.push(route) };
  const memo = (work, deps) => {
    const index = cursor++, previous = slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  const progress = { account: 'a', ready: true, welcomeOpen: false, progress: model.defaultProgress(),
    setWelcomeOpen(open) { progress.welcomeOpen = open; },
    load() {}, refresh() {}, acknowledge(step) {
      progress.progress = model.mergeProgress(progress.progress, { completed: [step] });
    }, update(patch) {
      calls.updates.push(patch); progress.progress = model.mergeProgress(progress.progress, patch);
    }, ...overrides.guidance };
  const jsx = (type, props) => ({ type, props });
  const { GuidanceProvider } = evaluate('src/features/guidance/GuidanceProvider.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
      useRef: initial => slots[cursor++] ??= { current: initial },
      useState: initial => {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
      },
      useMemo: memo, useCallback: (work, deps) => memo(() => work, deps),
      useEffect: (work, deps) => {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          slots[index] = { deps };
          pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = work(); });
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { AppState: { currentState: state.foreground ? 'active' : 'background',
      addEventListener: () => ({ remove() {} }) }, Keyboard: { addListener: () => ({ remove() {} }) },
      BackHandler: { addEventListener: (_name, work) => {
        backListeners.add(work); return { remove: () => backListeners.delete(work) };
      } },
      Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
      StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 393, height: 852 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { usePathname: () => state.path, useIsFocused: () => true,
      useGlobalSearchParams: () => state.params ?? (state.path === '/checkin' ? { mode: 'guide' } : {}) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'react-i18next': { useTranslation: () => ({ t: translate, i18n: { language: 'vi' } }) },
    '../auth/auth.store': { useAuthStore: select => select(state) },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => router },
    '../../components/QueuedModal': { useQueuedModalBusy: () => state.modalBusy },
    '../../components/ScreenHeaderButton': { ScreenBackButton: 'ScreenBackButton' },
    './guidance.store': { useGuidanceStore: () => progress }, './guidance.model': model,
    './guidance.audio': { guidanceAudio: {
      speak: (...args) => { calls.audio.push(args); return overrides.audio?.speak(...args); },
      stop: async () => { calls.stops++; await overrides.audio?.stop(); },
    } },
    '../../../assets/asinu_chat_sticker.png': 'mascot',
  }, { setInterval: work => { const id = ++nextInterval; intervals.set(id, work); return id; },
    clearInterval: id => intervals.delete(id) });
  const render = () => { cursor = 0; return GuidanceProvider({ children: 'App' }); };
  return { state, progress, calls, backListeners, measure: () => [...intervals.values()].forEach(work => work()), async settle() {
    let tree;
    for (let pass = 0; pass < 4; pass++) {
      tree = render(); const effects = pending; pending = []; effects.forEach(work => work()); await tick();
    }
    return tree;
  }, unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
const nodes = tree => !tree || typeof tree !== 'object' ? []
  : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const flattenStyle = style => Array.isArray(style)
  ? Object.assign({}, ...style.filter(Boolean).map(flattenStyle)) : style || {};
const buttonStyle = (button, pressed = false) => flattenStyle(typeof button.props.style === 'function'
  ? button.props.style({ pressed }) : button.props.style);
const nativeButton = node => typeof node.type === 'function' ? nativeButton(node.type(node.props)) : node;
function assertBrandButton(button) {
  const style = buttonStyle(button);
  assert.equal(style.backgroundColor, theme.lightColors.primary);
  assert.ok(style.minHeight >= 56);
  for (const node of nodes(button)) {
    if (node.type === 'Text') {
      const label = flattenStyle(node.props.style);
      assert.equal(label.color, model.guideColors.onAction); assert.ok(label.fontSize >= 22);
      assert.equal(node.props.allowFontScaling, true);
    }
    if (node.type === 'Icon' || node.type === 'Spinner') assert.equal(node.props.color, model.guideColors.onAction);
  }
}
function controlHarness(file, imports = {}) {
  const slots = []; let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const components = evaluate(file, {
    react: { useEffect() {}, useRef: value => slots[cursor++] ??= { current: value },
      useState: initial => {
        const index = cursor++; slots[index] ??= { value: initial };
        return [slots[index].value, value => { slots[index].value = value; }];
      } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', View: 'View', Text: 'Text', Switch: 'Switch',
      ActivityIndicator: 'Spinner', StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { useIsFocused: () => true },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language: 'vi' } }) },
    './guidance.model': model,
    ...imports,
  });
  return { render(name, props = {}) { cursor = 0; return components[name](props); } };
}

await test('welcome and its narration stay hidden until authenticated profile onboarding is complete', async () => {
  for (const state of [
    { profile: null, token: null }, { token: null }, { hydrated: false },
    { profile: { id: 'a', onboardingCompleted: false } }, { profile: { id: 'a' } },
    { path: '/' }, { path: '/login' }, { path: '/login/email' }, { path: '/register' },
    { path: '/onboarding' }, { path: '/auth/google/callback' },
    { guidance: { ready: false } }, { guidance: { account: 'another-account' } },
    { modalBusy: true }, { foreground: false }, { path: '/checkin-call/episode' },
  ]) {
    const h = guidanceHarness(state); const tree = await h.settle();
    assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false, JSON.stringify(state));
    assert.deepEqual(h.calls.audio, [], JSON.stringify(state)); assert.deepEqual(h.calls.updates, []);
    h.unmount();
  }
});
await test('finishing onboarding opens the welcome and reads it once, then the account role starts its tour', async () => {
  for (const role of ['self', 'caregiver']) {
    const h = guidanceHarness({ path: '/onboarding', profile: { id: 'a', onboardingCompleted: false } });
    await h.settle(); assert.deepEqual(h.calls.audio, []);
    h.state.profile = { id: 'a', onboardingCompleted: true };
    await h.settle(); assert.deepEqual(h.calls.audio, []);
    h.state.path = '/home'; const tree = await h.settle();
    assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), true);
    assert.deepEqual(h.calls.audio, [['welcome', 'vi']]);
    await h.settle(); assert.equal(h.calls.audio.length, 1);
    const button = nodes(tree).find(node => node.props?.label === `guidance.${role === 'self' ? 'roleSelf' : 'roleCaregiver'}`);
    await button.props.onPress();
    assert.deepEqual(h.calls.updates, [{ welcomeSeen: true }, { role, welcomeSeen: true }]);
    await h.settle(); assert.equal(h.progress.welcomeOpen, false);
    assert.deepEqual(h.calls.routes, [role === 'self' ? '/(tabs)/home' : '/(tabs)/care-circle']);
    h.unmount();
  }
});
await test('welcome Back uncovers the app, remembers its display and never chooses a role or completes coach steps', async () => {
  for (const path of ['/home', '/care-circle']) {
    const h = guidanceHarness({ path });
    let tree = await h.settle();
    const back = nodes(tree).find(node => node.type === 'ScreenBackButton');
    assert.ok(back); assert.equal(flattenStyle(back.props.style).width, 56);
    assert.equal(flattenStyle(back.props.style).height, 56);
    const header = nodes(tree).find(node => node.type === 'View' && nodes(node).includes(back)
      && flattenStyle(node.props.style).position === 'absolute' && flattenStyle(node.props.style).left === 24);
    assert.ok(header); assert.equal(flattenStyle(header.props.style).top, 67);
    assert.equal(flattenStyle(header.props.style).left, 24);
    const stops = h.calls.stops;
    for (let tap = 0; tap < 50; tap++) back.props.onPress();
    tree = await h.settle();
    assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false);
    assert.equal(nodes(tree).some(node => node.props?.importantForAccessibility === 'no-hide-descendants'), false);
    assert.ok(h.calls.stops > stops); assert.equal(h.calls.audio.length, 1);
    assert.deepEqual(h.calls.updates, [{ welcomeSeen: true }]); assert.deepEqual(h.calls.routes, []);
    assert.equal(h.progress.progress.role, null); assert.equal(h.progress.progress.welcomeSeen, true);
    assert.deepEqual(h.progress.progress.completed, []); assert.equal(h.progress.welcomeOpen, false);
    assert.equal(h.backListeners.size, 0);
    h.state.path = path === '/home' ? '/care-circle' : '/home'; await h.settle();
    assert.equal(h.calls.audio.length, 1, 'a tab change must not reopen a dismissed welcome');
    h.unmount();
  }
});
await test('Android hardware Back dismisses only the welcome and releases its handler', async () => {
  const h = guidanceHarness(); await h.settle();
  assert.equal(h.backListeners.size, 1);
  assert.equal([...h.backListeners][0](), true);
  const tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.type === 'ScreenBackButton'), false);
  assert.equal(h.backListeners.size, 0);
  assert.deepEqual(h.calls.routes, []); assert.deepEqual(h.calls.updates, [{ welcomeSeen: true }]);
  h.unmount();
});
await test('a seen welcome cannot return on sign-in, and reopens only for a new account or explicit replay', async () => {
  const h = guidanceHarness();
  let tree = await h.settle(); nodes(tree).find(node => node.type === 'ScreenBackButton').props.onPress();
  tree = await h.settle(); assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false);
  h.progress.progress = { ...model.defaultProgress(), epoch: 1 }; tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props?.source === 'mascot'), 'explicit replay reopens welcome');
  nodes(tree).find(node => node.type === 'ScreenBackButton').props.onPress(); await h.settle();
  h.state.profile = { id: 'b', onboardingCompleted: true }; h.progress.account = 'b';
  h.progress.progress = model.defaultProgress();
  tree = await h.settle(); assert.ok(nodes(tree).some(node => node.props?.source === 'mascot'));
  nodes(tree).find(node => node.type === 'ScreenBackButton').props.onPress(); await h.settle();
  h.state.token = 'new-session'; tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false, 'sign-in is not an explicit guide replay');
  assert.deepEqual(h.calls.updates, Array(3).fill({ welcomeSeen: true })); h.unmount();
});
await test('simply seeing the welcome is remembered on provider reload without requiring Back or a role choice', async () => {
  const first = guidanceHarness(); const firstTree = await first.settle();
  assert.ok(nodes(firstTree).some(node => node.props?.source === 'mascot'), 'saving seen must keep the initial role choice open');
  assert.equal(first.progress.welcomeOpen, true);
  assert.equal(first.progress.progress.welcomeSeen, true);
  assert.equal(first.progress.progress.role, null);
  assert.deepEqual(first.calls.updates, [{ welcomeSeen: true }]);
  const saved = first.progress.progress;
  first.unmount(); assert.equal(first.progress.welcomeOpen, false);
  const reloaded = guidanceHarness({ guidance: { progress: saved } });
  const tree = await reloaded.settle();
  assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false);
  assert.deepEqual(reloaded.calls.audio, []); assert.deepEqual(reloaded.calls.updates, []);
  reloaded.unmount();
});
await test('an urgent modal can suspend the first welcome without forgetting it or repeating its narration', async () => {
  const h = guidanceHarness(); await h.settle();
  assert.equal(h.progress.welcomeOpen, true);
  h.state.modalBusy = true;
  let tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false);
  assert.equal(h.progress.welcomeOpen, false);
  h.state.modalBusy = false; tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props?.source === 'mascot'));
  assert.equal(h.progress.welcomeOpen, true);
  assert.deepEqual(h.calls.audio, [['welcome', 'vi']]);
  assert.deepEqual(h.calls.updates, [{ welcomeSeen: true }]);
  h.unmount();
});
await test('saving welcome-seen on display cannot unlock notification prompts while role selection is still open', () => {
  const source = ts.createSourceFile('SessionProvider.tsx', read('src/providers/SessionProvider.tsx'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selector;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'guidanceWelcomed') {
      selector = node.initializer.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(selector);
  const gate = evaluateSource(`module.exports = ${selector};`, {}, { profile: { id: 'a' } });
  const state = { account: 'a', ready: true, welcomeOpen: true, progress: { welcomeSeen: true } };
  assert.equal(gate(state), false);
  assert.equal(gate({ ...state, welcomeOpen: false }), true);
  assert.equal(gate({ ...state, welcomeOpen: false, account: 'b' }), false);
  assert.equal(gate({ ...state, welcomeOpen: false, ready: false }), false);
});
await test('completed account welcome stays completed and anonymous device state is never imported', async () => {
  const h = guidanceHarness({ guidance: { progress: completedWelcome() } });
  const tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.source === 'mascot'), false);
  assert.deepEqual(h.calls.audio, []); assert.deepEqual(h.calls.updates, []); h.unmount();
  assert.doesNotMatch(read('src/features/guidance/GuidanceProvider.tsx'), /anonymous|AsyncStorage/);
});
await test('coach marks cannot leak onto auth or profile onboarding from a registered target', async () => {
  for (const path of ['/login', '/onboarding', '/register', '/checkin-call/episode']) {
    const h = guidanceHarness({ path, guidance: { progress: completedWelcome() } });
    const tree = await h.settle();
    tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, 160, 300, 70) } } });
    await h.settle(); assert.deepEqual(h.calls.audio, []); h.unmount();
  }
});
await test('even a previously welcomed account needs completed onboarding before its real home target is guided', async () => {
  for (const completed of [undefined, false, true]) {
    const h = guidanceHarness({ profile: { id: 'a', onboardingCompleted: completed },
      guidance: { progress: completedWelcome() } });
    const tree = await h.settle();
    tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, 160, 300, 70) } } });
    const guided = await h.settle();
    assert.deepEqual(h.calls.audio, completed === true ? [['home.fine', 'vi']] : []);
    assert.equal(nodes(guided).some(node => node.props?.children === 'guidance.steps.home_fine'), completed === true);
    h.unmount();
  }
});
await test('email and social sign-in both route unfinished accounts through profile onboarding', () => {
  const source = read('app/login/email.tsx');
  const ast = ts.createSourceFile('login.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let navigate;
  const find = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'navigateAfterLogin') navigate = node.initializer.getText(ast);
    ts.forEachChild(node, find);
  };
  find(ast); assert.ok(navigate);
  for (const completed of [undefined, false, true]) {
    const routes = [];
    // Execute the checked-in login handler with isolated store/router adapters.
    // eslint-disable-next-line no-new-func
    const run = new Function('useAuthStore', 'router', `return (${navigate})();`);
    run({ getState: () => ({ profile: { onboardingCompleted: completed } }) }, { replace: route => routes.push(route) });
    assert.deepEqual(routes, [completed === true ? '/(tabs)/home' : '/onboarding']);
  }
  assert.equal((source.match(/navigateAfterLogin\(\);/g) || []).length, 2);
});
await test('focus-aware guidance uses the installed Expo Router API', () => {
  for (const file of ['src/features/guidance/GuidanceProvider.tsx', 'src/features/guidance/VoiceAnswerButton.tsx']) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const focusImport = ast.statements.find(node => ts.isImportDeclaration(node)
      && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && node.importClause.namedBindings.elements.some(element => (element.propertyName || element.name).text === 'useIsFocused'));
    assert.ok(focusImport, `${file}: missing focus hook`);
    assert.equal(focusImport.moduleSpecifier.text, 'expo-router', `${file}: incompatible focus provider`);
  }
  const exports = read('node_modules/expo-router/build/exports.d.ts');
  assert.match(exports, /export\s*\{\s*useIsFocused\s*\}/);
});
await test('application code never imports external React Navigation packages on SDK 56+', () => {
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!/\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.d.ts')) continue;
      const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true,
        /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const check = node => {
        if (ts.isStringLiteralLike(node) && node.text.startsWith('@react-navigation/')) {
          const parent = node.parent;
          const moduleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
            && parent.moduleSpecifier === node;
          const moduleCall = ts.isCallExpression(parent)
            && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || parent.expression.getText(ast) === 'require')
            && parent.arguments[0] === node;
          assert.ok(!moduleSpecifier && !moduleCall, `${file}: import ${node.text} through Expo Router instead`);
        }
        ts.forEachChild(node, check);
      };
      check(ast);
    }
  };
  visit('app'); visit('src');
});
await test('home teaches only its two real controls, not later questions', () => {
  let progress = completedWelcome();
  assert.equal(model.nextGuideStep(progress, ['home.fine', 'home.unwell', 'home.suggestions']), 'home.fine');
  progress = model.mergeProgress(progress, { completed: ['home.fine'] });
  assert.equal(model.nextGuideStep(progress, ['home.fine', 'home.unwell', 'home.suggestions']), 'home.unwell');
  progress = model.mergeProgress(progress, { completed: ['home.unwell'] });
  assert.equal(model.nextGuideStep(progress, ['home.suggestions']), undefined);
  progress = model.mergeProgress(progress, { firstCheckin: true });
  assert.equal(model.nextGuideStep(progress, ['home.suggestions']), 'home.suggestions');
});
await test('answer choices precede Other and only appear when their actual targets exist', () => {
  const progress = completedWelcome();
  assert.equal(model.nextGuideStep(progress, []), undefined);
  assert.equal(model.nextGuideStep(progress, ['checkin.other']), undefined);
  assert.equal(model.nextGuideStep(progress, ['checkin.choices', 'checkin.other']), 'checkin.choices');
  assert.equal(model.nextGuideStep(model.mergeProgress(progress, { completed: ['checkin.choices'] }), ['checkin.other']), 'checkin.other');
});
await test('a text-only question guides typing or speaking without consuming the later choice guide', async () => {
  const h = guidanceHarness({ path: '/checkin', guidance: { progress: completedWelcome() } });
  let tree = await h.settle();
  const node = { current: { measureInWindow: work => work(20, 180, 300, 90) } };
  const remove = tree.props.value.register('checkin.other', { node, withoutChoices: true });
  tree = await h.settle();
  assert.ok(nodes(tree).some(item => item.props?.children === 'guidance.steps.checkin_other'));
  assert.deepEqual(h.calls.audio, [['checkin.other', 'vi']]);
  tree.props.value.acknowledge('checkin.other');
  assert.ok(!h.progress.progress.completed.includes('checkin.choices'));
  remove(); tree.props.value.register('checkin.choices', { node });
  tree = await h.settle();
  assert.ok(nodes(tree).some(item => item.props?.children === 'guidance.steps.checkin_choices'));
  assert.deepEqual(h.calls.audio.at(-1), ['checkin.choices', 'vi']);
  h.unmount();
});
await test('real symptom guides cover single, multiple, grouped, empty-group and text-only answer layouts', () => {
  const file = ts.createSourceFile('checkin.tsx', read('app/checkin/index.tsx'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TriageScreen');
  assert.ok(component);
  const jsx = (type, props) => ({ type, props });
  const animation = { duration: () => animation, delay: () => animation };
  const TriageScreen = evaluateSource(`${component.getText(file)}\nmodule.exports = TriageScreen;`, {
    'react/jsx-runtime': { jsx, jsxs: jsx },
  }, { View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', ActivityIndicator: 'Spinner',
    Ionicons: 'Icon', MaterialCommunityIcons: 'Icon', Animated: { View: 'Animated' },
    FadeIn: animation, FadeInDown: animation, FadeInLeft: animation, GuideTarget: 'GuideTarget', VoiceAnswerButton: 'VoiceAnswerButton',
    colors: theme.lightColors, spacing: theme.spacing, MAX_TRIAGE_QUESTIONS: 10,
    useTranslation: () => ({ t: key => key }), useLanguageStore: () => ({ language: 'vi' }), useGuideAcknowledgement: () => () => {},
    useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {} });
  const defaults = { styles: {}, question: 'question', answers: [], options: ['first', 'second'], practice: true,
    optionsGrouped: null, loading: false, multiSelect: false, allowFreeText: false, onBeforeAi: async () => true };
  for (const [name, overrides, expectedOther, expectedChoices] of [
    ['single', {}, false, true],
    ['multiple', { multiSelect: true }, true, true],
    ['optional text', { allowFreeText: true }, true, true],
    ['empty first group', { optionsGrouped: [{ key: 'empty', label: 'empty', items: [] },
      { key: 'actual', label: 'actual', items: ['first'] }] }, false, true],
    ['all groups empty', { optionsGrouped: [{ key: 'empty', label: 'empty', items: [] }] }, false, true],
    ['text only', { options: [] }, true, false],
    ['loading', { loading: true }, false, false],
  ]) {
    const answers = [];
    const tree = TriageScreen({ ...defaults, ...overrides, onAnswer: answer => answers.push(answer) });
    const guides = nodes(tree).filter(node => node.type === 'GuideTarget' && node.props.enabled);
    const choices = guides.filter(node => node.props.step === 'checkin.choices');
    const other = guides.find(node => node.props.step === 'checkin.other');
    assert.equal(choices.length, expectedChoices ? 1 : 0, name);
    assert.equal(Boolean(other), expectedOther, name);
    if (other) assert.equal(other.props.withoutChoices, !expectedChoices, name);
    if (expectedChoices && !overrides.multiSelect) {
      nodes(choices[0]).find(node => node.type === 'Pressable').props.onPress();
      assert.deepEqual(answers, ['first'], `${name}: guidance must preserve the actual answer action`);
    }
  }
});
await test('the real first check-in screen guides all three health choices without changing their actions', () => {
  const file = ts.createSourceFile('checkin.tsx', read('app/checkin/index.tsx'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statusScreen = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'StatusScreen');
  assert.ok(statusScreen);
  const jsx = (type, props) => ({ type, props });
  const animation = { duration: () => animation, delay: () => animation };
  const statuses = ['fine', 'tired', 'very_tired'].map(status => ({ status }));
  const StatusScreen = evaluateSource(`${statusScreen.getText(file)}\nmodule.exports = StatusScreen;`, {
    'react/jsx-runtime': { jsx, jsxs: jsx },
  }, { View: 'View', Text: 'Text', MaterialCommunityIcons: 'Icon', Animated: { View: 'Animated' },
    FadeIn: animation, FadeInDown: animation, GuideTarget: 'GuideTarget', CheckinStatusChoice: 'StatusChoice',
    CHECKIN_STATUS_CHOICES: statuses, useTranslation: () => ({ t: key => key }) });
  const selected = [], onSelect = status => selected.push(status);
  const tree = StatusScreen({ styles: { optionList: 'optionList' }, onSelect, isFollowUp: false, practice: true });
  const guide = nodes(tree).find(node => node.type === 'GuideTarget' && node.props.step === 'checkin.status');
  assert.ok(guide, 'Opening from Không ổn must immediately have a real, measurable answer target');
  const choices = nodes(guide).filter(node => node.type === 'StatusChoice');
  assert.deepEqual(choices.map(node => node.props.choice.status), statuses.map(choice => choice.status));
  for (const choice of choices) choice.props.onSelect(choice.props.choice.status);
  assert.deepEqual(selected, ['fine', 'tired', 'very_tired']);
});
await test('Không ổn teaches each real check-in phase independently instead of consuming the later question guide', async () => {
  const h = guidanceHarness({ guidance: { progress: { ...completedWelcome(), completed: ['home.fine'] } } });
  let tree = await h.settle();
  const target = () => ({ node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  const removeHome = tree.props.value.register('home.unwell', target());
  tree = await h.settle(); assert.deepEqual(h.calls.audio, [['home.unwell', 'vi']]);
  tree.props.value.acknowledge('home.unwell'); removeHome(); h.state.path = '/checkin';
  for (const step of ['checkin.status', 'checkin.location', 'checkin.location_other', 'checkin.choices', 'checkin.other']) {
    tree.props.value.register(step, target()); tree = await h.settle();
    assert.equal(nodes(tree).some(node => node.props?.children === `guidance.steps.${step.replace('.', '_')}`), true);
    assert.deepEqual(h.calls.audio.at(-1), [step, 'vi']);
    tree.props.value.acknowledge(step);
    if (step === 'checkin.location_other') {
      assert.ok(!h.progress.progress.completed.includes('checkin.choices'));
      assert.ok(!h.progress.progress.completed.includes('checkin.other'));
    }
  }
  const readings = h.calls.audio.length; await h.settle();
  assert.equal(h.calls.audio.length, readings);
  assert.ok(h.progress.progress.completed.includes('checkin.choices'));
  assert.ok(h.progress.progress.completed.includes('checkin.other'));
  h.unmount();
});
await test('existing symptom-guide completion does not suppress the newly independent entry and location coaches', () => {
  let progress = model.mergeProgress(completedWelcome(), { completed: ['checkin.choices', 'checkin.other'] });
  assert.equal(model.nextGuideStep(progress, ['checkin.status']), 'checkin.status');
  progress = model.mergeProgress(progress, { completed: ['checkin.status'] });
  assert.equal(model.nextGuideStep(progress, ['checkin.location', 'checkin.location_other']), 'checkin.location');
  progress = model.mergeProgress(progress, { completed: ['checkin.location'] });
  assert.equal(model.nextGuideStep(progress, ['checkin.location_other']), 'checkin.location_other');
});
await test('real status, location and symptom-question screens register different guide identities', () => {
  const file = ts.createSourceFile('checkin.tsx', read('app/checkin/index.tsx'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expected = { StatusScreen: ['checkin.status'], LocationScreen: ['checkin.location', 'checkin.location_other', 'checkin.voice', 'checkin.location_confirm'],
    TriageScreen: ['checkin.choices', 'checkin.other', 'checkin.voice', 'checkin.confirm'] };
  for (const [name, ids] of Object.entries(expected)) {
    const component = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(component);
    const registered = new Set();
    const visit = node => {
      if (ts.isJsxAttribute(node) && node.name.getText(file) === 'step' && ts.isStringLiteral(node.initializer)) {
        registered.add(node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(component);
    assert.deepEqual([...registered].sort(), [...ids].sort(), name);
  }
});
await test('care-circle steps follow actual form progress without a five-step blocking tour', () => {
  let progress = completedWelcome();
  for (const id of ['circle.add', 'circle.phone', 'circle.relationship', 'circle.send', 'circle.member']) {
    assert.equal(model.nextGuideStep(progress, [id]), id);
    progress = model.mergeProgress(progress, { completed: [id] });
    assert.equal(model.nextGuideStep(progress, [id]), undefined);
  }
});
await test('automatic check-in guidance is limited to the first visit in the current account tour', () => {
  const state = { userId: 'a', account: 'a', ready: true, progress: completedWelcome() };
  const { useCheckinPracticeEntry } = evaluate('src/features/guidance/useCheckinPracticeEntry.ts', {
    '../auth/auth.store': { useAuthStore: select => select({ profile: { id: state.userId } }) },
    './guidance.store': { useGuidanceStore: select => select(state) },
  });
  assert.equal(useCheckinPracticeEntry(), true);
  state.progress = model.mergeProgress(state.progress, { completed: ['checkin.practice'] });
  assert.equal(useCheckinPracticeEntry(), false, 'Leaving the first guide early must not force it on the next check-in');
  state.progress = { ...completedWelcome(), completed: ['checkin.finished'] };
  assert.equal(useCheckinPracticeEntry(), false, 'Previously finished tours stay finished');
  state.progress = { ...completedWelcome(), firstCheckin: true };
  assert.equal(useCheckinPracticeEntry(), false, 'Existing real check-ins must not become examples');
  state.progress = { ...state.progress, epoch: 1 };
  assert.equal(useCheckinPracticeEntry(), true, 'An explicit full-tour replay still includes check-in');
  state.ready = false; assert.equal(useCheckinPracticeEntry(), false);
  state.ready = true; state.account = 'b'; assert.equal(useCheckinPracticeEntry(), false);
  state.account = 'a'; state.progress.welcomeSeen = false; assert.equal(useCheckinPracticeEntry(), false);
});
await test('normal check-in cannot display or narrate leftover guide targets, even with an unfinished practice scope', async () => {
  const h = guidanceHarness({ path: '/checkin', params: { mode: 'guide' }, guidance: { progress: completedWelcome() } });
  let tree = await h.settle(); tree.props.value.beginPractice('first-visit');
  tree.props.value.register('checkin.status', { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'));
  for (const mode of [undefined, 'random', 'followup', 'result_preview']) {
    h.state.params = mode ? { mode } : {};
    const before = h.calls.audio.length;
    tree = await h.settle();
    assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'), false);
    tree.props.value.acknowledge('checkin.status');
    assert.equal(h.calls.audio.length, before);
    assert.deepEqual(h.progress.progress.completed, []);
  }
  h.state.params = { mode: 'guide' };
  tree = await h.settle(); tree.props.value.beginPractice('explicit-replay');
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'));
  assert.deepEqual(h.calls.audio.at(-1), ['checkin.status', 'vi']);
  h.unmount();
});
await test('practice coaches keep every acknowledgement in memory, even for an already-completed account', async () => {
  const saved = { ...completedWelcome(), completed: [...model.GUIDE_STEPS] };
  const h = guidanceHarness({ path: '/checkin', guidance: { progress: saved } });
  let tree = await h.settle(); tree.props.value.beginPractice('first-run');
  tree.props.value.register('checkin.status', { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  tree = await h.settle(); assert.deepEqual(h.calls.audio, [['checkin.status', 'vi']]);
  tree.props.value.acknowledge('checkin.status'); tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'), false);
  assert.deepEqual(h.calls.updates, []); assert.equal(h.progress.progress, saved);
  tree.props.value.beginPractice('second-run'); tree = await h.settle();
  assert.deepEqual(h.calls.audio, [['checkin.status', 'vi'], ['checkin.status', 'vi']]);
  tree.props.value.endPractice('first-run'); tree = await h.settle(); // A stale unmount cannot close the new run.
  assert.ok(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'));
  tree.props.value.endPractice('second-run'); tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'), false);
  assert.equal(h.progress.progress, saved); h.unmount();
});
await test('practice does not require online guidance progress and resumes quietly after a real call interrupts it', async () => {
  const h = guidanceHarness({ path: '/checkin', guidance: { ready: false } });
  let tree = await h.settle(); tree.props.value.beginPractice('offline-run');
  tree.props.value.register('checkin.status', { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  tree = await h.settle(); assert.deepEqual(h.calls.audio, [['checkin.status', 'vi']]);
  h.state.modalBusy = true; tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'), false);
  h.state.modalBusy = false; tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props?.children === 'guidance.steps.checkin_status'));
  assert.equal(h.calls.audio.length, 1); assert.deepEqual(h.calls.updates, []); h.unmount();
});
await test('all fixed Vietnamese coach sentences are short, everyday, and non-clinical', () => {
  const strings = JSON.parse(read('src/i18n/locales/vi/onboarding.json')).guidance.steps;
  for (const id of model.GUIDE_STEPS) {
    const text = strings[id.replace('.', '_')];
    assert.ok(text); assert.ok(text.trim().split(/\s+/).length <= 15, `${id}: too long`);
    assert.doesNotMatch(text, /check-in|chẩn đoán|điều trị|kê đơn|\bbác\b/i);
    assert.equal((text.match(/[.!?]/g) || []).length, 1, id);
  }
});
await test('check-in guidance uses friendly, contextual copy without internal practice or storage warnings', () => {
  for (const language of ['vi', 'en']) {
    const { guidance } = JSON.parse(read(`src/i18n/locales/${language}/onboarding.json`));
    const visible = [...Object.entries(guidance).filter(([key]) => key.startsWith('practice')).map(([, value]) => value),
      ...Object.values(guidance.steps)];
    for (const text of visible) {
      assert.doesNotMatch(text, /thực hành|không (?:được )?lưu|\bpractice\b|not saved|câu giống với bạn|best describes you/i);
    }
    assert.equal(new Set(['checkin_status', 'checkin_location', 'checkin_choices']
      .map(key => guidance.steps[key])).size, 3, 'each screen needs its own contextual instruction');
    for (const key of ['practiceVariantLow', 'practiceVariantMedium', 'practiceVariantHigh', 'practiceVariantEmergency']) {
      assert.ok(guidance[key]?.trim(), `${language}/${key}`);
    }
  }
});
const luminance = hex => {
  const rgb = hex.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
await test('guide text and button labels exceed 7:1 contrast', () => {
  const colors = model.guideColors;
  for (const [fg, bg] of [[colors.ink, colors.background], [colors.primary, colors.background],
    [colors.onPrimary, colors.primary], [colors.onAction, colors.actionBackground]]) {
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 7);
  }
});

await test('the rendered Understood button uses the shared Asinu brand green with a readable large label', async () => {
  const h = guidanceHarness({ guidance: { progress: completedWelcome() } });
  let tree = await h.settle();
  tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  tree = await h.settle();
  const component = nodes(tree).find(node => node.props?.label === 'guidance.understood');
  assert.ok(component);
  const button = component.type(component.props);
  const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style;
  const style = flatten(button.props.style({ pressed: false }));
  const label = nodes(button).find(node => node.type === 'Text');
  assert.equal(style.backgroundColor, theme.lightColors.primary);
  assert.ok(style.minHeight >= 56); assert.ok(flatten(label.props.style).fontSize >= 22);
  assert.equal(flatten(label.props.style).color, model.guideColors.onAction);
  button.props.onPress(); await h.settle();
  assert.ok(h.progress.progress.completed.includes('home.fine'));
  h.unmount();
});
await test('both welcome roles and Replay use the same brand button as every coach step', async () => {
  const welcome = guidanceHarness(); const welcomeTree = await welcome.settle();
  const actions = nodes(welcomeTree).filter(node => ['GuideButton', 'GuideReplay'].includes(node.type?.name));
  assert.equal(actions.length, 3);
  for (const action of actions) assertBrandButton(nativeButton(action));
  welcome.unmount();
  for (const step of model.GUIDE_STEPS) {
    const h = guidanceHarness({ path: step.startsWith('checkin.') ? '/checkin'
      : step.startsWith('circle.') ? '/care-circle' : '/home',
      guidance: { progress: { ...completedWelcome(), firstCheckin: true,
        completed: model.GUIDE_STEPS.filter(id => id !== step) } } });
    let tree = await h.settle();
    tree.props.value.register(step, { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
    tree = await h.settle();
    const buttons = nodes(tree).filter(node => ['GuideButton', 'GuideReplay'].includes(node.type?.name));
    assert.equal(buttons.length, 2, step);
    for (const action of buttons) {
      const button = nativeButton(action); assertBrandButton(button);
      assert.equal(buttonStyle(button, true).opacity, 0.8);
    }
    h.unmount();
  }
});
await test('Replay is icon-only, named for accessibility and balanced with Understood on small scaled screens', async () => {
  const h = guidanceHarness({ guidance: { progress: completedWelcome() } });
  let tree = await h.settle();
  tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, 180, 300, 90) } } });
  tree = await h.settle();
  const row = nodes(tree).find(node => node.type === 'View'
    && flattenStyle(node.props.style).flexDirection === 'row'
    && nodes(node).some(child => child.type?.name === 'GuideReplay')
    && nodes(node).some(child => child.props?.label === 'guidance.understood'));
  assert.ok(row);
  const replay = nativeButton(nodes(row).find(node => node.type?.name === 'GuideReplay'));
  const understood = nativeButton(nodes(row).find(node => node.props?.label === 'guidance.understood'));
  assert.equal(nodes(replay).some(node => node.type === 'Text'), false);
  assert.equal(replay.props.accessibilityRole, 'button');
  assert.equal(replay.props.accessibilityLabel, 'guidance.replayAudio');
  assert.equal(buttonStyle(replay).width, 60); assert.ok(buttonStyle(replay).minHeight >= 56);
  assert.equal(buttonStyle(replay).height, undefined); assert.equal(buttonStyle(replay).alignSelf, 'stretch');
  assert.equal(buttonStyle(understood).flex, 1); assert.equal(buttonStyle(understood).width, undefined);
  assert.equal(flattenStyle(row.props.style).alignItems, 'stretch');
  for (const width of [320, 393, 430]) {
    const available = width - 24 - 40; // Screen margins and bubble padding.
    const labelWidth = available - buttonStyle(replay).width - flattenStyle(row.props.style).gap;
    assert.ok(labelWidth >= 56);
    assert.equal(nodes(understood).find(node => node.type === 'Text').props.allowFontScaling, true);
  }
  replay.props.onPress();
  assert.deepEqual(h.calls.audio.at(-1), ['home.fine', 'vi', true]);
  h.unmount();
});
await test('voice Start, Stop and transcription states retain brand colors and their existing recording actions', async () => {
  const transcript = deferred(), texts = [], events = [];
  const h = controlHarness('src/features/guidance/VoiceAnswerButton.tsx', {
    '../../lib/audio': { Audio: { requestPermissionsAsync: async () => ({ granted: true }), setAudioModeAsync: async () => {},
      RecordingOptionsPresets: { HIGH_QUALITY: {} }, Recording: { createAsync: async () => ({ recording: {
        getURI: () => 'recording.m4a', stopAndUnloadAsync: async () => events.push('stop'),
      } }) } } },
    '../chat/chat.api': { chatApi: { transcribeAudio: () => transcript.promise } },
    '../../stores/toast.store': { showToast: () => assert.fail('Unexpected voice failure') },
    './guidance.audio': { guidanceAudio: { stop: async () => events.push('stop-guide') } },
  });
  const props = { onText: text => texts.push(text), onBeforeAi: async () => true };
  let button = h.render('VoiceAnswerButton', props); assertBrandButton(button);
  assert.equal(button.props.accessibilityLabel, 'guidance.speak');
  assert.equal(buttonStyle(button, true).opacity, 0.8);
  button.props.onPress(); await tick();
  button = h.render('VoiceAnswerButton', props); assertBrandButton(button);
  assert.equal(button.props.accessibilityLabel, 'guidance.stopRecording');
  button.props.onPress(); await tick();
  button = h.render('VoiceAnswerButton', props); assertBrandButton(button);
  assert.equal(button.props.disabled, true); assert.equal(button.props.accessibilityState.busy, true);
  assert.equal(buttonStyle(button).opacity, 0.5);
  transcript.resolve('Tôi hơi mệt'); await tick();
  button = h.render('VoiceAnswerButton', props); assertBrandButton(button);
  assert.equal(button.props.disabled, false); assert.deepEqual(texts, ['Tôi hơi mệt']);
  assert.deepEqual(events, ['stop-guide', 'stop-guide', 'stop']);
  button = h.render('VoiceAnswerButton', { ...props, disabled: true }); assertBrandButton(button);
  assert.equal(button.props.disabled, true); assert.equal(buttonStyle(button).opacity, 0.5);
});
await test('practice Speak and Done use example text, never recording, permission, transcription or consent APIs', async () => {
  const texts = [], notices = [];
  const h = controlHarness('src/features/guidance/VoiceAnswerButton.tsx', {
    '../../lib/audio': { Audio: new Proxy({}, { get() { assert.fail('Practice cannot use microphone APIs'); } }) },
    '../chat/chat.api': { chatApi: { transcribeAudio: () => assert.fail('Practice cannot upload audio') } },
    '../../stores/toast.store': { showToast: message => notices.push(message) },
    './guidance.audio': { guidanceAudio: { stop: async () => {} } },
  });
  const props = { practice: true, onText: text => texts.push(text), onBeforeAi: () => assert.fail('Practice cannot request AI consent') };
  let button = h.render('VoiceAnswerButton', props); button.props.onPress(); await tick();
  button = h.render('VoiceAnswerButton', props); assert.equal(button.props.accessibilityLabel, 'guidance.stopRecording');
  assert.deepEqual(texts, []); button.props.onPress(); await tick();
  button = h.render('VoiceAnswerButton', props); assert.equal(button.props.accessibilityLabel, 'guidance.speak');
  assert.deepEqual(texts, ['guidance.practiceVoiceExample']); assert.deepEqual(notices, ['guidance.practiceVoiceNotice']);
});
await test('guide replay is a neutral settings row with no read-aloud switch and preserves its loading behavior', async () => {
  for (const colors of [theme.lightColors, theme.darkColors]) {
    const pending = deferred(), routes = [];
    const state = { account: 'a', ready: true, progress: model.defaultProgress(), replay: () => pending.promise };
    const useGuidanceStore = Object.assign(() => state, { getState: () => state });
    const h = controlHarness('src/features/guidance/GuidanceSettings.tsx', {
      './guidance.store': { useGuidanceStore },
      '../../hooks/useThemeColors': { useThemeColors: () => ({ colors }) },
      '../../components/ScaledText': { ScaledText: 'Text' },
      '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ replace: route => routes.push(route) }) },
      '../../stores/toast.store': { showToast: () => assert.fail('Unexpected replay failure') },
    });
    const assertRow = tree => {
      assert.equal(tree.type, 'Pressable');
      assert.equal(buttonStyle(tree).backgroundColor, colors.surface);
      assert.notEqual(buttonStyle(tree).backgroundColor, colors.primary);
      assert.ok(buttonStyle(tree).minHeight >= 44);
      assert.equal(buttonStyle(tree).paddingVertical, 13); assert.equal(buttonStyle(tree).paddingHorizontal, 16);
      assert.equal(nodes(tree).filter(node => node.type === 'Switch').length, 0);
      assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.readAloud'), false);
      const label = nodes(tree).find(node => node.type === 'Text');
      assert.equal(label.props.children, 'guidance.review');
      assert.equal(flattenStyle(label.props.style).fontSize, 15); assert.equal(flattenStyle(label.props.style).fontWeight, '600');
      assert.equal(flattenStyle(label.props.style).color, colors.textPrimary);
      assert.equal(nodes(tree).find(node => node.props?.name === 'book-outline').props.color, colors.primaryText);
      assert.equal(nodes(tree).find(node => node.props?.name === 'book-outline').props.size, 22);
      assert.equal(nodes(tree).find(node => node.props?.name === 'chevron-forward').props.size, 16);
      assert.equal(tree.props.accessibilityLabel, 'guidance.review');
    };
    let tree = h.render('GuidanceSettings'); assertRow(tree);
    assert.equal(buttonStyle(tree, true).opacity, 0.8);
    tree.props.onPress(); await tick();
    tree = h.render('GuidanceSettings'); assertRow(tree);
    assert.equal(tree.props.disabled, true); assert.equal(buttonStyle(tree).opacity, 0.5);
    pending.resolve(); await tick();
    tree = h.render('GuidanceSettings'); assertRow(tree);
    assert.equal(tree.props.disabled, false); assert.deepEqual(routes, ['/(tabs)/home']);
    state.ready = false; tree = h.render('GuidanceSettings'); assertRow(tree); assert.equal(tree.props.disabled, true);
    const inherited = { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 13 };
    const labelStyle = { color: colors.textPrimary, fontSize: 15, fontWeight: '600' };
    tree = h.render('GuidanceSettings', { style: inherited, labelStyle });
    assert.equal(buttonStyle(tree).paddingVertical, 13, 'profile row styles are preserved');
    assert.equal(nodes(tree).find(node => node.type === 'Text').props.style.at(-1), labelStyle,
      'profile typography is reused instead of an independent guide button size');
  }
});
await test('the check-in Help button explicitly reopens a seen guide without resetting the welcome or account tour', async () => {
  const routes = [];
  const state = { account: 'a', ready: true, progress: { ...completedWelcome(),
    firstCheckin: true, completed: [...model.GUIDE_STEPS] },
    replay: () => assert.fail('Check-in Help must not reset the entire account tour') };
  const saved = state.progress;
  const h = controlHarness('src/features/guidance/GuidanceSettings.tsx', {
    './guidance.store': { useGuidanceStore: Object.assign(() => state, { getState: () => state }) },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors }) },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ replace: route => routes.push(route) }) },
    '../../stores/toast.store': { showToast: () => assert.fail('Unexpected guide failure') },
  });
  await h.render('useReviewGuidance', 'checkin')();
  assert.equal(routes.length, 1);
  assert.equal(routes[0].pathname, '/checkin'); assert.equal(routes[0].params.mode, 'guide');
  assert.ok(routes[0].params.guide);
  assert.equal(state.progress, saved); assert.equal(state.progress.welcomeSeen, true);
});
await test('automatic read-aloud restores old disabled preferences without choosing a role or completing coach steps', async () => {
  const h = guidanceHarness({ guidance: { progress: { ...model.defaultProgress(), readAloud: false } } });
  await h.settle();
  assert.deepEqual(h.calls.updates, [{ readAloud: true }, { welcomeSeen: true }]);
  assert.deepEqual(h.calls.audio, [['welcome', 'vi']]);
  assert.equal(h.progress.progress.welcomeSeen, true); assert.equal(h.progress.progress.role, null);
  assert.deepEqual(h.progress.progress.completed, []);
  await h.settle(); assert.equal(h.calls.updates.length, 2, 'enabling narration and remembering display are not repeating writes');
  h.unmount();
  for (const override of [{ token: null }, { hydrated: false }, { profile: { id: 'a', onboardingCompleted: false } },
    { guidance: { account: 'another-account' } }, { guidance: { ready: false } }]) {
    const isolated = guidanceHarness({ ...override, guidance: { ...override.guidance,
      progress: { ...model.defaultProgress(), readAloud: false } } });
    await isolated.settle(); assert.deepEqual(isolated.calls.updates, []); isolated.unmount();
  }
});

const storage = new Map(); let requestImpl;
const create = init => {
  let state; const get = () => state;
  const set = value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) }; };
  state = init(set, get); return { getState: get, setState: set };
};
const { useGuidanceStore: store } = evaluate('src/features/guidance/guidance.store.ts', {
  zustand: { create }, './guidance.model': model,
  '@react-native-async-storage/async-storage': { getItem: async key => storage.get(key) || null,
    setItem: async (key, value) => { storage.set(key, value); } },
  '../../lib/apiClient': { apiClient: (...args) => requestImpl(...args) },
});
const remote = new Map();
const server = async (path, options = {}) => {
  const account = store.getState().account;
  let progress = remote.get(account) || completedWelcome();
  if (path.endsWith('/replay')) progress = { ...progress, completed: [], welcomeSeen: false, epoch: progress.epoch + 1 };
  else if (options.method === 'PUT') {
    if (options.body.epoch !== progress.epoch) throw Object.assign(new Error('stale'), { code: 'GUIDANCE_STALE' });
    progress = model.mergeProgress(progress, options.body);
  }
  remote.set(account, progress); return { ok: true, progress };
};
await test('account progress synchronizes across reloads and never leaks to a different account', async () => {
  requestImpl = server; await store.getState().load('a');
  store.getState().acknowledge('home.fine'); await tick();
  await store.getState().load('a'); assert.deepEqual(store.getState().progress.completed, ['home.fine']);
  await store.getState().load('b'); assert.deepEqual(store.getState().progress.completed, []);
});
await test('a late request for account A cannot replace account B or resurrect logout state', async () => {
  const old = deferred(); requestImpl = () => old.promise;
  const load = store.getState().load('slow'); await tick();
  requestImpl = server; await store.getState().load('current');
  old.resolve({ ok: true, progress: { ...completedWelcome(), completed: ['home.fine'] } }); await load;
  assert.equal(store.getState().account, 'current'); assert.deepEqual(store.getState().progress.completed, []);
  await store.getState().load(null); assert.equal(store.getState().ready, false);
});
await test('offline acknowledgements remain pending, then merge with server progress', async () => {
  requestImpl = server; await store.getState().load('offline');
  requestImpl = async () => { throw new Error('offline'); };
  store.getState().acknowledge('home.fine'); await tick();
  assert.ok(store.getState().progress.completed.includes('home.fine'));
  requestImpl = server; await store.getState().refresh();
  assert.ok(remote.get('offline').completed.includes('home.fine'));
});
await test('the first check-in guide visit survives offline restart and syncs only account-owned tour metadata', async () => {
  requestImpl = server; await store.getState().load('checkin-once');
  requestImpl = async () => { throw new Error('offline'); };
  store.getState().update({ completed: ['checkin.practice'] }); await tick();
  await store.getState().load('checkin-once');
  assert.ok(store.getState().progress.completed.includes('checkin.practice'));
  assert.equal(store.getState().progress.firstCheckin, false);
  assert.deepEqual(store.getState().pending, { completed: ['checkin.practice'] });
  requestImpl = server; await store.getState().refresh();
  assert.ok(remote.get('checkin-once').completed.includes('checkin.practice'));
  await store.getState().load('checkin-other');
  assert.deepEqual(store.getState().progress.completed, []);
});
await test('an old guidance GET cannot undo a seen welcome or completed guide after a successful save', async () => {
  requestImpl = server; await store.getState().load('stale-guidance-read');
  const oldProgress = { ...model.defaultProgress(), role: 'self' };
  const old = deferred();
  requestImpl = (path, options) => options?.method === 'PUT' ? server(path, options) : old.promise;
  const refreshing = store.getState().refresh();
  store.getState().update({ welcomeSeen: true, firstCheckin: true, completed: ['checkin.practice'] });
  await tick(); assert.equal(store.getState().syncing, false);
  old.resolve({ ok: true, progress: oldProgress }); await refreshing;
  assert.equal(store.getState().progress.welcomeSeen, true);
  assert.equal(store.getState().progress.firstCheckin, true);
  assert.ok(store.getState().progress.completed.includes('checkin.practice'));
  requestImpl = server; await store.getState().load('stale-guidance-read');
  assert.equal(store.getState().progress.welcomeSeen, true);
  assert.ok(store.getState().progress.completed.includes('checkin.practice'));
});
await test('rapid acknowledgements and a sound toggle keep both batches and account cache intact', async () => {
  requestImpl = server; await store.getState().load('rapid');
  const first = deferred(); let calls = 0;
  requestImpl = (path, options) => options?.method === 'PUT' && ++calls === 1 ? first.promise : server(path, options);
  store.getState().acknowledge('home.fine');
  store.getState().acknowledge('home.unwell'); store.getState().update({ readAloud: false }); await tick();
  const saved = JSON.parse(storage.get('guidance:account:rapid:v1'));
  assert.deepEqual(saved.pending.completed, ['home.fine', 'home.unwell']);
  assert.equal(saved.pending.readAloud, false);
  first.resolve(await server('/api/mobile/guidance', { method: 'PUT', body: { epoch: 0, completed: ['home.fine'] } }));
  await tick(); assert.deepEqual(remote.get('rapid').completed, ['home.fine', 'home.unwell']);
  assert.equal(remote.get('rapid').readAloud, false);
});
await test('replay invalidates an older in-flight save and retains the sound preference', async () => {
  requestImpl = server; await store.getState().load('replay');
  const old = deferred();
  requestImpl = (path, options) => options?.method === 'PUT' ? old.promise : server(path, options);
  store.getState().acknowledge('home.fine');
  await store.getState().replay();
  old.resolve({ ok: true, progress: { ...completedWelcome(), completed: ['home.fine'] } }); await tick();
  assert.equal(store.getState().progress.epoch, 1); assert.deepEqual(store.getState().progress.completed, []);
});
await test('guidance defaults to read aloud and completed account tours never reset except by explicit replay', async () => {
  assert.equal(model.defaultProgress().readAloud, true);
  requestImpl = server; await store.getState().load('once-only');
  store.getState().update({ welcomeSeen: true, completed: [...model.GUIDE_STEPS] }); await tick();
  for (let pass = 0; pass < 3; pass++) {
    await store.getState().load('once-only');
    assert.equal(store.getState().progress.welcomeSeen, true);
    assert.equal(model.nextGuideStep(store.getState().progress, model.GUIDE_STEPS), undefined);
  }
  await store.getState().replay();
  assert.equal(store.getState().progress.welcomeSeen, false);
  assert.equal(store.getState().progress.readAloud, true);
  assert.deepEqual(store.getState().progress.completed, []);
  await store.getState().load('once-only'); assert.equal(store.getState().progress.epoch, 1);
});

const { CheckinCallAudio } = evaluate('src/features/checkin-call/checkin-call.audio.ts');
const assetImports = Object.fromEntries([...read('src/features/guidance/guidance.assets.ts').matchAll(/require\('([^']+)'\)/g)]
  .map((match, index) => [match[1], index + 1]));
const { guidanceAssets, guidanceAudioAliases } = evaluate('src/features/guidance/guidance.assets.ts', assetImports);
let platform = 'ios'; let silent = false; let mode;
const native = { isGuidanceSoundAllowed: async () => !silent };
const played = [], created = [], events = [];
let unloadBarrier = Promise.resolve(); let createBarrier = null;
let failCreate = false; let failRelease = false;
const { guidanceAudio } = evaluate('src/features/guidance/guidance.audio.ts', {
  'react-native': { Platform: { get OS() { return platform; } }, NativeModules: {
    AsinuCheckinCallModule: native,
  } }, '../checkin-call/checkin-call.audio': { CheckinCallAudio },
  './guidance.assets': { guidanceAssets },
  '../../lib/audio': { Audio: { setAudioModeAsync: async value => { mode = value; },
    Sound: { createAsync: async (source, initial) => {
      if (failCreate) throw new Error('Audio unavailable');
      const sound = { source, initial, listener: null,
        pauseAsync: () => { events.push(['pause', source]); return failRelease ? Promise.reject(new Error('pause')) : Promise.resolve(); },
        unloadAsync: () => { events.push(['unload', source]); return failRelease ? Promise.reject(new Error('unload')) : unloadBarrier; },
        play: () => { played.push(source); },
        setOnPlaybackStatusUpdate: callback => { sound.listener = callback; },
      };
      created.push(sound);
      if (createBarrier) await createBarrier.promise;
      return { sound };
    } },
  } },
});
await test('Vietnamese guidance plays its offline Tuấn Anh recording and respects iOS silent mode', async () => {
  await guidanceAudio.speak('welcome', 'vi');
  assert.equal(mode.playsInSilentModeIOS, false);
  assert.equal(played.at(-1), guidanceAssets.vi.welcome);
  assert.equal(created.at(-1).initial.shouldPlay, false, 'The player must be owned before it starts');
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(mode.playsInSilentModeIOS, true);
});
await test('English guidance selects English recordings by the same Asinu narrator', async () => {
  await guidanceAudio.speak('home.fine', 'en-US');
  assert.equal(played.at(-1), guidanceAssets.en['home.fine']);
});
await test('Android silent mode suppresses autoplay but explicit Replay remains usable', async () => {
  platform = 'android'; silent = true; const count = played.length;
  await guidanceAudio.speak('welcome', 'vi'); assert.equal(played.length, count);
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(played.length, count + 1);
});
await test('older Android builds stay silent automatically but permit manual listening', async () => {
  const permission = native.isGuidanceSoundAllowed; delete native.isGuidanceSoundAllowed;
  const count = played.length;
  await guidanceAudio.speak('welcome', 'vi'); assert.equal(played.length, count);
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(played.length, count + 1);
  native.isGuidanceSoundAllowed = permission;
});
await test('a second guide reading waits for native cancellation, and only the latest intent speaks', async () => {
  platform = 'ios'; silent = false;
  await guidanceAudio.speak('home.fine', 'vi');
  const previous = played.at(-1); const blocked = deferred(); unloadBarrier = blocked.promise;
  const first = guidanceAudio.speak('home.unwell', 'vi');
  assert.deepEqual(events.at(-1), ['pause', previous], 'Pause must begin synchronously');
  const second = guidanceAudio.speak('home.suggestions', 'vi');
  const count = played.length; await tick(); assert.equal(played.length, count);
  blocked.resolve(); await Promise.all([first, second]);
  assert.equal(played.at(-1), guidanceAssets.vi['home.suggestions']);
  assert.equal(played.length, count + 1);
  unloadBarrier = Promise.resolve();
});
await test('leaving a bubble during native creation unloads its player without autoplay', async () => {
  createBarrier = deferred(); const count = played.length;
  const pending = guidanceAudio.speak('circle.phone', 'vi'); await tick();
  const orphan = created.at(-1);
  await guidanceAudio.stop();
  createBarrier.resolve(); await pending; createBarrier = null;
  assert.equal(played.length, count);
  assert.ok(events.some(([event, source]) => event === 'unload' && source === orphan.source));
});
await test('opening a real call cancels guidance before loading call audio', async () => {
  await guidanceAudio.speak('welcome', 'vi');
  const blocked = deferred(); unloadBarrier = blocked.promise; let loaded = false;
  const player = new CheckinCallAudio({ stopSpeech: async () => {}, onState: () => {}, speak: () => {},
    load: async () => { loaded = true; return 'call.mp3'; }, prepare: async () => {},
    create: async () => ({ play: () => {}, pauseAsync: async () => {}, unloadAsync: async () => {}, setOnPlaybackStatusUpdate: () => {} }) });
  const call = player.play({ key: 'call', text: 'Call', language: 'vi' });
  await tick(); assert.equal(loaded, false); blocked.resolve(); await call;
  assert.equal(loaded, true); player.dispose(); unloadBarrier = Promise.resolve();
});
await test('recording failures never substitute an OS voice and an explicit retry can recover', async () => {
  failCreate = true; const count = played.length;
  await guidanceAudio.speak('home.fine', 'vi'); assert.equal(played.length, count);
  assert.doesNotMatch(read('src/features/guidance/guidance.audio.ts'), /expo-speech|Speech\s*\./);
  failCreate = false; await guidanceAudio.speak('home.fine', 'vi', true);
  assert.equal(played.length, count + 1);
});
await test('an unpausable and unreleasable old recording cannot overlap a new guide', async () => {
  failRelease = true; const count = played.length;
  await guidanceAudio.speak('home.unwell', 'vi'); assert.equal(played.length, count);
  failRelease = false; await guidanceAudio.speak('home.unwell', 'vi', true);
  assert.equal(played.length, count + 1);
});
await test('finished clips release their native player and stale completion cannot stop a new clip', async () => {
  const old = created.at(-1);
  await guidanceAudio.speak('circle.add', 'vi'); const current = created.at(-1);
  const priorEvents = events.length;
  old.listener({ didJustFinish: true, isLoaded: true }); await tick();
  assert.equal(events.length, priorEvents);
  current.listener({ didJustFinish: true, isLoaded: true }); await tick();
  assert.ok(events.slice(priorEvents).some(([event, source]) => event === 'unload' && source === current.source));
});
await test('suggestion narration waits for its own visible target, survives layout updates, and replays only on demand', async () => {
  const h = guidanceHarness({ audio: guidanceAudio,
    guidance: { progress: { ...completedWelcome(), firstCheckin: true } } });
  let visible = false, y = 300, reveals = 0;
  let tree = await h.settle(); const before = played.length;
  tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, 180, 300, 70) } } });
  tree.props.value.register('home.suggestions', { node: { current: {
    measureInWindow: work => work(20, visible ? y : 1000, 300, 70),
  } }, reveal: () => { reveals++; } });
  await h.settle(); assert.deepEqual(played.slice(before), [guidanceAssets.vi['home.fine']]);
  h.progress.acknowledge('home.fine'); tree = await h.settle();
  assert.equal(reveals, 1);
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.home_suggestions'), false);
  assert.equal(h.calls.audio.filter(([clip]) => clip === 'home.suggestions').length, 0,
    'The previous highlight must not consume this off-screen step’s automatic reading');
  visible = true; h.measure(); tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.home_suggestions'), true);
  assert.deepEqual(played.slice(before), [guidanceAssets.vi['home.fine'], guidanceAssets.vi['home.suggestions']]);
  const stops = h.calls.stops, eventCount = events.length;
  y = 340; h.measure(); await h.settle();
  assert.equal(h.calls.stops, stops, 'Moving the same bubble must not stop its recording');
  assert.equal(events.length, eventCount);
  assert.equal(h.calls.audio.filter(([clip]) => clip === 'home.suggestions').length, 1);
  h.state.modalBusy = true; await h.settle();
  assert.ok(events.slice(eventCount).some(([event, source]) => event === 'pause' && source === guidanceAssets.vi['home.suggestions']));
  h.state.modalBusy = false; tree = await h.settle();
  assert.equal(h.calls.audio.filter(([clip]) => clip === 'home.suggestions').length, 1, 'Resuming must not repeat an already-started phrase');
  const replay = nodes(tree).find(node => node.type?.name === 'GuideReplay');
  assert.ok(replay); replay.props.onPress(); await tick();
  assert.deepEqual(h.calls.audio.at(-1), ['home.suggestions', 'vi', true]);
  assert.equal(played.at(-1), guidanceAssets.vi['home.suggestions']);
  assert.equal(played.length, before + 3);
  h.progress.acknowledge('home.suggestions'); tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.props?.children === 'guidance.steps.home_suggestions'), false);
  h.unmount();
});
await test('a coach geometry refresh cannot cancel asynchronous native player creation for the same step', async () => {
  const h = guidanceHarness({ audio: guidanceAudio, guidance: { progress: completedWelcome() } });
  let y = 200; const tree = await h.settle(); const before = played.length;
  createBarrier = deferred();
  tree.props.value.register('home.fine', { node: { current: { measureInWindow: work => work(20, y, 300, 70) } } });
  await h.settle(); assert.equal(played.length, before);
  y = 250; h.measure(); await h.settle();
  createBarrier.resolve(); await tick(); createBarrier = null;
  assert.equal(played.length, before + 1);
  assert.equal(played.at(-1), guidanceAssets.vi['home.fine']);
  h.unmount(); await tick();
});
await test('all bundled clips match their fixed translations, voice identity and verified audio bytes', () => {
  const manifest = JSON.parse(read('assets/sounds/guidance/manifest.json'));
  const nativeVoice = JSON.parse(read('assets/sounds/asinu_checkin_open_app_vi.json')).voice;
  assert.equal(manifest.voice, nativeVoice); assert.equal(manifest.voiceLabel, 'Asinu Tuan Anh v4');
  assert.equal(manifest.engine, 'v4'); assert.ok(manifest.speed < 1 && manifest.speed >= 0.75);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const ids = ['welcome', 'practice_result', ...model.GUIDE_STEPS];
  const recordedIds = ids.filter(id => !Object.hasOwn(guidanceAudioAliases, id));
  for (const language of ['vi', 'en']) {
    const strings = JSON.parse(read(`src/i18n/locales/${language}/onboarding.json`)).guidance;
    assert.deepEqual(Object.keys(manifest.clips[language]).sort(), [...recordedIds].sort());
    for (const id of ids) {
      const recordedId = guidanceAudioAliases[id] || id;
      const clip = manifest.clips[language][recordedId];
      const expected = id === 'welcome' ? `${strings.welcomeTitle}. ${strings.welcomeBody}`
        : id === 'practice_result' ? strings.practiceResultAudio
        : id === 'circle.member' ? strings.circleMemberAudio : strings.steps[id.replace('.', '_')];
      assert.equal(clip.text, expected); assert.ok(!clip.text.includes('{{'));
      assert.equal(clip.textSha256, hash(expected));
      const bytes = fs.readFileSync(`assets/sounds/guidance/${clip.file}`);
      assert.equal(clip.audioSha256, hash(bytes)); assert.equal(clip.bytes, bytes.length);
      assert.ok(bytes.length > 1000 && bytes.length < 2_000_000);
      assert.ok(bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 0xff);
      assert.ok(Math.abs(clip.integratedLufs + 16) <= 0.5); assert.ok(clip.truePeakDbtp <= -1);
      assert.ok(Object.hasOwn(guidanceAssets[language], id));
      assert.equal(guidanceAssets[language][id], guidanceAssets[language][recordedId]);
    }
  }
});

await test('the profile System section has no guide replay or read-aloud setting', () => {
  const profileSource = read('app/(tabs)/profile/index.tsx');
  const source = ts.createSourceFile('profile.tsx', profileSource,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const settings = [], sections = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'GuidanceSettings') settings.push(node);
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Animated.View'
      && /t\("sectionSystem"\)/.test(node.getText(source))) sections.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(settings.length, 0); assert.equal(sections.length, 1);
  assert.doesNotMatch(profileSource, /GuidanceSettings|useReviewGuidance|guidance\.(review|readAloud)/);
  assert.match(sections[0].getText(source), /ts\("helpSupport"\)/);
  assert.match(sections[0].getText(source), /t\("shareApp"\)/);
  assert.doesNotMatch(read('src/features/guidance/GuidanceProvider.tsx'), /<Switch\b/,
    'read-aloud has no visible toggle on any guidance screen');
});

await test('onboarding uses inline touch-through scrims, native text scaling and no carousel', () => {
  const source = read('src/features/guidance/GuidanceProvider.tsx');
  assert.doesNotMatch(source, /<Modal|<FlatList|numberOfLines|allowFontScaling=\{false\}/);
  assert.match(source, /fontSize: 30/); assert.match(source, /fontSize: 22/);
  assert.match(source, /minHeight: 60/);
  assert.match(source, /useQueuedModalBusy/); assert.match(source, /!foreground \|\| keyboard \|\| backgroundCall/);
  assert.match(source, /onTouchEnd=.*acknowledge/);
  for (const file of ['app/(tabs)/home/index.tsx', 'app/checkin/index.tsx', 'app/(tabs)/profile/index.tsx'])
    assert.doesNotMatch(read(file), /<CheckinGuideCarousel/);
  assert.match(source, /assets\/asinu_chat_sticker\.png/);
});
console.log(`Guided onboarding: ${checks} regression checks passed.`);
