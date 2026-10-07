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
const style = value => typeof value === 'function' ? style(value({ pressed: false }))
  : Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
function assertCenteredPrice(card, caption) {
  const period = nodes(card).find(node => node.type === 'Text' && node.props.children === caption);
  assert.ok(period, 'The billing period must remain visible');
  const group = nodes(card).find(node => node.type === 'View' && [node.props.children].flat().includes(period));
  assert.ok(group, 'Price and billing period must share one alignment container');
  const groupStyle = style(group.props.style);
  assert.equal(groupStyle.alignItems, 'center');
  assert.equal(groupStyle.alignSelf, 'stretch');
  assert.equal(groupStyle.flexDirection, 'column');
  assert.equal(groupStyle.marginLeft, undefined, 'Wide cards must not offset the price');
  assert.equal(groupStyle.height, undefined);
  const labels = nodes(group).filter(node => node.type === 'Text');
  assert.equal(labels.length, 2);
  for (const label of labels) {
    assert.equal(style(label.props.style).textAlign, 'center');
    assert.equal(style(label.props.style).alignSelf, 'stretch');
    assert.equal(label.props.allowFontScaling, true);
    assert.equal(label.props.numberOfLines, undefined);
  }
}
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
  const { localizedPlanName } = evaluate('src/features/subscription/planName.ts', {});
  const purchaseAction = tree => nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
  const actionLabel = tree => nodes(purchaseAction(tree)).find(node => node.type === 'Text')?.props.children;
  const periodAction = (tree, period) => nodes(tree).find(node => node.type === 'Pressable'
    && nodes(node).some(child => child.type === 'Text' && child.props.children === t(period === 'yearly' ? 'iapYearly' : 'iapMonthly')));
  function purchaseHarness(initialProps = {}, { defer = false } = {}) {
    theme.applyTheme('light'); const h = hooks(); const calls = [];
    let complete; const completion = new Promise(resolve => { complete = resolve; });
    const products = evaluate('src/features/iap/iap.catalog.ts', { 'react-native': { Platform: { OS: 'ios' } } })
      .FALLBACK_IAP_PRODUCTS.map(item => ({ ...item, localizedPrice: '$9.99', nativeProduct: {} }));
    const { IapPurchaseCard } = evaluate('src/features/iap/IapPurchaseCard.tsx', {
      react: h.react, 'react-native': { ...native, useWindowDimensions: () => ({ width: 430, fontScale: 1 }) }, '@expo/vector-icons': icons,
      'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
      'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) }, '../../components/ScaledText': { ScaledText: 'Text' },
      '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) }, '../../styles': theme,
      '../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: theme.typography.size, scaledSize: theme.typography.size }) },
      './iap.catalog': { FALLBACK_IAP_PRODUCTS: products }, './iap.service': {
        fetchAvailableProducts: async () => products,
        purchaseSubscription: async (...args) => { calls.push(args); if (defer) await completion; return { kind: 'success' }; },
      },
      './SubscriptionFeedbackModal': { SubscriptionFeedbackModal: 'Feedback' }, './RestoreLink': { RestoreLink: 'Restore' },
      '../subscription/planName': { localizedPlanName },
    });
    let props = { onPurchased: () => calls.push('refreshed'), ...initialProps };
    return {
      calls, complete, effects: h.effects,
      render: (changes = {}) => { props = { ...props, ...changes }; return h.render(IapPurchaseCard, props); },
    };
  }
  async function loadedPurchaseHarness(props, options) {
    const h = purchaseHarness(props, options); h.render(); h.effects(); await flush(); return h;
  }
  function plansScreenHarness(results = []) {
    theme.applyTheme('light'); const h = hooks(); const calls = []; let cleanup; let currentFocus; let accountId = 'account-a'; let canGoBack = true;
    const queue = [...results];
    const router = { canGoBack: () => canGoBack, back: () => calls.push('back'), replace: route => calls.push(route) };
    const { default: PlansScreen } = evaluate('app/subscription/plans.tsx', {
      react: h.react, 'react-native': native,
      'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect: fn => {
        currentFocus = fn;
        h.react.useEffect(() => { cleanup?.(); cleanup = fn(); }, [fn]);
      } },
      'react-i18next': { useTranslation: () => ({ t }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
      '../../src/components/ScaledText': { ScaledText: 'Text' }, '../../src/components/Screen': { Screen: 'Screen' },
      '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'BackButton' },
      '../../src/features/auth/auth.store': { useAuthStore: select => select({ profile: { id: accountId } }) },
      '../../src/features/iap/IapPurchaseCard': { IapPurchaseCard: 'PurchaseCard' },
      '../../src/features/subscription/planName': { localizedPlanName },
      '../../src/hooks/useGuardedRouter': { useGuardedRouter: () => router },
      '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors }) },
      '../../src/lib/apiClient': { apiClient: async path => { calls.push(path); const result = queue.shift(); if (result instanceof Error) throw result; return await result; } },
      '../../src/styles': theme,
    });
    return { calls, queue, effects: h.effects, render: () => h.render(PlansScreen, {}),
      blur: () => { cleanup?.(); cleanup = undefined; },
      focus: () => { cleanup?.(); cleanup = currentFocus(); },
      setAccount: value => { accountId = value; }, setCanGoBack: value => { canGoBack = value; },
    };
  }
  for (const period of ['monthly', 'yearly']) {
    await test(`${language}: separate plan screen waits for actual ${period} status and states the current period`, async () => {
      const h = plansScreenHarness([{ ok: true, planCode: 'antam_4', billingPeriod: period, isAnTam: true }]);
      assert.equal(nodes(h.render()).some(node => node.type === 'PurchaseCard'), false);
      h.effects(); await flush(); const tree = h.render();
      const purchase = nodes(tree).find(node => node.type === 'PurchaseCard');
      assert.equal(purchase.props.currentPlanCode, 'antam_4');
      assert.equal(purchase.props.currentBillingPeriod, period); assert.equal(purchase.props.disabled, false);
      assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === t('iapCurrentPlanPeriod', {
        plan: localizedPlanName('antam_4', t), period: t(period === 'yearly' ? 'iapYearly' : 'iapMonthly'),
      })));
      assert.deepEqual(h.calls, ['/api/subscriptions/status']);
      const back = nodes(tree).find(node => node.type === 'BackButton'); back.props.onPress();
      assert.equal(h.calls.at(-1), 'back');
      h.setCanGoBack(false); back.props.onPress(); assert.equal(h.calls.at(-1), '/subscription');
    });
  }
  await test(`${language}: failed status never enables purchases and Retry fetches again`, async () => {
    const h = plansScreenHarness([new Error('offline'), { ok: true, planCode: 'free', billingPeriod: null, isAnTam: false }]);
    h.render(); h.effects(); await flush(); let tree = h.render();
    assert.equal(nodes(tree).some(node => node.type === 'PurchaseCard'), false);
    assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === t('v2LoadError')));
    const retry = nodes(tree).find(node => node.type === 'Pressable'); retry.props.onPress();
    assert.equal(nodes(h.render()).some(node => node.type === 'PurchaseCard'), false);
    await flush(); tree = h.render(); assert.equal(nodes(tree).find(node => node.type === 'PurchaseCard').props.currentPlanCode, 'free');
    assert.equal(h.calls.filter(path => path === '/api/subscriptions/status').length, 2);
  });
  await test(`${language}: post-purchase refresh keeps feedback mounted but blocks a second purchase`, async () => {
    let finish; const updated = new Promise(resolve => { finish = resolve; });
    const h = plansScreenHarness([{ ok: true, planCode: 'free', isAnTam: false, billingPeriod: null }, updated]);
    h.render(); h.effects(); await flush(); let tree = h.render();
    nodes(tree).find(node => node.type === 'PurchaseCard').props.onPurchased();
    tree = h.render(); const purchase = nodes(tree).find(node => node.type === 'PurchaseCard');
    assert.ok(purchase, 'Keep the same purchase component so its success feedback survives');
    assert.equal(purchase.props.disabled, true);
    finish({ ok: true, planCode: 'antam_4', isAnTam: true, billingPeriod: 'yearly' }); await flush();
    tree = h.render(); assert.equal(nodes(tree).find(node => node.type === 'PurchaseCard').props.currentPlanCode, 'antam_4');
    assert.equal(nodes(tree).find(node => node.type === 'PurchaseCard').props.disabled, false);
  });
  await test(`${language}: account switch ignores the old pending entitlement and refocus reloads`, async () => {
    let finishOld; const old = new Promise(resolve => { finishOld = resolve; });
    const h = plansScreenHarness([old, { ok: true, planCode: 'antam_8', isAnTam: true, billingPeriod: 'yearly' },
      { ok: true, planCode: 'antam_2', isAnTam: true, billingPeriod: 'monthly' }]);
    h.render(); h.effects(); h.blur(); h.setAccount('account-b'); h.render(); h.effects(); await flush();
    finishOld({ ok: true, planCode: 'antam_4', isAnTam: true, billingPeriod: 'monthly' }); await flush();
    assert.equal(nodes(h.render()).find(node => node.type === 'PurchaseCard').props.currentPlanCode, 'antam_8');
    h.blur(); h.focus(); assert.equal(nodes(h.render()).some(node => node.type === 'PurchaseCard'), false);
    await flush(); assert.equal(nodes(h.render()).find(node => node.type === 'PurchaseCard').props.currentPlanCode, 'antam_2');
    assert.equal(h.calls.length, 3);
  });
  for (const period of ['monthly', 'yearly']) {
    await test(`${language}: ${period} plans show 2 and 4 together, with all benefits repeated on every card`, async () => {
      const h = await loadedPurchaseHarness({ currentPlanCode: 'antam_4', currentBillingPeriod: period });
      const tree = h.render();
      const rows = nodes(tree).filter(node => node.type === 'View' && node.key?.startsWith('row-'));
      assert.equal(rows.length, 2);
      const cards = row => nodes(row).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'radio');
      assert.deepEqual(cards(rows[0]).map(node => node.key), [`asinu.premium.${period}`, `asinu.antam4.${period}`]);
      assert.deepEqual(cards(rows[1]).map(node => node.key), [`asinu.antam8.${period}`]);
      const expectedPrices = period === 'monthly'
        ? [149000, 199000, 249000] : [1199000, 1499000, 1799000];
      [...cards(rows[0]), ...cards(rows[1])].forEach((card, index) => {
        const price = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'vi-VN', {
          style: 'currency', currency: 'VND', maximumFractionDigits: 0,
        }).format(expectedPrices[index]);
        assert.ok(nodes(card).some(node => node.type === 'Text' && node.props.children === price));
        assert.ok(card.props.accessibilityLabel.includes(price));
        assert.doesNotMatch(card.props.accessibilityLabel, /\$/);
        assert.equal(nodes(card).some(node => node.props.children === '$9.99'), false);
      });
      assert.equal(style(rows[0].props.style).alignItems, 'stretch');
      assert.equal(style(rows[0].props.style).flexDirection, 'row');
      for (const card of [...cards(rows[0]), ...cards(rows[1])]) {
        assertCenteredPrice(card, t(period === 'yearly' ? 'iapPerYear' : 'iapPerMonth'));
        assert.equal(style(card.props.style).flex, 1);
        assert.equal(style(card.props.style).height, undefined);
        const content = nodes(card).find(node => node.type === 'View' && style(node.props.style).gap === (card.key.includes('antam8') ? 16 : 10));
        assert.equal(style(content.props.style).flexDirection, card.key.includes('antam8') ? 'row' : undefined);
        for (const text of nodes(card).filter(node => node.type === 'Text')) {
          assert.equal(text.props.allowFontScaling, true);
          assert.equal(text.props.numberOfLines, undefined);
        }
      }
      for (const key of ['iapAiCallcenterShort', 'iapEarlySignalsShort']) {
        assert.equal(nodes(tree).filter(node => node.type === 'Text' && node.props.children === t(key)).length, 3);
        for (const card of [...cards(rows[0]), ...cards(rows[1])]) {
          assert.equal(nodes(card).filter(node => node.type === 'Text' && node.props.children === t(key)).length, 1);
        }
      }
      const noCredits = nodes(tree).filter(node => node.type === 'Text' && node.props.children === t('iapNoConsultation'));
      assert.equal(noCredits.length, period === 'monthly' ? 3 : 0);
      cards(rows[0])[0].props.onPress();
      const selected = h.render();
      assert.equal(nodes(selected).find(node => node.key === `asinu.premium.${period}`).props.accessibilityState.checked, true);
      await purchaseAction(selected).props.onPress();
      assert.equal(h.calls[0][0], `asinu.premium.${period}`);
    });
  }
  for (const currentPlanCode of ['antam_2', 'antam_4', 'antam_8']) for (const currentBillingPeriod of ['monthly', 'yearly']) {
    await test(language + ': opens ' + currentPlanCode + '/' + currentBillingPeriod + ' as current, never repurchases it', async () => {
      const h = await loadedPurchaseHarness({ currentPlanCode, currentBillingPeriod }); const tree = h.render();
      assert.equal(purchaseAction(tree), undefined);
      assert.equal(nodes(tree).find(node => node.type === 'Restore').props.disabled, false);
      assert.deepEqual(h.calls, []);
      const product = nodes(tree).find(node => node.type === 'Pressable' && node.key?.endsWith('.' + currentBillingPeriod)
        && nodes(node).some(child => child.type === 'Text' && child.props.children === t('iapCurrent')));
      assert.ok(product, 'The current plan card is visibly marked');
    });
  }
  await test(language + ': late status selects the current monthly plan instead of the annual default', async () => {
    const h = await loadedPurchaseHarness();
    h.render({ currentPlanCode: 'antam_4', currentBillingPeriod: 'monthly' }); h.effects();
    const tree = h.render();
    assert.equal(purchaseAction(tree), undefined);
    assert.ok(nodes(tree).find(node => node.type === 'Restore'));
    assert.ok(nodes(tree).some(node => node.key === 'asinu.antam4.monthly'));
    assert.equal(nodes(tree).some(node => node.key === 'asinu.antam4.yearly'), false);
  });
  await test(language + ': choosing a different period is deliberate and survives status refresh', async () => {
    const h = await loadedPurchaseHarness({ currentPlanCode: 'antam_4', currentBillingPeriod: 'monthly' });
    periodAction(h.render(), 'yearly').props.onPress();
    h.render({ currentPlanCode: 'antam_4', currentBillingPeriod: 'monthly' }); h.effects();
    let tree = h.render(); assert.equal(purchaseAction(tree).props.disabled, false);
    assert.equal(actionLabel(tree), t('iapChangeToYearly'));
    assert.ok(nodes(tree).some(node => node.key === 'asinu.antam4.yearly'));
    periodAction(tree, 'monthly').props.onPress(); tree = h.render();
    assert.equal(purchaseAction(tree), undefined);
    assert.ok(nodes(tree).find(node => node.type === 'Restore'));
  });
  await test(language + ': switching an active yearly plan to monthly uses a clear period-change label', async () => {
    const h = await loadedPurchaseHarness({ currentPlanCode: 'antam_4', currentBillingPeriod: 'yearly' });
    periodAction(h.render(), 'monthly').props.onPress();
    const tree = h.render();
    assert.equal(actionLabel(tree), t('iapChangeToMonthly'));
    assert.equal(purchaseAction(tree).props.disabled, false);
    await purchaseAction(tree).props.onPress();
    assert.equal(h.calls[0][0], 'asinu.antam4.monthly');
  });
  await test(language + ': entitlement refresh blocks purchases, restore and plan/period changes', async () => {
    const h = await loadedPurchaseHarness({ disabled: true });
    let tree = h.render();
    assert.equal(purchaseAction(tree).props.disabled, true);
    assert.equal(nodes(tree).find(node => node.type === 'Restore'), undefined);
    for (const card of nodes(tree).filter(node => node.props.accessibilityRole === 'radio')) {
      assert.equal(card.props.disabled, true);
    }
    assert.equal(periodAction(tree, 'monthly').props.disabled, true);
    assert.equal(periodAction(tree, 'yearly').props.disabled, true);
    await purchaseAction(tree).props.onPress(); assert.deepEqual(h.calls, []);
    tree = h.render({ disabled: false });
    assert.equal(purchaseAction(tree).props.disabled, false);
    tree = h.render({ currentPlanCode: 'antam_4', currentBillingPeriod: 'yearly', disabled: true });
    h.effects(); tree = h.render();
    assert.equal(purchaseAction(tree), undefined);
    assert.equal(nodes(tree).find(node => node.type === 'Restore').props.disabled, true);
  });
  await test(language + ': selecting another plan survives late status and uses the explicit buy label', async () => {
    const h = await loadedPurchaseHarness();
    nodes(h.render()).find(node => node.key === 'asinu.antam8.yearly').props.onPress();
    h.render({ currentPlanCode: 'antam_4', currentBillingPeriod: 'monthly' }); h.effects();
    const tree = h.render(); assert.equal(actionLabel(tree), t('iapBuy', { plan: localizedPlanName('antam_8', t) }));
    assert.equal(purchaseAction(tree).props.disabled, false);
    await purchaseAction(tree).props.onPress(); assert.equal(h.calls[0][0], 'asinu.antam8.yearly');
  });
  await test(language + ': free users see Buy, duplicate taps create only one Store request', async () => {
    const h = await loadedPurchaseHarness({}, { defer: true }); const action = purchaseAction(h.render());
    assert.equal(actionLabel(h.render()), t('iapBuy', { plan: localizedPlanName('antam_4', t) }));
    const first = action.props.onPress(); const second = action.props.onPress();
    assert.equal(h.calls.length, 1);
    assert.equal(purchaseAction(h.render()).props.disabled, true);
    assert.equal(nodes(h.render()).find(node => node.type === 'Restore'), undefined);
    h.complete(); await Promise.all([first, second]); assert.equal(h.calls.at(-1), 'refreshed');
    const tree = h.render({ currentPlanCode: 'antam_4', currentBillingPeriod: 'yearly' });
    assert.equal(purchaseAction(tree), undefined);
    assert.ok(nodes(tree).find(node => node.type === 'Restore'));
    assert.equal(h.calls.filter(Array.isArray).length, 1);
  });
  await test(language + ': an expired plan can be bought again after status becomes free', async () => {
    const h = await loadedPurchaseHarness({ currentPlanCode: 'antam_4', currentBillingPeriod: 'monthly' });
    const tree = h.render({ currentPlanCode: 'free', currentBillingPeriod: null });
    assert.equal(actionLabel(tree), t('iapBuy', { plan: localizedPlanName('antam_4', t) }));
    assert.equal(purchaseAction(tree).props.disabled, false);
    await purchaseAction(tree).props.onPress(); assert.equal(h.calls[0][0], 'asinu.antam4.monthly');
  });
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
    assert.equal(nodes(tree).find(node => node.type === 'Text').props.children, t('restorePurchases'));
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
  await test(`${language}: restore uses one full-width action with a horizontal icon and purchased-plan label`, () => {
    const h = restoreHarness({ restored: 0, errors: [] });
    const tree = h.render(); const button = nodes(tree).find(node => node.type === 'Pressable');
    const buttonStyle = style(button.props.style({ pressed: false }));
    assert.equal(buttonStyle.alignSelf, 'stretch'); assert.equal(buttonStyle.flexShrink, 1);
    assert.ok(buttonStyle.minHeight >= 56); assert.equal(buttonStyle.maxWidth, '100%');
    assert.equal(buttonStyle.height, undefined); assert.equal(buttonStyle.marginTop, 0);
    assert.equal(buttonStyle.backgroundColor, theme.colors.primaryLight); assert.equal(buttonStyle.borderColor, theme.colors.border);
    const leading = nodes(button).find(node => node.type === 'View');
    assert.equal(style(leading.props.style).flex, 0); assert.equal(style(leading.props.style).flexDirection, 'row');
    assert.equal(style(leading.props.style).alignItems, 'center');
    const label = nodes(button).find(node => node.type === 'Text');
    assert.equal(label.props.allowFontScaling, true); assert.equal(label.props.numberOfLines, undefined);
    assert.equal(style(label.props.style).color, theme.colors.primaryText);
    assert.equal(label.props.children, t('restorePurchases'));
    assert.ok(nodes(button).some(node => node.type === 'Icon' && node.props.name === 'refresh-outline' && node.props.size >= 21));
  });
  for (const [width, multiplier, fontScale] of [[430, 1, 1], [393, 1, 1], [320, 1, 1], [430, 1.25, 1], [430, 1, 1.5]]) {
    await test(`${language}: one selected-plan action at ${width}px, app scale ${multiplier}, system scale ${fontScale}`, async () => {
      const h = hooks(); const calls = [];
      const products = evaluate('src/features/iap/iap.catalog.ts', { 'react-native': { Platform: { OS: 'ios' } } }).FALLBACK_IAP_PRODUCTS.map(item => ({ ...item, nativeProduct: {} }));
      const { IapPurchaseCard } = evaluate('src/features/iap/IapPurchaseCard.tsx', {
        react: h.react, 'react-native': { ...native, useWindowDimensions: () => ({ width, fontScale }) }, '@expo/vector-icons': icons,
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
      const planRows = nodes(tree).filter(node => node.type === 'View' && node.key?.startsWith('row-'));
      const planStacked = width < 360 || multiplier * fontScale > 1.15;
      assert.equal(planRows.length, planStacked ? 3 : 2);
      assert.deepEqual(planRows.map(row => nodes(row).filter(node => node.type === 'Pressable').length), planStacked ? [1, 1, 1] : [2, 1]);
      for (const row of planRows) for (const card of nodes(row).filter(node => node.type === 'Pressable')) {
        assertCenteredPrice(card, t('iapPerYear'));
        assert.equal(card.props.accessibilityRole, 'radio');
        assert.equal(style(card.props.style).minWidth, 0);
        assert.equal(style(card.props.style).height, undefined);
      }
      let buy = nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
      assert.ok(buy); assert.equal(buy.props.disabled, false);
      assert.equal(nodes(tree).find(node => node.type === 'Restore'), undefined);
      const group = nodes(tree).find(node => [node.props.children].flat().includes(buy));
      assert.equal(style(group.props.style).flexDirection, 'column');
      assert.equal(style(group.props.style).alignItems, 'stretch');
      assert.equal(style(buy.props.style).height, undefined); assert.ok(style(buy.props.style).minHeight >= 56);
      const content = nodes(buy).find(node => node.type === 'View');
      assert.equal(style(content.props.style).height, undefined); assert.ok(style(content.props.style).minHeight >= 56);
      const label = nodes(buy).find(node => node.type === 'Text');
      assert.equal(label.props.allowFontScaling, true); assert.equal(label.props.numberOfLines, undefined);
      await buy.props.onPress(); assert.equal(calls[0][0], 'asinu.antam4.yearly'); assert.equal(calls.at(-1), 'refreshed');
      const currentProps = { ...props, currentPlanCode: 'antam_4', currentBillingPeriod: 'yearly' };
      const current = h.render(IapPurchaseCard, currentProps);
      assert.equal(nodes(current).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button'), undefined);
      const restore = nodes(current).find(node => node.type === 'Restore');
      assert.equal(restore.props.disabled, false); assert.equal(restore.props.compact, true);
      assert.equal(restore.props.onRestored, props.onPurchased);
      restore.props.onBusyChange(true); tree = h.render(IapPurchaseCard, currentProps);
      assert.equal(nodes(tree).find(node => node.props.accessibilityRole === 'radio').props.disabled, true);
      restore.props.onBusyChange(false);
      nodes(h.render(IapPurchaseCard, currentProps)).find(node => node.key === 'asinu.antam8.yearly').props.onPress();
      tree = h.render(IapPurchaseCard, currentProps);
      assert.equal(nodes(tree).find(node => node.type === 'Restore'), undefined);
      assert.equal(nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button').props.disabled, false);
    });
  }
}

for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
  await test(language + '/' + mode + ': FAQ starts compact, opens all ten questions and collapses accessibly', () => {
    theme.applyTheme(mode); const h = hooks(); const t = translate(language, 'subscription'); const animations = [];
    const { SubscriptionFAQ } = evaluate('src/components/SubscriptionFAQ.tsx', {
      react: h.react, 'react-native': {
        ...native, Platform: { OS: 'ios' }, UIManager: {},
        LayoutAnimation: { Types: { easeInEaseOut: 'easeInEaseOut' }, Properties: { opacity: 'opacity' }, configureNext: value => animations.push(value) },
      },
      '@expo/vector-icons': icons, './ScaledText': { ScaledText: 'Text' },
      '../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors, isDark: mode === 'dark' }) },
      '../styles': theme, 'react-i18next': { useTranslation: () => ({ t }) },
    });
    const render = () => h.render(SubscriptionFAQ.type, {});
    const header = tree => nodes(tree).find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t('faqTitle'));
    const questions = tree => nodes(tree).filter(node => node.type?.type?.name === 'FAQItem');
    let tree = render(); assert.equal(header(tree).props.accessibilityState.expanded, false); assert.equal(questions(tree).length, 0);
    const headerStyle = style(header(tree).props.style({ pressed: false }));
    assert.ok(headerStyle.minHeight >= 56); assert.equal(headerStyle.height, undefined);
    for (const text of nodes(header(tree)).filter(node => node.type === 'Text'
      && [t('faqTitle'), t('faqTapHint')].includes(node.props.children))) {
      assert.equal(text.props.allowFontScaling, true); assert.equal(text.props.numberOfLines, undefined);
    }
    header(tree).props.onPress(); tree = render();
    assert.equal(header(tree).props.accessibilityState.expanded, true); assert.equal(questions(tree).length, 10);
    assert.equal(questions(tree).some(node => node.props.isOpen), false);
    let fourth = questions(tree)[3]; fourth.props.onToggle(3); tree = render(); fourth = questions(tree)[3];
    assert.equal(fourth.props.isOpen, true);
    const item = hooks().render(fourth.type.type, fourth.props);
    assert.equal(item.props.accessibilityRole, 'button'); assert.equal(item.props.accessibilityState.expanded, true);
    assert.ok(style(item.props.style({ pressed: false })).minHeight >= 56);
    assert.ok(nodes(item).some(node => node.type === 'Text' && node.props.children === t('faq.a4')));
    header(tree).props.onPress(); tree = render(); assert.equal(questions(tree).length, 0);
    header(tree).props.onPress(); tree = render(); assert.equal(questions(tree).length, 10);
    assert.equal(questions(tree)[3].props.isOpen, true); assert.equal(animations.length, 4);
  });
}

await test('FAQ remains above comparison; purchase and restore live only on the separate plan screen', () => {
  const source = read('app/subscription/index.tsx');
  assert.ok(source.indexOf('<SubscriptionFAQ') > source.indexOf('<CurrentPlanCard'));
  assert.ok(source.indexOf('<SubscriptionFAQ') < source.indexOf('<PlanComparison'));
  assert.equal(source.match(/<SubscriptionFAQ/g).length, 1);
  assert.doesNotMatch(source, /IapPurchaseCard|RestoreLink|showPurchaseSection|purchaseSectionYRef|isFirstRevealRef/);
  assert.match(source, /router\.push\("\/subscription\/plans"\)/);
  assert.match(source, /useFocusEffect/);
  const plans = read('app/subscription/plans.tsx');
  assert.equal(plans.match(/<IapPurchaseCard/g).length, 1);
  assert.doesNotMatch(plans, /<PlanComparison|<SubscriptionFAQ/);
  assert.match(plans, /useGuardedRouter/);
  assert.match(read('src/features/iap/IapPurchaseCard.tsx'), /<RestoreLink compact/);
  assert.match(read('app/care-circle/index.tsx'), /<AppAlertModal[^>]*queued/);
  assert.match(read('app/care-circle/index.tsx'), /layout: 'actions'/);
});
await test('redundant emergency-contact footnotes are absent from the subscription screen and member sheet', () => {
  assert.doesNotMatch(read('app/subscription/index.tsx'), /v2EmergencyContactHint|sheetFootnoteRow|footerNote/);
});
await test('plan selector starts with the billing switch, without the removed heading or description', () => {
  const source = read('src/features/iap/IapPurchaseCard.tsx');
  assert.doesNotMatch(source, /iapPackageSectionTitle|iapPackageSectionSubtitle|styles\.headingRow|styles\.headerInfo/);
  assert.ok(source.indexOf('styles.periodSwitch') < source.indexOf('styles.planListWrap'));
  assert.doesNotMatch(source, /sharedBenefits|iapSharedBenefits/);
});
console.log('Connection options, subscription actions and FAQ: ' + checks + ' runtime regressions passed.');
