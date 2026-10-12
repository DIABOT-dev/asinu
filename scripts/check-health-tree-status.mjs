import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = path => fs.readFileSync(path, 'utf8');
const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function evaluate(path, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Evaluate the production component with isolated native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const factorMetadata = evaluate('src/features/checkin/health-score-factors.ts');
const detailHelpers = evaluate('src/features/checkin/health-status-details.ts');
const { lightColors, darkColors } = evaluate('src/styles/theme.ts');
const translate = language => {
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  return (key, options = {}) => {
    assert.equal(typeof catalog[key], 'string', `Missing ${language}/${key}`);
    return catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? '');
  };
};
const texts = tree => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children);
function harness(language, compact, isDark) {
  const t = translate(language);
  const destinations = [];
  const colors = isDark ? darkColors : lightColors;
  const { HealthTreeStatusCard } = evaluate('src/components/HealthTreeStatusCard.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useMemo: work => work(),
    },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t }) },
    './ScaledText': { ScaledText: 'Text' },
    '../styles': { iconColors: { warning: '#d97706' }, spacing: { sm: 8, md: 16 }, radius: { full: 999 } },
    '../hooks/useScaledTypography': { useScaledTypography: () => ({ size: { xs: 13, sm: 15, md: 18 } }) },
    '../hooks/useThemeColors': { useThemeColors: () => ({ colors, isDark }) },
    '../features/checkin/health-score-factors': factorMetadata,
    '../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push: route => destinations.push(route) }) },
  });
  return {
    t,
    destinations,
    render(score, showDetails = true) { return HealthTreeStatusCard({ score, compact, showDetails }); },
  };
}

let checks = 0;
for (const language of ['vi', 'en']) {
  for (const compact of [true, false]) {
    for (const isDark of [false, true]) {
      const h = harness(language, compact, isDark);
      const score = { level: 'danger', checkinDone: true, factors: ['systolic_very_high'] };
      let tree = h.render(score);
      const text = () => texts(tree);
      assert.ok(text().includes(h.t('healthTreeCheckinDone')));
      assert.equal(tree.props.accessibilityRole, 'button');
      assert.equal(tree.props.accessibilityState, undefined, 'A navigation action is not an accordion');
      assert.ok(text().includes(h.t('healthFactorSystolicVeryHigh')), 'The reason is visible before opening details');
      assert.ok(!text().includes(h.t('healthScoreDangerSub')), 'A known reason replaces the generic subtitle');
      assert.ok(nodes(tree).some(node => node.type === 'Icon' && node.props.name === 'chevron-forward'));
      assert.ok(!nodes(tree).some(node => node.type === 'Icon' && /chevron-(up|down)/.test(node.props.name)));
      tree.props.onPress();
      assert.deepEqual(h.destinations, ['/health-status']);
      tree = h.render({ ...score, factors: ['glucose_high'] });
      assert.ok(text().includes(h.t('healthFactorGlucoseHigh')));
      tree = h.render({ ...score, factors: ['future_factor_code'] });
      assert.ok(text().includes(h.t('healthFactorUnknown')));
      assert.ok(!text().includes('future_factor_code'), 'Internal factor codes must never appear');
      tree = h.render({ ...score, checkinDone: false });
      assert.ok(text().includes(h.t('healthScoreDanger')), 'A concerning measurement remains visible before check-in');
      assert.equal(tree.props.accessibilityRole, 'button');
      tree = h.render(score, false);
      assert.equal(tree.props.onPress, undefined, 'The details screen cannot navigate to itself');
      for (const empty of [null, { level: 'ok', checkinDone: true, factors: [] }, { ...score, checkinDone: false, factors: [] }]) {
        tree = h.render(empty);
        assert.equal(tree.props.onPress, undefined);
        assert.equal(tree.props.accessibilityRole, undefined);
        assert.equal(tree.props.disabled, true);
        assert.ok(!text().includes(h.t('healthTreeShowSignals')));
        assert.ok(!nodes(tree).some(node => node.type === 'Icon' && /chevron/.test(node.props.name)));
      }
      checks++;
      console.log(`PASS ${language}/${compact ? 'home' : 'tree'}/${isDark ? 'dark' : 'light'}: right arrow opens details and names the actual reason`);
    }
  }
}
assert.equal(JSON.parse(read('src/i18n/locales/vi/home.json')).healthTreeCheckinDone, 'Đã ghi nhận check-in');

