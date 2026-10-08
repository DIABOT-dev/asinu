import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const evaluate = (file, dependencies, extra = '') => {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file) + extra, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute production components and their real effects with isolated adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', source)(module, module.exports, name => {
    if (name.endsWith('.png')) return name;
    if (name === 'react/jsx-runtime') return {
      jsx: (type, props, key) => React.createElement(type, { ...props, key }),
      jsxs: (type, props, key) => React.createElement(type, { ...props, key }),
    };
    assert.ok(Object.hasOwn(dependencies, name), `Missing adapter: ${name}`);
    return dependencies[name];
  });
  return module.exports;
};
const theme = evaluate('src/styles/theme.ts', {});
const { localizedPlanName } = evaluate('src/features/subscription/planName.ts', {});
const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'Modal', 'ActivityIndicator'].map(name => [name, name]));
native.StyleSheet = { create: value => value };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const style = value => typeof value === 'function' ? style(value({ pressed: false }))
  : Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const texts = tree => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children);
const translate = language => {
  const catalogue = JSON.parse(read(`src/i18n/locales/${language}/subscription.json`));
  return (key, values = {}) => {
    const value = key.split('.').reduce((item, part) => item?.[part], catalogue);
    assert.equal(typeof value, 'string', `${language}:subscription:${key}`);
    return value.replace(/\{\{(\w+)\}\}/g, (_, part) => String(values[part] ?? ''));
  };
};
function hooks() {
  const slots = []; let index = 0; const effects = []; const cleanups = [];
  const useMemo = (fn, deps) => {
    const cursor = index++;
    if (!slots[cursor] || deps.some((value, offset) => !Object.is(value, slots[cursor].deps[offset]))) slots[cursor] = { value: fn(), deps };
    return slots[cursor].value;
  };
  return {
    react: { __esModule: true, default: React, ...React, useMemo, useCallback: (fn, deps) => useMemo(() => fn, deps),
      useState: initial => {
        const cursor = index++;
        slots[cursor] ??= { value: typeof initial === 'function' ? initial() : initial };
        return [slots[cursor].value, value => { slots[cursor].value = typeof value === 'function' ? value(slots[cursor].value) : value; }];
      },
      useRef: initial => { const cursor = index++; return slots[cursor] ??= { current: initial }; },
      useEffect: (fn, deps) => { useMemo(() => { effects.push(fn); }, deps); },
    },
    render: (component, props = {}) => { index = 0; return component(props); },
    effects: () => { effects.splice(0).forEach(fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); }); },
    unmount: () => cleanups.splice(0).forEach(fn => fn()),
  };
}
const comparisonPath = 'src/features/subscription/components/SubscriptionScenarioComparison.tsx';
function comparisonHarness({ language = 'vi', mode = 'light', width = 430, fontScale = 1, multiplier = 1 } = {}) {
  theme.applyTheme(mode); const h = hooks(); const t = translate(language);
  const exports = evaluate(comparisonPath, {
    '@expo/vector-icons': { Ionicons: 'Icon' },
    react: h.react, 'react-native': { ...native, useWindowDimensions: () => ({ width, fontScale }) },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    '../../../components/ScaledText': { ScaledText: 'Text' }, '../../../styles': theme,
    '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors }) },
    '../../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: theme.typography.size, scaledSize: { sm: theme.typography.size.sm * multiplier } }) },
  });
  return { ...h, ...exports, t, render: () => h.render(exports.SubscriptionScenarioComparison) };
}
let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  for (const dimensions of [
    { width: 320, fontScale: 1, multiplier: 1 },
    { width: 430, fontScale: 1, multiplier: 1 },
    { width: 430, fontScale: 1.5, multiplier: 1 },
    { width: 430, fontScale: 1, multiplier: 1.25 },
  ]) {
    await test(`${language}/${mode}: five complete scenarios without a duplicate price card at ${JSON.stringify(dimensions)}`, () => {
      const h = comparisonHarness({ language, mode, ...dimensions });
      let tree = h.render(); h.effects();
      const toggle = () => nodes(tree).find(node => node.type === 'Pressable');
      assert.equal(toggle().props.accessibilityRole, 'button');
      assert.equal(toggle().props.accessibilityLabel, `${h.t('comparison.title')}. ${h.t('comparison.headerSubtitle')}`);
      assert.ok(texts(toggle()).includes(h.t('comparison.title')));
      assert.ok(texts(toggle()).includes(h.t('comparison.headerSubtitle')));
      assert.equal(style(tree.props.style).backgroundColor, theme.colors.surface);
      const headerIcons = nodes(toggle()).filter(node => node.type === 'Icon');
      assert.equal(headerIcons.length, 2);
      assert.equal(headerIcons[0].props.name, 'git-compare-outline');
      assert.equal(headerIcons[1].props.name, 'chevron-down');
      for (const icon of headerIcons) assert.equal(icon.props.color, theme.colors.primaryText);
      const [leadingIcon, copy, arrow] = toggle().props.children;
      assert.equal(style(leadingIcon.props.style).backgroundColor, undefined);
      assert.equal(style(leadingIcon.props.style).flexShrink, 0);
      assert.equal(style(copy.props.style).flex, 1);
      assert.equal(style(copy.props.style).minWidth, 0);
      assert.equal(style(arrow.props.style).flexShrink, 0);
      assert.equal(style(toggle().props.style).height, undefined);
      assert.equal(toggle().props.accessibilityState.expanded, false);
      assert.equal(nodes(tree).filter(node => node.props.testID?.startsWith('comparison-scenario-')).length, 0);
      assert.ok(style(toggle().props.style).minHeight >= 56);
      toggle().props.onPress(); tree = h.render();
      assert.equal(toggle().props.accessibilityState.expanded, true);
      assert.equal(nodes(toggle()).filter(node => node.type === 'Icon')[1].props.name, 'chevron-up');
      const priceRows = nodes(tree).filter(node => node.props.testID?.startsWith('comparison-price-'));
      assert.equal(priceRows.length, 0);
      assert.equal(nodes(tree).filter(node => node.props.testID?.startsWith('comparison-scenario-')).length, 5);
      assert.equal(texts(tree).includes(h.t('iapMonthly')), false);
      assert.equal(texts(tree).includes(h.t('iapYearly')), false);
      for (const key of ['missed', 'unanswered', 'busy', 'trend', 'people']) {
        const row = nodes(tree).find(node => node.props.testID === `comparison-scenario-${key}`);
        for (const field of ['title', 'free', 'anTam']) assert.ok(texts(row).includes(h.t(`comparison.${key}.${field}`)));
        const columns = row.props.children[1];
        const stacked = dimensions.width < 420 || dimensions.fontScale * dimensions.multiplier > 1.15;
        assert.equal(style(columns.props.style).flexDirection, stacked ? 'column' : 'row');
        if (stacked) for (const cell of columns.props.children) assert.equal(style(cell.props.style).flexBasis, 'auto');
      }
      for (const node of nodes(tree).filter(node => node.type === 'Text')) {
        assert.equal(node.props.allowFontScaling, true);
        assert.equal(node.props.numberOfLines, undefined);
        assert.equal(style(node.props.style).height, undefined);
      }
      assert.equal(nodes(tree).filter(node => node.type === 'Pressable').length, 1);
      assert.equal(nodes(tree).some(node => node.type === 'Modal'), false);
      toggle().props.onPress(); tree = h.render();
      assert.equal(toggle().props.accessibilityState.expanded, false);
      assert.equal(nodes(tree).filter(node => node.props.testID?.startsWith('comparison-scenario-')).length, 0);
    });
  }
}

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  for (const os of ['ios', 'android']) for (const { fontScale, multiplier } of [
    { fontScale: 1, multiplier: 1 },
    { fontScale: 1.5, multiplier: 1 },
    { fontScale: 1, multiplier: 1.25 },
  ]) {
  await test(`${language}/${mode}/${os}: benefit checkmarks align with the first title line at system scale ${fontScale}, app scale ${multiplier}`, () => {
    theme.applyTheme(mode); const h = hooks(); const t = translate(language); let chosen = 0;
    const { inspection } = evaluate('app/subscription/index.tsx', {
      react: h.react, 'react-native': { ...native, Platform: { OS: os }, useWindowDimensions: () => ({ width: 320, fontScale }) },
      '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
      'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect: () => {} },
      'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: {} },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
      '../../src/components/ScaledText': { ScaledText: 'Text' }, '../../src/components/Screen': { Screen: 'Screen' },
      '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' }, '../../src/components/SubscriptionFAQ': { SubscriptionFAQ: 'FAQ' },
      '../../src/features/subscription/planName': { localizedPlanName },
      '../../src/features/subscription/components/SubscriptionScenarioComparison': { SubscriptionScenarioComparison: 'Comparison' },
      '../../src/features/care-circle/care-circle.api': { careCircleApi: {} }, '../../src/features/auth/auth.store': { useAuthStore: () => ({}) },
      '../../src/hooks/useScaledTypography': {
        useScaledTypography: () => ({ size: theme.typography.size, scaledSize: { sm: Math.round(theme.typography.size.sm * multiplier) } }),
        useScaledFontSize: baseSize => Math.round(baseSize * multiplier),
      },
      '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors, isDark: mode === 'dark' }) },
      '../../src/lib/apiClient': { apiClient: () => {}, getApiErrorMessage: () => {} },
      '../../src/stores/toast.store': { showToast: () => {} }, '../../src/styles': theme,
      '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({}) },
    }, '\nexport const inspection = { PlanComparison, createStyles, FREE_FEATURES, AN_TAM_FEATURES };');
    assert.equal(inspection.FREE_FEATURES.length, 6); assert.equal(inspection.AN_TAM_FEATURES.length, 6);
    const freeFeatures = inspection.FREE_FEATURES.map(key => ({ text: t(key), description: t(`${key}Description`) }));
    const anTamFeatures = inspection.AN_TAM_FEATURES.map(key => ({ text: t(key), description: t(`${key}Description`) }));
    const tree = h.render(inspection.PlanComparison.type, { freeFeatures, anTamFeatures, freeIsCurrent: true, onChoosePlan: () => { chosen++; }, t, styles: inspection.createStyles(theme.typography, mode === 'dark') });
    assert.equal(style(tree.props.style).flexDirection, 'column');
    for (const item of [...freeFeatures, ...anTamFeatures]) {
      assert.ok(texts(tree).includes(item.text)); assert.ok(texts(tree).includes(item.description));
    }
    for (const text of nodes(tree).filter(node => node.type === 'Text')) {
      assert.equal(text.props.allowFontScaling, true); assert.equal(text.props.numberOfLines, undefined);
    }
    const checkmarks = nodes(tree).filter(node => node.type === 'View' && node.props.children?.type === 'Icon' && node.props.children.props.name === 'checkmark-circle');
    assert.equal(checkmarks.length, 12);
    const expectedLineHeight = Math.round(Math.round(17 * multiplier) * (os === 'android' ? 1.6 : 1.5)) * fontScale;
    const expectedCheckSize = Math.round(Math.round(16 * multiplier) * fontScale);
    for (const wrapper of checkmarks) {
      const wrapperStyle = style(wrapper.props.style);
      assert.equal(wrapperStyle.height, expectedLineHeight);
      assert.equal(wrapperStyle.width, expectedCheckSize + 2);
      assert.equal(wrapperStyle.marginTop, undefined);
      assert.equal(wrapperStyle.justifyContent, 'center');
      assert.equal(wrapperStyle.alignItems, 'center');
      assert.equal(wrapperStyle.flexShrink, 0);
      assert.equal(wrapperStyle.marginRight, 8);
      const icon = wrapper.props.children;
      assert.equal(icon.props.size, expectedCheckSize);
      assert.equal(icon.props.allowFontScaling, false, 'Native text must not scale the icon twice');
      assert.equal(style(icon.props.style).lineHeight, expectedCheckSize);
      assert.equal(style(icon.props.style).includeFontPadding, false);
      assert.equal(wrapper.props.importantForAccessibility, 'no-hide-descendants');
    }
    const button = nodes(tree).find(node => node.type === 'Pressable');
    assert.ok(style(button.props.style).minHeight >= 56); button.props.onPress(); assert.equal(chosen, 1);
    assert.ok(texts(tree).includes(t('v2AnTamFeature6Description')));
  });
  }
}

await test('comparison is below the FAQ, and checkout stays on the separate screen', () => {
  const main = read('app/subscription/index.tsx');
  assert.ok(main.indexOf('<SubscriptionFAQ') < main.indexOf('<PlanComparison'));
  assert.ok(main.indexOf('<SubscriptionFAQ') < main.indexOf('<SubscriptionScenarioComparison'));
  assert.ok(main.indexOf('<SubscriptionScenarioComparison') < main.indexOf('<PlanComparison'));
  assert.doesNotMatch(read(comparisonPath), /purchaseSubscription|initializeIap|fetchAvailableProducts|fetchProducts|iapApi|verifyReceipt|method: ['"]POST|comparison-price-|comparison\.pricesTitle/);
  assert.match(main, /router\.push\("\/subscription\/plans"\)/);
  const purchase = read('src/features/iap/IapPurchaseCard.tsx');
  for (const key of ['iapFamilyCallsShort', 'iapHealthHistoryShort', 'iapFamilyCareShort', 'iapSummaryShort']) assert.ok(purchase.includes(`t("${key}")`));
  assert.match(purchase, /period === "yearly" && choices\.some/);
});
console.log(`Subscription benefits and scenario comparison: ${checks} regressions passed.`);
