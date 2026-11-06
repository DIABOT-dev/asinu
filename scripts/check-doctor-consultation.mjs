import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, 'utf8');
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('module', 'exports', 'require', source)(module, module.exports, name => {
    if (name === 'react/jsx-runtime') return require(name);
    assert.ok(name in imports, `Unexpected dependency ${name}`);
    return imports[name];
  });
  return module.exports;
}
function hooks() {
  let cursor = 0, effects = [];
  const slots = [];
  const memo = (run, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) slots[index] = { deps, value: run() };
    return slots[index].value;
  };
  return {
    useRef: value => slots[cursor++] ??= { current: value },
    useState: initial => {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useCallback: (run, deps) => memo(() => run, deps),
    useEffect: (run, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[index].cleanup = run(); });
      }
    },
    render(run) { cursor = 0; const result = run(); const pending = effects; effects = []; pending.forEach(work => work()); return result; },
    async settle(run) { let result; for (let i = 0; i < 7; i++) { result = this.render(run); await tick(); } return result; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    remount() { this.unmount(); slots.length = 0; effects = []; },
  };
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const theme = load('src/styles/theme.ts');
// API response fixtures keep mobile state tests independent of a backend checkout.
function evaluateConsultationScreening({ answers = [], locale = 'vi' }) {
  const catalog = JSON.parse(read(`src/i18n/locales/${locale}/home.json`));
  const steps = ['red_flags', 'associated', 'onset', 'progression', 'impact'];
  const values = [
    ['option:0', 'option:1', 'none', 'unsure'], ['option:0', 'option:1', 'none'],
    ['today', 'two_to_seven_days', 'over_one_week', 'ongoing'],
    ['improving', 'stable', 'worsening'], ['mild', 'moderate', 'severe'],
  ];
  const question = index => ({ step: steps[index], title: `Screening ${steps[index]}`,
    options: values[index].map(value => ({ value, label: catalog[`doctorConsultationSeverity_${value}`]
      || catalog[`doctorConsultationOnset_${value}`] || catalog[`doctorConsultationProgression_${value}`] || value })),
    multiSelect: index < 2, allowFreeText: index < 2,
  });
  const danger = answers.find(answer => answer.step === 'red_flags');
  const status = danger?.values.includes('unsure') ? 'incomplete'
    : danger && !danger.values.includes('none') ? 'needs_in_person'
      : answers.length === 5 ? 'ready' : 'question';
  const field = name => answers.find(answer => answer.step === name)?.values[0];
  return {
    status, isDone: status !== 'question', suitable_for_remote_care: status === 'ready',
    risk_level: status === 'ready' ? 'low' : 'medium', message: status === 'question' ? null : 'Screening information recorded.',
    ...(status === 'question' ? { question: question(answers.length) } : {}),
    intake: { symptom_onset: field('onset'), progression: field('progression'), severity: field('impact') },
    recorded_answers: answers.map((answer, index) => ({ step: answer.step, question: question(index).title,
      answers: answer.values.map(value => question(index).options.find(option => option.value === value)?.label || value) })),
  };
}
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

