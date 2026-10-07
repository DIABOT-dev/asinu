const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function evaluate(file, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // Render the actual screen and modal using local native/network adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return require(id);
    assert.ok(Object.hasOwn(dependencies, id), `Missing adapter: ${id}`);
    return dependencies[id];
  });
  return module.exports;
}

const theme = evaluate('src/styles/theme.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const style = value => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const native = Object.fromEntries(['View', 'Modal', 'Pressable', 'ScrollView', 'Image', 'Switch', 'ActivityIndicator'].map(name => [name, name]));
native.StyleSheet = { create: value => value, hairlineWidth: 1 };
const icons = { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' };
const safeArea = { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) };
const luminance = hex => {
  const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

function createModal(mode) {
  theme.applyTheme(mode);
  return evaluate('src/components/AppAlertModal.tsx', {
    react: { useMemo: factory => factory(), useRef: initial => ({ current: initial }), useState: initial => [initial, () => {}] },
    'react-native': native, '@expo/vector-icons': icons,
    './ScaledText': { ScaledText: 'Text' }, './QueuedModal': { QueuedModal: 'QueuedModal' },
    '../hooks/useScaledTypography': { useScaledTypography: () => theme.typography }, '../styles': theme,
    '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: mode === 'dark' }) },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-native-safe-area-context': safeArea,
  }).AppAlertModal;
}

function screenHarness(language, mode, initialSharing) {
  const AppAlertModal = createModal(mode);
  const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/settings.json`, 'utf8'));
  const t = (key, values = {}) => catalog[key] || values.defaultValue || key;
  let index = 0;
  let mounted = false;
  const slots = [], effects = [], calls = [];
  const Screen = evaluate('app/privacy-center.tsx', {
    react: {
      useState: initial => {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }];
      },
      useRef: initial => { const slot = index++; return slots[slot] ??= { current: initial }; },
      useMemo: factory => factory(), useCallback: callback => callback,
      useEffect: effect => { if (!mounted) effects.push(effect); },
    },
    'react-native': { ...native, Share: { share: async () => {} } },
    '@expo/vector-icons': icons, 'expo-router': { Stack: { Screen: 'StackScreen' } },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language, resolvedLanguage: language } }) },
    'react-native-safe-area-context': safeArea,
    '../src/components/ScaledText': { ScaledText: 'Text' },
    '../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../src/components/AppAlertModal': { AppAlertModal },
    '../src/features/auth/auth.store': { useAuthStore: selector => selector({ profile: { consentVersion: 'v2' } }) },
    '../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ canGoBack: () => false, back() {}, replace() {} }) },
    '../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.colors }) },
    '../src/lib/env': { env: { doctorTenantId: 'test-clinic' } },
    '../src/stores/toast.store': { showToast() {} }, '../src/styles': theme,
    '../src/lib/apiClient': {
      getApiErrorMessage: (_error, translate, key) => translate(key),
      apiClient: async (path, options) => {
        calls.push({ path, options });
        assert.equal(options, undefined, 'Opening a modal must not submit a privacy change');
        return { ok: true, data: { sharing_enabled: initialSharing, details_anonymized: false, items: [] } };
      },
    },
  }).default;
  const render = () => {
    index = 0;
    const tree = Screen();
    mounted = true;
    const all = nodes(tree);
    return {
      toggle: key => all.find(node => node.type === 'Switch' && node.props.accessibilityLabel === t(key)),
      button: key => all.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === t(key)),
      modal: all.find(node => node.type === AppAlertModal),
    };
  };
  return {
    calls, render, AppAlertModal,
    mount: async () => {
      render(); effects.forEach(effect => effect());
      for (let count = 0; count < 10; count++) await Promise.resolve();
      return render();
    },
  };
}

async function main() {
  let checks = 0;
  for (const language of ['vi', 'en']) for (const mode of ['light', 'dark']) {
    for (const action of ['grant_consent', 'withdraw_consent', 'anonymize', 'delete']) {
      const h = screenHarness(language, mode, action !== 'grant_consent');
      const initial = await h.mount();
      if (action === 'delete') initial.button('privacyAction_delete').props.onPress();
      else if (action === 'anonymize') initial.toggle('privacyAction_anonymize').props.onValueChange(true);
      else initial.toggle('privacySharingTitle').props.onValueChange(action === 'grant_consent');
      const props = h.render().modal.props;
      assert.equal(props.visible, true);
      const tree = h.AppAlertModal(props), all = nodes(tree);
      assert.equal(tree.type, 'QueuedModal');
      const iconWrap = all.find(node => node.type === 'View' && nodes(node.props.children).some(child => child.type === 'Icon' && child.props.name === props.icon.name));
      assert.ok(iconWrap);
      const iconStyle = style(iconWrap.props.style);
      assert.equal(iconStyle.backgroundColor, undefined);
      assert.equal(iconStyle.borderWidth, undefined);
      assert.equal(iconStyle.borderColor, undefined);
      const icon = nodes(iconWrap).find(node => node.type === 'Icon');
      const destructive = action === 'delete' || action === 'anonymize';
      assert.equal(icon.props.color, destructive ? theme.colors.danger : theme.colors.primary);
      const buttons = all.filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
      assert.equal(buttons.length, 2);
      const confirmStyle = style(buttons[0].props.style({ pressed: false }));
      const confirmText = nodes(buttons[0]).find(node => node.type === 'Text');
      if (action === 'grant_consent') {
        assert.equal(confirmStyle.backgroundColor, theme.colors.primary);
        assert.equal(style(confirmText.props.style).color, theme.lightColors.textPrimary);
        assert.ok(contrast(confirmStyle.backgroundColor, style(confirmText.props.style).color) >= 4.5);
      } else {
        assert.equal(confirmStyle.backgroundColor, theme.colors.danger + (mode === 'dark' ? '20' : '12'));
        assert.equal(confirmStyle.borderColor, theme.colors.danger + '35');
        assert.equal(style(confirmText.props.style).color, theme.iconColors.danger);
      }
      assert.equal(style(buttons[1].props.style({ pressed: false })).backgroundColor, theme.colors.surfaceMuted);
      assert.equal(h.calls.filter(call => call.options).length, 0);
      props.onDismiss();
      assert.equal(h.render().modal.props.visible, false);
      console.log(`PASS ${language}/${mode}: ${action} has a bare icon and scoped semantic colors`);
      checks++;
    }
  }
  for (const mode of ['light', 'dark']) {
    const AppAlertModal = createModal(mode);
    const all = nodes(AppAlertModal({ visible: true, title: 'Existing consumer', icon: { name: 'shield-check-outline' },
      buttons: [{ text: 'Continue', variant: 'primary' }], onDismiss() {} }));
    const iconWrap = all.find(node => node.type === 'View' && nodes(node.props.children).some(child => child.type === 'Icon'));
    assert.equal(style(iconWrap.props.style).borderWidth, 4);
    assert.equal(style(iconWrap.props.style).backgroundColor, mode === 'dark' ? 'rgba(45, 212, 191, 0.14)' : '#E6F7F3');
    const button = all.find(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button');
    assert.equal(style(button.props.style({ pressed: false })).backgroundColor, '#209f97');
    assert.equal(style(nodes(button).find(node => node.type === 'Text').props.style).color, '#ffffff');
    console.log(`PASS ${mode}: existing modal consumers retain their appearance`);
    checks++;
  }
  console.log(`Privacy modal visuals: ${checks} checks passed.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