const now = Date.parse('2026-10-12T10:00:00Z');
const logAt = (offset, values) => ({ recordedAt: new Date(now + offset).toISOString(), ...values });
const hour = 60 * 60 * 1000;
const readings = detailHelpers.getRecentHealthReadings([
  logAt(-2 * hour, { type: 'glucose', value: 220 }),
  logAt(-hour, { type: 'glucose', value: 260 }),
  logAt(-hour, { type: 'blood-pressure', systolic: 185, diastolic: 95 }),
  logAt(-25 * hour, { type: 'blood-pressure', systolic: 200, diastolic: 100 }),
  logAt(hour, { type: 'glucose', value: 999 }),
  { type: 'glucose', value: 999, recordedAt: 'invalid' },
], now);
assert.deepEqual(readings.map(({ value, unit }) => ({ value, unit })), [
  { value: '260', unit: 'mg/dL' }, { value: '185/95', unit: 'mmHg' },
]);
assert.deepEqual(detailHelpers.getRecentHealthReadings([logAt(-25 * hour, { type: 'glucose', value: 260 })], now), []);
const incomplete = detailHelpers.getRecentHealthReadings([logAt(-hour, { type: 'blood-pressure', systolic: 150 })], now)[0];
assert.equal(incomplete.labelKey, 'healthStatusSystolic');
assert.equal(incomplete.value, '150');
assert.deepEqual(detailHelpers.getCheckinAnswers({ triage_messages: [
  { question: 'Có khó thở không?', answer: 'Không' },
  { question: 'Triệu chứng bắt đầu từ khi nào?', answer: 'Từ hôm qua' },
  { question: 'Bạn có triệu chứng gì?', answer: ['Đau đầu', 'Buồn nôn'] },
  { question: '', answer: 'Chưa' },
] }), [
  { question: 'Có khó thở không?', answer: 'Không' },
  { question: 'Triệu chứng bắt đầu từ khi nào?', answer: 'Từ hôm qua' },
  { question: 'Bạn có triệu chứng gì?', answer: 'Đau đầu, Buồn nôn' },
]);
assert.deepEqual(detailHelpers.getCheckinAnswers(null), []);
console.log('PASS reading timestamps, latest values, missing diastolic and contextual check-in answers');
checks++;

function detailsHarness(language, isDark, api) {
  const t = translate(language);
  const colors = isDark ? darkColors : lightColors;
  const slots = []; let cursor = 0; let focused;
  let cleanup; let updates = 0;
  const destinations = [];
  const { default: DetailsScreen } = evaluate('app/health-status/index.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useMemo: fn => fn(),
      useCallback: (fn, deps) => {
        const index = cursor++;
        if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
          slots[index] = { fn, deps };
        }
        return slots[index].fn;
      },
      useState: initial => {
        const index = cursor++;
        if (!(index in slots)) {
          slots[index] = initial;
        }
        return [slots[index], value => { updates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
    },
    'expo-router': { useFocusEffect: callback => {
      if (focused !== callback) { cleanup?.(); focused = callback; cleanup = callback(); }
    } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    '../../src/components/HealthTreeStatusCard': { HealthTreeStatusCard: 'StatusCard' },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../src/components/Screen': { Screen: 'Screen' },
    '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../../src/components/state/Skeleton': { SkeletonBlock: 'Skeleton' },
    '../../src/components/state/StateError': { StateError: 'StateError' },
    '../../src/features/checkin/checkin.api': { checkinApi: api },
    '../../src/features/checkin/health-status-details': detailHelpers,
    '../../src/features/logs/logs.api': { logsApi: { fetchRecent: api.logs } },
    '../../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ canGoBack: () => false, replace: route => destinations.push(route) }) },
    '../../src/hooks/useScaledTypography': { useScaledTypography: () => ({ size: { sm: 15, md: 18, lg: 22 } }) },
    '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors, isDark }) },
    '../../src/styles': { spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 24 } },
  });
  return {
    t, destinations,
    render() { cursor = 0; return DetailsScreen(); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); return this.render(); },
    dispose() { cleanup?.(); },
    get updates() { return updates; },
  };
}