function harness(language = 'vi') {
  const runtime = hooks(), secure = new Map(), plain = new Map(), calls = [], navigation = [], toasts = [];
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const common = JSON.parse(read(`src/i18n/locales/${language}/common.json`));
  const t = (key, values = {}) => {
    const value = key.startsWith('common:') ? common[key.slice(7)] : key.split('.').reduce((entry, part) => entry?.[part], catalog);
    assert.equal(typeof (value || values.defaultValue), 'string', `Missing copy ${key}`);
    return String(value || values.defaultValue).replace(/{{([^}]+)}}/g, (_, name) => values[name] ?? '');
  };
  let owner = 'A', token = 'token-A', generation = 0, failGet = false, failPost = false, holdRead, holdWrite;
  let options = [{ code: 'general', name: 'General' }, { code: 'internal_medicine', name: 'Internal medicine' }];
  const doctor = (id, specialty = 'general') => ({ doctorId: id, fullName: id, specialties: [specialty], reputation: 4,
    preferred: false, estimatedWaitMinutes: 0, routingTenantId: 'clinic-demo', availability: 'online' });
  let doctors = [doctor('expert-A')], responder;
  const secureStorage = {
    async getItem(key) { const value = secure.get(key) ?? null; if (holdRead) await holdRead; return value; },
    async setItem(key, value) { if (holdWrite) await holdWrite; secure.set(key, value); },
    async removeItem(key) { secure.delete(key); },
  };
  const session = load('src/lib/healthStoreSession.ts', {
    './secureStorage': { secureStorage }, './tokenStore': { tokenStore: { getToken: () => token, subscribeSession() {} } },
  });
  session.healthStoreSession.setOwner(owner);
  const healthModule = session;
  const apiClient = async (url, input) => {
    calls.push({ url, input });
    if (responder) { const result = responder(url, input); if (result !== undefined) return result; }
    if (url === '/api/doctor/screening') return { data: evaluateConsultationScreening(input.body, { birth_year: 1992 }) };
    if (url === '/api/doctor/specialty-options') {
      if (failGet) throw new Error('Offline');
      return { data: { items: options } };
    }
    if (url === '/api/doctor/specialists') return { data: { items: doctors, estimatedWaitMinutes: doctors.length ? 0 : null } };
    if (input?.method === 'POST' && url === '/api/doctor/tasks') {
      if (failPost) throw new Error('Save failed');
      return { data: { task_id: 'saved-task' } };
    }
    return { data: { tasks: [] } };
  };
  const draftHook = load('src/features/doctor-consultation/useConsultationDraft.ts', { react: runtime, '../../lib/healthStoreSession': healthModule });
  const directoryHook = load('src/features/doctor-consultation/useConsultationDirectory.ts', { react: runtime, '../../lib/apiClient': { apiClient }, '../../lib/appEnv': { isExpertConsultationEnabled: true } });
  const screeningHook = load('src/features/doctor-consultation/useConsultationScreening.ts', { react: runtime, '../../lib/apiClient': { apiClient }, '../../lib/appEnv': { isExpertConsultationEnabled: true } });
  const Screen = load('app/doctor-consultation.tsx', {
    react: runtime,
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-router': { Stack: { Screen: 'Stack' } },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', KeyboardAvoidingView: 'Keyboard', Modal: 'Modal',
      Platform: { OS: 'ios' }, Pressable: 'Button', RefreshControl: 'Refresh', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-image-picker': {},
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => plain.get(key) ?? null,
      setItem: async (key, value) => plain.set(key, value), removeItem: async key => plain.delete(key),
    } },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    '../src/features/doctor-consultation/DoctorConsultationIntake': { DoctorConsultationIntake: 'Intake' },
    '../src/features/doctor-consultation/useConsultationDraft': draftHook,
    '../src/features/doctor-consultation/useConsultationScreening': screeningHook,
    '../src/features/doctor-consultation/useConsultationDirectory': directoryHook,
    '../src/lib/native-permissions': { runNativePermission: run => run() },
    '../src/components/ScaledText': { ScaledText: 'Text' },
    '../src/components/AppAlertModal': { AppAlertModal: 'Alert' },
    '../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../src/features/auth/auth.store': { useAuthStore: selector => selector({ profile: { id: owner, consentVersion: 'v1' } }) },
    '../src/lib/apiClient': { apiClient, getApiErrorMessage: (_error, translate, key) => translate(key) },
    '../src/lib/env': { env: { doctorTenantId: 'clinic-demo' } },
    '../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors, isDark: false }) },
    '../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ back: () => navigation.push('back'), replace: route => navigation.push(route), push: route => navigation.push(route) }) },
    '../src/stores/toast.store': { showToast: (message, type) => toasts.push({ message, type }) },
  }).default;
  const render = () => runtime.render(Screen);
  const settle = () => runtime.settle(Screen);
  const get = (tree, type) => nodes(tree).find(node => node.type === type);
  const button = (tree, text) => nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === text));
  const complete = async () => {
    let tree = await settle();
    await get(tree, 'Intake').props.screening.check();
    tree = await settle();
    const defaults = { red_flags: 'none', associated: 'none', onset: 'two_to_seven_days', progression: 'stable', impact: 'mild' };
    for (let i = 0; i < 5; i++) {
      const screening = get(tree, 'Intake').props.screening;
      const question = screening.result?.question;
      if (!question) break;
      await screening.answer({ step: question.step, values: [defaults[question.step]], text: '' });
      tree = await settle();
    }
    assert.equal(get(tree, 'Intake').props.screening.result?.status, 'ready');
    return tree;
  };
  const fill = async () => {
    const tree = await settle();
    get(tree, 'Intake').props.onSummaryChange('Ca kiểm thử: đau mỏi cổ vai sau khi làm việc.');
    return complete();
  };
  const step2 = async tree => { get(tree, 'Intake').props.onContinue(); return settle(); };
  const step3 = async tree => { button(tree, t('common:continue')).props.onPress(); return settle(); };
  return { runtime, secure, plain, calls, navigation, toasts, t, render, settle, get, button, fill, complete, step2, step3,
    changeLanguage(value) { language = value; },
    changeOwner(value) { owner = value; token = `token-${value}`; generation++; session.healthStoreSession.setOwner(value); },
    setOptions(value) { options = value; }, setDoctors(value) { doctors = value; }, doctor,
    failGet(value) { failGet = value; }, failPost(value) { failPost = value; },
    holdRead(value) { holdRead = value; }, holdWrite(value) { holdWrite = value; },
    respond(value) { responder = value; },
  };
}

