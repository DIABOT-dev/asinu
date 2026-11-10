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
native.StyleSheet = { create: value => value, hairlineWidth: 0.5 };
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
  theme.applyTheme(mode); const h = hooks(); const t = translate(language); const navigations = [];
  const exports = evaluate(comparisonPath, {
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'expo-image': { Image: 'Image' },
    '../../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push: path => navigations.push(path) }) },
    react: h.react, 'react-native': { ...native, useWindowDimensions: () => ({ width, fontScale }) },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    '../../../components/ScaledText': { ScaledText: 'Text' }, '../../../styles': theme,
    '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors }) },
    '../../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: theme.typography.size, scaledSize: { sm: theme.typography.size.sm * multiplier } }) },
  });
  return { ...h, ...exports, t, navigations, render: () => h.render(exports.SubscriptionScenarioComparison), renderContent: () => h.render(exports.SubscriptionComparisonContent) };
}
let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  for (const dimensions of [
    { width: 320, fontScale: 1, multiplier: 1 },
    { width: 360, fontScale: 1, multiplier: 1 },
    { width: 430, fontScale: 1, multiplier: 1 },
    { width: 430, fontScale: 1.5, multiplier: 1 },
    { width: 430, fontScale: 1, multiplier: 1.25 },
  ]) {
    await test(`${language}/${mode}: comparison navigates to a readable page at ${JSON.stringify(dimensions)}`, () => {
      const h = comparisonHarness({ language, mode, ...dimensions });
      const entry = h.render();
      const link = nodes(entry).find(node => node.type === 'Pressable');
      assert.equal(link.props.accessibilityRole, 'button');
      assert.equal(link.props.accessibilityLabel, `${h.t('comparison.title')}. ${h.t('comparison.headerSubtitle')}`);
      assert.equal(link.props.accessibilityHint, h.t('comparison.openHint'));
      assert.equal(link.props.accessibilityState?.expanded, undefined);
      assert.ok(texts(link).includes(h.t('comparison.title')));
      assert.ok(texts(link).includes(h.t('comparison.headerSubtitle')));
      assert.ok(style(link.props.style).minHeight >= 56);
      assert.deepEqual(nodes(link).filter(node => node.type === 'Icon').map(node => node.props.name), ['stethoscope']);
      assert.equal(nodes(entry).filter(node => node.props.testID?.startsWith('comparison-scenario-')).length, 0);
      link.props.onPress(); assert.deepEqual(h.navigations, ['/subscription/comparison']);
      const tree = h.renderContent();
      assert.equal(nodes(tree).filter(node => node.props.testID?.startsWith('comparison-scenario-')).length, 5);
      assert.ok(texts(tree).includes(h.t('comparison.subtitle')));
      const stacked = dimensions.width < 360 || dimensions.fontScale * dimensions.multiplier > 1.15;
      assert.equal(nodes(tree).some(node => node.props.testID === 'comparison-table-header'), !stacked);
      for (const key of ['missed', 'unanswered', 'busy', 'trend', 'people']) {
        const row = nodes(tree).find(node => node.props.testID === `comparison-scenario-${key}`);
        for (const field of ['title', 'free', 'anTam']) assert.ok(texts(row).includes(h.t(`comparison.${key}.${field}`)));
        assert.equal(style(row.props.style).flexDirection, stacked ? 'column' : 'row');
        const [scenario, free, anTam] = row.props.children;
        assert.equal(style(free.props.style).backgroundColor, theme.colors.surfaceMuted);
        assert.equal(style(anTam.props.style).backgroundColor, theme.colors.primaryLight);
        assert.equal(nodes(scenario).filter(node => node.type === 'Icon').length, 1);
        assert.equal(nodes(free).some(node => node.props.accessibilityLabel === `${h.t('comparison.freeLabel')}: ${h.t(`comparison.${key}.free`)}`), true);
        assert.equal(nodes(anTam).some(node => node.props.accessibilityLabel === `${h.t('comparison.anTamLabel')}: ${h.t(`comparison.${key}.anTam`)}`), true);
        if (stacked) {
          for (const cell of [free, anTam]) assert.equal(style(cell.props.style).flexBasis, 'auto');
          assert.ok(texts(free).includes(h.t('comparison.freeLabel')));
          assert.ok(texts(anTam).includes(h.t('comparison.anTamLabel')));
        }
      }
      for (const node of nodes(tree).filter(node => node.type === 'Text')) {
        assert.equal(node.props.allowFontScaling, true);
        assert.equal(node.props.numberOfLines, undefined);
        assert.equal(style(node.props.style).height, undefined);
      }
      const art = nodes(tree).find(node => node.type === 'Image');
      assert.equal(art.props.accessible, false);
      assert.equal(nodes(tree).filter(node => node.type === 'Pressable').length, 0);
      assert.equal(nodes(tree).some(node => node.type === 'Modal'), false);
      assert.equal(texts(tree).includes(h.t('iapMonthly')), false);
      assert.equal(texts(tree).includes(h.t('iapYearly')), false);
    });
  }
}

