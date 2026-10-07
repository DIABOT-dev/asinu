const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function evaluate(file, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // Execute the real screen with controllable native and network adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return require(id);
    assert.ok(id in dependencies, `Missing adapter: ${id}`);
    return dependencies[id];
  });
  return module.exports;
}

const theme = evaluate('src/styles/theme.ts');
function harness(language = 'vi', initial = {}) {
  const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/settings.json`, 'utf8'));
  const t = (key, params = {}) => (catalog[key] || params.defaultValue || key).replace(/\{\{(\w+)\}\}/g, (_, name) => params[name] ?? '');
  let index = 0;
  let mounted = false;
  let rejectPost = false;
  let rejectGet = false;
  let holdPost;
  let holdGet;
  const hooks = [], effects = [], calls = [], shares = [], toasts = [], navigation = [];
  const server = { sharing_enabled: true, details_anonymized: false, items: [], ...initial };
  const deps = {
    react: {
      useState: value => {
        const slot = index++;
        if (!(slot in hooks)) hooks[slot] = value;
        return [hooks[slot], next => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }];
      },
      useRef: value => {
        const slot = index++;
        if (!(slot in hooks)) hooks[slot] = { current: value };
        return hooks[slot];
      },
      useMemo: factory => factory(), useCallback: callback => callback,
      useEffect: effect => { if (!mounted) effects.push(effect); },
    },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: value => value, hairlineWidth: 1 }, Share: { share: async data => { shares.push(data); } } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { Stack: { Screen: 'StackScreen' } },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language, resolvedLanguage: language } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    '../src/components/ScaledText': { ScaledText: 'Text' },
    '../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../src/components/AppAlertModal': { AppAlertModal: 'Alert' },
    '../src/features/auth/auth.store': { useAuthStore: selector => selector({ profile: { consentVersion: 'v2' } }) },
    '../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ canGoBack: () => false, back: () => navigation.push('back'), replace: route => navigation.push(route) }) },
    '../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors }) },
    '../src/lib/env': { env: { doctorTenantId: 'clinic-demo' } },
    '../src/stores/toast.store': { showToast: (...args) => toasts.push(args) },
    '../src/styles': theme,
    '../src/lib/apiClient': {
      getApiErrorMessage: (_error, translate, key) => translate(key),
      apiClient: async (path, options) => {
        calls.push({ path, options });
        if (!options) {
          if (holdGet) await holdGet;
          if (rejectGet) throw new Error('Status unavailable');
          return { ok: true, data: { ...server } };
        }
        if (rejectPost) throw new Error('Network failure');
        if (holdPost) await holdPost;
        const { action } = options.body;
        if (action !== 'export') server.sharing_enabled = action === 'grant_consent';
        if (action === 'anonymize' || action === 'delete') server.details_anonymized = true;
        return { ok: true, data: { action, test_export: 'records' } };
      },
    },
  };
  const Screen = evaluate('app/privacy-center.tsx', deps).default;
  function render() {
    index = 0;
    const tree = Screen(); mounted = true;
    const nodes = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    return {
      nodes,
      button: key => nodes.find(node => (node.type === 'Pressable' || node.type === 'Back') && node.props.accessibilityLabel === t(key)),
      toggle: key => nodes.find(node => node.type === 'Switch' && node.props.accessibilityLabel === t(key)),
      anonymizeRow: nodes.find(node => node.type === 'Pressable' &&
        node.props.children?.some?.(child => child?.type === 'Switch' && child.props.accessibilityLabel === t('privacyAction_anonymize'))),
      alert: nodes.find(node => node.type === 'Alert'),
    };
  }
  async function settle() { for (let count = 0; count < 20; count++) await Promise.resolve(); return render(); }
  const posts = () => calls.filter(call => call.options?.method === 'POST');
  const confirm = view => {
    const modal = view.alert.props;
    modal.onDismiss(); // AppAlert invokes the captured action after native dismissal.
    return modal.buttons[0].onPress();
  };
  return { t, render, settle, calls, shares, toasts, navigation, posts, confirm,
    mount: async () => { render(); effects.forEach(effect => effect()); return settle(); },
    reject: () => { rejectPost = true; }, hold: promise => { holdPost = promise; },
    rejectStatus: value => { rejectGet = value; }, holdStatus: promise => { holdGet = promise; },
    setServer: next => Object.assign(server, next) };
}

// Exercise the real alert and queue, including parent re-render between button
// press and native onDismiss. All requests remain inside the mock API adapter.
function queuedAlert(h) {
  const { ModalQueue } = evaluate('src/lib/modalQueue.ts');
  const queue = new ModalQueue();
  const refs = [];
  let refIndex = 0;
  const AppAlertModal = evaluate('src/components/AppAlertModal.tsx', {
    react: { useMemo: fn => fn(), useRef: initial => refs[refIndex++] ??= { current: initial },
      useState: initial => [initial, () => {}] },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image',
      StyleSheet: { create: value => value } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    './ScaledText': { ScaledText: 'Text' }, './QueuedModal': { QueuedModal: 'QueuedModal' },
    '../hooks/useScaledTypography': { useScaledTypography: () => theme.typography },
    '../styles': theme, '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
  }).AppAlertModal;
  function render() {
    refIndex = 0;
    const tree = AppAlertModal(h.render().alert.props);
    if (tree.props.visible) queue.request('privacy', {
      content: tree.props.children, onDismiss: tree.props.onDismiss, onShow: tree.props.onShow,
    });
    else queue.remove('privacy');
    return tree;
  }
  function button(index) {
    const buttons = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.type === 'Pressable' && node.props.accessibilityRole === 'button') buttons.push(node);
      visit(node.props?.children);
    };
    visit(queue.getSnapshot().active.request.content);
    return buttons[index];
  }
  return { queue, render, button };
}

async function main() {
  let checks = 0;
  const test = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
  for (const language of ['vi', 'en']) {
    await test(`${language}: four separate cards, two switches, no confirmation input`, async () => {
      const h = harness(language), v = await h.mount();
      assert.equal(v.nodes.filter(node => node.type === 'View' && node.props.style?.overflow === 'hidden').length, 4);
      assert.equal(v.nodes.filter(node => node.type === 'Switch').length, 2);
      assert.equal(v.nodes.some(node => node.type === 'TextInput'), false);
      assert.equal(h.posts().length, 0);
    });
    for (const [initial, action] of [[true, 'withdraw_consent'], [false, 'grant_consent']]) {
      await test(`${language}: sharing ${initial ? 'off' : 'on'} waits for the modal and backend`, async () => {
        const h = harness(language, { sharing_enabled: initial });
        (await h.mount()).toggle('privacySharingTitle').props.onValueChange(!initial);
        const opened = h.render();
        assert.equal(opened.alert.props.visible, true);
        assert.equal(opened.toggle('privacySharingTitle').props.value, initial);
        assert.equal(h.posts().length, 0);
        await h.confirm(opened);
        const saved = await h.settle();
        assert.equal(h.posts()[0].options.body.action, action);
        if (action === 'grant_consent') assert.equal(h.posts()[0].options.body.consent_version, 'v2');
        assert.equal(saved.toggle('privacySharingTitle').props.value, !initial);
      });
    }
    await test(`${language}: cancelling a deletion never sends a request`, async () => {
      const h = harness(language);
      (await h.mount()).button('privacyAction_delete').props.onPress();
      const modal = h.render().alert.props;
      assert.equal(modal.visible, true);
      assert.deepEqual(modal.buttons.map(button => button.text), [h.t('privacyConfirmButton_delete'), h.t('privacyCancel')]);
      modal.onDismiss();
      assert.equal(h.posts().length, 0);
      assert.equal(h.render().alert.props.visible, false);
    });
    await test(`${language}: deletion runs only after pressing Delete in the modal`, async () => {
      const h = harness(language);
      (await h.mount()).button('privacyAction_delete').props.onPress();
      assert.equal(h.posts().length, 0);
      await h.confirm(h.render());
      assert.equal(h.posts().length, 1);
      assert.equal(h.posts()[0].options.body.action, 'delete');
    });
    await test(`${language}: the anonymization switch opens a modal before processing`, async () => {
      const h = harness(language);
      (await h.mount()).toggle('privacyAction_anonymize').props.onValueChange(true);
      assert.equal(h.posts().length, 0);
      await h.confirm(h.render());
      const saved = await h.settle();
      assert.equal(h.posts()[0].options.body.action, 'anonymize');
      assert.equal(saved.toggle('privacyAction_anonymize').props.value, true);
      assert.equal(saved.toggle('privacyAction_anonymize').props.disabled, true);
      assert.equal(saved.anonymizeRow.props.disabled, true);
    });
    await test(`${language}: tapping the whole anonymization card opens confirmation without changing data`, async () => {
      const h = harness(language), initial = await h.mount();
      initial.anonymizeRow.props.onPress();
      const view = h.render();
      assert.equal(view.alert.props.visible, true);
      assert.equal(view.toggle('privacyAction_anonymize').props.value, false);
      assert.equal(h.posts().length, 0);
      view.alert.props.onDismiss();
      assert.equal(h.render().alert.props.visible, false);
      assert.equal(h.posts().length, 0);
    });
    await test(`${language}: loading and failed status explain why anonymization is disabled; retry restores it`, async () => {
      const h = harness(language);
      h.rejectStatus(true);
      const before = h.render();
      assert.equal(before.anonymizeRow.props.disabled, true);
      assert.ok(before.nodes.some(node => node.type === 'ActivityIndicator' && node.props.accessibilityLabel === h.t('privacySettingsLoading')));
      const failed = await h.mount();
      assert.equal(failed.toggle('privacyAction_anonymize').props.disabled, true);
      assert.ok(failed.nodes.some(node => node.type === 'Text' && node.props.children === h.t('privacySettingsError')));
      failed.anonymizeRow.props.onPress();
      assert.equal(h.render().alert.props.visible, false);
      assert.equal(h.posts().length, 0);
      h.rejectStatus(false);
      await failed.button('privacyRetry').props.onPress();
      const restored = await h.settle();
      assert.equal(restored.anonymizeRow.props.disabled, false);
      restored.anonymizeRow.props.onPress();
      assert.equal(h.render().alert.props.visible, true);
    });
    await test(`${language}: missing anonymization status is not mistaken for an unprotected account`, async () => {
      const h = harness(language, { details_anonymized: undefined });
      const view = await h.mount();
      assert.equal(view.anonymizeRow.props.disabled, true);
      view.anonymizeRow.props.onPress();
      assert.equal(h.render().alert.props.visible, false);
      assert.equal(h.posts().length, 0);
      assert.ok(view.button('privacyRetry'));
    });
    await test(`${language}: failed anonymization keeps the switch off and reports an error`, async () => {
      const h = harness(language); h.reject();
      (await h.mount()).anonymizeRow.props.onPress();
      await h.confirm(h.render());
      const view = await h.settle();
      assert.equal(h.posts()[0].options.body.action, 'anonymize');
      assert.equal(view.toggle('privacyAction_anonymize').props.value, false);
      assert.equal(view.anonymizeRow.props.disabled, false);
      assert.equal(h.toasts.at(-1)[1], 'error');
    });
    await test(`${language}: export shares the actual API result`, async () => {
      const h = harness(language);
      (await h.mount()).button('privacyAction_export').props.onPress();
      await h.settle();
      assert.equal(h.posts()[0].options.body.action, 'export');
      assert.equal(JSON.parse(h.shares[0].message).test_export, 'records');
    });
    await test(`${language}: a failed update preserves the previous switch and reports failure`, async () => {
      const h = harness(language); h.reject();
      (await h.mount()).toggle('privacySharingTitle').props.onValueChange(false);
      await h.confirm(h.render());
      assert.equal((await h.settle()).toggle('privacySharingTitle').props.value, true);
      assert.equal(h.toasts.at(-1)[1], 'error');
    });
  }
  await test('duplicate modal actions cannot send a second pending request', async () => {
    const h = harness(); let release;
    h.hold(new Promise(resolve => { release = resolve; }));
    (await h.mount()).toggle('privacySharingTitle').props.onValueChange(false);
    const modal = h.render().alert.props;
    const first = modal.buttons[0].onPress();
    await modal.buttons[0].onPress();
    assert.equal(h.posts().length, 1);
    release(); await first;
  });
  await test('a direct entry returns to Profile when no back stack exists', async () => {
    const h = harness(); (await h.mount()).button('privacyBack').props.onPress();
    assert.deepEqual(h.navigation, ['/(tabs)/profile']);
  });
  await test('real queued confirmation waits for native dismissal, survives re-render and submits once', async () => {
    const h = harness(); let release;
    h.hold(new Promise(resolve => { release = resolve; }));
    (await h.mount()).anonymizeRow.props.onPress();
    const alert = queuedAlert(h);
    alert.render();
    const presentation = alert.queue.getSnapshot().active.presentation;
    alert.queue.didShow(presentation);
    const confirmButton = alert.button(0);
    confirmButton.props.onPress(); confirmButton.props.onPress();
    assert.equal(h.posts().length, 0);
    alert.render();
    assert.equal(alert.queue.getSnapshot().active.phase, 'closing');
    alert.queue.didDismiss(presentation);
    alert.queue.didDismiss(presentation);
    assert.equal(h.posts().length, 1);
    assert.equal(h.posts()[0].options.body.action, 'anonymize');
    const pending = h.render();
    assert.equal(pending.anonymizeRow.props.disabled, true);
    assert.equal(pending.toggle('privacyAction_anonymize').props.accessibilityState.busy, true);
    assert.ok(pending.nodes.some(node => node.type === 'ActivityIndicator' && node.props.accessibilityLabel === h.t('privacyAnonymizing')));
    pending.anonymizeRow.props.onPress();
    assert.equal(h.posts().length, 1);
    release();
    const saved = await h.settle();
    assert.equal(saved.toggle('privacyAction_anonymize').props.value, true);
    assert.equal(saved.anonymizeRow.props.disabled, true);
    assert.equal(alert.queue.getSnapshot().active, null);
  });
  await test('real queued Cancel never submits anonymization and releases its native presenter', async () => {
    const h = harness();
    (await h.mount()).anonymizeRow.props.onPress();
    const alert = queuedAlert(h); alert.render();
    const presentation = alert.queue.getSnapshot().active.presentation;
    alert.queue.didShow(presentation);
    alert.button(1).props.onPress();
    alert.render(); alert.queue.didDismiss(presentation);
    assert.equal(h.posts().length, 0);
    assert.equal(h.render().alert.props.visible, false);
    assert.equal(alert.queue.getSnapshot().active, null);
  });
  console.log(`Doctor privacy: ${checks} checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
