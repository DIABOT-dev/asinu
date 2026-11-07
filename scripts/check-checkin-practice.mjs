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
const locationDetailsHelpers = evaluate(read('src/features/checkin/location-details.ts'));
const { createCheckinPractice } = evaluate(read('src/features/guidance/checkin.practice.ts'));
const triageOptionDisplay = evaluate(read('src/features/checkin/triage-option-display.ts'));
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
    return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (match, name) => options[name] ?? match) : value;
  };
  const t = (key, options) => get('home', key, options);
  const tg = (key, options) => get('onboarding', key, options);
  return { t, tg, useTranslation: ns => ({ t: ns === 'onboarding' ? tg : t, i18n: { resolvedLanguage: language } }) };
}
const animation = { duration: () => animation, delay: () => animation };
const native = { View: 'View', Text: 'Text', Image: 'Image', asinuChatSticker: 'asinu_chat_sticker.png', TextInput: 'Input', Pressable: 'Pressable', ScrollView: 'ScrollView',
  ActivityIndicator: 'Spinner', Ionicons: 'Icon', MaterialCommunityIcons: 'Icon', Stack: { Screen: 'Stack' },
  GuidePracticeScope: 'PracticeScope', GuideScrollScope: 'ScrollScope', GuideTarget: 'GuideTarget',
  ScreenBackButton: 'Back', AppAlertModal: 'Alert', AiDataConsentModal: 'Consent',
  CheckinGiftCloseButton: ({ disabled, eligible = false, children }) => {
    assert.equal(eligible, false, 'Tutorials and read-only UI previews cannot consume daily gifts');
    return jsx('Pressable', { disabled, children });
  },
  Animated: { View: 'Animated' }, FadeIn: animation, FadeInDown: animation, FadeInLeft: animation,
  Svg: 'Svg', Path: 'Path', Circle: 'Circle', CheckinHeroBadge: 'Badge', guideColors: { background: '#f9fcfb', ink: '#123b35',
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
  realApi.getToday = async () => { calls.network.push(['getToday']); return { ok: true, session: null }; };
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
    ConclusionLoadingView: 'Loading',
    offerCheckinGiftOnHome() {},
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
const extractVariable = name => routeFile.statements.find(item => ts.isVariableStatement(item)
  && item.declarationList.declarations.some(declaration => declaration.name.getText(routeFile) === name)).getText(routeFile);

function locationHarness(language) {
  const runtime = hooks(), tr = translations(language), calls = [];
  const component = evaluate(`${extractVariable('BODY_LOCATION_OPTIONS')}\n${extract('LocationScreen')}\nmodule.exports = LocationScreen;`, {
    ...native, ...runtime, ...tr, ...locationDetailsHelpers, spacing: { xs: 4 },
    VoiceAnswerButton: 'VoiceAnswerButton', useGuideAcknowledgement: () => () => {},
  });
  let props = { styles: {}, loading: false, onConfirm: (...args) => calls.push(args), onBack() {}, onBeforeAi: async () => true };
  let tree;
  const settle = async () => { tree = await runtime.settle(() => component(props)); return tree; };
  const find = id => { const node = nodes(tree).find(item => item.props?.testID === id); assert.ok(node, id); return node; };
  return { calls, tr, find, settle, async press(id) { await find(id).props.onPress(); return settle(); },
    async note(value) { nodes(tree).find(item => item.type === 'Input').props.onChangeText(value); return settle(); },
    async loading(value) { props = { ...props, loading: value }; return settle(); } };
}

for (const language of ['vi', 'en']) {
  await test(`${language}: selecting head and limbs asks for both exact spots before starting check-in`, async () => {
    const h = locationHarness(language); await h.settle();
    await h.press('checkin-location-region-head'); await h.press('checkin-location-region-limbs');
    assert.ok(h.find('checkin-location-detail-head'));
    assert.ok(h.find('checkin-location-detail-limbs'));
    assert.equal(h.find('checkin-location-continue').props.disabled, true);
    await h.press('checkin-location-continue'); assert.equal(h.calls.length, 0);
    await h.press('checkin-location-detail-head');
    await h.press('checkin-location-position-head-forehead');
    assert.equal(h.find('checkin-location-continue').props.disabled, true, 'The arm/leg area still needs an answer');
    await h.press('checkin-location-detail-limbs');
    await h.press('checkin-location-position-limbs-right_wrist');
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.press('checkin-location-continue');
    assert.deepEqual(h.calls[0][0], ['head', 'limbs']);
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_forehead')));
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_right_wrist')));
    await h.press('checkin-location-region-head');
    await h.press('checkin-location-continue');
    assert.deepEqual(h.calls[1][0], ['limbs']);
    assert.ok(!h.calls[1][1].includes(h.tr.t('checkinLocationDetail_forehead')), 'A removed region cannot leak a stale answer');
  });
  await test(`${language}: uncertain and custom positions are supported without inventing pain`, async () => {
    const h = locationHarness(language); await h.settle(); await h.press('checkin-location-region-head');
    await h.press('checkin-location-detail-head'); await h.press('checkin-location-position-head-uncertain');
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.press('checkin-location-continue');
    assert.ok(h.calls[0][1].includes(h.tr.t('checkinLocationDetail_uncertain')));
    await h.press('checkin-location-position-head-other_detail');
    assert.equal(h.find('checkin-location-continue').props.disabled, true);
    await h.note(language === 'vi' ? 'Phía sau tai phải' : 'Behind the right ear');
    assert.equal(h.find('checkin-location-continue').props.disabled, false);
    await h.press('checkin-location-continue');
    assert.ok(h.calls[1][1].includes(language === 'vi' ? 'Phía sau tai phải' : 'Behind the right ear'));
    await h.loading(true); await h.press('checkin-location-continue');
    assert.equal(h.calls.length, 2, 'A stale loading action cannot submit again');
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
    const preview = evaluate(source, { ...native, ...runtime, ...translations(language), ...triageOptionDisplay, ...locationDetailsHelpers, isDoctorFeaturesEnabled: true, MAX_TRIAGE_QUESTIONS: 4,
      CHECKIN_STATUS_CHOICES: [{ status: 'fine' }, { status: 'tired' }, { status: 'very_tired' }],
      CheckinStatusChoice: 'StatusChoice', VoiceAnswerButton: 'VoiceAnswerButton',
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
        if (node.type === 'StatusChoice') assert.equal(node.props.onSelect, undefined);
        if (node.type === 'GuideTarget') assert.equal(node.props.enabled, false, `${id}: active coaching target`);
      }
    }
  });
}
await test('route identity remounts practice and real sessions rather than sharing private answer state', () => {
  assert.match(extract('CheckinRoute'), /key=\{.*params\.mode.*params\.checkin_id.*params\.guide/);
  assert.match(extract('CheckinScreen'), /isPractice \? createCheckinPractice\(t\) : checkinApi/);
  assert.doesNotMatch(extract('CheckinScreen'), /checkinApi\.(start|triage|followUp)/);
});
for (const language of ['vi', 'en']) {
  await test(`${language}: instant check-in only offers tired levels and neither status screen shows the removed artwork or slogans`, () => {
    const tr = translations(language);
    const choices = ['fine', 'tired', 'very_tired'].map(status => ({ status }));
    const StatusScreen = evaluate(`${extract('StatusScreen')}\nmodule.exports=StatusScreen;`, {
      ...native, ...tr, CHECKIN_STATUS_CHOICES: choices, CheckinStatusChoice: 'Choice',
    });
    for (const instant of [false, true]) {
      const tree = StatusScreen({ styles: {}, instant, isFollowUp: false, onSelect() {} });
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
      assert.deepEqual(h.calls.network, [], 'Unsupported stale presets cannot save an instant check-in');
      screen = nodes(tree).find(n => n.type === 'Status');
      await screen.props.onSelect(level); tree = await h.settle();
      const location = nodes(tree).find(n => n.type === 'Location'); assert.ok(location);
      assert.deepEqual(h.calls.network, [], 'Wait for locations before saving');
      await location.props.onConfirm(['head','limbs'], 'Đầu: Trán; Tay chân: Cổ tay phải'); tree = await h.settle();
      assert.deepEqual(h.calls.network[0], ['start',level,['head','limbs'],'Đầu: Trán; Tay chân: Cổ tay phải',true]);
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
      ...native, ...runtime, ...tr, ...optionDisplay, MAX_TRIAGE_QUESTIONS: 4,
      spacing: { sm: 8 }, VoiceAnswerButton: 'VoiceAnswerButton', useGuideAcknowledgement: () => () => {},
    });
    const catalog = JSON.parse(read(`../backend.asinu/src/i18n/locales/${language}.json`));
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
console.log(`Check-in practice: ${checks} runtime regressions passed.`);
