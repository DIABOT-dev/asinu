import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, dependencies = {}, isDevelopment = true) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  } }).outputText;
  // Execute actual screen JSX with deterministic hooks and native adapters.
  // eslint-disable-next-line no-new-func
  new Function('__DEV__', 'module', 'exports', 'require', output)(isDevelopment, module, module.exports, id => {
    if (id.endsWith('.png')) return id;
    assert.ok(id in dependencies, `Missing screen adapter ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const state = evaluate(read('src/features/checkin-call/checkin-call.state.ts'));
let checks = 0;
function test(label, run) { run(); checks++; console.log(`PASS ${label}`); }
function render({ lang = 'vi', role = 'USER', triage = false, busy = false, ended = false, hasHistory = false, stopAudio = () => {},
  params = { episodeId: 'episode', attemptId: 'attempt', nativeAnswered: '1' },
  auth = { hydrated: true, loading: false, token: 'test-token', profile: { id: 'test-user' } } } = {}) {
  const catalog = JSON.parse(read(`src/i18n/locales/${lang}/checkinCall.json`));
  const t = (key, values = {}) => {
    const text = key.split('.').reduce((value, part) => value?.[part], catalog) || key;
    return typeof text === 'string' ? text.replace(/\{\{(\w+)\}\}/g, (_, part) => String(values[part] ?? '')) : key;
  };
  let index = 0;
  const values = {
    0: { id: 'attempt', episode_id: 'episode', target_role: role, severity: 'MILD',
      state: 'CONNECTED', episode_state: triage ? 'TRIAGE_USER' : 'CONTACT_USER',
      confirm_deadline: new Date(Date.now() + 90000).toISOString(), next_action_at: new Date(Date.now() + 90000).toISOString() },
    2: true, 3: busy, 4: ended, 6: triage,
  };
  const hooks = {
    createElement: React.createElement, Fragment: React.Fragment,
    useState: initial => [index in values ? values[index++] : (index++, initial), () => {}],
    useRef: initial => ({ current: initial }), useEffect: () => {}, useLayoutEffect: () => {}, useCallback: callback => callback,
  };
  const noop = () => {};
  const navigation = [];
  const audioStops = [];
  const imports = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
      Image: 'Image', Platform: { OS: 'ios' }, AppState: { currentState: 'active' }, StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'expo-router': { Redirect: 'Redirect', useFocusEffect: noop, useLocalSearchParams: () => params },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({
      canGoBack: () => hasHistory,
      back: () => navigation.push({ action: 'back' }),
      replace: route => navigation.push({ action: 'replace', route }),
    }) },
    '@livekit/react-native': { LiveKitRoom: 'Room' }, 'livekit-client': { Room: class {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '@react-native-async-storage/async-storage': { default: {} },
    '../../src/features/checkin-call/checkin-call.api': { checkinCallApi: {} },
    '../../src/features/checkin-call/checkin-call.state': state,
    '../../src/lib/voip': { addVoipCallAnsweredListener: noop, endVoipCall: noop, setVoipCallUIActive: noop, simulateIncomingVoipCall: noop },
    '../../src/features/checkin-call/checkin-call.accept': { acceptCheckinCallOnce: noop },
    '../../src/lib/apiClient': { getApiErrorMessage: noop },
    'react-i18next': { useTranslation: () => ({ t, i18n: { resolvedLanguage: lang } }) },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../src/features/checkin-call/CheckinCallContact': { CheckinCallContact: 'Contact' },
    '../../src/features/checkin-call/CheckinCallSpeech': { CheckinCallSpeech: 'Speech', CheckinCallSafetyNote: 'SafetyNote' },
    '../../src/features/checkin-call/useCheckinCallAudio': { useCheckinCallAudio: () => ({ audio: { prompt: null }, play: noop,
      stopAudio: clearPrompt => { audioStops.push(clearPrompt); return stopAudio(clearPrompt); }, showPrompt: noop }) },
    '../../src/features/checkin-call/CheckinCallPhoneAction': { CheckinCallPhoneAction: 'Phone' },
    '../../src/features/checkin-call/triage-draft': { restoreTriageDraft: noop },
    '../../src/features/checkin-call/triage-draft.storage': {
      triageDraftKey: (account, episode) => account == null ? null : `draft-${account}-${episode}`,
      triageDraftStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    },
    '../../src/features/auth/auth.store': { useAuthStore: selector => selector(auth) },
  };
  const { default: Screen } = evaluate(read('app/checkin-call/[episodeId].tsx'), imports);
  const outer = Screen();
  const tree = typeof outer.type === 'function' ? outer.type(outer.props) : outer;
  const nodes = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node);
    visit(node.props?.children);
  };
  visit(tree);
  return { tree, nodes, t, outer, navigation, audioStops };
}
for (const lang of ['vi', 'en']) for (const [role, triage] of [['USER', false], ['USER', true], ['FAMILY', false]]) {
  test(`${lang} ${role}${triage ? ' triage' : ''}: response is scrollable, safe-area protected and has no connection banner`, () => {
    const h = render({ lang, role, triage });
    assert.equal(h.tree.props.style[1].paddingTop, 59);
    assert.equal(h.tree.props.style[1].paddingBottom, 34);
    assert.ok(h.nodes.some(node => node.type === 'ScrollView'));
    const displayed = h.nodes.filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
    for (const key of ['statusConnecting', 'statusConnected', 'statusConnectionUnavailable', 'statusNoLiveKit']) assert.ok(!displayed.includes(h.t(key)));
    assert.ok(!displayed.includes(h.t('responseCountdown', { seconds: 90 })) && !displayed.includes(h.t('responseDeadline')));
    const speech = h.nodes.filter(node => node.type === 'Speech');
    assert.ok(speech.length > 0);
    assert.ok(speech.every(node => node.props.showTranscript === false));
    assert.equal(h.nodes.filter(node => node.type === 'SafetyNote').length, role === 'USER' ? 1 : 0,
      'The user safety notice stays visible once, including while the prompt is loading');
    const actions = h.nodes.filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
    assert.ok(actions.length > 0);
    if (role === 'USER' && !triage) {
      assert.equal(actions.length, 3);
      assert.deepEqual(actions.map(node => node.props.accessibilityLabel), ['choiceOk', 'choiceMild', 'choiceUrgent'].map(h.t));
      assert.ok(!displayed.includes(h.t('answerCall')), 'Accepted calls must not ask for acceptance again');
      const heading = h.nodes.find(node => node.type === 'Text' && node.props.children === h.t('userHeading'));
      assert.equal(heading.props.style.fontWeight, '700');
      assert.equal(heading.props.style.lineHeight, 32);
      assert.equal(heading.props.style.width, '100%');
      assert.equal(heading.props.numberOfLines, undefined);
      for (const choice of actions) {
        const label = choice.props.children.find(node => node?.type === 'Text');
        assert.equal(label.props.style[0].flex, 1);
        assert.equal(label.props.numberOfLines, undefined, 'Large-font text must wrap, not truncate');
        assert.equal(typeof choice.props.onPress, 'function');
      }
    }
  });
}
test('cold-start hydration gates the API/audio component instead of making unauthenticated requests', () => {
  const h = render({ auth: { hydrated: false, loading: true, token: null } });
  assert.ok(h.nodes.some(node => node.type === 'ActivityIndicator'));
  assert.equal(typeof h.outer.type, 'string');
});
test('logged-out call routes go to app login without mounting protected UI', () => {
  const h = render({ auth: { hydrated: true, loading: false, token: null } });
  assert.equal(h.tree.type, 'Redirect'); assert.equal(h.tree.props.href, '/login');
});
test('the response component key never exposes the session token', () => {
  const h = render(); assert.equal(h.outer.key, JSON.stringify(['test-user', 'episode', 'attempt']));
});
test('a new attempt on the same route gets fresh audio, triage and submission refs', () => {
  const first = render();
  const second = render({ params: { episodeId: 'episode', attemptId: 'next-attempt', nativeAnswered: '1' } });
  assert.notEqual(first.outer.key, second.outer.key);
});
test('native answer upgrades the same call without remounting or replaying its audio', () => {
  const first = render({ params: { episodeId: 'episode', attemptId: 'attempt' } });
  const second = render();
  assert.equal(first.outer.key, second.outer.key);
});
test('saving disables all three health buttons to prevent repeated submissions', () => {
  const h = render({ busy: true });
  const choices = h.nodes.filter(node => node.type === 'Pressable' && node.props.accessibilityLabel);
  assert.equal(choices.length, 3);
  assert.ok(choices.every(node => node.props.disabled && node.props.accessibilityState.disabled));
});
for (const lang of ['vi', 'en']) for (const hasHistory of [false, true]) {
  test(`${lang}: Close returns completed calls to Home with ${hasHistory ? 'an existing' : 'no'} navigation history`, () => {
    const h = render({ lang, ended: true, hasHistory });
    const close = h.nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('close'));
    assert.ok(close); close.props.onPress();
    assert.deepEqual(h.navigation, [{ action: 'replace', route: '/(tabs)/home' }]);
    assert.deepEqual(h.audioStops, [true]);
  });
}
test('slow audio cleanup cannot keep the completed call screen open', () => {
  const h = render({ ended: true, stopAudio: () => new Promise(() => {}) });
  h.nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('close')).props.onPress();
  assert.deepEqual(h.navigation, [{ action: 'replace', route: '/(tabs)/home' }]);
});
const theme = evaluate(read('src/styles/theme.ts'));
const speechNodes = tree => {
  const nodes = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node); visit(node.props?.children);
  };
  visit(tree);
  return nodes;
};
const flatten = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));

for (const lang of ['vi', 'en']) for (const mode of ['light', 'dark']) for (const multiplier of [1, 1.25]) {
test(`${lang} ${mode} font ${multiplier}: playback actions, status and safety use the app theme without truncation`, () => {
  const catalog = JSON.parse(read(`src/i18n/locales/${lang}/checkinCall.json`));
  const t = key => key.split('.').reduce((value, part) => value?.[part], catalog) || key;
  const colors = mode === 'light' ? theme.lightColors : theme.darkColors;
  const imports = {
    react: { __esModule: true, default: React, useMemo: create => create() },
    'react-native': { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: styles => styles, hairlineWidth: 0.5 } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t }) },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors }) },
    '../../stores/font-size.store': { useFontSizeStore: selector => selector({ multiplier }) },
    '../../styles/theme': theme,
  };
  const { CheckinCallSpeech, CheckinCallSafetyNote } = evaluate(read('src/features/checkin-call/CheckinCallSpeech.tsx'), imports);
  const onReplay = () => {}, onStop = () => {};
  const prompt = { key: 'user_prompt', text: 'Long spoken transcript', language: lang };
  for (const phase of ['idle', 'loading', 'playing', 'finished', 'error']) {
    const tree = CheckinCallSpeech({ audio: { phase, prompt },
      disabled: false, showTranscript: false, onReplay, onStop });
    const nodes = speechNodes(tree);
    assert.ok(!nodes.some(node => node.type === 'Text' && node.props.children === 'Long spoken transcript'));
    const status = nodes.find(node => node.type === 'Text' && node.props.accessibilityLiveRegion === 'polite');
    assert.equal(status.props.children, t(`playback.${phase}`));
    assert.equal(status.props.style.color, colors.primaryText);
    assert.equal(tree.props.children[0].props.style.backgroundColor, colors.primaryLight);
    assert.equal(nodes.some(node => node.type === 'Spinner'), phase === 'loading');
    assert.equal(nodes.some(node => node.props.importantForAccessibility === 'no-hide-descendants'), phase === 'playing');
    assert.equal(nodes.some(node => node.type === 'Text' && node.props.children === t('playback.errorHint')), phase === 'error');
    assert.equal(nodes.filter(node => node.type === 'Pressable').length, 2, 'Both controls stay in the layout after playback');
    const replay = nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('replay'));
    assert.equal(replay.props.onPress, onReplay);
    assert.equal(replay.props.disabled, false);
    const stop = nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('playback.stop'));
    assert.equal(stop.props.onPress, onStop);
    assert.equal(stop.props.disabled, !(phase === 'loading' || phase === 'playing'));
    assert.equal(stop.props.accessibilityState.disabled, stop.props.disabled);
    for (const control of [replay, stop]) {
      const style = flatten(control.props.style({ pressed: false }));
      assert.ok(style.minHeight >= 44);
      assert.equal(style.flexGrow, 1);
      assert.ok(style.flexBasis * 2 + theme.spacing.md <= 320 === (multiplier === 1),
        'At 320px the actions fit together at normal font size and wrap at the largest app size');
      const label = control.props.children.find(node => node.type === 'Text');
      assert.equal(label.props.numberOfLines, undefined);
      assert.equal(label.props.ellipsizeMode, undefined);
    }
  }
  for (const phase of ['idle', 'loading', 'playing', 'finished', 'error']) {
    const previewNodes = speechNodes(CheckinCallSpeech({ audio: { phase, prompt }, disabled: false,
      readOnly: true, onReplay, onStop }));
    const controls = previewNodes.filter(node => node.type === 'Pressable');
    assert.equal(controls.length, 2);
    assert.ok(controls.every(node => node.props.disabled && node.props.accessibilityState.disabled));
    assert.ok(controls.every(node => node.props.onPress === undefined), 'Preview controls have no touch, keyboard or accessibility action');
  }
  const busyNodes = speechNodes(CheckinCallSpeech({ audio: { phase: 'playing', prompt }, disabled: true, onReplay, onStop }));
  const busyReplay = busyNodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('replay'));
  assert.ok(busyReplay.props.disabled && busyReplay.props.accessibilityState.disabled);
  assert.equal(busyNodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('playback.stop')).props.disabled, false,
    'Saving a response must not prevent silencing speech');
  assert.equal(CheckinCallSpeech({ audio: { phase: 'idle', prompt: null }, disabled: false, onReplay, onStop }), null);
  const notice = speechNodes(CheckinCallSafetyNote());
  const safetyText = notice.find(node => node.type === 'Text');
  assert.equal(safetyText.props.children, t('safetyNote'));
  assert.equal(safetyText.props.style.color, colors.textSecondary);
  assert.equal(safetyText.props.numberOfLines, undefined);
  assert.equal(notice.find(node => node.type === 'Icon').props.color, colors.primaryText);
});
}

for (const lang of ['vi', 'en']) test(`${lang}: all 40 previews stay read-only and the separate gift demo is interactive`, () => {
  const catalogs = Object.fromEntries(['checkinCall', 'common', 'home'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${lang}/${ns}.json`))]));
  const t = (key, options = {}) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], catalogs[options.ns || 'checkinCall']);
    assert.equal(typeof value, 'string', `Missing ${lang} gallery copy: ${key}`);
    return value.replace(/\{\{(\w+)\}\}/g, (_, part) => String(options[part] ?? ''));
  };
  let selected = null, androidBack;
  let refs = [], refCursor = 0;
  const navigation = [];
  const demoNavigation = [];
  const hooks = { createElement: React.createElement, Fragment: React.Fragment,
    useMemo: work => work(), useCallback: work => work,
    useRef: initial => refs[refCursor++] ??= { current: initial },
    useState: () => [selected, value => { selected = value; }] };
  const { CHECKIN_UI_PREVIEWS } = evaluate(read('src/features/checkin/checkin-ui-gallery.ts'));
  const adapters = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', Switch: 'Switch',
      BackHandler: { addEventListener: (_event, callback) => { androidBack = callback; return { remove() {} }; } },
      StyleSheet: { create: value => value, hairlineWidth: 0.5, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'expo-router': { Redirect: 'Redirect', useFocusEffect: work => work() },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({ back: () => navigation.push('back'), push: route => demoNavigation.push(route) }) },
    'react-i18next': { useTranslation: ns => ({ t: (key, options) => t(key, { ns, ...options }), i18n: { resolvedLanguage: lang } }) },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../checkin': { CheckinUiPreview: 'CheckinPreview' },
    '../../src/features/checkin/checkin-ui-gallery': { CHECKIN_UI_PREVIEWS },
    '../../src/features/checkin-call/voice-preferences': evaluate(read('src/features/checkin-call/voice-preferences.ts')),
    '../../src/features/checkin-call/CheckinCallSpeech': { CheckinCallSpeech: 'Speech', CheckinCallSafetyNote: 'Safety' },
    '../../src/lib/appEnv': { isDevBuild: true, isCheckinUiGalleryEnabled: true },
    'react-native-svg': { __esModule: true, default: 'Svg', Svg: 'Svg', Path: 'Path' },
  };
  const { default: Gallery } = evaluate(read('app/checkin-call/ui-gallery.tsx'), adapters);
  const expand = tree => !tree || typeof tree !== 'object' ? tree : Array.isArray(tree) ? tree.map(expand)
    : typeof tree.type === 'function' ? expand(tree.type(tree.props))
    : { ...tree, props: { ...tree.props, children: expand(tree.props?.children) } };
  const renderGallery = () => { refCursor = 0; return speechNodes(expand(Gallery())); };
  const menu = renderGallery();
  assert.deepEqual(menu.find(node => node.type === 'ScrollView').props.contentOffset ?? { x: 0, y: 0 }, { x: 0, y: 0 });
  const demoButton = menu.find(node => node.type === 'Pressable' && speechNodes(node).some(child =>
    child.type === 'Text' && child.props.children === t('checkinGift.demoTry', { ns: 'home' })));
  assert.ok(demoButton, 'Missing separate interactive gift demo entry');
  demoButton.props.onPress();
  assert.deepEqual(demoNavigation, ['/checkin-rewards/demo']);
  const rows = menu.filter(node => node.type === 'Pressable' && node.props.accessibilityLabel &&
    node.props.accessibilityLabel !== t('back', { ns: 'common' }));
  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map(row => row.props.accessibilityLabel)).size, 40);
  for (const [index, row] of rows.entries()) {
    const catalogueScroll = renderGallery().find(node => node.type === 'ScrollView');
    const scrolledY = [0, 1250.5, 3500, -32][index % 4];
    catalogueScroll.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: scrolledY } } });
    row.props.onPress();
    const tree = renderGallery();
    // The frame blocks its descendants, while its parent ScrollView remains interactive.
    const frames = tree.filter(node => node.props.pointerEvents === 'none');
    const frame = frames.find(node => speechNodes(node).some(child => ['Text', 'CheckinPreview'].includes(child.type)));
    assert.ok(frame, `Missing read-only frame for ${selected}`);
    const scroll = tree.find(node => node.type === 'ScrollView');
    assert.ok(scroll && scroll.props.pointerEvents !== 'none');
    assert.deepEqual(scroll.props.contentOffset ?? { x: 0, y: 0 }, { x: 0, y: 0 }, 'Each preview starts at the top, independently of the catalogue');
    assert.ok(speechNodes(scroll).includes(frame));
    for (const child of speechNodes(frame)) {
      assert.notEqual(child.type, 'Pressable', `${selected}: interactive preview button`);
      if (child.type === 'Switch') assert.equal(child.props.disabled, true);
      if (child.type === 'Speech') assert.equal(child.props.readOnly, true);
      if (child.type === 'CheckinPreview') assert.ok(CHECKIN_UI_PREVIEWS.some(item => item.id === child.props.id));
    }
    const back = tree.find(node => node.type === 'Pressable');
    assert.ok(back.props.style.width >= 44);
    back.props.onPress();
    assert.equal(selected, null);
    assert.deepEqual(navigation, []);
    assert.deepEqual(renderGallery().find(node => node.type === 'ScrollView').props.contentOffset,
      { x: 0, y: Math.max(0, scrolledY) }, 'Header back restores the catalogue position, including near the bottom');
  }
  renderGallery().find(node => node.type === 'ScrollView').props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 4800 } } });
  rows.at(-1).props.onPress(); renderGallery();
  assert.equal(androidBack(), true);
  assert.equal(selected, null);
  const returned = renderGallery();
  assert.deepEqual(returned.find(node => node.type === 'ScrollView').props.contentOffset, { x: 0, y: 4800 }, 'Android Back also restores the catalogue position');
  returned.find(node => node.type === 'Pressable').props.onPress();
  assert.deepEqual(navigation, ['back']);
  refs = [];
  assert.deepEqual(renderGallery().find(node => node.type === 'ScrollView').props.contentOffset, { x: 0, y: 0 }, 'A fresh gallery visit starts at the top');
  for (const [isDevelopment, isDevBuild, isCheckinUiGalleryEnabled] of [[false, true, true], [false, false, true], [true, false, true], [true, true, false]]) {
    const { default: RestrictedGallery } = evaluate(read('app/checkin-call/ui-gallery.tsx'), {
      ...adapters, '../../src/lib/appEnv': { isDevBuild, isCheckinUiGalleryEnabled },
    }, isDevelopment);
    const restricted = RestrictedGallery();
    assert.equal(restricted.type, 'Redirect', 'Preview links must redirect when disabled or outside development');
    assert.equal(restricted.props.href, '/(tabs)/profile');
  }
});
test('Profile hides the paused preview library and retains its development gate when restored', () => {
  assert.equal(evaluate(read('src/lib/appEnv.ts')).isCheckinUiGalleryEnabled, false);
  const file = ts.createSourceFile('profile.tsx', read('app/(tabs)/profile/index.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let entry;
  const visit = node => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onPress' && node.getText(file).includes('/checkin-call/ui-gallery')) entry = node;
    ts.forEachChild(node, visit);
  };
  visit(file); assert.ok(entry);
  let gatedEntry;
  for (let node = entry.parent; node; node = node.parent) {
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)) gatedEntry = node.expression;
  }
  assert.ok(gatedEntry, 'The profile preview entry must have a development gate');
  const source = `import React from 'react';
    import { isDevBuild, isCheckinUiGalleryEnabled } from '../../../src/lib/appEnv';
    const TouchableOpacity = 'Button', View = 'View', Text = 'Text', Ionicons = 'Icon';
    const styles = {}, t = key => key, router = { push() {} };
    export default () => (${gatedEntry.getText(file)});`;
  for (const isDevelopment of [false, true]) for (const environment of ['dev', 'staging', 'prod']) for (const isCheckinUiGalleryEnabled of [false, true]) {
    const { default: PreviewEntry } = evaluate(source, {
      react: { __esModule: true, default: React },
      '../../../src/lib/appEnv': { isDevBuild: environment === 'dev', isCheckinUiGalleryEnabled },
    }, isDevelopment);
    const rendered = PreviewEntry();
    assert.equal(React.isValidElement(rendered), isDevelopment && environment === 'dev' && isCheckinUiGalleryEnabled,
      `Unexpected preview visibility: __DEV__=${isDevelopment}, environment=${environment}`);
  }
});

console.log(`Check-in screen: ${checks} rendered JSX regressions passed.`);