await test('Back and re-entry restore the description and recheck screening without reusing consent', async () => {
  const h = harness(); let tree = await h.fill();
  const original = h.get(tree, 'Intake').props;
  tree = await h.step2(tree); tree = await h.step3(tree);
  nodes(tree).filter(n => n.props.accessibilityRole === 'checkbox').forEach(n => n.props.onPress());
  await h.settle(); h.runtime.remount(); tree = await h.settle();
  const restored = h.get(tree, 'Intake').props;
  assert.equal(restored.summary, original.summary);
  assert.deepEqual(restored.screening.result?.intake, original.screening.result?.intake);
  tree = await h.step2(tree); tree = await h.step3(tree);
  assert.ok(nodes(tree).filter(n => n.props.accessibilityRole === 'checkbox').every(n => !n.props.accessibilityState.checked));
  assert.equal(h.plain.size, 0, 'Health text never reaches AsyncStorage');
});

await test('Back immediately after the last keystroke still restores the latest edit', async () => {
  const h = harness(); let tree = await h.fill();
  h.get(tree, 'Intake').props.onSummaryChange('Nội dung vừa nhập trước khi bấm Back.');
  h.runtime.remount(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.summary, 'Nội dung vừa nhập trước khi bấm Back.');
});

await test('refresh reloads specialties, online experts and tasks without losing condition or preferred expert', async () => {
  const h = harness(); let tree = await h.fill(); tree = await h.step2(tree);
  h.button(tree, 'expert-A').props.onPress(); tree = await h.settle();
  const before = h.calls.length;
  const refresh = h.get(tree, 'Scroll').props.refreshControl;
  const request = refresh.props.onRefresh(); tree = await h.settle(); await request;
  assert.ok(h.calls.slice(before).some(c => c.url === '/api/doctor/specialty-options'));
  assert.ok(h.calls.slice(before).some(c => c.url === '/api/doctor/specialists'));
  assert.ok(h.calls.slice(before).some(c => c.url.startsWith('/api/doctor/tasks?')));
  assert.equal(h.button(tree, 'expert-A').props.accessibilityState.selected, true);
  h.button(tree, h.t('common:back')).props.onPress(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.summary, 'Ca kiểm thử: đau mỏi cổ vai sau khi làm việc.');
});

await test('refresh discovers newly configured specialties without leaving the screen', async () => {
  const h = harness(); h.setOptions([]); let tree = await h.fill(); tree = await h.step2(tree);
  assert.equal(h.button(tree, h.t('common:continue')).props.disabled, true);
  h.setOptions([{ code: 'general', name: 'General' }]);
  await h.get(tree, 'Scroll').props.refreshControl.props.onRefresh(); tree = await h.settle();
  assert.ok(h.button(tree, h.t('doctorConsultationSpecialty_general')));
  assert.ok(h.button(tree, 'expert-A'));
  assert.equal(h.button(tree, h.t('common:continue')).props.disabled, false);
});

