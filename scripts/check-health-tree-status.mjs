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
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const factorMetadata = evaluate('src/features/checkin/health-score-factors.ts');
const { lightColors, darkColors } = evaluate('src/styles/theme.ts');
function harness(language, compact, isDark) {
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const t = (key, options = {}) => {
    assert.equal(typeof catalog[key], 'string', `Missing ${language}/${key}`);
    return catalog[key].replace('{{count}}', options.count);
  };
  let cursor = 0;
  const slots = [];
  const colors = isDark ? darkColors : lightColors;
  const { HealthTreeStatusCard } = evaluate('src/components/HealthTreeStatusCard.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useMemo: work => work(),
      useState: initial => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; }];
      },
    },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t }) },
    './ScaledText': { ScaledText: 'Text' },
    '../styles': { iconColors: { warning: '#d97706' }, spacing: { sm: 8, md: 16 }, radius: { full: 999 } },
    '../hooks/useScaledTypography': { useScaledTypography: () => ({ size: { xs: 13, sm: 15, md: 18 } }) },
    '../hooks/useThemeColors': { useThemeColors: () => ({ colors, isDark }) },
    '../features/checkin/health-score-factors': factorMetadata,
  });
  return {
    t,
    render(score) { cursor = 0; return HealthTreeStatusCard({ score, compact }); },
  };
}

let checks = 0;
for (const language of ['vi', 'en']) {
  for (const compact of [true, false]) {
    for (const isDark of [false, true]) {
      const h = harness(language, compact, isDark);
      const score = { level: 'danger', checkinDone: true, factors: ['systolic_very_high'] };
      let tree = h.render(score);
      const text = () => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children);
      assert.ok(text().includes(h.t('healthTreeCheckinDone')));
      assert.equal(tree.props.accessibilityRole, 'button');
      assert.deepEqual(tree.props.accessibilityState, { expanded: false });
      assert.ok(!text().includes(h.t('healthFactorSystolicVeryHigh')));
      tree.props.onPress(); tree = h.render(score);
      assert.deepEqual(tree.props.accessibilityState, { expanded: true });
      assert.ok(text().includes(h.t('healthFactorSystolicVeryHigh')), 'Press must reveal the actual factor');
      tree.props.onPress(); tree = h.render(score);
      assert.ok(!text().includes(h.t('healthFactorSystolicVeryHigh')), 'Second press must collapse');
      tree.props.onPress(); tree = h.render({ ...score, factors: ['glucose_high'] });
      assert.equal(tree.props.accessibilityState.expanded, false, 'Different signals start collapsed');
      tree.props.onPress(); tree = h.render({ ...score, factors: ['glucose_high'] });
      assert.ok(text().includes(h.t('healthFactorGlucoseHigh')));
      tree = h.render({ ...score, factors: ['future_factor_code'] });
      tree.props.onPress(); tree = h.render({ ...score, factors: ['future_factor_code'] });
      assert.ok(text().includes(h.t('healthFactorUnknown')));
      assert.ok(!text().includes('future_factor_code'), 'Internal factor codes must never appear');
      for (const empty of [null, { level: 'ok', checkinDone: true, factors: [] }, { ...score, checkinDone: false }]) {
        tree = h.render(empty);
        assert.equal(tree.props.onPress, undefined);
        assert.equal(tree.props.accessibilityRole, undefined);
        assert.equal(tree.props.disabled, true);
        assert.ok(!text().includes(h.t('healthTreeShowSignals')));
        assert.ok(!nodes(tree).some(node => node.type === 'Icon' && /chevron/.test(node.props.name)));
      }
      checks++;
      console.log(`PASS ${language}/${compact ? 'home' : 'tree'}/${isDark ? 'dark' : 'light'}: signals expand, collapse and handle empty/refreshed data`);
    }
  }
}
assert.equal(JSON.parse(read('src/i18n/locales/vi/home.json')).healthTreeCheckinDone, 'Đã ghi nhận check-in');
console.log(`Health status card: ${checks} interaction scenarios passed.`);
