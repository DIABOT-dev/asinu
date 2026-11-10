import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { progressHarness } from './helpers/checkin-progress-harness.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const routeFile = ts.createSourceFile('checkin.tsx', read('app/checkin/index.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const locationFile = ts.createSourceFile('location.tsx', read('src/features/checkin/CheckinLocationFlow.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const extract = name => {
  if (name === 'LocationScreen') {
    const node = locationFile.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'CheckinLocationFlow');
    assert.ok(node); return node.getText(locationFile).replace('export function CheckinLocationFlow', 'function LocationScreen');
  }
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
const locationDetailsHelpers = evaluate(read('src/features/checkin/location-details.ts'));
const conclusionHelpers = evaluate(read('src/features/checkin/checkin-conclusion.ts'));
const cancellationFile = ts.createSourceFile('cancel.ts', read('src/features/checkin/useCheckinCancellation.ts'), ts.ScriptTarget.Latest, true);
const cancellationFunction = cancellationFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useCheckinCancellation').getText(cancellationFile);
const { createCheckinPractice } = evaluate(read('src/features/guidance/checkin.practice.ts'));
const triageSelection = progressHarness().selection;
const triageOptionDisplay = evaluate(read('src/features/checkin/triage-option-display.ts'));
assert.equal(triageOptionDisplay.formatTriageOptionLabel('yếu hoặc tê cả hai chân (hội chứng đuôi ngựa)'), 'Yếu hoặc tê cả hai chân');
assert.equal(triageOptionDisplay.formatTriageOptionLabel('sốt cao kèm sưng đỏ khớp (nghi nhiễm trùng khớp)'), 'Sốt cao kèm sưng đỏ khớp');
assert.equal(triageOptionDisplay.formatTriageOptionLabel('sụt cân nhanh (trên 5kg/tháng)'), 'Sụt cân nhanh (trên 5kg/tháng)');
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
  const catalogs = Object.fromEntries(['home', 'onboarding', 'common'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`))]));
  const get = (ns, key, options = {}) => {
    options = { honorific: 'bạn', Honorific: 'Bạn', CallName: 'Bạn', ...options };
    const value = key.split('.').reduce((entry, part) => entry?.[part], catalogs[options.ns || ns]);
    assert.notEqual(value, undefined, `Missing ${language}/${options.ns || ns}/${key}`);
    return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (match, name) => options[name] ?? match) : value;
  };
  const t = (key, options) => get('home', key, options);
  const tg = (key, options) => get('onboarding', key, options);
  return { t, tg, useTranslation: ns => ({ t: ns === 'onboarding' ? tg : t, i18n: { resolvedLanguage: language } }) };
}
const animation = { duration: () => animation, delay: () => animation };
const native = { ...conclusionHelpers, useCheckinAddressing: () => ({ honorific: 'bạn', Honorific: 'Bạn', CallName: 'Bạn' }), View: 'View', Text: 'Text', Image: 'Image', asinuChatSticker: 'asinu_chat_sticker.png', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'ScrollView',
  CheckinQuestionLoading: 'QuestionLoading', ActivityIndicator: 'Spinner', Ionicons: 'Icon', MaterialCommunityIcons: 'Icon', Stack: { Screen: 'Stack' },
  GuidePracticeScope: 'PracticeScope', GuideScrollScope: 'ScrollScope', GuideTarget: 'GuideTarget',
  ScreenBackButton: 'Back', AppAlertModal: 'Alert', AiDataConsentModal: 'Consent',
  CheckinGiftCloseButton: ({ disabled, eligible = false, children }) => {
    assert.equal(eligible, false, 'Tutorials and read-only UI previews cannot consume daily gifts');
    return jsx('Pressable', { disabled, children });
  },
  Animated: { View: 'Animated' }, FadeIn: animation, FadeInDown: animation, FadeInLeft: animation,
  Svg: 'Svg', Path: 'Path', Circle: 'Circle', CheckinHeroBadge: 'Badge', guideColors: { background: '#f9fcfb', ink: '#123b35',
    actionBackground: '#08b8a2', onAction: '#061c19' }, colors: { primary: '#08b8a2' } };
function routeHarness(language, params = { mode: 'guide' }, guidance = {}, entry = {}) {
  const storage = progressHarness();
  const runtime = hooks(), calls = { network: [], consent: 0, progress: [], finished: [], routes: [], alerts: [], audio: [], help: [], presentation: [] };
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
    calls.network.push([name, ...args]); const response = await (entry.api?.[name] ? entry.api[name](...args) : real[name](...args));
    if (response.session) response.session = { ...response.session, id: 500, user_id: 7 };
    if (name === 'triage' && entry.triageError) throw new Error('offline');
    return response;
  }]));
  realApi.getToday = async () => { calls.network.push(['getToday']); if (entry.error) throw new Error('offline'); return { ok: true, session: entry.session || null }; };
  realApi.cancel = async (id, phase) => { calls.network.push(['cancel', id, phase]); if (entry.cancelError) throw new Error('offline'); return { ok:true, cancelled:true }; };
  const useCheckinCancellation = evaluate(`${cancellationFunction}\nmodule.exports=useCheckinCancellation;`, {
    ...runtime, ...tr, tokenStore:{getToken:()=> 'synthetic-token'}, checkinApi:realApi, ...storage.progress,
    useAppAlert:()=>({alertState:{},showAlert:(...args)=>calls.alerts.push(args),dismissAlert(){}}),
  });
  const router = { canGoBack: () => true, back: () => calls.routes.push('back'), replace: route => calls.routes.push(route) };
  const source = `${extract('CheckinScreen')}\nmodule.exports = CheckinScreen;`;
  const CheckinScreen = evaluate(source, { useCheckinQuestionViewport: () => ({ onContentSizeChange() {}, onScrollBeginDrag() {} }), ...storage.progress, StateError: 'StateError', ...native, ...runtime, ...tr, useLocalSearchParams: () => params,
    useCheckinPresentationPriority: blocked => calls.presentation.push(blocked),
    useCheckinCancellation,
    useReviewGuidance: (destination, options) => () => calls.help.push({ destination, options }), useRouter: () => router, useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
    useScaledTypography: () => ({}), useThemeColors: () => ({ isDark: false }), createStyles: () => ({}),
    useAppAlert: () => ({ alertState: {}, showAlert: (...args) => calls.alerts.push(args), dismissAlert() {} }),
    useAuthStore: select => select({ profile: { id: 7 } }), useGuidanceStore,
    useLanguageStore: () => ({ language }), createCheckinPractice, checkinApi: realApi,
    hasAiDataConsent: async () => { calls.consent++; return entry.consented !== false; }, showToast() {},
    guidanceAudio: { stop: async () => calls.audio.push('stop') }, Platform: { OS: 'ios' },
    StatusScreen: 'Status', LocationScreen: 'Location', TriageScreen: 'Question', DoneScreen: 'Result',
    ConclusionLoadingView: 'Loading',
    offerCheckinGiftOnHome() {},
    getLocalFallbackQuestion: () => assert.fail('Practice must not require an API fallback'), __DEV__: false });
  return { calls, guideState, storage, settle: () => runtime.settle(() => CheckinScreen()) };
}
for (const language of ['vi', 'en']) {
  await test(`${language}: contextual Help only appears at the two live entry screens and preserves their guide context`, async () => {
    for (const mode of ['daily', 'random']) {
      const h = routeHarness(language, { mode }); let tree = await h.settle();
      const help = nodes(tree).find(n => n.props?.testID === 'checkin-context-help'); assert.ok(help);
      help.props.onPress();
      assert.deepEqual(h.calls.help, [{ destination: 'checkin', options: { instant: mode === 'random', followup: false } }]);
      await nodes(tree).find(n => n.type === 'Status').props.onSelect('tired'); tree = await h.settle();
      assert.ok(!nodes(tree).some(n => n.props?.testID === 'checkin-context-help'), 'Location questions must not start a new guide');
      await nodes(tree).find(n => n.type === 'Location').props.onConfirm(['head'], 'example'); tree = await h.settle();
      assert.ok(!nodes(tree).some(n => n.props?.testID === 'checkin-context-help'), 'Triage questions must not start a new guide');
    }
    const daily = routeHarness(language, { mode: 'daily' }); let tree = await daily.settle();
    await nodes(tree).find(n => n.type === 'Status').props.onSelect('fine'); tree = await daily.settle();
    assert.ok(!nodes(tree).some(n => n.props?.testID === 'checkin-context-help'), 'Results do not reopen entry help');
    for (const entry of [undefined, 'instant']) {
      const guide = routeHarness(language, { mode: 'guide', entry });
      assert.ok(!nodes(await guide.settle()).some(n => n.props?.testID === 'checkin-context-help'), 'Do not nest a second guide');
    }
  });
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
        for (let i = 0; i < 5; i++) {
          const question = nodes(tree).find(node => node.type === 'Question'); assert.ok(question, `Question ${i}`);
          assert.equal(question.props.practice, true);
          layouts.push(question.props.options.length === 0 ? 'text' : question.props.multiSelect ? 'multiple' : 'single');
          await question.props.onAnswer('private practice answer'); tree = await h.settle();
        }
        assert.deepEqual(layouts, ['multiple', 'single', 'single', 'multiple', 'text']);
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
    const h = routeHarness(language, { mode: 'daily' }); let tree = await h.settle();
    await nodes(tree).find(node => node.type === 'Status').props.onSelect('fine'); tree = await h.settle();
    assert.deepEqual(h.calls.network.map(call => call[0]), ['getToday', 'start']);
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
      ...native, ...runtime, ...tr, isDoctorFeaturesEnabled: true, useRouter: () => router,
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
// Verify the redesigned choices still report the original API status values.
const choiceFile = ts.createSourceFile('choice.tsx', read('src/features/checkin/CheckinStatusChoice.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const choiceSource = choiceFile.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(choiceFile)).join('\n');
for (const language of ['vi', 'en']) for (const isDark of [false, true]) {
  await test(`${language}/${isDark ? 'dark' : 'light'}: status cards preserve all three actions, readable labels and read-only previews`, () => {
    const { CHECKIN_STATUS_CHOICES, CheckinStatusChoice } = evaluate(choiceSource, {
      ...native, React: {}, LinearGradient: 'Gradient', StyleSheet: { create: value => value },
      useTranslation: translations(language).useTranslation, useThemeColors: () => ({ isDark }),
    });
    const selected = [];
    assert.deepEqual(CHECKIN_STATUS_CHOICES.map(choice => choice.status), ['fine', 'tired', 'very_tired']);
    for (const choice of CHECKIN_STATUS_CHOICES) {
      const tree = CheckinStatusChoice({ choice, onSelect: value => selected.push(value) });
      const card = nodes(tree).find(node => node.type === 'Gradient');
      const cardStyle = Object.assign({}, ...card.props.style);
      assert.ok(cardStyle.minHeight >= 104);
      assert.equal(cardStyle.height, undefined);
      assert.equal(tree.props.accessibilityRole, 'button');
      assert.equal(tree.props.testID, `checkin-status-${choice.status}`);
      assert.ok(tree.props.accessibilityLabel.includes(translations(language).t(choice.labelKey)));
      const labels = nodes(card).filter(node => node.type === 'Text');
      assert.equal(labels.length, 2);
      for (const label of labels) {
        assert.equal(label.props.allowFontScaling, true);
        assert.equal(label.props.numberOfLines, undefined);
      }
      tree.props.onPress();
      const preview = CheckinStatusChoice({ choice });
      assert.equal(nodes(preview).some(node => node.type === 'Pressable'), false);
    }
    assert.deepEqual(selected, ['fine', 'tired', 'very_tired']);
  });
}

for (const language of ['vi', 'en']) {
  for (const [hour, key] of [[8, 'Morning'], [13, 'Afternoon'], [16, 'Evening2'], [21, 'Evening']]) {
    await test(`${language}: status greeting follows the time at ${hour}:00 for practice and normal check-in`, () => {
      const tr = translations(language);
      const StatusScreen = evaluate(`${extract('StatusScreen')}\nmodule.exports = StatusScreen;`, {
        ...native, ...tr, CHECKIN_STATUS_CHOICES: [], CheckinStatusChoice: 'Choice',
        Date: class extends Date { getHours() { return hour; } },
      });
      for (const practice of [false, true]) {
        const tree = StatusScreen({ styles: {}, onSelect() {}, isFollowUp: false, practice });
        const heading = nodes(tree).find(node => node.type === 'Text' && node.props.accessibilityRole === 'header');
        assert.equal(heading.props.children, tr.t(`checkinGreeting${key}`));
      }
      const followup = StatusScreen({ styles: {}, onSelect() {}, isFollowUp: true });
      assert.ok(nodes(followup).some(node => node.type === 'Text' && node.props.children === tr.t('checkinGreetingFollowUp')));
    });
  }
}

// Exercise the real shared screen components independently of the live route.
const { CHECKIN_UI_PREVIEWS } = evaluate(read('src/features/checkin/checkin-ui-gallery.ts'));
const extractVariable = name => {
  const file = name === 'BODY_LOCATION_OPTIONS' ? locationFile : routeFile;
  return file.statements.find(item => ts.isVariableStatement(item)
    && item.declarationList.declarations.some(declaration => declaration.name.getText(file) === name)).getText(file);
};

function locationHarness(language, overrides = {}) {
  const storage = progressHarness(); let headerBack; let backs = 0;
  const runtime = hooks(), tr = translations(language), calls = [], scrolls = [];
  const component = evaluate(`${extractVariable('BODY_LOCATION_OPTIONS')}\n${extract('LocationScreen')}\nmodule.exports = LocationScreen;`, {
    ...storage.progress, ...native, ...runtime, ...tr, ...locationDetailsHelpers, spacing: { xs: 4 },
    useCheckinAddressing: () => overrides.addressing || native.useCheckinAddressing(),
    VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
  });
  let props = { styles: {}, loading: false, onConfirm: (...args) => calls.push(args), onBack() { backs++; }, onBeforeAi: async () => true, onQuestionChange: () => scrolls.push('top'), onBackHandlerChange: handler => { headerBack = handler; }, ...overrides };
  let tree;
  const settle = async () => { tree = await runtime.settle(() => component(props)); return tree; };
  const find = id => { const node = nodes(tree).find(item => item.props?.testID === id); assert.ok(node, id); return node; };
  return { calls, scrolls, tr, find, settle, storage, async back() { headerBack(); return settle(); }, get backs() { return backs; }, has(id) { return nodes(tree).some(item => item.props?.testID === id); }, async press(id) { await find(id).props.onPress(); return settle(); },
    async note(value) { nodes(tree).find(item => item.type === 'VoiceAnswerInput').props.onChangeText(value); return settle(); },
    async voiceBusy(value) { nodes(tree).find(item => item.type === 'VoiceAnswerInput').props.onProcessingChange(value); return settle(); },
    async loading(value) { props = { ...props, loading: value }; return settle(); } };
}

for (const language of ['vi', 'en']) {
  for (const [region, position, expected] of [
    ['head', 'forehead', language === 'vi' ? /(?:chỗ nào.*đầu|đầu.*chỗ nào)/ : /Where on your head/],
    ['chest', 'middle_chest', language === 'vi' ? /(?:chỗ nào.*ngực|ngực.*chỗ nào)/ : /Where in your chest/],
    ['abdomen', 'upper_abdomen', language === 'vi' ? /(?:chỗ nào.*[Bb]ụng|[Bb]ụng.*chỗ nào)/ : /Where in your belly/],
    ['limbs', 'right_wrist', language === 'vi' ? /(?:chỗ nào.*tay hoặc chân|tay hoặc chân.*chỗ nào)/ : /Where in your arms or legs/],
    ['skin', 'face_neck', language === 'vi' ? /(?:chỗ nào.*da|da.*chỗ nào)/ : /Which area of your skin/],
  ]) {
    await test(`${language}: ${region} asks a natural position question that matches its answers`, async () => {
      const h = locationHarness(language); await h.settle();
      await h.press(`checkin-location-region-${region}`);
      const tree = await h.press('checkin-location-continue');
      const heading = nodes(tree).find(node => node.props?.accessibilityRole === 'header').props.children;
      assert.match(heading, expected); assert.ok(!heading.includes(':'));
      assert.ok(!heading.includes('{{'));
      assert.ok(heading.length > 15 && heading.length < 180, 'Each position question should stay short and readable');
      assert.equal(h.find('checkin-location-question-next').props.disabled, true);
      await h.press(`checkin-location-position-${region}-${position}`);
      assert.equal(h.find('checkin-location-question-next').props.disabled, false);
      await h.press('checkin-location-question-next');
      assert.deepEqual(h.calls[0][0], [region]);
      assert.ok(h.calls[0][1].includes(h.tr.t(`checkinLocationDetail_${position}`)));
    });
  }
}

for (const addressing of [
  { honorific: 'bạn', Honorific: 'Bạn', CallName: 'Bạn Đức' },
  { honorific: 'chú', Honorific: 'Chú', CallName: 'Chú Hùng' },
  { honorific: 'bác', Honorific: 'Bác', CallName: 'Bác Hoa' },
]) {
  await test(`location greeting names ${addressing.CallName} once; later questions use the honorific without repeating the name`, async () => {
    const h = locationHarness('vi', { addressing });
    const strings = tree => nodes(tree).filter(n => n.type === 'Text' && typeof n.props.children === 'string').map(n => n.props.children).join(' ');
    const initial = strings(await h.settle());
    assert.equal(initial.split(addressing.CallName).length - 1, 1);
    assert.ok(initial.includes(`${addressing.CallName} ơi`));
    await h.press('checkin-location-region-abdomen');
    const question = strings(await h.press('checkin-location-continue'));
    assert.ok(question.includes(`Bụng ${addressing.honorific}`));
    assert.ok(!question.includes(addressing.CallName));
    assert.ok(!question.includes('{{'));
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: location answers wait for recorded speech before continuing`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-whole_body');
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.voiceBusy(true);
    assert.equal(h.find('checkin-location-continue').props.disabled, true);
    await h.press('checkin-location-continue'); assert.equal(h.calls.length, 0);
    await h.voiceBusy(false); await h.press('checkin-location-continue');
    assert.equal(h.calls.length, 1);
  });
  await test(`${language}: head and chest positions appear as separate follow-up questions with answers`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-region-chest');
    assert.equal(h.has('checkin-location-question-head'), false);
    assert.equal(h.has('checkin-location-position-head-forehead'), false);
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.press('checkin-location-continue'); assert.equal(h.calls.length, 0);
    assert.equal(h.has('checkin-location-question-head'), true);
    assert.equal(h.has('checkin-location-question-chest'), false);
    assert.equal(h.scrolls.length, 2, 'The first position question starts at the heading');
    await h.press('checkin-location-question-next'); assert.equal(h.calls.length, 0);
    await h.press('checkin-location-position-head-forehead');
    assert.equal(h.scrolls.length, 2, 'Selecting an answer must not jump the screen');
    await h.press('checkin-location-question-next');
    assert.equal(h.scrolls.length, 3, 'The next region starts at its own heading');
    assert.equal(h.has('checkin-location-question-chest'), true);
    assert.equal(h.has('checkin-location-position-head-forehead'), false);
    await h.press('checkin-location-position-chest-middle_chest');
    await h.press('checkin-location-question-back');
    assert.equal(h.find('checkin-location-position-head-forehead').props.accessibilityState.checked, true);
    await h.press('checkin-location-question-next');
    assert.equal(h.find('checkin-location-position-chest-middle_chest').props.accessibilityState.checked, true);
    await h.press('checkin-location-question-next');
    assert.deepEqual(h.calls[0][0], ['head', 'chest']);
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_forehead')));
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_middle_chest')));
    await h.press('checkin-location-question-back'); await h.press('checkin-location-question-back');
    await h.press('checkin-location-region-head');
    await h.press('checkin-location-continue'); await h.press('checkin-location-question-next');
    assert.deepEqual(h.calls[1][0], ['chest']);
    assert.ok(!h.calls[1][1].includes(h.tr.t('checkinLocationDetail_forehead')), 'A removed region cannot leak a stale answer');
  });
  await test(`${language}: uncertain and custom positions are supported without inventing pain`, async () => {
    const h = locationHarness(language); await h.settle(); await h.press('checkin-location-region-head');
    await h.press('checkin-location-continue'); await h.press('checkin-location-position-head-uncertain');
    assert.equal(h.find('checkin-location-question-next').props.disabled, false);
    await h.press('checkin-location-question-next');
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_uncertain')));
    await h.press('checkin-location-position-head-other_detail');
    assert.equal(h.find('checkin-location-question-next').props.disabled, true);
    await h.note(language === 'vi' ? 'Phía sau tai phải' : 'Behind the right ear');
    assert.equal(h.find('checkin-location-question-next').props.disabled, false);
    await h.voiceBusy(true);
    assert.equal(h.find('checkin-location-question-next').props.disabled, true);
    await h.voiceBusy(false); await h.press('checkin-location-question-next');
    assert.ok(h.calls[1][1].includes(language === 'vi' ? 'Phía sau tai phải' : 'Behind the right ear'));
    await h.loading(true); await h.press('checkin-location-question-next');
    assert.equal(h.calls.length, 2, 'A stale loading action cannot submit again');
  });
  await test(`${language}: Other requires a separate description for each selected region`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-region-chest');
    await h.press('checkin-location-continue'); await h.press('checkin-location-position-head-other_detail');
    await h.note('Behind the right ear'); await h.press('checkin-location-question-next');
    await h.press('checkin-location-position-chest-other_detail');
    assert.equal(h.find('checkin-location-question-next').props.disabled, true, 'The head note cannot satisfy the chest question');
    await h.note('Below the collarbone'); await h.press('checkin-location-question-next');
    assert.ok(h.calls[0][1].includes('Behind the right ear'));
    assert.ok(h.calls[0][1].includes('Below the collarbone'));
  });
  await test(`${language}: rapid taps on the last position question submit only once`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-continue');
    await h.press('checkin-location-position-head-uncertain');
    const next = h.find('checkin-location-question-next').props.onPress;
    next(); next(); await h.settle();
    assert.equal(h.calls.length, 1);
  });
  await test(`${language}: whole-body and mental choices do not demand a fictitious anatomical spot`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-whole_body'); await h.press('checkin-location-region-mental');
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.press('checkin-location-continue');
    assert.deepEqual(h.calls[0], [['whole_body','mental'], '']);
  });
}