for (const language of ['vi', 'en']) await test(`${language}: failed refresh preserves inputs and cached selection, shows Retry, then recovers`, async () => {
  const h = harness(language); let tree = await h.fill(); tree = await h.step2(tree);
  h.button(tree, 'expert-A').props.onPress(); tree = await h.settle(); h.failGet(true);
  await h.get(tree, 'Scroll').props.refreshControl.props.onRefresh(); tree = await h.settle();
  assert.ok(nodes(tree).some(n => n.props.accessibilityRole === 'alert' && n.props.children === h.t('doctorConsultationDirectoryError')));
  assert.equal(h.button(tree, 'expert-A').props.accessibilityState.selected, true);
  assert.equal(h.get(tree, 'Scroll').props.refreshControl.props.refreshing, false);
  h.failGet(false); await h.button(tree, h.t('common:retry')).props.onPress(); tree = await h.settle();
  assert.ok(!nodes(tree).some(n => n.props.accessibilityRole === 'alert'));
  h.button(tree, h.t('common:back')).props.onPress(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result?.intake.severity, 'mild');
});

await test('an expert going offline is unselected without losing the condition or specialty', async () => {
  const h = harness(); let tree = await h.fill(); tree = await h.step2(tree);
  h.button(tree, 'expert-A').props.onPress(); tree = await h.settle(); h.setDoctors([]);
  await h.get(tree, 'Scroll').props.refreshControl.props.onRefresh(); tree = await h.settle();
  assert.equal(h.button(tree, h.t('doctorConsultationAutoAssign')).props.accessibilityState.selected, true);
  assert.equal(h.button(tree, h.t('doctorConsultationSpecialty_general')).props.accessibilityState.selected, true);
});

await test('late specialist results cannot overwrite a newer specialty selection', async () => {
  const h = harness(); let tree = await h.fill(); tree = await h.step2(tree);
  const held = deferred();
  h.respond((url, input) => url === '/api/doctor/specialists' && input?.body.specialty === 'general' ? held.promise : undefined);
  const refresh = h.get(tree, 'Scroll').props.refreshControl.props.onRefresh(); await h.settle();
  h.setDoctors([h.doctor('expert-B', 'internal_medicine')]);
  h.button(tree, h.t('doctorConsultationSpecialty_internal_medicine')).props.onPress(); tree = await h.settle();
  held.resolve({ data: { items: [h.doctor('stale-expert-A')], estimatedWaitMinutes: 30 } });
  await refresh; tree = await h.settle();
  assert.ok(h.button(tree, 'expert-B')); assert.equal(h.button(tree, 'stale-expert-A'), undefined);
});

await test('duplicate refresh gestures share the in-flight request', async () => {
  const h = harness(); let tree = await h.fill(); const held = deferred();
  h.respond(url => url === '/api/doctor/specialty-options' ? held.promise : undefined);
  const before = h.calls.length, refresh = h.get(tree, 'Scroll').props.refreshControl.props.onRefresh;
  const pending = refresh(); await refresh(); await h.settle();
  assert.equal(h.calls.slice(before).filter(c => c.url === '/api/doctor/specialty-options').length, 1);
  held.resolve({ data: { items: [{ code: 'general', name: 'General' }] } }); await pending;
});

await test('failed submission keeps the draft; successful submission clears it after the existing consent gates', async () => {
  const h = harness(); let tree = await h.fill(); tree = await h.step2(tree); tree = await h.step3(tree);
  await h.button(tree, h.t('doctorConsultationSubmit')).props.onPress(); await h.settle();
  assert.equal(h.calls.filter(c => c.input?.method === 'POST' && c.url === '/api/doctor/tasks').length, 0);
  nodes(tree).filter(n => n.props.accessibilityRole === 'checkbox').forEach(n => n.props.onPress()); tree = await h.settle();
  h.failPost(true); h.button(tree, h.t('doctorConsultationSubmit')).props.onPress(); tree = await h.settle();
  assert.ok(h.secure.size > 0); assert.equal(h.navigation.length, 0);
  h.failPost(false); h.button(tree, h.t('doctorConsultationSubmit')).props.onPress(); await h.settle();
  const request = h.calls.find(c => c.input?.method === 'POST' && c.url === '/api/doctor/tasks');
  assert.deepEqual(request.input.body.clinical_intake, { symptom_onset: 'two_to_seven_days', progression: 'stable', severity: 'mild', emergency_confirmation: true, screening_locale: 'vi', screening_answers: request.input.body.clinical_intake.screening_answers });
  assert.equal(request.input.body.clinical_intake.screening_answers.length, 5);
  assert.equal(h.secure.size, 0); assert.equal(h.navigation.length, 1);
  h.runtime.remount(); tree = await h.settle(); assert.equal(h.get(tree, 'Intake').props.summary, '');
});

