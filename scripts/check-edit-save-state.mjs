import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  } }).outputText;
  // Execute the real screens, their fields and their submission handlers.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id.endsWith('.png')) return id;
    assert.ok(id in imports, `Missing edit adapter: ${id}`);
    return imports[id];
  });
  return module.exports;
}
const theme = evaluate(read('src/styles/theme.ts'));
const connectionEdit = evaluate(read('src/features/care-circle/connection-edit.ts'));
const familyRoles = evaluate(read('src/features/care-circle/family-roles.ts'));
const healthAccess = evaluate(read('src/features/care-circle/health-access.ts'));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const flatten = value => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
const translate = (language, namespace) => {
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/${namespace}.json`));
  return (key, values = {}) => {
    const text = catalog[key];
    assert.equal(typeof text, 'string', `${language}:${namespace}:${key}`);
    return text.replace(/\{\{(\w+)\}\}/g, (_, part) => String(values[part] ?? ''));
  };
};
function hooks() {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const useMemo = (work, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((value, offset) => !Object.is(value, slots[index].deps[offset]))) {
      slots[index] = { value: work(), deps };
    }
    return slots[index].value;
  };
  return {
    react: { __esModule: true, default: React, ...React,
      useState: initial => {
        const index = cursor++;
        slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, value => {
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        }];
      },
      useRef: value => slots[cursor++] ??= { current: value },
      useMemo, useCallback: (work, deps) => useMemo(() => work, deps),
      useEffect: (work, deps) => useMemo(() => { effects.push(work); }, deps),
    },
    render: (component, props) => { cursor = 0; return component(props); },
    effects: () => effects.splice(0).forEach(work => work()),
  };
}
const native = {
  ...Object.fromEntries(['ActivityIndicator', 'View', 'Modal', 'Image', 'Switch', 'ScrollView', 'KeyboardAvoidingView'].map(name => [name, name])),
  TouchableOpacity: 'Button', Pressable: 'Button',
  Platform: { OS: 'ios', select: values => values.ios ?? values.default },
  StyleSheet: { create: value => value, absoluteFill: {} },
};
const icons = { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' };
let checks = 0;
async function test(label, work) { await work(); checks++; console.log(`PASS ${label}`); }

function connectionHarness({ language = 'vi', isDark = false, role = 'than-nhan', relationship = 'bo', permissions, update } = {}) {
  theme.applyTheme(isDark ? 'dark' : 'light');
  const h = hooks();
  const t = translate(language, 'careCircle');
  const tc = translate(language, 'common');
  const calls = { alerts: [], writes: [], toasts: [] };
  const connection = {
    id: 'connection', requester_id: 'me', addressee_id: 'relative', status: 'accepted',
    addressee_full_name: 'Family Member', relationship_type: relationship, role,
    permissions: permissions ?? { can_view_logs: true, can_receive_alerts: true, can_ack_escalation: true },
  };
  const write = async (kind, id, values) => {
    calls.writes.push({ kind, id, values: { ...values } });
    if (update) await update(kind, values);
    Object.assign(connection, kind === 'permissions' ? { permissions: { ...values } } : values);
    return { ...connection };
  };
  const care = { connections: [connection], invitations: [], loading: false, refreshing: false,
    updateConnection: (id, values) => write('metadata', id, values),
    updatePermissions: (id, values) => write('permissions', id, values),
  };
  const { default: Screen } = evaluate(read('app/care-circle/index.tsx'), {
    react: h.react, 'react-native': native, '@expo/vector-icons': icons,
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect() {} },
    'react-i18next': { useTranslation: namespace => ({ t: namespace === 'common' ? tc : t }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({ push() {} }) },
    '../../src/components/RippleRefresh': { RippleRefreshScrollView: 'ScrollView' },
    '../../src/components/Button': { Button: 'Button' }, '../../src/components/Dropdown': { Dropdown: 'Dropdown' },
    '../../src/components/AppAlertModal': { AppAlertModal: 'AlertModal', useAppAlert: () => ({ alertState: {}, dismissAlert() {}, showAlert: (...args) => calls.alerts.push(args) }) },
    '../../src/components/ScaledText': { ScaledText: 'Text' }, '../../src/components/Screen': { Screen: 'Screen' },
    '../../src/components/state/MainScreenSkeletons': { CareCircleTabSkeleton: 'Skeleton' },
    '../../src/hooks/useInitialLoadingGate': { useInitialLoadingGate: () => false },
    '../../src/features/auth/auth.store': { useAuthStore: select => select({ profile: { id: 'me' } }) },
    '../../src/stores/language.store': { useLanguageStore: () => ({ language }) },
    '../../src/stores/toast.store': { showToast: (...args) => calls.toasts.push(args) },
    '../../src/features/care-circle': { useCareCircle: () => care },
    '../../src/hooks/useScaledTypography': { useScaledTypography: () => theme.typography },
    '../../src/styles': theme, '../../src/hooks/useThemeColors': { useThemeColors: () => ({ isDark }) },
    '../../src/lib/apiClient': { getApiErrorMessage: error => error.message },
    '../../src/features/care-circle/health-access': healthAccess,
    '../../src/features/care-circle/family-roles': familyRoles,
    '../../src/features/care-circle/connection-edit': connectionEdit,
    '../../src/features/care-circle/components/CareCircleQrActions': { CareCircleQrActions: 'QrActions' },
  });
  const render = () => h.render(Screen);
  const modal = () => nodes(render()).find(node => node.type === 'Modal' && node.props.visible);
  return { calls, connection, modal,
    open: () => {
      nodes(render()).find(node => node.type === 'Button' && node.props.accessibilityLabel === tc('notificationMoreActions')).props.onPress();
      calls.alerts.at(-1)[2].find(button => button.text === t('editConnection')).onPress();
    },
    save: () => nodes(modal()).find(node => node.type === 'Button' && node.props.accessibilityLabel === tc('save')),
    choose: (field, id) => {
      const dropdown = nodes(modal()).find(node => node.type === 'Dropdown' && node.props.label === t(field));
      dropdown.props.onChange(dropdown.props.options.find(option => option.id === id));
    },
    permission: (index, value) => nodes(modal()).filter(node => node.type === 'Switch')[index].props.onValueChange(value),
  };
}
for (const language of ['vi', 'en']) for (const isDark of [false, true]) {
  await test(`${language}/${isDark ? 'dark' : 'light'}: unchanged connection is muted and submits nothing`, async () => {
    const h = connectionHarness({ language, isDark, role: 'Thân nhân', relationship: language === 'vi' ? 'Bố' : 'Father' });
    h.open(); const button = h.save();
    assert.equal(button.props.disabled, true);
    assert.deepEqual(button.props.accessibilityState, { disabled: true, busy: false });
    assert.equal(flatten(button.props.style).backgroundColor, theme.colors.border);
    await button.props.onPress(); assert.equal(h.calls.writes.length, 0); assert.equal(h.calls.toasts.length, 0);
    h.choose('role', 'nguoi-cham-soc'); assert.equal(h.save().props.disabled, false);
    h.choose('role', 'than-nhan'); assert.equal(h.save().props.disabled, true);
    h.choose('relationship', 'me'); assert.equal(h.save().props.disabled, false);
    h.choose('relationship', 'bo'); assert.equal(h.save().props.disabled, true);
    for (let index = 0; index < 3; index++) {
      h.permission(index, false); assert.equal(h.save().props.disabled, false);
      h.permission(index, true); assert.equal(h.save().props.disabled, true);
    }
  });
}
await test('permission-only edits submit only permissions, including a connection with no metadata', async () => {
  const h = connectionHarness({ role: '', relationship: '', permissions: { can_view_logs: false, can_receive_alerts: false, can_ack_escalation: true } });
  h.open(); assert.equal(h.save().props.disabled, true);
  h.permission(0, true); await h.save().props.onPress();
  assert.deepEqual(h.calls.writes.map(call => call.kind), ['permissions']);
  assert.deepEqual(h.calls.writes[0].values, { can_view_logs: true, can_receive_alerts: false, can_ack_escalation: true });
  assert.equal(h.modal(), undefined); h.open(); assert.equal(h.save().props.disabled, true);
});
await test('metadata-only edits omit unchanged fields and permission writes', async () => {
  const h = connectionHarness(); h.open(); h.choose('role', 'nguoi-cham-soc');
  await h.save().props.onPress();
  assert.deepEqual(h.calls.writes, [{ kind: 'metadata', id: 'connection', values: { role: 'nguoi-cham-soc' } }]);
});
await test('saving locks the form immediately and suppresses a second tap from the same render', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const h = connectionHarness({ update: () => waiting }); h.open(); h.choose('relationship', 'me');
  const button = h.save(); const pending = button.props.onPress(); await button.props.onPress();
  assert.equal(h.calls.writes.length, 1);
  assert.deepEqual(h.save().props.accessibilityState, { disabled: true, busy: true });
  assert.ok(nodes(h.modal()).filter(node => node.type === 'Switch').every(node => node.props.disabled));
  finish(); await pending; assert.equal(h.modal(), undefined);
});
await test('a failed permission write remains retryable without resending successful metadata', async () => {
  let permissionWrites = 0;
  const h = connectionHarness({ update: kind => {
    if (kind === 'permissions' && ++permissionWrites === 1) throw new Error('offline');
  } });
  h.open(); h.choose('relationship', 'me'); h.permission(1, false);
  await h.save().props.onPress(); assert.ok(h.modal()); assert.equal(h.save().props.disabled, false);
  assert.equal(h.calls.toasts.at(-1)[1], 'error');
  await h.save().props.onPress(); assert.equal(h.modal(), undefined);
  assert.deepEqual(h.calls.writes.map(call => call.kind), ['metadata', 'permissions', 'permissions']);
  h.open(); assert.equal(h.save().props.disabled, true);
});

for (const language of ['vi', 'en']) {
  await test(`${language}: reminder time confirms only changes and cannot reset an already automatic schedule`, () => {
    const h = hooks(); const calls = [];
    const { TimePickerModal } = evaluate(`${read('app/reminder-config/index.tsx')}\nexport { TimePickerModal };`, {
      react: h.react, 'react-native': native, '@expo/vector-icons': icons,
      'expo-router': { Stack: {} }, '@/hooks/useGuardedRouter': {},
      'react-i18next': { useTranslation: () => ({ t: translate(language, 'settings') }) },
      'react-native-reanimated': { __esModule: true, default: {}, FadeIn: {}, FadeInDown: {} },
      'react-native-safe-area-context': {}, '../../src/components/ScaledText': { ScaledText: 'Text' },
      '../../src/components/state/MainScreenSkeletons': {}, '../../src/features/auth/auth.api': {},
      '../../src/stores/toast.store': {}, '../../src/features/notifications/notifications.api': {},
      '../../src/lib/notifications': {}, '../../src/hooks/useScaledTypography': { useScaledTypography: () => theme.typography },
      '../../src/styles': theme, '../../src/hooks/useThemeColors': {},
    });
    const props = { visible: true, initialTime: '08:00:00', isAuto: true, saving: false, hourRange: [5, 11],
      onConfirm: time => calls.push(time), onResetToAuto: () => calls.push('auto'), onCancel() {} };
    const render = extras => h.render(TimePickerModal, { ...props, ...extras });
    render(); h.effects();
    const actions = tree => nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityRole === 'button');
    let [auto, confirm] = actions(render());
    assert.equal(auto.props.disabled, true); assert.equal(confirm.props.disabled, true);
    auto.props.onPress(); confirm.props.onPress(); assert.deepEqual(calls, []);
    const hour = nodes(render()).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === '09'));
    hour.props.onPress(); [, confirm] = actions(render()); assert.equal(confirm.props.disabled, false);
    confirm.props.onPress(); assert.deepEqual(calls, ['09:00']);
    const original = nodes(render()).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === '08'));
    original.props.onPress(); assert.equal(actions(render())[1].props.disabled, true);
    [auto] = actions(render({ isAuto: false })); assert.equal(auto.props.disabled, false);
    assert.ok(actions(render({ saving: true, isAuto: false })).every(button => button.props.disabled));
  });
}
// Isolate the actual message editor expressions and handler from its realtime
// thread so that unrelated sockets/audio do not mask save-state regressions.
const threadSource = read('app/doctor-consultation/[taskId].tsx');
const threadAst = ts.createSourceFile('thread.tsx', threadSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
const messageButtons = [];
function inspectThread(node) {
  if (ts.isVariableDeclaration(node) && ['editedMessage', 'hasMessageEditChanges', 'editMessageSaveDisabled', 'runMessageAction'].includes(node.name.getText(threadAst))) {
    declarations.set(node.name.getText(threadAst), node.getText(threadAst));
  }
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(threadAst) === 'Pressable' && node.openingElement.attributes.properties.some(attribute =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(threadAst) === 'disabled' && attribute.initializer?.expression?.getText(threadAst) === 'editMessageSaveDisabled')) {
    messageButtons.push(node.getText(threadAst));
  }
  ts.forEachChild(node, inspectThread);
}
inspectThread(threadAst);
assert.equal(declarations.size, 4); assert.equal(messageButtons.length, 2);
const { messageEditor } = evaluate(`
  import React from 'react';
  export function messageEditor(state, deps) {
    const { taskId, activeTenantId, messages, editingMessageId, editingDraft, messageActionBusy, messageActionInFlight } = state;
    const { apiClient, setEditingMessageId, setEditingDraft, setMessageActionBusy, loadThread, showToast } = deps;
    const Pressable = 'Button', Text = 'Text', t = key => key;
    const styles = { editSaveText: {}, editSaveDisabled: { opacity: 0.4 } };
    ${[...declarations.values()].map(declaration => `const ${declaration};`).join('\n')}
    const message = editedMessage;
    return { runMessageAction, buttons: [${messageButtons.join(',')}] };
  }
`, { react: React });
await test('both message Save buttons reject unchanged, whitespace-only and reverted content', async () => {
  const calls = [];
  const state = { taskId: 'task', activeTenantId: 'tenant', messages: [{ id: 'message', content: 'Original text' }],
    editingMessageId: 'message', editingDraft: 'Original text', messageActionBusy: false, messageActionInFlight: { current: false } };
  const deps = { apiClient: async (...args) => calls.push(args), loadThread() {}, showToast() {},
    setEditingMessageId: id => { state.editingMessageId = id; }, setEditingDraft: content => { state.editingDraft = content; },
    setMessageActionBusy: busy => { state.messageActionBusy = busy; } };
  for (const content of ['Original text', ' Original text ', '', '   ']) {
    state.editingDraft = content;
    const editor = messageEditor(state, deps);
    assert.ok(editor.buttons.every(button => button.props.disabled));
    await editor.runMessageAction('message', 'edit', content.trim()); assert.equal(calls.length, 0);
  }
  state.editingDraft = 'Updated text';
  assert.ok(messageEditor(state, deps).buttons.every(button => !button.props.disabled));
  state.editingDraft = 'Original text';
  assert.ok(messageEditor(state, deps).buttons.every(button => button.props.disabled));
  state.editingDraft = 'Updated text';
  const editor = messageEditor(state, deps);
  await editor.runMessageAction('message', 'edit', 'Updated text');
  assert.equal(calls.length, 1); assert.equal(calls[0][1].body.content, 'Updated text');
});
console.log(`Edit save state: ${checks} runtime regressions passed.`);
