import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  } }).outputText;
  // Execute actual screen JSX with deterministic hooks and native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id.endsWith('.png')) return id;
    assert.ok(id in dependencies, `Missing screen adapter ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const state = evaluate(read('src/features/checkin-call/checkin-call.state.ts'));
let checks = 0;
function test(label, run) { run(); checks++; console.log(`PASS ${label}`); }
function render({ lang = 'vi', role = 'USER', triage = false, busy = false,
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
    2: true, 3: busy, 6: triage,
  };
  const hooks = {
    createElement: React.createElement, Fragment: React.Fragment,
    useState: initial => [index in values ? values[index++] : (index++, initial), () => {}],
    useRef: initial => ({ current: initial }), useEffect: () => {}, useLayoutEffect: () => {}, useCallback: callback => callback,
  };
  const noop = () => {};
  const imports = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
      Image: 'Image', Platform: { OS: 'ios' }, AppState: { currentState: 'active' }, StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'expo-router': { Redirect: 'Redirect', useFocusEffect: noop, useLocalSearchParams: () => ({ episodeId: 'episode', attemptId: 'attempt', nativeAnswered: '1' }), useRouter: () => ({ back: noop, replace: noop }) },
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
    '../../src/features/checkin-call/CheckinCallSpeech': { CheckinCallSpeech: 'Speech' },
    '../../src/features/checkin-call/useCheckinCallAudio': { useCheckinCallAudio: () => ({ audio: { prompt: null }, play: noop, stopAudio: noop }) },
    '../../src/features/checkin-call/CheckinCallPhoneAction': { CheckinCallPhoneAction: 'Phone' },
    '../../src/features/checkin-call/triage-draft': { restoreTriageDraft: noop },
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
  return { tree, nodes, t, outer };
}
for (const lang of ['vi', 'en']) for (const [role, triage] of [['USER', false], ['USER', true], ['FAMILY', false]]) {
  test(`${lang} ${role}${triage ? ' triage' : ''}: response is scrollable, safe-area protected and has no connection banner`, () => {
    const h = render({ lang, role, triage });
    assert.equal(h.tree.props.style[1].paddingTop, 59);
    assert.equal(h.tree.props.style[1].paddingBottom, 34);
    assert.ok(h.nodes.some(node => node.type === 'ScrollView'));
    const displayed = h.nodes.filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
    for (const key of ['statusConnecting', 'statusConnected', 'statusConnectionUnavailable', 'statusNoLiveKit']) assert.ok(!displayed.includes(h.t(key)));
    assert.ok(displayed.includes(h.t('responseCountdown', { seconds: 90 })) || /89/.test(displayed));
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
  const h = render(); assert.equal(h.outer.key, 'test-user');
});
test('saving disables all three health buttons to prevent repeated submissions', () => {
  const h = render({ busy: true });
  const choices = h.nodes.filter(node => node.type === 'Pressable' && node.props.accessibilityLabel);
  assert.equal(choices.length, 3);
  assert.ok(choices.every(node => node.props.disabled && node.props.accessibilityState.disabled));
});
console.log(`Check-in screen: ${checks} rendered JSX regressions passed.`);
