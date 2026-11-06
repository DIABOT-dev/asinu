import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(file, imports) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const jsx = (type, props) => ({ type, props });
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    assert.ok(id in imports, `Missing deletion adapter ${id}`); return imports[id];
  });
  return module.exports;
}
const theme = evaluate('src/styles/theme.ts', {});
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];
function harness(language = 'vi', dark = false) {
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/settings.json`));
  const common = JSON.parse(read(`src/i18n/locales/${language}/common.json`));
  const t = (key, values = {}) => {
    assert.equal(typeof catalog[key], 'string', `Missing deletion copy ${key}`);
    return catalog[key].replace(/{{([^}]+)}}/g, (_, name) => values[name] ?? '');
  };
  let index = 0, visible = true, onConfirm = async () => {}, closes = 0, confirms = 0;
  const slots = [], effects = [];
  const runtime = {
    useState: initial => { const i = index++; slots[i] ??= { value: initial }; return [slots[i].value, next => { slots[i].value = next; }]; },
    useRef: initial => slots[index++] ??= { current: initial },
    useMemo: fn => fn(),
    useEffect: (fn, deps) => { const i = index++, old = slots[i]; if (!old || deps.some((x,j) => x !== old.deps[j])) { slots[i] = { deps }; effects.push(fn); } },
  };
  const Screen = evaluate('src/components/DeleteAccountModal.tsx', {
    react: runtime, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native': { ActivityIndicator: 'Spinner', KeyboardAvoidingView: 'Keyboard', Modal: 'Modal', Platform: { OS: 'ios' }, Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFill: {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    'react-i18next': { useTranslation: namespace => ({ t: namespace === 'settings' ? t : key => common[key] }) },
    '../hooks/useScaledTypography': { useScaledTypography: () => theme.typography },
    './ScaledText': { ScaledText: 'Text' }, './ScaledTextInput': { ScaledTextInput: 'Input' },
    '../styles': { ...theme, colors: dark ? theme.darkColors : theme.lightColors },
    '../hooks/useThemeColors': { useThemeColors: () => ({ isDark: dark }) },
  }).default;
  function render() {
    index = 0;
    const tree = Screen({ visible, onClose: () => { closes++; }, onConfirm: async () => { confirms++; await onConfirm(); } });
    effects.splice(0).forEach(fn => fn());
    const all = nodes(tree);
    return { tree, all, input: all.find(x => x.type === 'Input'), remove: all.find(x => x.type === 'Button' && x.props.accessibilityLabel === t('deleteAccount')),
      cancel: all.find(x => x.type === 'Button' && x.props.accessibilityLabel === common.cancel), text: all.filter(x => x.type === 'Text').map(x => x.props.children).filter(x => typeof x === 'string') };
  }
  return { render, t, word: t('deleteConfirmWord'), type: value => { render().input.props.onChangeText(value); return render(); },
    setConfirm: fn => { onConfirm = fn; }, setVisible: value => { visible = value; render(); return render(); },
    counts: () => ({ closes, confirms }) };
}
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
for (const language of ['vi', 'en']) for (const dark of [false, true]) {
  const prefix = `${language}/${dark ? 'dark' : 'light'}`;
  await test(`${prefix}: readable warning sections describe the actual immediate-deletion flow`, () => {
    const h = harness(language, dark), view = h.render();
    for (let i = 1; i <= 4; i++) { assert.ok(view.text.includes(h.t(`deleteWarningTitle${i}`))); assert.ok(view.text.includes(h.t(`deleteWarning${i}`))); }
    assert.ok(!/72|\bOTP\b/i.test(view.text.join(' ')));
    assert.equal(view.remove.props.disabled, true);
    assert.equal(view.input.props.editable, true);
  });
  await test(`${prefix}: blank or incorrect words cannot delete, including a direct press`, async () => {
    const h = harness(language, dark);
    for (const word of ['', 'wrong', language === 'vi' ? 'XOA' : 'XÓA']) {
      const view = h.type(word); assert.equal(view.remove.props.disabled, true); await view.remove.props.onPress();
    }
    assert.equal(h.counts().confirms, 0);
  });
  await test(`${prefix}: the localized word supports whitespace, lowercase and Unicode normalization`, async () => {
    const h = harness(language, dark), view = h.type(` ${h.word.toLowerCase().normalize('NFD')} `);
    assert.equal(view.remove.props.disabled, false); await view.remove.props.onPress();
    assert.equal(h.counts().confirms, 1); assert.equal(h.render().input.props.value, '');
  });
  await test(`${prefix}: Cancel clears confirmation and rejects a queued stale delete handler`, async () => {
    const h = harness(language, dark), view = h.type(h.word);
    view.cancel.props.onPress(); await view.remove.props.onPress();
    assert.deepEqual(h.counts(), { closes: 1, confirms: 0 }); assert.equal(h.render().input.props.value, '');
  });
  await test(`${prefix}: changing the word immediately invalidates a stale enabled delete button`, async () => {
    const h = harness(language, dark), view = h.type(h.word);
    view.input.props.onChangeText('wrong'); await view.remove.props.onPress();
    assert.equal(h.counts().confirms, 0);
  });
  await test(`${prefix}: pending deletion blocks duplicates, editing and dismissal`, async () => {
    const h = harness(language, dark); let finish;
    h.setConfirm(() => new Promise(resolve => { finish = resolve; }));
    const view = h.type(h.word), first = view.remove.props.onPress();
    await view.remove.props.onPress(); view.cancel.props.onPress(); view.tree.props.onRequestClose();
    const pending = h.render(); assert.equal(pending.input.props.editable, false);
    assert.equal(pending.remove.props.accessibilityState.busy, true); assert.equal(pending.cancel.props.disabled, true);
    assert.deepEqual(h.counts(), { closes: 0, confirms: 1 }); finish(); await first;
  });
  await test(`${prefix}: failure stays visible, keeps the confirmation and allows a deliberate retry`, async () => {
    const h = harness(language, dark); h.setConfirm(async () => { throw new Error('Synthetic failure'); });
    await h.type(h.word).remove.props.onPress(); const failed = h.render();
    assert.equal(failed.input.props.value, h.word); assert.equal(failed.remove.props.disabled, false);
    assert.ok(failed.all.some(x => x.type === 'Text' && x.props.accessibilityRole === 'alert' && x.props.children === h.t('deleteErrorGeneric')));
    assert.equal(h.counts().closes, 0); h.setConfirm(async () => {}); await failed.remove.props.onPress(); assert.equal(h.counts().confirms, 2);
  });
  await test(`${prefix}: external dismissal cannot preserve a dangerous confirmation on reopening`, () => {
    const h = harness(language, dark); h.type(h.word); h.setVisible(false);
    const reopened = h.setVisible(true); assert.equal(reopened.input.props.value, ''); assert.equal(reopened.remove.props.disabled, true);
  });
}
console.log(`Delete account modal: ${checks} runtime regressions passed.`);
