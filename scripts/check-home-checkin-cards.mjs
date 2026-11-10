import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { progressHarness } from "./helpers/checkin-progress-harness.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const flatten = (style) =>
  Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean).map(flatten))
    : style ?? {};
const jsx = (type, props) => ({ type, props });

function evaluate(source, dependencies) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Exercise the actual JSX, text scaling and button handlers with native adapters.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (id) => {
      assert.ok(id in dependencies, `Missing adapter: ${id}`);
      return dependencies[id];
    }
  );
  return module.exports;
}

let checks = 0;
async function test(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function featureGridHarness({ language = 'vi', width = 393, multiplier = 1, fontScale = 1,
  medicationEnabled = true, coinsEnabled = true } = {}) {
  const pushes = [], catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`)).quickActions;
  let cursor = 0;
  const slots = [], pending = [], scrolls = [];
  const viewport = { width, fontScale };
  const hooks = {
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef: initial => { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useCallback: work => work,
    useEffect: (work, deps) => {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        slots[index] = { deps }; pending.push(work);
      }
    },
  };
  const source = read('src/components/HomeFeatureGrid.tsx');
  const assetAdapters = Object.fromEntries([...source.matchAll(/require\('([^']+)'\)/g)].map(match => [match[1], match[1]]));
  const palette = { textPrimary: '#213B35', surface: '#FEFFFE', primaryText: '#0F766E', primaryLight: '#E6FAF8', border: '#E7F0EC' };
  const { QuickActionTile } = evaluate(read('src/components/QuickActionTile.tsx'), {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value } },
    './ScaledText': { ScaledText: 'Text' }, '../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark: false }) },
  });
  const { HomeFeatureGrid } = evaluate(source, {
    ...assetAdapters, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: hooks,
    'react-native': { Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: value => value },
      useWindowDimensions: () => viewport },
    '@expo/vector-icons': { Ionicons: 'Icon' }, './ScaledText': { ScaledText: 'Text' },
    './QuickActionTile': { QuickActionTile },
    'react-i18next': { useTranslation: () => ({ t: (key, values = {}) => {
      const label = catalog[key.split('.')[1]]; assert.ok(label, `${language}/${key}`);
      return label.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name]);
    } }) },
    '../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push: route => pushes.push(route) }) },
    '../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark: false }) },
    '../stores/font-size.store': { useFontSizeStore: select => select({ multiplier }) },
    '../features/v21/HealthCoinIcon': { HealthCoinIcon: 'GoldCoin' },
    '../features/profile/AppPermissionsModal': { AppPermissionsModal: 'PermissionModal' },
  });
  const render = () => {
    cursor = 0;
    const tree = HomeFeatureGrid({ medicationEnabled, coinsEnabled });
    pending.splice(0).forEach(work => work());
    return tree;
  };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
    : typeof tree.type === 'function' ? nodes(tree.type(tree.props))
      : (() => {
        if (tree.type === 'ScrollView') tree.props.ref.current = { scrollTo: value => scrolls.push(value) };
        return [tree, ...nodes(typeof tree.props?.children === 'function' ? tree.props.children({ pressed: false }) : tree.props?.children)];
      })();
  const tiles = () => nodes(render()).filter(node => node.type === 'Pressable' && node.props.testID && !node.props.testID.startsWith('home-feature-page-'));
  return { render, nodes, tiles, pushes, catalog, scrolls, viewport };
}

for (const language of ['vi', 'en']) {
  await test(`${language}: Home shortcuts expose the real destinations with labels and a gold coin`, () => {
    const h = featureGridHarness({ language }), tree = h.render(), nodes = h.nodes(tree);
    const buttons = h.tiles();
    assert.equal(buttons.length, 12);
    assert.equal(buttons[0].props.testID, 'home-feature-healthHistory');
    for (const button of buttons) {
      assert.equal(button.props.accessibilityRole, 'button'); assert.ok(button.props.accessibilityLabel);
      assert.ok(flatten(button.props.style({ pressed: false })).minHeight >= 44);
      button.props.onPress();
    }
    assert.deepEqual(h.pushes, ['/(tabs)/tree', '/medication', '/logs', '/doctor-consultation', '/checkin-call/settings', '/checkin-call/voice-settings', '/care-circle',
      '/(tabs)/missions', '/coins', '/checkin-rewards', '/checkin-rewards/history']);
    const dialog = h.nodes(h.render()).find(node => node.type === 'PermissionModal');
    assert.equal(dialog.props.visible, true);
    dialog.props.onClose();
    assert.equal(h.nodes(h.render()).find(node => node.type === 'PermissionModal').props.visible, false);
    assert.equal(nodes.filter(node => node.type === 'GoldCoin').length, 1);
    assert.ok(nodes.filter(node => node.type === 'Text').every(node => node.props.allowFontScaling && !node.props.numberOfLines));
    assert.ok(nodes.filter(node => node.type === 'Image').every(node => node.props.accessible === false));
  });
  await test(`${language}: disabled medication and coin features have no Home shortcuts`, () => {
    const h = featureGridHarness({ language, medicationEnabled: false, coinsEnabled: false });
    const ids = h.tiles().map(node => node.props.testID);
    assert.equal(ids.length, 10); assert.ok(!ids.includes('home-feature-medication')); assert.ok(!ids.includes('home-feature-coins'));
    assert.equal(ids[0], 'home-feature-healthHistory');
    assert.ok(ids.includes('home-feature-expert'));
  });
}
for (const [width, multiplier, fontScale, columns] of [[393, 1, 1, 4], [430, 1, 1, 4],
  [320, 1, 1, 3], [393, 1.25, 1, 3], [393, 1.25, 1.4, 2]]) {
  await test(`Home shortcuts fit ${width}px with app font ${multiplier} and system font ${fontScale}`, () => {
    const h = featureGridHarness({ width, multiplier, fontScale });
    let tree = h.render(); tree.props.onLayout({ nativeEvent: { layout: { width: width - 32 } } }); tree = h.render();
    const button = h.nodes(tree).find(node => node.type === 'Pressable');
    const tile = flatten(button.props.style({ pressed: false }));
    assert.ok(tile.width >= 64); assert.ok(Math.abs(tile.width * columns + 12 * (columns - 1) - (width - 32)) < 0.01);
  });
}

for (const [width, multiplier, expected] of [[393, 1, [8, 4]], [320, 1, [6, 6]], [393, 1.6, [4, 4, 4]]]) {
  await test(`Home shortcuts paginate at ${width}px/font ${multiplier} and expose only the active page to accessibility`, () => {
    const h = featureGridHarness({ width, multiplier });
    const nodes = h.nodes(h.render());
    const scroller = nodes.find(node => node.props?.testID === 'home-feature-pages');
    assert.equal(scroller.props.pagingEnabled, true); assert.equal(scroller.props.horizontal, true);
    assert.deepEqual(scroller.props.children.map(page => page.props.children.length), expected);
    assert.equal(scroller.props.children[0].props.accessibilityElementsHidden, false);
    assert.ok(scroller.props.children.slice(1).every(page => page.props.importantForAccessibility === 'no-hide-descendants'));
    scroller.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: width - 32 } } });
    const afterSwipe = h.nodes(h.render());
    assert.equal(afterSwipe.find(node => node.props?.testID === 'home-feature-page-1').props.accessibilityState.selected, true);
    assert.equal(afterSwipe.find(node => node.props?.testID === 'home-feature-pages').props.children[1].props.accessibilityElementsHidden, false);
    afterSwipe.find(node => node.props?.testID === 'home-feature-page-0').props.onPress();
    assert.deepEqual(h.scrolls.at(-1), { x: 0, animated: false });
    assert.equal(h.nodes(h.render()).find(node => node.props?.testID === 'home-feature-page-0').props.accessibilityState.selected, true);
  });
}
await test('changing screen width resets a paged shortcut grid to a valid position', () => {
  const h = featureGridHarness();
  h.nodes(h.render()).find(node => node.props?.testID === 'home-feature-page-1').props.onPress();
  h.viewport.width = 430;
  h.render().props.onLayout({ nativeEvent: { layout: { width: 398 } } });
  h.render();
  const nodes = h.nodes(h.render());
  assert.equal(nodes.find(node => node.props?.testID === 'home-feature-page-0').props.accessibilityState.selected, true);
  assert.deepEqual(h.scrolls.at(-1), { x: 0, animated: false });
});
await test('expert consultation stays on the first page with its doctor portrait when optional shortcuts are disabled', () => {
  const h = featureGridHarness({ medicationEnabled: false, coinsEnabled: false });
  const nodes = h.nodes(h.render());
  const scroller = nodes.find(node => node.props?.testID === 'home-feature-pages');
  assert.equal(scroller.props.scrollEnabled, true);
  const firstPage = h.nodes(scroller.props.children[0]);
  const expert = firstPage.find(node => node.props?.testID === 'home-feature-expert');
  assert.ok(expert);
  assert.ok(firstPage.some(node => node.type === 'Image' && node.props.source.endsWith('expert-consultation-v1.png')));
  expert.props.onPress();
  assert.equal(h.pushes.at(-1), '/doctor-consultation');
});

await test('health history leaves the bottom bar and stays available through its existing route', () => {
  const source = read('app/(tabs)/_layout.tsx');
  const assets = Object.fromEntries([...source.matchAll(/require\('([^']+)'\)/g)].map(match => [match[1], match[1]]));
  const loading = [];
  const Tabs = Object.assign(() => null, { Screen: 'TabScreen' });
  const { default: TabsLayout } = evaluate(source, {
    ...assets,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {},
      useState: () => [['home-loaded', 'connect-loaded', 'profile-loaded', null], () => {}] },
    'expo-asset': { Asset: {} },
    'expo-router': { Tabs },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-native': { Image: 'Image', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 393 }), View: 'View' },
    'react-native-reanimated': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../../src/hooks/useInitialLoadingGate': { useInitialLoadingGate: ready => { loading.push(ready); return !ready; } },
    '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../../src/styles': { bottomTabBar: { horizontalInset: 16, maxWidth: 600, contentHeight: 60, verticalPadding: 8, minimumBottomPadding: 8 } },
    '../../src/features/auth/useOnboardingGate': { useOnboardingGate: () => true },
  });
  const screens = TabsLayout().props.children.filter(child => child?.type === 'TabScreen');
  assert.deepEqual(screens.filter(screen => screen.props.options.href !== null).map(screen => screen.props.name),
    ['home/index', 'care-circle/index', 'profile/index']);
  assert.equal(screens.find(screen => screen.props.name === 'tree/index').props.options.href, null);
  assert.ok(fs.existsSync('app/(tabs)/tree/index.tsx'));
  assert.deepEqual(loading, [true], 'Hidden tabs do not delay the three visible icons');
});

function permissionModalHarness({ language = 'vi', platform = 'ios', request } = {}) {
  const catalogs = Object.fromEntries(['settings', 'common', 'checkinCall'].map(name =>
    [name, JSON.parse(read(`src/i18n/locales/${language}/${name}.json`))]));
  const translate = (namespace, key) => key.split('.').reduce((value, part) => value?.[part], catalogs[namespace]);
  const calls = { requests: [], close: 0, native: 0, nativeReads: 0, nativeOff: 0 };
  const auth = { token: 'account-a' };
  let cursor = 0, visible = true, focusCleanup;
  const slots = [], effects = [];
  const states = Object.fromEntries(['notifications', 'microphone', 'photos'].map(kind => [kind, {
    permission: { granted: kind === 'microphone', canAskAgain: true, accessPrivileges: kind === 'photos' ? 'limited' : 'all' },
    loading: false, pending: false, failed: false,
    refresh: async () => states[kind].permission,
    change: async value => {
      calls.requests.push(kind);
      if (request) await request();
      states[kind].permission.granted = value;
    },
  }]));
  const hooks = {
    useCallback: work => work,
    useRef: initial => { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useState: initial => { const index = cursor++; slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = value; }]; },
    useEffect: (work, deps) => { const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        const previous = slots[index]; slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = work(); });
      }
    },
  };
  let nativeAccess = { notifications: true, channels: true, fullScreen: false };
  const { AppPermissionsModal } = evaluate(read('src/features/profile/AppPermissionsModal.tsx'), {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: platform }, AppState: { addEventListener: () => ({ remove() {} }) },
      ActivityIndicator: 'Loading', Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', View: 'View', StyleSheet: { create: value => value, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../../components/QueuedModal': { QueuedModal: 'QueuedPermissionDialog' },
    '../../components/GlobalToastHost': { ModalToastHost: 'ToastHost' },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
    'expo-router': { useFocusEffect: work => { focusCleanup ??= work(); } },
    'react-i18next': { useTranslation: namespace => ({ t: key => {
      const value = translate(namespace, key); assert.equal(typeof value, 'string', `${namespace}/${key}`); return value;
    } }) },
    './useDevicePermission': { useDevicePermission: kind => states[kind] },
    '../care-circle/useQrCameraPermission': { useQrCameraPermission: () => ({ permission: { granted: false }, pending: false,
      change: async () => { calls.requests.push('camera'); } }) },
    '../auth/auth.store': { useAuthStore: Object.assign(select => select(auth), { getState: () => auth }) },
    '../../lib/android-checkin-call': { getAndroidCallPermissions: async () => { calls.nativeReads++; return nativeAccess; },
      openAndroidCallSettings: async () => { calls.nativeOff++; nativeAccess = { ...nativeAccess, fullScreen: false }; return true; } },
    '../../lib/android-call-access': { requestAndroidCallAccess: async () => {
      calls.native++; nativeAccess = { notifications: true, channels: true, fullScreen: true }; return true;
    } },
    '../../stores/toast.store': { showToast: () => assert.fail('No error toast expected') },
  });
  const onClose = () => { calls.close++; visible = false; };
  const render = () => { cursor = 0; const tree = AppPermissionsModal({ visible, onClose });
    effects.splice(0).forEach(work => work()); return tree;
  };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
  const switches = () => nodes(render()).filter(node => node.type === 'Switch');
  return { calls, states, auth, render, translate, switches,
    settle: async () => { render(); await flush(); return render(); },
    blur: () => focusCleanup(),
    change: async (index, enabled = true) => { switches()[index].props.onValueChange(enabled); await render().props.onDismiss(); },
  };
}
for (const language of ['vi', 'en']) {
  await test(`${language}: permission switches show actual OS states and opening never requests access`, async () => {
    const h = permissionModalHarness({ language }), dialog = await h.settle();
    assert.equal(dialog.type, 'QueuedPermissionDialog');
    assert.equal(h.switches().length, 4);
    assert.equal(h.switches()[0].props.value, false);
    assert.equal(h.switches()[1].props.value, true);
    assert.equal(h.switches()[3].props.value, true, 'Limited photo access is already granted');
    assert.deepEqual(h.calls.requests, []); assert.equal(h.calls.nativeReads, 0);
    h.switches()[0].props.onValueChange(true);
    assert.deepEqual(h.calls.requests, [], 'The OS request must wait for actual app-modal dismissal');
    assert.equal(h.render().props.visible, false);
    await h.render().props.onDismiss();
    assert.deepEqual(h.calls.requests, ['notifications']); assert.equal(h.calls.close, 0);
    assert.equal(h.render().props.visible, true); assert.equal(h.switches()[0].props.value, true);
    await h.change(0, false);
    assert.equal(h.switches()[0].props.value, false);
  });
}
await test('repeated permission callbacks share one pending request and a blurred screen cannot reopen the dialog', async () => {
  let complete;
  const h = permissionModalHarness({ request: () => new Promise(resolve => { complete = resolve; }) });
  await h.settle();
  const first = h.change(0), duplicate = h.change(0);
  assert.deepEqual(h.calls.requests, ['notifications']);
  h.blur(); complete(); await Promise.all([first, duplicate]);
  assert.equal(h.render().props.visible, false);
});
await test('a stale permission switch cannot request access for a different account', async () => {
  const h = permissionModalHarness(); await h.settle();
  h.switches()[0].props.onValueChange(true);
  h.auth.token = 'account-b'; await h.render().props.onDismiss();
  assert.deepEqual(h.calls.requests, []);
});
await test('Android call switch refreshes native state after granting and revoking through Settings', async () => {
  const h = permissionModalHarness({ platform: 'android' }); await h.settle();
  assert.equal(h.switches().length, 5); assert.equal(h.switches()[4].props.value, false);
  assert.equal(h.calls.native, 0);
  await h.change(4); await h.settle();
  assert.equal(h.calls.native, 1); assert.equal(h.switches()[4].props.value, true);
  await h.change(4, false); await h.settle();
  assert.equal(h.calls.nativeOff, 1); assert.equal(h.switches()[4].props.value, false);
});

await test('Home shortcuts reuse V2.1 access without requesting unused coin balances or showing another account flags', async () => {
  let cursor = 0, focus, auth = { profile: { id: 7 }, token: 'session-a' };
  const slots = [], calls = [];
  const hooks = { useState: initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = value; }];
  }, useCallback: work => work };
  const { V21HomeCard } = evaluate(read('src/features/v21/V21HomeCard.tsx'), {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', View: 'View', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-router': { useFocusEffect: work => { focus = work; } },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({}) }, '@expo/vector-icons': {},
    'react-i18next': { useTranslation: () => ({ t: key => key }) }, '../../components/ScaledText': {},
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../auth/auth.store': { useAuthStore: select => select(auth) }, '../../lib/health-action-events': { subscribeHealthAction: () => () => {} },
    './v21.api': { v21Api: {
      flags: async () => { calls.push('flags'); return { medication: true, coins: true, patients: [{ id: 7 }] }; },
      coins: () => assert.fail('A shortcut grid must not fetch a hidden balance'),
    } }, '../../lib/apiClient': { ApiError: Error },
  });
  const render = () => { cursor = 0; return V21HomeCard({ renderShortcuts: access => access }); };
  assert.deepEqual(render(), { medicationEnabled: false, coinsEnabled: false });
  const cleanup = focus();
  try {
    await flush(); assert.deepEqual(render(), { medicationEnabled: true, coinsEnabled: true });
    assert.deepEqual(calls, ['flags']);
    auth = { profile: { id: 8 }, token: 'session-b' };
    assert.deepEqual(render(), { medicationEnabled: false, coinsEnabled: false });
  } finally { cleanup(); }
});

function harness({
  language = "vi",
  isDark = false,
  multiplier = 1,
  session = null,
  fail = false,
  practice = false,
  draft = null,
  getToday,
} = {}) {
  let cursor = 0;
  const slots = [];
  let focus;
  const progress = progressHarness();
  const pushes = [];
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const t = (key) => {
    assert.equal(
      typeof catalog[key],
      "string",
      `${language}:${key} must be translated`
    );
    return catalog[key];
  };
  const native = {
    Text: "Text",
    View: "View",
    Pressable: "Pressable",
    Platform: { OS: "ios" },
    StyleSheet: { create: (styles) => styles, flatten },
  };
  const typography = { size: { xs: 13, sm: 15, md: 18, lg: 22, xl: 30 } };
  const colors = {
    surface: isDark ? "#18181b" : "#fefefe",
    border: "#eeeeef",
    primary: "#08b8a2",
    primaryLight: isDark ? "#0f2b28" : "#e6faf8",
    premiumDark: isDark ? "#f59e0b" : "#d97706",
    premiumLight: isDark ? "#3b2e10" : "#fef3c7",
    textPrimary: isDark ? "#f0f0f5" : "#221f1f",
    textSecondary: isDark ? "#b2b2ba" : "#656565",
  };
  const { ScaledText } = evaluate(read("src/components/ScaledText.tsx"), {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": native,
    "../hooks/useScaledTypography": {
      useScaledFontSize: (size) => Math.round(size * multiplier),
    },
  });
  const hooks = {
    memo: (component) => component,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: (work, deps) => {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        old?.cleanup?.();
        slots[index] = { deps, cleanup: work() };
      }
    },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
  };
  const components = evaluate(read("src/components/DailyCheckinCard.tsx"), {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { __esModule: true, default: hooks, ...hooks },
    "react-native": native,
    "expo-router": {
      useFocusEffect: (callback) => {
        focus = callback;
      },
    },
    "@/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ push: (value) => pushes.push(value) }),
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "expo-image": { Image: "Image" },
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "../../assets/images/home/checkin-fine-background-v1.png": "fine-card-image",
    "../../assets/images/home/checkin-unwell-background-v1.png": "unwell-card-image",
    "react-i18next": { useTranslation: () => ({ t }) },
    "./ScaledText": { ScaledText },
    "../features/guidance/GuidanceProvider": { GuideTarget: props => props.children },
    "../features/guidance/useCheckinPracticeEntry": { useCheckinPracticeEntry: () => practice },
    "../hooks/useScaledTypography": { useScaledTypography: () => typography },
    "../hooks/useThemeColors": { useThemeColors: () => ({ isDark }) },
    "../styles": {
      colors,
      radius: { lg: 16, xl: 20 },
      spacing: { xs: 4, md: 12, lg: 16, xxl: 28 },
    },
    "../features/auth/auth.store": { useAuthStore: select => select({ profile: { id: 7 } }) },
    "../features/checkin/checkin-progress": { ...progress.progress, readLocationDraft: async () => draft },
    "../features/checkin/checkin-card-cache": progress.cardCache,
    "../features/checkin/checkin.api": {
      checkinApi: {
        getToday: getToday || (() =>
          fail
            ? Promise.reject(new Error("offline"))
            : Promise.resolve({ ok: true, session })),
      },
    },
  });
  const render = (name) => {
    cursor = 0;
    const nodes = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node.type === "function") return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props?.children);
    };
    visit(components[name]());
    return nodes;
  };
  return {
    render,
    t,
    pushes,
    colors,
    invalidate: () => progress.cardCache.invalidateCheckinCard(7),
    setServerSession: value => { session = value; },
    focus: async () => {
      focus();
      await flush();
    },
  };
}

await test('unfinished check-in guidance opens only practice routes for both real Home controls', async () => {
  const h = harness({ practice: true }); h.render('DailyCheckinCard'); await h.focus();
  h.render('DailyCheckinCard').find(node => node.type === 'Pressable').props.onPress();
  h.render('InstantCheckinCard').find(node => node.type === 'Pressable').props.onPress();
  assert.deepEqual(h.pushes, [
    { pathname: '/checkin', params: { preset_status: 'fine', mode: 'guide' } },
    { pathname: '/checkin', params: { mode: 'guide', entry: 'instant' } },
  ]);
});

for (const language of ["vi", "en"]) {
  for (const isDark of [false, true]) {
    for (const multiplier of [1, 1.6]) {
      await test(`${language}, ${
        isDark ? "dark" : "light"
      }, font ${multiplier}: larger wrapping cards keep their actions`, async () => {
        const h = harness({ language, isDark, multiplier });
        assert.deepEqual(h.render("DailyCheckinCard"), []);
        await h.focus();
        for (const [name, label, fontSize, route] of [
          [
            "DailyCheckinCard",
            "checkinFine",
            30,
            { pathname: "/checkin", params: { preset_status: "fine" } },
          ],
          [
            "InstantCheckinCard",
            "checkinInstantTitle",
            30,
            { pathname: "/checkin", params: { mode: "random" } },
          ],
        ]) {
          const nodes = h.render(name);
          const button = nodes.find((node) => node.type === "Pressable");
          assert.equal(button.props.accessibilityRole, "button");
          assert.equal(button.props.accessibilityLabel, h.t(label));
          const style = flatten(button.props.style({ pressed: false }));
          assert.ok(style.minHeight >= 184);
          assert.ok(style.paddingVertical >= 28);
          assert.equal(
            style.height,
            undefined,
            "cards must grow with wrapping content"
          );
          assert.notEqual(style.overflow, "hidden");
          assert.equal(
            flatten(button.props.style({ pressed: true })).opacity,
            0.9
          );
          const column = nodes.find(
            (node) => node.type === "View" && node.props.style?.flex === 1
          );
          assert.equal(column.props.style.minWidth, 0);
          const title = nodes.find(
            (node) => node.type === "Text" && node.props.children === h.t(label)
          );
          assert.ok(title);
          assert.equal(
            flatten(title.props.style).fontSize,
            Math.round(fontSize * multiplier)
          );
          assert.equal(flatten(title.props.style).color, h.colors.textPrimary);
          for (const text of nodes.filter((node) => node.type === "Text")) {
            assert.equal(
              text.props.numberOfLines,
              undefined,
              "never truncate the action or description"
            );
            assert.ok(
              !text.props.adjustsFontSizeToFit,
              "never shrink text to fit"
            );
            assert.ok(
              flatten(text.props.style).lineHeight >=
                flatten(text.props.style).fontSize * 1.49
            );
          }
          assert.ok(
            nodes.some((node) => node.type === "Icon" && node.props.size >= 48)
          );
          button.props.onPress();
          assert.deepEqual(h.pushes.at(-1), route);
        }
      });
    }
  }
}

await test("the simplified unwell action and contextual guide are available in both languages", () => {
  for (const [language, expected] of [
    ["vi", "Không ổn"],
    ["en", "I'm not feeling well"],
  ]) {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
    assert.equal(catalog.checkinInstantTitle, expected);
    const guide = JSON.parse(read(`src/i18n/locales/${language}/onboarding.json`)).guidance;
    assert.ok(guide.steps.home_unwell.length > 0);
  }
});

const active = {
  id: "demo-session",
  initial_status: "tired",
  triage_completed_at: "2026-10-01T08:00:00Z",
};
for (const [label, session, visible] of [
  [
    "resolved sessions stay hidden",
    { ...active, resolved_at: "2026-10-01T09:00:00Z" },
    false,
  ],
  [
    "scheduled follow-ups are hidden until due",
    { ...active, next_checkin_at: "2099-01-01T09:00:00Z" },
    false,
  ],
  [
    "overdue follow-ups can still be continued",
    { ...active, next_checkin_at: "2000-01-01T09:00:00Z" },
    true,
  ],
  [
    "incomplete triage can be continued before the next reminder",
    {
      ...active,
      triage_completed_at: null,
      next_checkin_at: "2099-01-01T09:00:00Z",
    },
    true,
  ],
  [
    "high-alert follow-up copy is preserved",
    { ...active, flow_state: "high_alert" },
    true,
  ],
]) {
  await test(label, async () => {
    const h = harness({ session });
    h.render("DailyCheckinCard");
    await h.focus();
    const nodes = h.render("DailyCheckinCard");
    assert.equal(nodes.length > 0, visible);
    if (visible) {
      nodes.find((node) => node.type === "Pressable").props.onPress();
      assert.equal(
        h.pushes.at(-1),
        (session.triage_completed_at ? "/checkin?mode=followup&checkin_id=demo-session" : "/checkin?mode=resume&checkin_id=demo-session")
      );
      const key =
        !session.triage_completed_at ? "checkinResumeTitle" : session.flow_state === "high_alert"
          ? "checkinFollowHighAlert"
          : "checkinFollowDefault";
      assert.ok(
        nodes.some(
          (node) => node.type === "Text" && node.props.children === h.t(key)
        )
      );
    }
    assert.ok(
      h.render("InstantCheckinCard").some((node) => node.type === "Pressable"),
      "immediate entry stays available"
    );
  });
}

await test("a failed refresh does not offer a false completed-state reset", async () => {
  const h = harness({ fail: true }); h.render('DailyCheckinCard'); await h.focus();
  assert.deepEqual(h.render('DailyCheckinCard'), []);
  h.render('InstantCheckinCard').find(node => node.type === 'Pressable').props.onPress();
  assert.equal(h.pushes.length, 1);
});
await test('a local position draft exposes Continue before a session is created', async () => {
  const h = harness({ draft: { status: 'tired' } }); h.render('DailyCheckinCard'); await h.focus();
  const nodes = h.render('DailyCheckinCard');
  assert.ok(nodes.some(n => n.type === 'Text' && n.props.children === h.t('checkinResumeTitle')));
  assert.ok(!nodes.some(n => n.type === 'Text' && n.props.children === h.t('checkinFollowTitle')));
  nodes.find(n => n.type === 'Pressable').props.onPress(); assert.equal(h.pushes.at(-1), '/checkin');
});

const homeAst = ts.createSourceFile('home.tsx', read('app/(tabs)/home/index.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let goToCheckinDeclaration;
const findEntry = node => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(homeAst) === 'goToCheckin')) goToCheckinDeclaration = node.getText(homeAst);
  ts.forEachChild(node, findEntry);
};
findEntry(homeAst); assert.ok(goToCheckinDeclaration);
const { makeHomeEntry } = evaluate(`export function makeHomeEntry(checkinApi, isUnfinishedCheckin, readLocationDraft, profileId, router, setShowAlreadyDoneModal, useCallback) {
  ${goToCheckinDeclaration}
  return goToCheckin;
}`, {});
for (const [label, session, draft, expectedModal] of [
  ['pending follow-up after a fine morning', { initial_status: 'fine', current_status: 'tired', triage_completed_at: 'earlier', triage_state: { phase: 'followup' } }, null, false],
  ['completed fine check-in', { initial_status: 'fine', current_status: 'fine', triage_completed_at: 'earlier' }, null, true],
  ['new unfinished location selection after a fine check-in', { initial_status: 'fine', current_status: 'fine' }, { status: 'tired' }, false],
]) {
  await test(`Home mission entry preserves ${label}`, async () => {
    const pushes = [], modals = [];
    const run = makeHomeEntry({ getToday: async () => ({ ok: true, session }) }, progressHarness().progress.isUnfinishedCheckin,
      async () => draft, 7, { push: route => pushes.push(route) }, value => modals.push(value), callback => callback);
    await run(); assert.deepEqual(modals, expectedModal ? [true] : []);
    assert.deepEqual(pushes, expectedModal ? [] : ['/checkin']);
  });
}

await test('confirmed cancellation clears the mounted Home cache before its next focus request', async () => {
  const h = harness({ session: { ...active, triage_completed_at: null } });
  h.render('DailyCheckinCard'); await h.focus();
  assert.equal(h.render('DailyCheckinCard').find(node => node.type === 'Pressable').props.accessibilityLabel, h.t('checkinResumeTitle'));
  h.invalidate();
  assert.deepEqual(h.render('DailyCheckinCard'), [], 'Do not offer the cancelled session while Home refreshes');
  h.setServerSession(null); await h.focus();
  assert.equal(h.render('DailyCheckinCard').find(node => node.type === 'Pressable').props.accessibilityLabel, h.t('checkinFine'));
});
await test('a response started before cancellation cannot repopulate the Home cache', async () => {
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const h = harness({ getToday: () => response });
  h.render('DailyCheckinCard'); await h.focus();
  h.invalidate();
  resolve({ ok: true, session: { ...active, triage_completed_at: null } });
  await flush(); await flush();
  assert.deepEqual(h.render('DailyCheckinCard'), []);
});
await test('an offline Home refresh never brings back the cancelled Continue button', async () => {
  let offline = false;
  const h = harness({ getToday: () => offline ? Promise.reject(new Error('offline')) : Promise.resolve({ ok:true, session:{...active,triage_completed_at:null} }) });
  h.render('DailyCheckinCard'); await h.focus();
  assert.ok(h.render('DailyCheckinCard').some(node => node.type === 'Pressable'));
  h.invalidate(); offline = true; await h.focus();
  assert.deepEqual(h.render('DailyCheckinCard'), []);
});
await test('cancel invalidation belongs to one account and cannot poison another account cache', () => {
  const { cardCache: cache } = progressHarness();
  cache.cacheCheckinCardSession(8, { ...active }, cache.checkinCardRevision(8));
  let updated = 0;
  const unsubscribe = cache.subscribeCheckinCardInvalidation(8, () => { updated++; });
  cache.invalidateCheckinCard(7);
  assert.deepEqual(cache.readCheckinCardCache(8), active);
  assert.equal(updated, 0);
  cache.invalidateCheckinCard(8);
  assert.equal(cache.readCheckinCardCache(8), undefined);
  assert.equal(updated, 1);
  unsubscribe();
});
console.log(`Home check-in cards: ${checks} regressions passed.`);