await test('a pending secure write cannot recreate a successfully submitted draft', async () => {
  const h = harness(); let tree = await h.fill(); const held = deferred(); h.holdWrite(held.promise);
  h.get(tree, 'Intake').props.onSummaryChange('Ca kiểm thử có lượt ghi nháp đang chờ.');
  tree = await h.complete(); tree = await h.step2(tree); tree = await h.step3(tree);
  nodes(tree).filter(n => n.props.accessibilityRole === 'checkbox').forEach(n => n.props.onPress()); tree = await h.settle();
  h.button(tree, h.t('doctorConsultationSubmit')).props.onPress(); await h.settle();
  assert.equal(h.navigation.length, 0, 'Success waits for queued draft deletion');
  h.holdWrite(null); held.resolve(); await h.settle();
  assert.equal(h.secure.size, 0); assert.equal(h.navigation.length, 1);
});

await test('drafts never appear in another account, including during delayed secure hydration', async () => {
  const h = harness(); await h.fill(); const held = deferred(); h.holdRead(held.promise); h.runtime.remount(); h.render();
  h.changeOwner('B'); let tree = await h.settle();
  assert.equal(h.get(tree, 'Intake'), undefined, 'Nothing from A is rendered while B hydrates');
  h.holdRead(null); held.resolve(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.summary, '');
  h.changeOwner('A'); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.summary, 'Ca kiểm thử: đau mỏi cổ vai sau khi làm việc.');
});

await test('expired and malformed drafts are removed rather than restored', async () => {
  const h = harness(); await h.fill(); const key = [...h.secure.keys()][0];
  for (const value of ['not json', JSON.stringify({ version: 1, expiresAt: Date.now() - 1, summary: 'Expired' })]) {
    h.secure.set(key, value); h.runtime.remount(); const tree = await h.settle();
    assert.equal(h.get(tree, 'Intake').props.summary, ''); assert.equal(h.secure.size, 0);
  }
});

function questionHarness(step, width = 393, fontScale = 1) {
  const runtime = hooks(), catalog = JSON.parse(read('src/i18n/locales/vi/home.json'));
  let submitted;
  const full = [
    ['red_flags', 'none'], ['associated', 'none'], ['onset', 'today'], ['progression', 'stable'], ['impact', 'mild'],
  ].map(([name, value]) => ({ step: name, values: [value], text: '' }));
  const index = full.findIndex(answer => answer.step === step);
  const result = evaluateConsultationScreening({ summary: 'Tôi bị đau đầu', answers: full.slice(0, index), locale: 'vi' });
  const module = load('src/features/doctor-consultation/DoctorConsultationIntake.tsx', {
    react: runtime,
    'react-native': {
      Pressable: 'Choice', View: 'View', ActivityIndicator: 'Loading', Linking: {},
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width }),
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: key => catalog[key] ?? key }) },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../components/ScaledTextInput': { ScaledTextInput: 'Input' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors, isDark: false }) },
    '../../hooks/useScaledTypography': { useScaledFontSize: size => size * fontScale },
    '../../styles/theme': theme,
  });
  const tree = module.DoctorConsultationIntake({ summary: 'Tôi bị đau đầu', answerCount: index,
    screening: { result, busy: false, error: false, answer: value => { submitted = value; }, reset() {}, back() {} },
    onSummaryChange() {}, onContinue() {},
  });
  const question = nodes(tree).find(node => typeof node.type === 'function' && node.props.question);
  const render = () => runtime.render(() => question.type(question.props));
  const choices = () => {
    const group = nodes(render()).find(node => typeof node.type === 'function' && node.props.choices);
    return nodes(group.type(group.props)).filter(node => ['radio', 'checkbox'].includes(node.props?.accessibilityRole));
  };
  return { render, choices, submit() {
    const button = nodes(render()).find(node => node.type === 'Choice' && node.props.accessibilityRole === 'button');
    assert.equal(button.props.disabled, false);
    button.props.onPress(); return submitted;
  } };
}