await test('exact position keys survive language changes and unknown choices remain exclusive', () => {
  const { toggleLocationDetail, formatLocationNotes } = locationDetailsHelpers;
  let selected = toggleLocationDetail({}, 'limbs', 'right_wrist');
  selected = toggleLocationDetail(selected, 'limbs', 'uncertain');
  assert.deepEqual(selected.limbs, ['uncertain']);
  selected = toggleLocationDetail(selected, 'limbs', 'right_wrist');
  assert.deepEqual(selected.limbs, ['right_wrist']);
  for (const language of ['vi','en']) assert.ok(formatLocationNotes(['limbs'], selected, '', translations(language).t).includes(translations(language).t('checkinLocationDetail_right_wrist')));
});

for (const language of ['vi', 'en']) {
  await test(`${language}: every gallery check-in is read-only, silent and cannot navigate or request consent`, async () => {
    const deny = () => assert.fail('A UI preview attempted an action');
    const runtime = { useMemo: work => work(), useRef: initial => ({ current: initial }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, deny],
      useEffect: work => work() };
    const source = [extractVariable('createResultPreviewSession'), extractVariable('BODY_LOCATION_OPTIONS'),
      ...['CheckinUiPreview', 'StatusScreen', 'LocationScreen', 'TriageScreen', 'ConclusionLoadingView', 'stripEmojis', 'extractRecordedSymptoms', 'DoneScreen'].map(extract),
      'module.exports = CheckinUiPreview;'].join('\n');
    const preview = evaluate(source, { ...native, ...runtime, ...translations(language), ...triageOptionDisplay, ...triageSelection, ...locationDetailsHelpers, isDoctorFeaturesEnabled: true, MAX_TRIAGE_QUESTIONS: 4,
      CHECKIN_STATUS_CHOICES: [{ status: 'fine' }, { status: 'tired' }, { status: 'very_tired' }],
      CheckinStatusChoice: 'StatusChoice', VoiceAnswerInput: 'VoiceAnswerInput',
      CheckinConclusionLoading: 'ConclusionProgress',
      CheckinGiftModal: (props) => ({ type: 'Pressable', props: { disabled: true, children: null } }),
      useScaledTypography: () => ({}), createStyles: () => ({}), spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
      useLanguageStore: () => ({ language }), useGuideAcknowledgement: () => deny,
      useRouter: () => ({ push: deny, back: deny, replace: deny }),
      useCheckinCallAudio: (_attempt, _language, _translate, _account, enabled) => {
        assert.equal(enabled, false, 'Gallery results must never create a voice player');
        return { audio: { phase: 'idle' }, play: deny, stopAudio: deny };
      }, guidanceAudio: { stop: deny, speak: deny }, Linking: { openURL: deny },
      Audio: { requestPermissionsAsync: deny }, chatApi: { transcribeAudio: deny }, showToast: deny, setTimeout: deny,
    });
    const expand = tree => !tree || typeof tree !== 'object' ? tree : Array.isArray(tree) ? tree.map(expand)
      : typeof tree.type === 'function' ? expand(tree.type(tree.props))
      : { ...tree, props: { ...tree.props, children: expand(tree.props?.children) } };
    for (const { id } of CHECKIN_UI_PREVIEWS) {
      const tree = expand(preview({ id }));
      for (const node of nodes(tree)) {
        if (node.type === 'Pressable' || node.type === 'VoiceAnswerButton') {
          assert.equal(node.props.disabled, true, `${id}: enabled control`);
          await node.props.onPress?.(); // Even a stale callback cannot perform an action.
        }
        if (node.type === 'Input') {
          assert.equal(node.props.editable, false, `${id}: editable input`);
          assert.equal(node.props.onChangeText, undefined);
        }
        if (node.type === 'VoiceAnswerInput') assert.equal(node.props.readOnly, true);
        if (node.type === 'StatusChoice') assert.equal(node.props.onSelect, undefined);
        if (node.type === 'GuideTarget') assert.equal(node.props.enabled, false, `${id}: active coaching target`);
      }
    }
  });
}
await test('route identity remounts practice and real sessions rather than sharing private answer state', () => {
  assert.match(extract('CheckinRoute'), /key=\{.*params\.mode.*params\.checkin_id.*params\.guide/);
  assert.match(extract('CheckinScreen'), /isPractice \? createCheckinPractice\(t, addressing\) : checkinApi/);
  assert.doesNotMatch(extract('CheckinScreen'), /checkinApi\.(start|triage|followUp)/);
});
for (const language of ['vi', 'en']) {
  await test(`${language}: instant check-in only offers tired levels and neither status screen shows the removed artwork or slogans`, () => {
    const tr = translations(language);
    const choices = ['fine', 'tired', 'very_tired'].map(status => ({ status }));
    const StatusScreen = evaluate(`${extract('StatusScreen')}\nmodule.exports=StatusScreen;`, {
      ...native, ...tr, CHECKIN_STATUS_CHOICES: choices, CheckinStatusChoice: 'Choice',
    });
    for (const instant of [false, true]) for (const isFollowUp of [false,true]) {
      const tree = StatusScreen({ styles: {}, instant, isFollowUp, onSelect() {} });
      assert.deepEqual(nodes(tree).filter(n => n.type === 'Choice').map(n => n.props.choice.status), instant ? ['tired', 'very_tired'] : ['fine', 'tired', 'very_tired']);
      assert.ok(!nodes(tree).some(n => ['Svg','Image'].includes(n.type)));
      for (const key of ['checkinHeroSloganLeft','checkinHeroSloganRight','checkinFooterBrand1','checkinFooterBrand2','checkinFooterBrand3']) {
        assert.ok(!nodes(tree).some(n => n.type === 'Text' && n.props.children === tr.t(key)));
      }
    }
  });
  for (const level of ['tired', 'very_tired']) {
    await test(`${language}/${level}: home unwell entry asks intensity then locations and submits the chosen level`, async () => {
      const h = routeHarness(language, { mode: 'random' }); let tree = await h.settle();
      let screen = nodes(tree).find(n => n.type === 'Status');
      assert.equal(screen.props.instant, true);
      assert.ok(nodes(tree).some(n => n.type === 'Text' && n.props.children === translations(language).t('checkinSelectIntensityTitle')));
      await screen.props.onSelect('fine'); await screen.props.onSelect('specific_concern'); tree = await h.settle();
      assert.deepEqual(h.calls.network.map(call => call[0]), ['getToday'], 'Check progress before permitting a new instant check-in');
      screen = nodes(tree).find(n => n.type === 'Status');
      await screen.props.onSelect(level); tree = await h.settle();
      const location = nodes(tree).find(n => n.type === 'Location'); assert.ok(location);
      assert.deepEqual(h.calls.network.map(call => call[0]), ['getToday'], 'Wait for locations before saving');
      await location.props.onConfirm(['head','limbs'], 'Đầu: Trán; Tay chân: Cổ tay phải'); tree = await h.settle();
      assert.deepEqual(h.calls.network[1], ['start',level,['head','limbs'],'Đầu: Trán; Tay chân: Cổ tay phải',true]);
      assert.ok(nodes(tree).some(n => n.type === 'Question'));
    });
  }
  await test(`${language}: instant practice stays offline and follow-up still permits recovery`, async () => {
    const h = routeHarness(language, { mode: 'guide', entry: 'instant' }); let tree = await h.settle();
    const status = nodes(tree).find(n => n.type === 'Status'); assert.equal(status.props.instant, true);
    await status.props.onSelect('tired'); tree = await h.settle();
    await nodes(tree).find(n => n.type === 'Location').props.onConfirm(['head'], 'example'); await h.settle();
    assert.deepEqual(h.calls.network, []);
    const followup = routeHarness(language, { mode: 'guide', entry: 'instant', guide_followup: '1' }); tree = await followup.settle();
    const recovery = nodes(tree).find(n => n.type === 'Status'); assert.equal(recovery.props.instant, false);
    await recovery.props.onSelect('fine'); tree = await followup.settle();
    assert.ok(nodes(tree).some(n => n.type === 'Result'));
    assert.deepEqual(followup.calls.network, []);
  });
  await test(`${language}: detailed questions show the server progress and region, and none cannot coexist with a symptom`, async () => {
    const runtime = hooks(), tr = translations(language), calls = [];
    const optionDisplay = evaluate(read('src/features/checkin/triage-option-display.ts'));
    const component = evaluate(`${extract('TriageScreen')}\nmodule.exports=TriageScreen;`, {
      ...native, ...runtime, ...tr, ...optionDisplay, ...triageSelection, MAX_TRIAGE_QUESTIONS: 4,
      spacing: { sm: 8 }, VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
    });
    const backendRoot = process.env.ASINU_BACKEND_DIR || '../backend.asinu';
    const catalog = JSON.parse(read(`${backendRoot}/src/i18n/locales/${language}.json`));
    const nausea = catalog['checkin.detail.option.nausea'];
    const none = catalog['checkin.detail.option.none'];
    const unknown = catalog['checkin.detail.option.unknown'];
    const props = { styles: {}, question: 'A supplied regional question', options: [nausea, none, unknown],
      multiSelect: true, exclusiveOptions: [none, unknown], answers: [], loading: false,
      onAnswer: answer => calls.push(answer), onBeforeAi: async () => true,
      questionProgress: { current: 14, total: 26 }, questionGroup: { label: language === 'vi' ? 'Tay chân' : 'Limbs', index: 2, total: 2 } };
    let tree;
    const settle = async () => { tree = await runtime.settle(() => component(props)); return tree; };
    await settle();
    assert.ok(nodes(tree).some(n => n.type === 'Text' && n.props.children === '14/26'));
    const unknownTotal = await runtime.settle(() => component({ ...props, questionProgress: undefined,
      answers: Array.from({ length: 9 }, () => ({ answer: 'Recorded' })) }));
    assert.ok(nodes(unknownTotal).some(n => n.type === 'Text' && n.props.children === tr.t('checkinQuestionNumber', { count: 10 })),
      'Without a server total, show the real question number instead of a fictional four-question cap');
    assert.ok(nodes(tree).some(n => n.type === 'Text' && n.props.children === tr.t('checkinQuestionRegion', { region: props.questionGroup.label, current: 2, total: 2 })));
    const choice = label => nodes(tree).find(n => n.props?.accessibilityLabel === label && n.props.accessibilityRole === 'checkbox');
    choice(nausea).props.onPress(); await settle();
    assert.equal(choice(nausea).props.accessibilityState.checked, true);
    choice(none).props.onPress(); await settle();
    assert.equal(choice(none).props.accessibilityState.checked, true);
    assert.equal(choice(nausea).props.accessibilityState.checked, false);
    choice(nausea).props.onPress(); await settle();
    assert.equal(choice(none).props.accessibilityState.checked, false);
    choice(unknown).props.onPress(); await settle();
    assert.equal(choice(unknown).props.accessibilityState.checked, true);
    assert.equal(choice(nausea).props.accessibilityState.checked, false);
    nodes(tree).find(n => n.type === 'Pressable' && n.props.onPress && !n.props.accessibilityRole).props.onPress();
    assert.deepEqual(calls, [unknown]);
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: header Back follows the same position steps as the footer and preserves choices`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-region-chest');
    await h.press('checkin-location-continue'); await h.press('checkin-location-position-head-forehead');
    await h.press('checkin-location-question-next'); assert.ok(h.has('checkin-location-question-chest'));
    await h.back(); assert.ok(h.has('checkin-location-question-head'));
    assert.equal(h.find('checkin-location-position-head-forehead').props.accessibilityState.checked, true);
    await h.back(); assert.ok(h.has('checkin-location-region-head')); assert.equal(h.backs, 0);
    await h.back(); assert.equal(h.backs, 1);
  });
  await test(`${language}: remounting the location screen restores the saved exact position question`, async () => {
    const h = locationHarness(language, { draftAccount: 7, draftStatus: 'tired' }); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-region-chest');
    await h.press('checkin-location-continue'); await h.press('checkin-location-position-head-forehead');
    await h.press('checkin-location-question-next');
    const draft = await h.storage.progress.readLocationDraft(7); assert.equal(draft.detailIndex, 1);
    const reopened = locationHarness(language, { initialDraft: draft }); await reopened.settle();
    assert.ok(reopened.has('checkin-location-question-chest')); await reopened.back();
    assert.equal(reopened.find('checkin-location-position-head-forehead').props.accessibilityState.checked, true);
  });
}
for (const language of ['vi', 'en']) {
  const saved = [{ step: 'symptoms', question: 'Symptoms?', answer: 'Headache' },
    { step: 'red_flags', question: 'Danger?', answer: 'None' }];
  const session = { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired', flow_state: 'monitoring',
    triage_completed_at: null, resolved_at: null, triage_messages: saved, triage_state: { phase: 'initial' } };
  for (const mode of ['daily', 'resume', 'random', 'followup']) {
    await test(`${language}/${mode}: opening an unfinished check-in restores answers without starting or following up`, async () => {
      const h = routeHarness(language, { mode, ...(mode === 'resume' || mode === 'followup' ? { checkin_id: '500', preset_status: 'fine' } : {}) }, {}, { session });
      const tree = await h.settle(); const q = nodes(tree).find(n => n.type === 'Question');
      assert.ok(q); assert.deepEqual(q.props.answers, saved);
      assert.deepEqual(h.calls.network.map(c => c[0]), ['getToday', 'triage']);
      assert.deepEqual(h.calls.network.at(-1), ['triage', 500, saved, h.storage.progress.checkinPhaseId(session)]);
      assert.ok(!nodes(tree).some(n => n.type === 'Status'));
    });
  }
  await test(`${language}: a failed load offers retry instead of a blank check-in`, async () => {
    const entry = { error: true, session }, h = routeHarness(language, { mode: 'daily' }, {}, entry);
    let tree = await h.settle();
    assert.ok(!nodes(tree).some(n => n.type === 'Status'));
    const retry = nodes(tree).find(n => n.type === 'StateError'); assert.ok(retry);
    entry.error = false; retry.props.onRetry(); tree = await h.settle();
    assert.deepEqual(nodes(tree).find(n => n.type === 'Question').props.answers, saved);
  });
  await test(`${language}: interrupted location selection is restored before creating a session`, async () => {
    const h = routeHarness(language, { mode: 'daily' });
    const draft = { status: 'very_tired', selected: ['head', 'chest'], other: '', details: { head: ['forehead'] },
      positionNotes: {}, detailIndex: 1 };
    await h.storage.progress.saveLocationDraft(7, draft);
    const tree = await h.settle(); const location = nodes(tree).find(n => n.type === 'Location');
    assert.ok(location); assert.deepEqual(location.props.initialDraft, draft);
    assert.deepEqual(h.calls.network.map(c => c[0]), ['getToday']);
  });
  await test(`${language}: network failure preserves the last answer and retries the identical request`, async () => {
    const entry = { session, triageError: true }, h = routeHarness(language, { mode: 'resume', checkin_id: '500' }, {}, entry);
    let tree = await h.settle(); const retry = nodes(tree).find(n => n.type === 'StateError'); assert.ok(retry);
    assert.ok(!nodes(tree).some(n => n.type === 'Question'));
    const request = h.calls.network.at(-1); entry.triageError = false;
    await retry.props.onRetry(); tree = await h.settle();
    assert.deepEqual(h.calls.network.at(-1), request);
    assert.deepEqual(nodes(tree).find(n => n.type === 'Question').props.answers, saved);
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: typed symptoms clear None and choosing None clears the typed answer`, async () => {
    const runtime = hooks(), calls = [], tr = translations(language);
    const component = evaluate(`${extract('TriageScreen')}\nmodule.exports=TriageScreen;`, {
      ...native, ...runtime, ...tr, ...triageOptionDisplay, ...triageSelection,
      spacing: { sm: 8 }, VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
    });
    const props = { styles: {}, question: 'Example question', options: ['Symptom', 'None', 'Unknown'],
      multiSelect: true, exclusiveOptions: ['None', 'Unknown'], answers: [], loading: false,
      onAnswer: value => calls.push(value), onBeforeAi: async () => true };
    let tree; const settle = async () => { tree = await runtime.settle(() => component(props)); };
    const input = () => nodes(tree).find(n => n.type === 'VoiceAnswerInput');
    const option = label => nodes(tree).find(n => n.props?.accessibilityLabel === label);
    const confirm = () => nodes(tree).find(n => n.type === 'Pressable' && !n.props.accessibilityRole);
    await settle(); input().props.onChangeText('Example symptom'); await settle();
    option('None').props.onPress(); await settle(); assert.equal(input().props.value, '');
    input().props.onChangeText('Example symptom'); await settle();
    assert.equal(option('None').props.accessibilityState.checked, false);
    confirm().props.onPress(); await settle(); assert.deepEqual(calls, ['Example symptom']);
  });
  await test(`${language}: repeated single-choice taps cannot send competing answers`, async () => {
    const runtime = hooks(), calls = [], tr = translations(language); let finish;
    const component = evaluate(`${extract('TriageScreen')}\nmodule.exports=TriageScreen;`, {
      ...native, ...runtime, ...tr, ...triageOptionDisplay, ...triageSelection,
      spacing: { sm: 8 }, VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
    });
    const tree = await runtime.settle(() => component({ styles: {}, question: 'Example question',
      options: ['First', 'Second'], multiSelect: false, answers: [], loading: false,
      onAnswer: value => { calls.push(value); return new Promise(resolve => { finish = resolve; }); }, onBeforeAi: async () => true }));
    const choices = nodes(tree).filter(n => n.props?.accessibilityRole === 'radio');
    choices[0].props.onPress(); choices[0].props.onPress(); choices[1].props.onPress();
    assert.deepEqual(calls, ['First']); finish(); await tick();
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: resuming after AI consent keeps answer controls disabled until the question arrives`, async () => {
    let release;
    const entry = { session: { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired',
      triage_completed_at: null, triage_messages: [], triage_state: {} }, consented: false,
      api: { triage: () => new Promise(resolve => { release = resolve; }) } };
    const h = routeHarness(language, { mode: 'resume', checkin_id: '500' }, {}, entry);
    let tree = await h.settle(); const consent = nodes(tree).find(n => n.type === 'Consent');
    assert.equal(consent.props.visible, true); entry.consented = true;
    consent.props.onAgree(); tree = await h.settle();
    assert.ok(release); assert.equal(nodes(tree).find(n => n.type === 'Question').props.loading, true);
    release({ ok: true, isDone: false, step: 'symptoms', question: 'Example question', options: ['Example symptom', 'None'], multiSelect: true });
    tree = await h.settle(); const question = nodes(tree).find(n => n.type === 'Question');
    assert.equal(question.props.loading, false); assert.equal(question.props.question, 'Example question');
  });
}
await test('a question response replaces the processing state immediately without adding a timer or AI request', async () => {
  let complete;
  const entry = { session: { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired',
    triage_completed_at: null, triage_messages: [], triage_state: {} },
    api: { triage: () => new Promise(resolve => { complete = resolve; }) } };
  const h = routeHarness('vi', { mode: 'resume', checkin_id: '500' }, {}, entry);
  let tree = await h.settle(); assert.equal(nodes(tree).find(n => n.type === 'Question').props.loading, true);
  assert.deepEqual(h.calls.network.map(call => call[0]), ['getToday', 'triage']);
  complete({ ok: true, isDone: false, step: 'symptoms', question: 'Example question', options: ['First', 'Second'], multiSelect: true });
  tree = await h.settle(); const question = nodes(tree).find(n => n.type === 'Question');
  assert.equal(question.props.loading, false); assert.deepEqual(question.props.options, ['First', 'Second']);
  assert.deepEqual(h.calls.network.map(call => call[0]), ['getToday', 'triage']);
});
await test('adaptive Other opens a free answer without submitting the placeholder, and an open fallback can be skipped', async () => {
  const runtime = hooks(), tr = translations('vi'), calls = [];
  const component = evaluate(`${extract('TriageScreen')}\nmodule.exports=TriageScreen;`, {
    ...native, ...runtime, ...tr, ...triageOptionDisplay, ...triageSelection,
    spacing: { sm: 8 }, VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
  });
  let props = { styles: {}, question: 'Âm thanh giống loại nào?', options: ['Tiếng ve', 'Tiếng rít', 'Không rõ', 'Khác, nhập hoặc nói câu trả lời'],
    freeTextOption: 'Khác, nhập hoặc nói câu trả lời', multiSelect: false, allowFreeText: true,
    answers: [], loading: false, onAnswer: answer => calls.push(answer), onBeforeAi: async () => true };
  let tree; const settle = async () => { tree = await runtime.settle(() => component(props)); };
  await settle(); nodes(tree).find(n => n.props?.accessibilityLabel === props.freeTextOption).props.onPress(); await settle();
  assert.deepEqual(calls, []);
  nodes(tree).find(n => n.type === 'VoiceAnswerInput').props.onChangeText('Tiếng gió'); await settle();
  nodes(tree).find(n => n.type === 'Pressable' && !n.props.accessibilityRole).props.onPress(); await settle();
  assert.deepEqual(calls, ['Tiếng gió']);
  props = { ...props, question: 'Mô tả thêm nhé?', options: [], freeTextOption: undefined, skipAnswerLabel: 'Không có gì thêm' };
  await settle(); nodes(tree).find(n => n.props?.accessibilityLabel === props.skipAnswerLabel).props.onPress(); await settle();
  assert.deepEqual(calls, ['Tiếng gió', 'Không có gì thêm']);
});
await test('multi-select Other keeps meaningful selected answers and removes exclusive uncertainty', async () => {
  const runtime = hooks(), tr = translations('vi'), calls = [];
  const component = evaluate(`${extract('TriageScreen')}\nmodule.exports=TriageScreen;`, {
    ...native, ...runtime, ...tr, ...triageOptionDisplay, ...triageSelection,
    spacing: { sm: 8 }, VoiceAnswerInput: 'VoiceAnswerInput', useGuideAcknowledgement: () => () => {},
  });
  const props = { styles: {}, question: 'Những biểu hiện nào?', options: ['First', 'Second', 'Không rõ', 'Khác'],
    freeTextOption: 'Khác', exclusiveOptions: ['Không rõ'], multiSelect: true, allowFreeText: true,
    answers: [], loading: false, onAnswer: answer => calls.push(answer), onBeforeAi: async () => true };
  let tree; const settle = async () => { tree = await runtime.settle(() => component(props)); };
  await settle();
  const select = async label => { nodes(tree).find(n => n.props?.accessibilityLabel === label).props.onPress(); await settle(); };
  await select('Không rõ'); await select('Khác');
  assert.equal(nodes(tree).find(n => n.props?.accessibilityLabel === 'Không rõ').props.accessibilityState.checked, false);
  await select('First'); await select('Khác');
  nodes(tree).find(n => n.type === 'VoiceAnswerInput').props.onChangeText('Additional answer'); await settle();
  nodes(tree).find(n => n.type === 'Pressable' && !n.props.accessibilityRole).props.onPress(); await settle();
  assert.deepEqual(calls, ['First, Additional answer']);
});
for (const language of ['vi', 'en']) {
  for (const conflicting of [true, false]) {
    await test(`${language}: conflict retry reloads server progress and preserves only a compatible pending answer (${conflicting})`, async () => {
      const first = {step:'symptoms',question:'Symptoms?',answer:'Headache'};
      const own = {step:'onset',question:'When?',answer:'Today'};
      const remote = {...own,answer:'Yesterday'};
      const session = {id:500,user_id:7,initial_status:'tired',current_status:'tired',flow_state:'monitoring',resolved_at:null,
        triage_completed_at:null,triage_messages:[first],triage_state:{phase:'initial',phase_id:'phase-a'}};
      let stage = 0;
      const entry = {session,api:{triage:async () => {
        if (stage++ === 0) return {ok:true,isDone:false,step:'onset',question:'When?',options:['Today','Yesterday'],multiSelect:false};
        if (stage === 2) { entry.session = {...session,triage_messages:conflicting?[first,remote]:[first]};
          throw Object.assign(new Error('changed'),{code:'TRIAGE_CHANGED'}); }
        return {ok:true,isDone:false,step:'progression',question:'How is it now?',options:['Same','Better'],multiSelect:false};
      }}};
      const h=routeHarness(language,{mode:'resume',checkin_id:'500'},{},entry);
      let tree=await h.settle(); await nodes(tree).find(n=>n.type==='Question').props.onAnswer('Today'); tree=await h.settle();
      const error=nodes(tree).find(n=>n.type==='StateError'); assert.ok(error);
      assert.ok(!nodes(tree).some(n=>n.type==='Question'));
      assert.equal(error.props.message,translations(language).t('checkinProgressChanged'));
      await error.props.onRetry(); tree=await h.settle();
      const expected=conflicting?[first,remote]:[first,own];
      assert.deepEqual(nodes(tree).find(n=>n.type==='Question').props.answers,expected);
      assert.deepEqual(h.calls.network.at(-1),['triage',500,expected,'phase-a']);
      assert.equal(h.calls.network.filter(call=>call[0]==='getToday').length,2);
    });
  }
  await test(`${language}: failed conflict recovery cannot expose stale answer controls`, async () => {
    const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',triage_messages:[],triage_state:{phase:'initial',phase_id:'phase-a'}};
    const entry={session,error:false,api:{triage:async()=>{throw Object.assign(new Error('changed'),{code:'TRIAGE_CHANGED'});}}};
    const h=routeHarness(language,{mode:'resume',checkin_id:'500'},{},entry);
    let tree=await h.settle(); entry.error=true;
    await nodes(tree).find(n=>n.type==='StateError').props.onRetry(); tree=await h.settle();
    assert.ok(nodes(tree).some(n=>n.type==='StateError'));
    assert.ok(!nodes(tree).some(n=>n.type==='Question'));
    assert.equal(h.calls.network.filter(call=>call[0]==='triage').length,1);
  });
}
await test('conflict retry opens the saved conclusion when that same interview completed before its response arrived', async () => {
  const session = { id:500,user_id:7,initial_status:'tired',current_status:'tired',flow_state:'follow_up',
    triage_messages:[],triage_completed_at:null,triage_state:{phase:'initial',phase_id:'phase-a'} };
  const answer = { step:'symptoms',question:'Biểu hiện nào?',answer:'Đau bụng' };
  let attempt = 0;
  const entry = { session,api:{triage:async () => {
    if (++attempt === 1) return {ok:true,isDone:false,...answer,options:['Đau bụng'],multiSelect:false};
    if (attempt === 2) {
      entry.session = {...session,triage_messages:[answer],triage_completed_at:'2026-11-10T06:53:00Z',
        triage_state:{...session.triage_state,completed:{finalized:true}}};
      throw Object.assign(new Error('changed'),{code:'TRIAGE_CHANGED'});
    }
    return {ok:true,isDone:true,summary:'Đã ghi nhận',recommendation:'Theo dõi thêm',severity:'low'};
  }}};
  const h=routeHarness('vi',{mode:'resume',checkin_id:'500'},{},entry);
  let tree=await h.settle();
  await nodes(tree).find(n=>n.type==='Question').props.onAnswer(answer.answer);tree=await h.settle();
  await nodes(tree).find(n=>n.type==='StateError').props.onRetry();tree=await h.settle();
  assert.ok(nodes(tree).some(n=>n.type==='Result'));
  assert.ok(!nodes(tree).some(n=>n.type==='StateError'));
  assert.deepEqual(h.calls.network.at(-1),['triage',500,[answer],'phase-a']);
  assert.equal(h.calls.network.filter(call=>['start','followUp'].includes(call[0])).length,0);
  assert.deepEqual(h.calls.routes,[]);
});

await test('completed conflict recovery cannot reopen a different phase or a stale ordinary Resume link', async () => {
  const {progress} = progressHarness();
  const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',
    triage_messages:[],triage_completed_at:'2026-11-10T06:53:00Z',
    triage_state:{phase:'initial',phase_id:'phase-new',completed:{finalized:true}}};
  const client={getToday:async()=>({ok:true,session})};
  assert.equal((await progress.loadCheckinEntry(client,7,'resume',500)).kind,'home');
  assert.equal((await progress.loadCheckinEntry(client,7,'resume',500,'phase-old')).kind,'home');
  assert.equal((await progress.loadCheckinEntry(client,7,'resume',500,'phase-new')).kind,'resume');
  await assert.rejects(progress.loadCheckinEntry(client,8,'resume',500,'phase-new'),/CHECKIN_ACCOUNT_CHANGED/);
});

await test('Continue Check-in restores a server bigint ID and resumes the latest saved question', async () => {
  const saved = [
    { step: 'symptoms', question: 'Biểu hiện nào?', answer: 'Đau bụng, Đau khớp' },
    { step: 'detail_abdomen_onset', question: 'Bạn bắt đầu thấy khó chịu từ khi nào?', answer: 'Hôm qua' },
  ];
  const session = { id: '500', user_id: '7', initial_status: 'tired', current_status: 'tired',
    triage_messages: saved, triage_state: { phase: 'initial', phase_id: 'phase-a' } };
  const h = routeHarness('vi', { mode: 'resume', checkin_id: '500' }, {}, {
    session, api: { triage: async () => ({ ok: true, isDone: false, step: 'detail_limbs_onset',
      question: 'Bạn bắt đầu thấy khó chịu ở tay chân từ khi nào?', options: ['Hôm nay', 'Hôm qua'], multiSelect: false }) },
  });
  const tree = await h.settle();
  assert.ok(!nodes(tree).some(n => n.type === 'StateError'));
  const question = nodes(tree).find(n => n.type === 'Question'); assert.ok(question);
  assert.match(question.props.question, /tay chân/);
  assert.deepEqual(question.props.answers, saved);
  assert.deepEqual(h.calls.network.at(-1), ['triage', '500', saved, 'phase-a']);
});

await test('instant entry routes a completed high alert to the existing follow-up screen without starting over', async () => {
  const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',flow_state:'high_alert',
    triage_messages:[{step:'symptoms',question:'Biểu hiện?',answer:'Đau bụng'}],
    triage_completed_at:'2026-11-10T06:53:00Z',triage_state:{phase:'initial',phase_id:'prior',completed:{finalized:true}}};
  const h=routeHarness('vi',{mode:'random'},{},{session});await h.settle();
  assert.deepEqual(h.calls.routes,[{pathname:'/checkin',params:{checkin_id:'500',mode:'followup',entry:'instant'}}]);
  assert.deepEqual(h.calls.network.map(c=>c[0]),['getToday']);
});

for (const status of ['tired','specific_concern']) for (const completed of [false,true]) {
  await test(`${status}: start preserves server answers when another request already updated it (completed: ${completed})`, async () => {
    const saved=[{step:'symptoms',question:'Biểu hiện?',answer:'Đau bụng'}];
    const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',flow_state:'high_alert',
      triage_messages:saved,triage_completed_at:completed?'2026-11-10T06:53:00Z':null,
      triage_state:{phase:'initial',phase_id:'prior',...(completed?{completed:{finalized:true}}:{})}};
    const entry={api:{start:async()=>({ok:true,session}),triage:async(id,answers)=>{
      assert.deepEqual(answers,saved,'Never send an empty conversation after start returns saved answers');
      return {ok:true,isDone:false,step:'onset',question:'Bắt đầu khi nào?',options:['Hôm nay','Hôm qua'],multiSelect:false};
    }}};
    const h=routeHarness('vi',{mode:status==='tired'?'random':'daily'},{},entry);
    let tree=await h.settle();await nodes(tree).find(n=>n.type==='Status').props.onSelect(status);tree=await h.settle();
    if(status==='tired'){
      await nodes(tree).find(n=>n.type==='Location').props.onConfirm(['abdomen'],'');tree=await h.settle();
    }
    if(completed){
      assert.deepEqual(h.calls.routes,[{pathname:'/checkin',params:{checkin_id:'500',mode:'followup',...(status==='tired'?{entry:'instant'}:{})}}]);
      assert.ok(!h.calls.network.some(c=>c[0]==='triage'));
    }else{
      assert.deepEqual(nodes(tree).find(n=>n.type==='Question').props.answers,saved);
      assert.deepEqual(h.calls.network.at(-1),['triage',500,saved,'prior']);
    }
    assert.deepEqual(h.calls.alerts,[]);
  });
}
for (const language of ['vi','en']) {
  await test(`${language}: an unwell entry keeps only the two discomfort levels when following up a protected alert`, async () => {
    const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',flow_state:'high_alert',
      triage_messages:[{step:'symptoms',question:'Biểu hiện?',answer:'Đau bụng'}],
      triage_completed_at:'2026-11-10T06:53:00Z',triage_state:{phase:'initial',phase_id:'prior',completed:{finalized:true}}};
    const entry={session,api:{followUp:async()=>({ok:true,session:{...session,triage_messages:[],
      triage_state:{phase:'followup',phase_id:'current-followup'}}}),triage:async()=>({ok:true,isDone:false,
      step:'followup_status',question:'Tình trạng hiện giờ?',options:['Đỡ hơn','Vẫn vậy'],multiSelect:false})}};
    const h=routeHarness(language,{mode:'followup',checkin_id:'500',entry:'instant'},{},entry);
    let tree=await h.settle();let status=nodes(tree).find(n=>n.type==='Status');
    assert.equal(status.props.instant,true);
    assert.ok(nodes(tree).some(n=>n.type==='Text'&&n.props.children===translations(language).t('checkinSelectIntensityTitle')));
    await status.props.onSelect('fine');await status.props.onSelect('specific_concern');tree=await h.settle();
    assert.deepEqual(h.calls.network.map(c=>c[0]),['getToday']);
    status=nodes(tree).find(n=>n.type==='Status');await status.props.onSelect('tired');tree=await h.settle();
    assert.ok(nodes(tree).some(n=>n.type==='Question'));
    assert.deepEqual(h.calls.network.find(c=>c[0]==='followUp'),['followUp',500,'tired']);
    assert.deepEqual(h.calls.network.at(-1),['triage',500,[],'current-followup']);
    assert.ok(!h.calls.network.some(c=>c[0]==='start'));
  });
}

await test('live result preparation and the resulting conclusion both request foreground priority', async () => {
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const session = { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired',
    triage_messages: [], triage_state: { phase: 'initial', phase_id: 'phase-a' } };
  const h = routeHarness('vi', { mode: 'resume', checkin_id: '500' }, {}, {
    session, api: { triage: () => response },
  });
  await h.settle(); assert.equal(h.calls.presentation.at(-1), true);
  resolve({ ok: true, isDone: true, summary: 'Kết quả', severity: 'low', recommendation: 'Theo dõi' });
  const tree = await h.settle();
  assert.ok(nodes(tree).some(n => n.type === 'Result'));
  assert.equal(h.calls.presentation.at(-1), true);
});
await test('offline result preparation releases priority for the inline retry screen; practice never takes it', async () => {
  const session = { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired',
    triage_messages: [], triage_state: { phase: 'initial', phase_id: 'phase-a' } };
  const h = routeHarness('vi', { mode: 'resume', checkin_id: '500' }, {}, { session, triageError: true });
  const tree = await h.settle(); assert.ok(nodes(tree).some(n => n.type === 'StateError'));
  assert.equal(h.calls.presentation.at(-1), false);
  const practice = routeHarness('vi'); await practice.settle();
  assert.ok(practice.calls.presentation.every(value => value === false));
});
await test('the explicit top-right Cancel action cannot be undone by a late triage response', async () => {
  let resolve;
  const response=new Promise(done=>{resolve=done;});
  const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',triage_messages:[],triage_state:{phase:'initial',phase_id:'phase-a'}};
  const h=routeHarness('vi',{mode:'resume',checkin_id:'500'},{},{session,api:{triage:()=>response}});
  let tree=await h.settle();
  const cancel=nodes(tree).find(node=>node.props?.testID==='checkin-cancel'); assert.ok(cancel); assert.equal(cancel.props.disabled,false);
  cancel.props.onPress();
  assert.equal(h.calls.network.filter(call=>call[0]==='cancel').length,0,'Opening confirmation cannot cancel anything');
  const confirm=h.calls.alerts.at(-1)[2].find(button=>button.style==='destructive'); assert.ok(confirm);
  confirm.onPress(); confirm.onPress(); tree=await h.settle();
  assert.equal(h.calls.network.filter(call=>call[0]==='cancel').length,1);
  assert.deepEqual(h.calls.network.find(call=>call[0]==='cancel'),['cancel',500,'phase-a']);
  assert.equal(h.calls.routes.at(-1),'/(tabs)/home');
  resolve({ok:true,isDone:true,summary:'Synthetic late result',severity:'low'}); tree=await h.settle();
  assert.ok(!nodes(tree).some(node=>node.type==='Result'));
});
await test('failed cancellation keeps the saved conversation and reloads its current question', async () => {
  const saved=[{step:'symptoms',question:'Synthetic question',answer:'Đau đầu'}];
  const session={id:500,user_id:7,initial_status:'tired',current_status:'tired',triage_messages:saved,triage_state:{phase:'initial',phase_id:'phase-a'}};
  const h=routeHarness('vi',{mode:'resume',checkin_id:'500'},{},{session,cancelError:true});
  let tree=await h.settle(); nodes(tree).find(node=>node.props?.testID==='checkin-cancel').props.onPress();
  h.calls.alerts.at(-1)[2].find(button=>button.style==='destructive').onPress(); tree=await h.settle();
  assert.deepEqual(h.calls.routes,[]);
  assert.deepEqual(nodes(tree).find(node=>node.type==='Question').props.answers,saved);
  assert.ok(h.calls.alerts.at(-1)[1].includes('Tiến độ vẫn được giữ lại'));
});
console.log(`Check-in practice: ${checks} runtime regressions passed.`);
