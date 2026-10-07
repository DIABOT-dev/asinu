import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const routeFile = ts.createSourceFile('checkin.tsx', read('app/checkin/index.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const extract = name => {
  const node = routeFile.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
  assert.ok(node, `Missing actual check-in function: ${name}`);
  return node.getText(routeFile);
};
const jsx = (type, props) => ({ type, props });
function evaluate(source, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports, id => {
    assert.equal(id, 'react/jsx-runtime', `Practice must not import a network/storage dependency: ${id}`);
    return { jsx, jsxs: jsx };
  }, ...Object.values(globals));
  return module.exports;
}
const { createCheckinPractice } = evaluate(read('src/features/guidance/checkin.practice.ts'));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }
function hooks() {
  const slots = []; let cursor = 0, pending = [];
  const memo = (work, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  return {
    useRef: initial => slots[cursor++] ??= { current: initial },
    useState: initial => {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useMemo: memo, useCallback: (work, deps) => memo(() => work, deps),
    useEffect: (work, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        slots[index] = { deps }; pending.push(() => { old?.cleanup?.(); slots[index].cleanup = work(); });
      }
    },
    async settle(work) {
      let tree;
      for (let i = 0; i < 4; i++) {
        cursor = 0; tree = work(); const effects = pending; pending = []; effects.forEach(run => run()); await tick();
      }
      return tree;
    },
  };
}
function translations(language) {
  const catalogs = Object.fromEntries(['home', 'onboarding'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`))]));
  const get = (ns, key, options = {}) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], catalogs[options.ns || ns]);
    assert.notEqual(value, undefined, `Missing ${language}/${options.ns || ns}/${key}`);
    return value;
  };
  const t = (key, options) => get('home', key, options);
  const tg = (key, options) => get('onboarding', key, options);
  return { t, tg, useTranslation: ns => ({ t: ns === 'onboarding' ? tg : t, i18n: { resolvedLanguage: language } }) };
}
const animation = { duration: () => animation, delay: () => animation };
const native = { View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'ScrollView',
  ActivityIndicator: 'Spinner', Ionicons: 'Icon', MaterialCommunityIcons: 'Icon', Stack: { Screen: 'Stack' },
  GuidePracticeScope: 'PracticeScope', GuideScrollScope: 'ScrollScope', GuideTarget: 'GuideTarget',
  ScreenBackButton: 'Back', AppAlertModal: 'Alert', AiDataConsentModal: 'Consent',
  Animated: { View: 'Animated' }, FadeIn: animation, FadeInDown: animation, FadeInLeft: animation,
  Svg: 'Svg', Path: 'Path', CheckinHeroBadge: 'Badge', guideColors: { background: '#f9fcfb', ink: '#123b35',
    actionBackground: '#08b8a2', onAction: '#061c19' }, colors: { primary: '#08b8a2' } };
function routeHarness(language, params = { mode: 'guide' }, guidance = {}) {
  const runtime = hooks(), calls = { network: [], consent: 0, progress: [], finished: [], routes: [], alerts: [], audio: [] };
  const tr = translations(language);
  const guideState = { account: '7', ready: true,
    progress: { firstCheckin: false, welcomeSeen: true, completed: [], epoch: 0 }, ...guidance,
    update: patch => {
      calls.progress.push(patch);
      guideState.progress = { ...guideState.progress, ...patch,
        completed: [...new Set([...guideState.progress.completed, ...(patch.completed || [])])] };
    }, acknowledge: id => {
      calls.finished.push(id);
      guideState.progress.completed = [...new Set([...guideState.progress.completed, id])];
    } };
  const useGuidanceStore = Object.assign(select => select(guideState), { getState: () => guideState });
  const real = createCheckinPractice(tr.t);
  const realApi = Object.fromEntries(Object.keys(real).map(name => [name, async (...args) => {
    calls.network.push([name, ...args]); const response = await real[name](...args);
    if (response.session) response.session = { ...response.session, id: 500, user_id: 7 };
    return response;
  }]));
  const router = { canGoBack: () => true, back: () => calls.routes.push('back'), replace: route => calls.routes.push(route) };
  const source = `${extract('CheckinScreen')}\nmodule.exports = CheckinScreen;`;
  const CheckinScreen = evaluate(source, { ...native, ...runtime, ...tr, useLocalSearchParams: () => params,
    useReviewGuidance: () => () => {}, useRouter: () => router, useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
    useScaledTypography: () => ({}), useThemeColors: () => ({ isDark: false }), createStyles: () => ({}),
    useAppAlert: () => ({ alertState: {}, showAlert: (...args) => calls.alerts.push(args), dismissAlert() {} }),
    useAuthStore: select => select({ profile: { id: 7 } }), useGuidanceStore,
    useLanguageStore: () => ({ language }), createCheckinPractice, checkinApi: realApi,
    hasAiDataConsent: async () => { calls.consent++; return true; }, showToast() {},
    guidanceAudio: { stop: async () => calls.audio.push('stop') }, Platform: { OS: 'ios' },
    StatusScreen: 'Status', LocationScreen: 'Location', TriageScreen: 'Question', DoneScreen: 'Result',
    getLocalFallbackQuestion: () => assert.fail('Practice must not require an API fallback'), __DEV__: false });
  return { calls, guideState, settle: () => runtime.settle(() => CheckinScreen()) };
}
for (const language of ['vi', 'en']) {
  for (const status of ['fine', 'tired', 'very_tired', 'specific_concern']) {
    await test(`${language}/${status}: actual tutorial handlers finish without health, AI, call or first-check-in writes`, async () => {
      // Even a stale real check-in ID cannot escape the local practice client.
      const h = routeHarness(language, { mode: 'guide', checkin_id: '500' });
      let tree = await h.settle();
      await nodes(tree).find(node => node.type === 'Status').props.onSelect(status); tree = await h.settle();
      if (['tired', 'very_tired'].includes(status)) {
        await nodes(tree).find(node => node.type === 'Location').props.onConfirm(['head'], 'example'); tree = await h.settle();
      }
      if (status !== 'fine') {
        const layouts = [];
        for (let i = 0; i < 4; i++) {
          const question = nodes(tree).find(node => node.type === 'Question'); assert.ok(question, `Question ${i}`);
          assert.equal(question.props.practice, true);
          layouts.push(question.props.options.length === 0 ? 'text' : question.props.multiSelect ? 'multiple' : 'single');
          await question.props.onAnswer('private practice answer'); tree = await h.settle();
        }
        assert.deepEqual(layouts, ['multiple', 'single', 'text', 'multiple']);
      }
      const result = nodes(tree).find(node => node.type === 'Result'); assert.ok(result);
      assert.equal(result.props.session.id, -1); assert.equal(result.props.practice, true);
      assert.deepEqual(h.calls.network, []); assert.equal(h.calls.consent, 0);
      assert.deepEqual(h.calls.progress, [{ completed: ['checkin.practice'] }], 'Only the first guide visit is remembered');
      result.props.onClose(); assert.deepEqual(h.calls.finished, ['checkin.finished']);
      assert.deepEqual(h.calls.routes, ['back']); assert.deepEqual(h.calls.alerts, []);
    });
  }
  await test(`${language}: replay and example follow-ups remain local and start a fresh guide session`, async () => {
    const h = routeHarness(language, { mode: 'guide', preset_status: 'fine' });
    let tree = await h.settle(); const run = tree.props.runKey;
    let result = nodes(tree).find(node => node.type === 'Result'); assert.ok(result);
    result.props.onRepeatPractice(true); tree = await h.settle();
    assert.notEqual(tree.props.runKey, run);
    assert.equal(nodes(tree).find(node => node.type === 'Status').props.isFollowUp, true);
    await nodes(tree).find(node => node.type === 'Status').props.onSelect('tired'); tree = await h.settle();
    assert.ok(nodes(tree).some(node => node.type === 'Question'));
    assert.deepEqual(h.calls.network, []); assert.equal(h.calls.consent, 0);
  });
  await test(`${language}: normal check-in still uses its real save and first-check-in progress`, async () => {
    const h = routeHarness(language, { mode: 'random' }); let tree = await h.settle();
    await nodes(tree).find(node => node.type === 'Status').props.onSelect('fine'); tree = await h.settle();
    assert.deepEqual(h.calls.network.map(call => call[0]), ['start']);
    assert.equal(nodes(tree).find(node => node.type === 'Result').props.practice, false);
    assert.deepEqual(h.calls.progress, [{ firstCheckin: true }]);
    nodes(tree).find(node => node.type === 'Result').props.onClose(); assert.deepEqual(h.calls.finished, []);
  });
  await test(`${language}: leaving the first tutorial early remembers the visit, not a completion or a health check-in`, async () => {
    const h = routeHarness(language);
    const tree = await h.settle();
    assert.equal(tree.props.enabled, true);
    nodes(tree).find(node => node.type === 'Back').props.onPress();
    assert.deepEqual(h.calls.routes, ['back']);
    assert.deepEqual(h.guideState.progress.completed, ['checkin.practice']);
    assert.equal(h.guideState.progress.firstCheckin, false);
    assert.deepEqual(h.calls.finished, []);
    assert.deepEqual(h.calls.network, []);
    await h.settle();
    assert.deepEqual(h.calls.progress, [{ completed: ['checkin.practice'] }]);
    const normal = routeHarness(language, { mode: 'random' }, { progress: h.guideState.progress });
    const normalTree = await normal.settle();
    assert.equal(normalTree.props.enabled, false);
    assert.equal(nodes(normalTree).find(node => node.type === 'Status').props.practice, false);
    assert.deepEqual(normal.calls.progress, []);
  });
  await test(`${language}: explicitly reopening an already-seen guide still works without rewriting progress`, async () => {
    const h = routeHarness(language, { mode: 'guide', guide: 'manual-replay' }, {
      progress: { firstCheckin: true, welcomeSeen: true, completed: ['checkin.practice', 'checkin.finished'], epoch: 0 },
    });
    let tree = await h.settle();
    assert.equal(tree.props.enabled, true);
    assert.equal(nodes(tree).find(node => node.type === 'Status').props.practice, true);
    await nodes(tree).find(node => node.type === 'Status').props.onSelect('tired');
    tree = await h.settle();
    assert.equal(nodes(tree).find(node => node.type === 'Location').props.practice, true);
    assert.deepEqual(h.calls.progress, []); assert.deepEqual(h.calls.network, []);
  });
  await test(`${language}: a guide visit cannot be saved to another account or before progress is ready`, async () => {
    for (const state of [{ account: 'other-account' }, { ready: false }]) {
      const h = routeHarness(language, { mode: 'guide' }, state);
      await h.settle();
      assert.deepEqual(h.calls.progress, []);
      assert.deepEqual(h.calls.network, []);
    }
    const delayed = routeHarness(language, { mode: 'guide' }, { ready: false });
    await delayed.settle();
    delayed.guideState.ready = true; await delayed.settle();
    assert.deepEqual(delayed.calls.progress, [{ completed: ['checkin.practice'] }]);
  });
  await test(`${language}: all example result levels explain actions but never call, consult or synthesize`, async () => {
    const runtime = hooks(), tr = translations(language), calls = { network: [], playback: [], repeats: [] };
    const router = { push: route => calls.network.push(route) };
    const stop = async () => {};
    const DoneScreen = evaluate(`${extract('stripEmojis')}\n${extract('extractRecordedSymptoms')}\n${extract('DoneScreen')}\nmodule.exports = DoneScreen;`, {
      ...native, ...runtime, ...tr, useRouter: () => router,
      useCheckinCallAudio: () => ({ audio: { phase: 'idle' }, play: (...args) => calls.network.push(args), stopAudio: stop }),
      Linking: { openURL: uri => { calls.network.push(uri); return Promise.resolve(); } }, showToast() {},
      guidanceAudio: { stop, speak: (...args) => calls.playback.push(args) } });
    const props = { styles: {}, session: (await createCheckinPractice(tr.t).start('tired')).session,
      triageSummary: { severity: 'medium', summary: 'example', recommendation: 'example', needsDoctor: false,
        show_urgent_caregiver_warning: true },
      answers: [], isFollowUp: false, practice: true, onClose() {}, onRepeatPractice: value => calls.repeats.push(value) };
    let tree = await runtime.settle(() => DoneScreen(props));
    assert.deepEqual(calls.network, []);
    for (const step of ['checkin.result_status', 'checkin.result_symptoms', 'checkin.result_advice',
      'checkin.result_replay', 'checkin.result_doctor', 'checkin.result_family', 'checkin.result_variants', 'checkin.result_close']) {
      assert.ok(nodes(tree).some(node => node.type === 'GuideTarget' && node.props.step === step), step);
    }
    for (const level of ['low', 'medium', 'high', 'emergency']) {
      const label = tr.t(`guidance.${level === 'low' ? 'practiceVariantLow' : level === 'medium' ? 'practiceVariantMedium' : level === 'high' ? 'practiceVariantHigh' : 'practiceVariantEmergency'}`, { ns: 'onboarding' });
      const variants = nodes(tree).find(node => node.type === 'GuideTarget' && node.props.step === 'checkin.result_variants');
      nodes(variants).find(node => node.type === 'Pressable' && nodes(node).some(child => child.type === 'Text' && child.props.children === label)).props.onPress();
      tree = await runtime.settle(() => DoneScreen(props));
      for (const step of ['checkin.result_doctor', 'checkin.result_emergency']) {
        const target = nodes(tree).find(node => node.type === 'GuideTarget' && node.props.step === step);
        if (target) nodes(target).find(node => node.type === 'Pressable').props.onPress();
      }
      const replay = nodes(tree).find(node => node.type === 'GuideTarget' && node.props.step === 'checkin.result_replay');
      nodes(replay).find(node => node.type === 'Pressable').props.onPress();
      const caregiver = nodes(tree).find(node => node.type === 'Pressable' && nodes(node)
        .some(child => child.type === 'Text' && child.props.children === tr.t('checkinCaregiverUrgentTitle')));
      assert.ok(caregiver); caregiver.props.onPress();
    }
    assert.deepEqual(calls.network, []);
    assert.deepEqual(calls.playback, Array(4).fill(['practice_result', language, true]));
  });
}
await test('route identity remounts practice and real sessions rather than sharing private answer state', () => {
  assert.match(extract('CheckinRoute'), /key=\{.*params\.mode.*params\.checkin_id.*params\.guide/);
  assert.match(extract('CheckinScreen'), /isPractice \? createCheckinPractice\(t\) : checkinApi/);
  assert.doesNotMatch(extract('CheckinScreen'), /checkinApi\.(start|triage|followUp)/);
});
console.log(`Check-in practice: ${checks} runtime regressions passed.`);