for (const [width, fontScale] of [[393, 1], [360, 1], [393, 1.4]]) {
  await test(`screening choices select, clear on a second tap, and switch at ${width}px / ${fontScale}x text`, () => {
    for (const step of ['onset', 'progression', 'impact']) {
      const h = questionHarness(step, width, fontScale);
      h.choices().forEach((_choice, index) => {
        h.choices()[index].props.onPress();
        assert.equal(h.choices()[index].props.accessibilityState.checked, true);
        assert.equal(h.choices().filter(choice => choice.props.accessibilityState.checked).length, 1);
        h.choices()[index].props.onPress();
        assert.ok(h.choices().every(choice => !choice.props.accessibilityState.checked));
      });
      h.choices()[0].props.onPress(); h.choices()[1].props.onPress();
      assert.equal(h.choices()[0].props.accessibilityState.checked, false);
      assert.equal(h.choices()[1].props.accessibilityState.checked, true);
      assert.equal(h.submit().step, step);
    }
  });
}

await test('danger and associated choices are togglable, and None excludes positive symptoms', () => {
  for (const step of ['red_flags', 'associated']) {
    const h = questionHarness(step);
    h.choices()[0].props.onPress(); h.choices()[1].props.onPress();
    assert.equal(h.choices().filter(choice => choice.props.accessibilityState.checked).length, 2);
    const noneIndex = h.choices().length - (step === 'red_flags' ? 2 : 1);
    h.choices()[noneIndex].props.onPress();
    assert.equal(h.choices().filter(choice => choice.props.accessibilityState.checked).length, 1);
    assert.deepEqual(h.submit().values, ['none']);
    h.choices()[noneIndex].props.onPress();
    assert.ok(h.choices().every(choice => !choice.props.accessibilityState.checked));
  }
});

await test('description edits invalidate old screening and prevent choosing an expert until rechecked', async () => {
  const h = harness(); let tree = await h.fill();
  h.get(tree, 'Intake').props.onSummaryChange('Nội dung vấn đề mới.');
  tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result, null);
  tree = await h.step2(tree);
  assert.ok(h.get(tree, 'Intake'));
  tree = await h.complete(); tree = await h.step2(tree);
  assert.equal(h.get(tree, 'Intake'), undefined);
});

for (const language of ['vi', 'en']) await test(`${language}: blocked and uncertain screening cannot advance to specialists`, async () => {
  for (const value of ['option:0', 'unsure']) {
    const h = harness(language); let tree = await h.settle();
    assert.equal(h.calls.filter(call => call.url === '/api/doctor/screening').length, 0);
    h.get(tree, 'Intake').props.onSummaryChange('Tôi bị đau đầu'); tree = await h.settle();
    await h.get(tree, 'Intake').props.screening.check(); tree = await h.settle();
    assert.equal(h.get(tree, 'Intake').props.screening.result.question.step, 'red_flags');
    await h.get(tree, 'Intake').props.screening.answer({ step: 'red_flags', values: [value], text: '' });
    tree = await h.settle(); tree = await h.step2(tree);
    assert.ok(h.get(tree, 'Intake'));
    assert.equal(h.get(tree, 'Intake').props.screening.result.suitable_for_remote_care, false);
    assert.equal(h.calls.filter(call => call.url === '/api/doctor/tasks' && call.input?.method === 'POST').length, 0);
  }
});

await test('screening requests and draft hydration respect the consultation flag', async () => {
  for (const enabled of [false, true]) for (const resumeDraft of [false, true]) {
    const runtime = hooks(), calls = [];
    const answers = resumeDraft ? [{ step: 'red_flags', values: ['none'], text: '' }] : [];
    const { useConsultationScreening } = load('src/features/doctor-consultation/useConsultationScreening.ts', {
      react: runtime,
      '../../lib/appEnv': { isExpertConsultationEnabled: enabled, isDoctorFeaturesEnabled: !enabled },
      '../../lib/apiClient': { apiClient: async (url, input) => {
        calls.push({ url, input });
        return { data: evaluateConsultationScreening(input.body) };
      } },
    });
    const render = () => useConsultationScreening({
      owner: 'A', ready: true, summary: 'Đau đầu', answers, locale: 'vi', onAnswersChange() {},
    });
    let screening = await runtime.settle(render);
    if (!resumeDraft) { await screening.check(); screening = await runtime.settle(render); }
    assert.equal(calls.length, enabled ? 1 : 0);
    assert.equal(screening.result?.status ?? null, enabled ? 'question' : null);
    runtime.unmount();
  }
});