for (const canGoBack of [false, true]) {
  await test(`comparison page returns safely with history=${canGoBack}`, () => {
    const h = hooks(); const actions = [];
    const { default: Page } = evaluate('app/subscription/comparison.tsx', {
      react: h.react, 'react-native': native,
      'expo-router': { Stack: { Screen: 'StackScreen' } },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
      '../../src/components/Screen': { Screen: 'Screen' },
      '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
      '../../src/features/subscription/components/SubscriptionScenarioComparison': { SubscriptionComparisonContent: 'Content' },
      '../../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ canGoBack: () => canGoBack, back: () => actions.push('back'), replace: path => actions.push(path) }) },
      '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors }) },
    });
    const tree = h.render(Page);
    assert.equal(nodes(tree).find(node => node.type === 'StackScreen').props.options.headerShown, false);
    const scroll = nodes(tree).find(node => node.type === 'ScrollView');
    assert.ok(style(scroll.props.contentContainerStyle).paddingTop >= 24);
    assert.ok(style(scroll.props.contentContainerStyle).paddingBottom >= 16);
    const back = nodes(tree).find(node => node.type === 'Back');
    assert.ok(style(back.props.style).width >= 44);
    back.props.onPress(); assert.deepEqual(actions, [canGoBack ? 'back' : '/subscription']);
    assert.equal(nodes(tree).filter(node => node.type === 'Content').length, 1);
  });
}

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  for (const os of ['ios', 'android']) for (const { fontScale, multiplier } of [
    { fontScale: 1, multiplier: 1 },
    { fontScale: 1.5, multiplier: 1 },
    { fontScale: 1, multiplier: 1.25 },
  ]) {
  await test(`${language}/${mode}/${os}: compact benefits keep the title, close and action outside scrolling at system scale ${fontScale}, app scale ${multiplier}`, () => {
    theme.applyTheme(mode); const h = hooks(); const t = translate(language); let chosen = 0; let width = 393;
    const preferenceModal = evaluate('src/features/profile/ProfilePreferenceModal.tsx', {
      'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
      'react-i18next': { useTranslation: () => ({ t }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
      '../../components/ScaledText': { ScaledText: 'Text' },
      '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors, isDark: mode === 'dark' }) },
    });
    const detailsModule = evaluate('src/features/subscription/components/PlanDetailsModal.tsx', {
      'react-native': { ...native, Platform: { OS: os }, useWindowDimensions: () => ({ width, fontScale }) },
      '@expo/vector-icons': { Ionicons: 'Icon' },
      'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
      '../../../components/ScaledText': { ScaledText: 'Text' },
      '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors, isDark: mode === 'dark' }) },
      '../../../hooks/useScaledTypography': { useScaledFontSize: base => Math.round(base * multiplier) },
      '../../profile/ProfilePreferenceModal': preferenceModal,
      '../planName': { localizedPlanName },
    });
    const { inspection } = evaluate('app/subscription/index.tsx', {
      react: h.react, 'react-native': { ...native, Platform: { OS: os }, useWindowDimensions: () => ({ width, fontScale }) },
      '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
      'expo-linear-gradient': { LinearGradient: 'Gradient' },
      'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect: () => {} },
      'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeInDown: {} },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
      '../../src/components/ScaledText': { ScaledText: 'Text' }, '../../src/components/Screen': { Screen: 'Screen' },
      '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' }, '../../src/components/SubscriptionFAQ': { SubscriptionFAQ: 'FAQ' },
      '../../src/features/subscription/components/PlanDetailsModal': detailsModule,
      '../../src/features/subscription/planName': { localizedPlanName },
      '../../src/features/subscription/components/SubscriptionScenarioComparison': { SubscriptionScenarioComparison: 'Comparison' },
      '../../src/features/subscription/components/CarePlanBackground': { CarePlanBackground: 'Background' },
      '../../src/features/care-circle/care-circle.api': { careCircleApi: {} }, '../../src/features/auth/auth.store': { useAuthStore: () => ({}) },
      '../../src/hooks/useScaledTypography': {
        useScaledTypography: () => ({ size: theme.typography.size, scaledSize: { sm: Math.round(theme.typography.size.sm * multiplier) } }),
        useScaledFontSize: baseSize => Math.round(baseSize * multiplier),
      },
      '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors, isDark: mode === 'dark' }) },
      '../../src/lib/apiClient': { apiClient: () => {}, getApiErrorMessage: () => {} },
      '../../src/stores/toast.store': { showToast: () => {} }, '../../src/styles': theme,
      '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({}) },
    }, '\nexport const inspection = { PlanComparison, CurrentPlanCard, createStyles };');
    const freeKeys = detailsModule.FREE_PLAN_BENEFITS;
    const premiumKeys = detailsModule.AN_TAM_PLAN_BENEFITS;
    assert.equal(freeKeys.length, 6); assert.equal(premiumKeys.length, 6);
    const status = { planCode: 'free', isAnTam: false, expiresAt: null };
    const renderPlans = (overrides = {}) => h.render(inspection.PlanComparison.type, { status, freeIsCurrent: true, onChoosePlan: () => { chosen++; }, t, styles: inspection.createStyles(theme.typography, mode === 'dark'), ...overrides });
    const control = (tree, key) => nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t(key));
    const dialog = tree => nodes(tree).find(node => node.type === detailsModule.PlanDetailsModal);
    const expand = detail => preferenceModal.ProfilePreferenceModal(detailsModule.PlanDetailsModal(detail.props).props);
    let tree = renderPlans();
    const largeType = fontScale * Math.round(17 * multiplier) / 17 > 1.2;
    assert.equal(style(tree.props.style).flexDirection, largeType ? 'column' : 'row');
    width = 320;
    assert.equal(style(renderPlans().props.style).flexDirection, 'column');
    width = 768;
    assert.equal(style(renderPlans().props.style).flexDirection, largeType ? 'column' : 'row');
    width = 393;
    assert.equal(nodes(tree).filter(node => node.type === 'Pressable').length, 3);
    assert.ok(texts(tree).includes(t('v2FreeOverview')));
    assert.ok(texts(tree).includes(t('v2AnTamOverview')));
    for (const key of ['v2FreePlan', 'v2AnTamPlanName']) {
      const button = control(tree, key);
      assert.equal(button.props.accessibilityState?.expanded, undefined);
      assert.ok(style(button.props.style).minHeight >= 56);
      assert.equal(style(button.props.style).flexGrow, 1);
      assert.equal(style(button.props.style).flexShrink, 0);
      assert.equal(style(button.props.style).minWidth, 0);
    }
    assert.ok(!nodes(tree).some(node => node.type === 'Icon' && /chevron/.test(node.props.name)));
    assert.ok([...freeKeys, ...premiumKeys].every(key => !texts(tree).includes(t(key))));
    assert.equal(dialog(tree), undefined);
    for (const premium of [false, true]) {
      const key = premium ? 'v2AnTamPlanName' : 'v2FreePlan';
      control(tree, key).props.onPress();
      tree = renderPlans();
      const details = dialog(tree);
      assert.equal(details.props.visible, true);
      assert.equal(nodes(tree).filter(node => node.type === detailsModule.PlanDetailsModal).length, 1);
      const nativeDialog = expand(details);
      const scroll = nodes(nativeDialog).find(node => node.type === 'ScrollView');
      const included = premium ? premiumKeys : freeKeys;
      const omitted = premium ? freeKeys : premiumKeys;
      for (const key of included) assert.ok(texts(scroll).includes(t(key)));
      assert.ok(omitted.every(key => !texts(scroll).includes(t(key))));
      assert.ok([...freeKeys, ...premiumKeys].every(key => !texts(nativeDialog).includes(t(`${key}Description`))), 'Quick view omits the long descriptions');
      const title = nodes(nativeDialog).find(node => node.props.accessibilityRole === 'header');
      assert.equal(title.props.children, t(key));
      assert.ok(!nodes(scroll).includes(title), 'The plan title never scrolls away');
      assert.ok(nodes(nativeDialog).some(node => node.props.accessibilityViewIsModal));
      assert.equal(nativeDialog.type, 'Modal');
      assert.equal(nativeDialog.props.transparent, true);
      assert.equal(style(scroll.props.style).flexShrink, 1);
      assert.equal(scroll.props.showsVerticalScrollIndicator, true);
      const close = control(nativeDialog, 'close');
      assert.ok(close); assert.ok(!nodes(scroll).includes(close));
      const action = control(nativeDialog, premium ? 'iapChooseTitle' : 'upgradeNow');
      assert.ok(action); assert.ok(!nodes(scroll).includes(action), 'Action stays outside the benefit scroll area');
      assert.ok(style(action.props.style).minHeight >= 56);
      const checkmarks = nodes(scroll).filter(node => node.type === 'View' && node.props.children?.type === 'Icon');
      assert.equal(checkmarks.length, 6);
      const expectedLineHeight = Math.round(Math.round(17 * multiplier) * (os === 'android' ? 1.6 : 1.5)) * fontScale;
      const expectedCheckSize = Math.round(Math.round(16 * multiplier) * fontScale);
      for (const wrapper of checkmarks) {
        assert.equal(style(wrapper.props.style).height, expectedLineHeight);
        assert.equal(style(wrapper.props.style).width, expectedCheckSize + 2);
        assert.equal(style(wrapper.props.style).flexShrink, 0);
        assert.equal(wrapper.props.children.props.size, expectedCheckSize);
        assert.equal(wrapper.props.children.props.allowFontScaling, false);
        assert.equal(wrapper.props.importantForAccessibility, 'no-hide-descendants');
      }
      if (premium) {
        action.props.onPress(); action.props.onPress();
        assert.equal(chosen, 1, 'Repeated taps navigate once');
        assert.equal(dialog(renderPlans()), undefined);
      } else {
        nativeDialog.props.onRequestClose();
        tree = renderPlans(); assert.equal(dialog(tree), undefined);
        action.props.onPress(); assert.equal(chosen, 0, 'An action queued after dismissal cannot navigate');
        control(tree, key).props.onPress(); tree = renderPlans();
        control(expand(dialog(tree)), 'close').props.onPress();
        tree = renderPlans(); assert.equal(dialog(tree), undefined);
      }
      tree = renderPlans();
    }
    control(tree, 'v2FreePlan').props.onPress();
    control(expand(dialog(renderPlans())), 'upgradeNow').props.onPress();
    assert.equal(chosen, 2, 'Free quick view offers a fixed upgrade action');
    const beforeUpgrade = chosen;
    control(renderPlans(), 'upgradeNow').props.onPress();
    assert.equal(chosen, beforeUpgrade + 1);
    const disabledUpgrade = control(renderPlans({ purchaseDisabled: true }), 'upgradeNow');
    assert.equal(disabledUpgrade.props.disabled, true);
    assert.equal(control(renderPlans({ freeIsCurrent: false }), 'upgradeNow'), undefined);
    const unavailable = h.render(inspection.CurrentPlanCard.type, {
      status: null, loading: false, language, t, styles: inspection.createStyles(theme.typography, mode === 'dark'),
    });
    assert.ok(texts(unavailable).includes(t('v2LoadError')));
    assert.equal(texts(unavailable).includes(t('v2FreeMeta')), false);
    assert.equal(unavailable.props.disabled, true, 'Unknown entitlements cannot open a guessed plan');
    let currentOpened = 0;
    const current = h.render(inspection.CurrentPlanCard.type, {
      status, loading: false, language, t, onPress: () => { currentOpened++; }, styles: inspection.createStyles(theme.typography, mode === 'dark'),
    });
    current.props.onPress(); assert.equal(currentOpened, 1);
    const paid = detailsModule.PlanDetailsModal({ visible: true, premium: true, currentPlanCode: 'antam_4', expiresAt: '2026-12-31T00:00:00Z', onClose() {}, onChoosePlan() {} });
    assert.equal(paid.props.title, t('planNames.antam4'));
    assert.ok(texts(paid.props.headerContent).some(value => value.includes('2026')), 'The actual expiry stays in the fixed header');
    assert.equal(control(paid.props.footer, 'viewPlans').props.disabled, false);
    const blocked = detailsModule.PlanDetailsModal({ visible: true, premium: false, disabled: true, onClose() {}, onChoosePlan() { throw Error('Disabled action navigated'); } });
    const blockedAction = control(blocked.props.footer, 'upgradeNow');
    assert.equal(blockedAction.props.disabled, true); blockedAction.props.onPress();
    const readOnly = detailsModule.PlanDetailsModal({ visible: true, premium: false, onClose() {} });
    assert.equal(readOnly.props.footer, undefined);
    for (const invalidExpiry of [null, 'not-a-date']) {
      const noExpiry = detailsModule.PlanDetailsModal({ visible: true, premium: true, currentPlanCode: 'antam_2', expiresAt: invalidExpiry, onClose() {} });
      assert.ok(texts(noExpiry.props.headerContent).includes(t('currentlyUsing')));
    }
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
  assert.doesNotMatch(purchase, /iapAnnualGiftAvailability|styles\.benefitNote/);
  for (const language of ['vi', 'en']) {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/subscription.json`));
    assert.equal(Object.hasOwn(catalog, 'iapAnnualGiftAvailability'), false);
  }
});
console.log(`Subscription benefits and scenario comparison: ${checks} regressions passed.`);
