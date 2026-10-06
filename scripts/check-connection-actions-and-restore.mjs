import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const evaluate = (file, dependencies) => {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute the checked-in component, including its real event handlers.
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
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const style = value => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const native = Object.fromEntries(['View', 'Modal', 'Pressable', 'ScrollView', 'Image', 'ActivityIndicator'].map(name => [name, name]));
native.StyleSheet = { create: value => value };
const icons = { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' };
const catalogs = (language, namespace) => JSON.parse(read(`src/i18n/locales/${language}/${namespace}.json`));
const translate = (language, namespace) => (key, values = {}) => {
  const value = key.split('.').reduce((item, part) => item?.[part], catalogs(language, namespace));
  assert.equal(typeof value, 'string', `${language}:${namespace}:${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, part) => String(values[part] ?? ''));
};
const flush = async () => { for (let index = 0; index < 10; index++) await Promise.resolve(); };
function hooks() {
  const slots = []; let index = 0; const effects = [];
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
    render: (component, props) => { index = 0; return component(props); },
    effects: () => { effects.splice(0).forEach(fn => fn()); },
  };
}
let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  await test(`${language}/${mode}: connection options use aligned icon/label/arrow columns and bounded scrolling`, () => {
    theme.applyTheme(mode);
    const h = hooks(); const t = translate(language, 'careCircle'); const tc = translate(language, 'common');
    let actions = 0; let dismissals = 0;
    const { AppAlertModal } = evaluate('src/components/AppAlertModal.tsx', {
      react: h.react, 'react-native': native, '@expo/vector-icons': icons,
      './ScaledText': { ScaledText: 'Text' }, './QueuedModal': { QueuedModal: 'QueuedModal' },
      '../hooks/useScaledTypography': { useScaledTypography: () => theme.typography }, '../styles': theme,
      '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: mode === 'dark' }) },
      'react-i18next': { useTranslation: () => ({ t: tc }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    });
    const props = { visible: true, queued: true, layout: 'actions', title: t('connectionActionsTitle'),
      message: t('connectionActionsMessage', { name: 'Phạm Duy Khiêm '.repeat(10) }), onDismiss: () => { dismissals++; },
      buttons: [
        { text: t('editConnection'), icon: 'pencil-outline', onPress: () => { actions++; } },
        { text: t('deleteConnection'), style: 'destructive', icon: 'trash-can-outline' },
        { text: tc('cancel'), style: 'cancel', icon: 'close' },
      ],
    };
    const tree = h.render(AppAlertModal, props); const all = nodes(tree);
    assert.equal(tree.type, 'QueuedModal');
    const scroll = all.find(node => node.type === 'ScrollView'); assert.ok(scroll);
    const card = all.find(node => node.props.accessibilityViewIsModal); assert.equal(style(card.props.style).maxHeight, '85%');
    const buttons = all.filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
    assert.equal(buttons.length, 3); assert.equal(nodes(scroll).filter(node => buttons.includes(node)).length, 3);
    for (const button of buttons) {
      const buttonStyle = style(button.props.style({ pressed: false }));
      assert.equal(buttonStyle.flexDirection, 'row'); assert.equal(buttonStyle.width, '100%'); assert.ok(buttonStyle.minHeight >= 56);
      const label = nodes(button).find(node => node.type === 'Text');
      assert.equal(style(label.props.style).textAlign, 'left'); assert.equal(style(label.props.style).flex, 1);
      assert.equal(label.props.numberOfLines, undefined); assert.equal(nodes(label).some(node => node.type === 'Icon'), false);
    }
    assert.equal(nodes(buttons[2]).filter(node => node.type === 'Icon').length, 1);
    assert.equal(nodes(buttons[0]).filter(node => node.type === 'Icon').length, 2);
    buttons[0].props.onPress(); buttons[0].props.onPress(); assert.equal(dismissals, 1); assert.equal(actions, 0);
    tree.props.onDismiss(); tree.props.onDismiss(); assert.equal(actions, 1);
  });
}

for (const language of ['vi', 'en']) {
  const t = translate(language, 'subscription');
  function restoreHarness(result, fail = false) {
    theme.applyTheme('light'); const h = hooks(); const calls = []; let finish;
    const promise = new Promise(resolve => { finish = resolve; });
    const { RestoreLink } = evaluate('src/features/iap/RestoreLink.tsx', {
      react: h.react, 'react-native': native, '@expo/vector-icons': icons,
      'react-i18next': { useTranslation: () => ({ t }) },
      '../../components/ScaledText': { ScaledText: 'Text' }, '../../styles': theme,
      '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) },
      '../../lib/env': { env: { paymentMethod: 'iap' } },
      './iap.service': { restorePurchases: async () => { calls.push('restore'); await promise; if (fail) throw new Error('Test failure'); return result; } },
      './SubscriptionFeedbackModal': { SubscriptionFeedbackModal: 'Feedback' },
    });
    const props = { compact: true, onRestored: () => calls.push('refreshed'), onBusyChange: value => calls.push(value) };
    return { calls, finish, render: (extras = {}) => h.render(RestoreLink, { ...props, ...extras }) };
  }
  for (const [label, result, kind] of [
    ['success', { restored: 1, errors: [] }, 'success'], ['no purchase', { restored: 0, errors: [] }, 'info'],
    ['expired', { restored: 0, errors: ['IAP_SUBSCRIPTION_EXPIRED'] }, 'warning'],
    ['failed verification', { restored: 0, errors: ['FAILED'] }, 'error'],
  ]) await test(`${language}: compact restore preserves ${label} feedback and suppresses duplicate taps`, async () => {
    const h = restoreHarness(result); let tree = h.render();
    const button = nodes(tree).find(node => node.type === 'Pressable');
    assert.equal(button.props.accessibilityLabel, t('restorePurchases')); assert.equal(button.props.accessibilityHint, t('restorePurchasesDesc'));
    assert.equal(nodes(tree).filter(node => node.type === 'Text').length, 1);
    assert.equal(nodes(tree).find(node => node.type === 'Text').props.children, t('restorePurchasesShort'));
    const pending = button.props.onPress(); button.props.onPress(); assert.deepEqual(h.calls, [true, 'restore']);
    assert.equal(nodes(h.render()).find(node => node.type === 'Pressable').props.disabled, true);
    h.finish(); await pending; tree = h.render();
    assert.equal(nodes(tree).find(node => node.type === 'Feedback').props.feedback.kind, kind);
    assert.equal(nodes(tree).find(node => node.type === 'Pressable').props.disabled, false);
    assert.equal(h.calls.filter(value => value === 'refreshed').length, result.restored > 0 ? 1 : 0);
    assert.equal(h.calls.at(-1), false);
  });
  await test(`${language}: restore remains disabled during purchase and recovers after a network failure`, async () => {
    const h = restoreHarness(null, true);
    nodes(h.render({ disabled: true })).find(node => node.type === 'Pressable').props.onPress(); assert.deepEqual(h.calls, []);
    const pending = nodes(h.render()).find(node => node.type === 'Pressable').props.onPress(); h.finish(); await pending;
    assert.equal(nodes(h.render()).find(node => node.type === 'Feedback').props.feedback.kind, 'error'); assert.equal(h.calls.at(-1), false);
  });
  for (const [width, multiplier, stacked] of [[430, 1, false], [320, 1, true], [430, 1.25, true]]) {
    await test(`${language}: purchase/restore are adjacent at ${width}px and font scale ${multiplier}`, async () => {
      const h = hooks(); const calls = [];
      const products = evaluate('src/features/iap/iap.catalog.ts', { 'react-native': { Platform: { OS: 'ios' } } }).FALLBACK_IAP_PRODUCTS.map(item => ({ ...item, nativeProduct: {} }));
      const { IapPurchaseCard } = evaluate('src/features/iap/IapPurchaseCard.tsx', {
        react: h.react, 'react-native': { ...native, useWindowDimensions: () => ({ width }) }, '@expo/vector-icons': icons,
        'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
        'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) }, '../../components/ScaledText': { ScaledText: 'Text' },
        '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) }, '../../styles': theme,
        '../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: theme.typography.size, scaledSize: { sm: theme.typography.size.sm * multiplier } }) },
        './iap.catalog': { FALLBACK_IAP_PRODUCTS: products }, './iap.service': {
          fetchAvailableProducts: async () => products, purchaseSubscription: async (...args) => { calls.push(args); return { kind: 'success' }; },
        },
        './SubscriptionFeedbackModal': { SubscriptionFeedbackModal: 'Feedback' }, './RestoreLink': { RestoreLink: 'Restore' },
        '../subscription/planName': { localizedPlanName: code => code },
      });
      const props = { onPurchased: () => calls.push('refreshed') };
      h.render(IapPurchaseCard, props); h.effects(); await flush(); let tree = h.render(IapPurchaseCard, props);
      const restore = nodes(tree).find(node => node.type === 'Restore'); assert.equal(restore.props.compact, true);
      assert.equal(restore.props.onRestored, props.onPurchased);
      const group = nodes(tree).find(node => [node.props.children].flat().includes(restore));
      assert.equal(style(group.props.style).flexDirection, stacked ? 'column' : 'row');
      let buy = nodes(group).find(node => node.type === 'Pressable'); assert.ok(buy); assert.equal(buy.props.disabled, false);
      restore.props.onBusyChange(true); tree = h.render(IapPurchaseCard, props);
      buy = nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button'); assert.equal(buy.props.disabled, true);
      nodes(tree).find(node => node.type === 'Restore').props.onBusyChange(false);
      buy = nodes(h.render(IapPurchaseCard, props)).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
      await buy.props.onPress(); assert.equal(calls[0][0], 'asinu.antam4.yearly'); assert.equal(calls.at(-1), 'refreshed');
      const current = h.render(IapPurchaseCard, { ...props, currentPlanCode: 'antam_4', currentBillingPeriod: 'yearly' });
      assert.equal(nodes(current).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button').props.disabled, true);
      assert.equal(nodes(current).find(node => node.type === 'Restore').props.disabled, false);
    });
  }
}

await test('hidden purchase selector still exposes restore beside plan comparison, never below FAQ', () => {
  const source = read('app/subscription/index.tsx');
  assert.ok(source.indexOf('<RestoreLink') > source.indexOf('<PlanComparison'));
  assert.ok(source.indexOf('<RestoreLink') < source.indexOf('<SubscriptionFAQ'));
  assert.equal(source.match(/<RestoreLink/g).length, 1);
  assert.match(source, /!showPurchaseSection && !status\?\.isAnTam/);
  assert.match(read('app/care-circle/index.tsx'), /<AppAlertModal[^>]*queued/);
  assert.match(read('app/care-circle/index.tsx'), /layout: 'actions'/);
});
console.log(`Connection options and restore placement: ${checks} runtime regressions passed.`);