await test('a failed screening request preserves submitted answers and Retry resumes the same stage', async () => {
  const h = harness(); let tree = await h.settle();
  h.get(tree, 'Intake').props.onSummaryChange('Đau đầu'); tree = await h.settle();
  await h.get(tree, 'Intake').props.screening.check(); tree = await h.settle();
  h.respond(url => url === '/api/doctor/screening' ? Promise.reject(new Error('Offline')) : undefined);
  await h.get(tree, 'Intake').props.screening.answer({ step: 'red_flags', values: ['none'], text: '' });
  tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.answerCount, 1);
  assert.equal(h.get(tree, 'Intake').props.screening.error, true);
  h.respond(undefined); await h.get(tree, 'Intake').props.screening.check(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result.question.step, 'associated');
});

await test('late screening responses cannot approve an edited problem or leak across accounts', async () => {
  const h = harness(); let tree = await h.fill(); const held = deferred();
  h.respond((url, input) => url === '/api/doctor/screening' ? held.promise : undefined);
  const pending = h.get(tree, 'Intake').props.screening.check();
  h.get(tree, 'Intake').props.onSummaryChange('Vấn đề mới chưa kiểm tra'); tree = await h.settle();
  held.resolve({ data: { status: 'ready', isDone: true, suitable_for_remote_care: true, intake: {}, recorded_answers: [] } });
  await pending; tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result, null);
  h.changeOwner('B'); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result, null);
  assert.equal(h.get(tree, 'Intake').props.summary, '');
});

await test('changing language restarts screening rather than reinterpreting old option values', async () => {
  const h = harness(); await h.fill(); h.changeLanguage('en'); const tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.result, null);
  assert.equal(h.get(tree, 'Intake').props.answerCount, 0);
});

await test('rapid repeated answer taps create one request and one recorded answer', async () => {
  const h = harness(); let tree = await h.settle();
  h.get(tree, 'Intake').props.onSummaryChange('Đau đầu'); tree = await h.settle();
  await h.get(tree, 'Intake').props.screening.check(); tree = await h.settle();
  const held = deferred(); h.respond(url => url === '/api/doctor/screening' ? held.promise : undefined);
  const before = h.calls.filter(call => call.url === '/api/doctor/screening').length;
  const screening = h.get(tree, 'Intake').props.screening;
  const answer = { step: 'red_flags', values: ['none'], text: '' };
  const first = screening.answer(answer); await screening.answer(answer);
  held.resolve({ data: evaluateConsultationScreening({ answers: [answer] }) }); await first;
  tree = await h.settle();
  assert.equal(h.calls.filter(call => call.url === '/api/doctor/screening').length, before + 1);
  assert.equal(h.get(tree, 'Intake').props.answerCount, 1);
  assert.equal(h.get(tree, 'Intake').props.screening.result.question.step, 'associated');
});

await test('legacy condition drafts keep the description and require fresh screening', async () => {
  const h = harness(); await h.fill(); const key = [...h.secure.keys()][0];
  h.secure.set(key, JSON.stringify({ version: 1, expiresAt: Date.now() + 60000,
    summary: 'Mô tả từ bản app cũ', symptomOnset: 'today', progression: 'stable', severity: 'mild' }));
  h.runtime.remount(); const tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.summary, 'Mô tả từ bản app cũ');
  assert.equal(h.get(tree, 'Intake').props.answerCount, 0);
  assert.equal(h.get(tree, 'Intake').props.screening.result, null);
});

await test('a malformed screening response cannot unlock the specialist step', async () => {
  const h = harness(); let tree = await h.settle();
  h.get(tree, 'Intake').props.onSummaryChange('Đau đầu'); tree = await h.settle();
  h.respond(url => url === '/api/doctor/screening'
    ? { data: { status: 'ready', isDone: true, suitable_for_remote_care: true, intake: {}, recorded_answers: [] } } : undefined);
  await h.get(tree, 'Intake').props.screening.check(); tree = await h.settle();
  assert.equal(h.get(tree, 'Intake').props.screening.error, true);
  tree = await h.step2(tree); assert.ok(h.get(tree, 'Intake'));
});

console.log(`Doctor consultation: ${checks} runtime regressions passed.`);