const detailsApi = () => ({
  getHealthScore: async () => ({ level: 'danger', factors: ['triage_severity_high'], checkinDone: true }),
  getToday: async () => ({ session: { current_status: 'specific_concern', triage_summary: 'Đau đầu từ hôm qua.', triage_messages: [{ question: 'Có khó thở không?', answer: 'Không' }] } }),
  logs: async () => [{ type: 'glucose', value: 260, unit: 'mg/dL', recordedAt: new Date().toISOString() }],
});
for (const [language, isDark] of [['vi', false], ['vi', true], ['en', false], ['en', true]]) {
  const h = detailsHarness(language, isDark, detailsApi());
  assert.ok(nodes(h.render()).some(node => node.type === 'Skeleton'));
  const tree = await h.settle();
  assert.ok(texts(tree).includes('Đau đầu từ hôm qua.'));
  assert.ok(texts(tree).includes('Có khó thở không?'));
  assert.ok(texts(tree).includes('Không'), 'Negated answers are shown with their question, not turned into a symptom');
  assert.ok(texts(tree).includes('260 mg/dL'));
  assert.equal(nodes(tree).find(node => node.type === 'StatusCard').props.showDetails, false);
  nodes(tree).find(node => node.type === 'Back').props.onPress();
  assert.deepEqual(h.destinations, ['/tree']);
  h.dispose(); checks++;
  console.log(`PASS ${language}/${isDark ? 'dark' : 'light'}: real check-in and measured values in details`);
}

const failed = detailsHarness('vi', false, {
  ...detailsApi(), getToday: async () => { throw new Error('offline'); }, logs: async () => { throw new Error('offline'); },
});
failed.render();
const failedTree = await failed.settle();
assert.ok(texts(failedTree).includes(failed.t('healthStatusCheckinError')));
assert.ok(texts(failedTree).includes(failed.t('healthStatusReadingsError')));
assert.ok(!texts(failedTree).includes(failed.t('healthStatusNoRecentReadings')), 'A load failure must not be presented as missing data');
const retry = nodes(failedTree).find(node => node.type === 'Pressable' && texts(node).includes(failed.t('healthStatusRetry')));
assert.equal(typeof retry.props.onPress, 'function');
retry.props.onPress(); failed.render(); await failed.settle(); failed.dispose(); checks++;

const unavailable = detailsHarness('vi', false, { ...detailsApi(), getHealthScore: async () => { throw new Error('offline'); } });
unavailable.render();
assert.ok(nodes(await unavailable.settle()).some(node => node.type === 'StateError' && typeof node.props.onRetry === 'function'));
unavailable.dispose(); checks++;

const empty = detailsHarness('vi', false, {
  ...detailsApi(), getToday: async () => ({ session: null }), logs: async () => [],
});
empty.render();
const emptyTree = await empty.settle();
assert.ok(texts(emptyTree).includes(empty.t('healthStatusNoCheckinDetail')));
assert.ok(texts(emptyTree).includes(empty.t('healthStatusNoRecentReadings')));
assert.ok(!texts(emptyTree).includes('260 mg/dL'), 'Missing measurements must never use fabricated values');
empty.dispose(); checks++;

let resolvePending;
const pending = detailsHarness('vi', false, { ...detailsApi(), getHealthScore: () => new Promise(resolve => { resolvePending = resolve; }) });
pending.render(); pending.dispose();
const updatesBeforeDispose = pending.updates;
resolvePending({ level: 'ok', factors: [], checkinDone: true });
await new Promise(resolve => setImmediate(resolve));
assert.equal(pending.updates, updatesBeforeDispose, 'Leaving the page must cancel later state updates');
checks++;
console.log('PASS partial failures, retry, full failure and leaving before requests finish');
console.log(`Health status: ${checks} scenarios passed.`);
