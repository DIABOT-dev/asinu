import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const jsx = (type, props) => ({ type, props });
function evaluate(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    assert.ok(id in imports, `Unexpected thread dependency ${id}`); return imports[id];
  }, ...Object.values(globals));
  return module.exports;
}
const theme = evaluate('src/styles/theme.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];
const tick = async () => { for (let i = 0; i < 45; i++) await Promise.resolve(); };
function hooks() {
  let cursor = 0, effects = [];
  const slots = [];
  return {
    useRef: value => slots[cursor++] ??= { current: value },
    useState: initial => {
      const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useEffect: (run, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) {
        slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = run(); });
      }
    },
    render(run) { cursor = 0; const tree = run(), pending = effects; effects = []; pending.forEach(work => work()); return tree; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function harness(language = 'vi', initialStatus = null) {
  const runtime = hooks(), calls = [], sockets = [], intervals = new Map(), timers = new Map();
  let sequence = 0, status = initialStatus, fallbackStatus = null, failMessages = false, failList = false, held;
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const common = JSON.parse(read(`src/i18n/locales/${language}/common.json`));
  const t = (key, values = {}) => {
    const value = key.startsWith('common:') ? common[key.slice(7)] : key.split('.').reduce((entry, part) => entry?.[part], catalog);
    assert.equal(typeof (value || values.defaultValue), 'string', `Missing copy ${key}`);
    return String(value || values.defaultValue).replace(/{{([^}]+)}}/g, (_, name) => values[name] ?? '');
  };
  const apiClient = async (url, input) => {
    calls.push({ url, input });
    if (url.includes('/messages?')) {
      if (held) await held;
      if (failMessages) throw new Error('Offline');
      return { data: { summary: 'Ca kiểm thử vừa gửi.', messages: [], task_status: status } };
    }
    if (url.startsWith('/api/doctor/tasks?')) {
      if (failList) throw new Error('Directory offline');
      return { data: { tasks: fallbackStatus ? [{ task_id: 'new-task', ...fallbackStatus }] : [] } };
    }
    return { ok: true };
  };
  class Socket {
    constructor() { sockets.push(this); }
    close() {}
  }
  const Screen = evaluate('app/doctor-consultation/[taskId].tsx', {
    react: runtime,
    '../../src/features/doctor-ivr/DoctorIvrEntry': { DoctorIvrEntry: 'IvrEntry' },
    '../../src/lib/native-permissions': { runNativePermission: run => run() },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image-picker': {},
    'expo-router': { Stack: { Screen: 'Stack' }, useLocalSearchParams: () => ({ taskId: 'new-task', tenantId: 'clinic-demo' }) },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    'react-native': { ActivityIndicator: 'Spinner', KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'ios' },
      Pressable: 'Button', ScrollView: 'Scroll', StyleSheet: { create: value => value }, View: 'View', Linking: {}, Image: 'Image' },
    'react-native-svg': { default: 'Svg', Path: 'Path', Circle: 'Circle' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../src/components/ScaledTextInput': { ScaledTextInput: 'Input' },
    '../../src/components/AppAlertModal': { AppAlertModal: 'Alert' },
    '../../src/components/AppActionSheetModal': { AppActionSheetModal: 'Actions' },
    '../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors, isDark: false }) },
    '../../src/hooks/useGuardedRouter': { useGuardedRouter: () => ({ back() {}, replace() {}, push() {} }) },
    '../../src/lib/apiClient': { apiClient, getApiErrorMessage: (_error, translate, key) => translate(key) },
    '../../src/lib/env': { env: { doctorTenantId: 'clinic-demo', apiBaseUrl: 'https://fixture.invalid' } },
    '../../src/lib/tokenStore': { tokenStore: { loadToken: async () => 'fixture-token' } },
    '../../src/stores/toast.store': { showToast() {} }, '../../src/styles': theme, '@/lib/audio': { Audio: {} },
  }, { WebSocket: Socket,
    setInterval: work => { const id = ++sequence; intervals.set(id, work); return id; }, clearInterval: id => intervals.delete(id),
    setTimeout: work => { const id = ++sequence; timers.set(id, work); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: work => work(),
  }).default;
  const render = () => runtime.render(Screen);
  const settle = async () => { let tree; for (let i = 0; i < 7; i++) { tree = render(); await tick(); } return tree; };
  const composer = tree => nodes(tree).find(node => node.type === 'Input' && node.props.placeholder === t('doctorConsultationReplyPlaceholder'));
  const texts = tree => nodes(tree).filter(node => node.type === 'Text').map(node => node.props.children);
  return { calls, sockets, t, render, settle, composer, texts, cleanup: () => runtime.unmount(),
    status(value) { status = value; }, fallback(value) { fallbackStatus = value; }, failList(value) { failList = value; }, failMessages(value) { failMessages = value; },
    hold(value) { held = value; }, poll: async () => { intervals.forEach(work => work()); return settle(); },
    socketOpen: async () => { sockets[0].onopen(); return settle(); },
    lifecycle: async () => { sockets[0].onmessage({ data: JSON.stringify({ type: 'chat.task.status.changed', data: { task_id: 'new-task', status: status?.status } }) }); return settle(); },
  };
}
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

for (const language of ['vi', 'en']) await test(`${language}: a newly queued task without status is syncing, never completed or permanently closed`, async () => {
  const h = harness(language);
  try {
    const tree = await h.settle();
    assert.ok(h.texts(tree).includes(h.t('doctorConsultationStatusSyncing')));
    assert.ok(!h.texts(tree).includes(h.t('doctorConsultationStatus_completed')));
    assert.ok(!h.texts(tree).includes(h.t('doctorConsultationConversationClosed')));
    assert.equal(h.composer(tree), undefined, 'Unknown status never bypasses server write permissions');
    assert.ok(nodes(tree).some(n => n.props.accessibilityLabel === h.t('common:retry')));
  } finally { h.cleanup(); }
});

await test('unknown status keeps polling with WebSocket connected and opens the same task once assigned', async () => {
  const h = harness();
  try {
    await h.settle(); await h.socketOpen(); h.status({ status: 'assigned', rateable: false });
    const tree = await h.poll();
    assert.ok(h.composer(tree)); assert.ok(h.texts(tree).includes(h.t('doctorConsultationStatus_assigned')));
    assert.ok(!h.texts(tree).includes(h.t('doctorConsultationStatus_completed')));
    assert.equal(h.calls.filter(c => c.input?.method === 'POST').length, 0, 'Refreshing does not create a case or send a message');
  } finally { h.cleanup(); }
});

await test('queued -> assigned still polls while chat is connected, before the expert accepts', async () => {
  const h = harness('vi', { status: 'queued', rateable: false });
  try {
    await h.settle(); await h.socketOpen(); h.status({ status: 'assigned', rateable: false });
    assert.ok(h.texts(await h.poll()).includes(h.t('doctorConsultationStatus_assigned')));
  } finally { h.cleanup(); }
});

await test('lifecycle WebSocket updates refresh an active conversation into a real completed state', async () => {
  const h = harness('vi', { status: 'in_progress', rateable: false });
  try {
    assert.ok(h.composer(await h.settle())); await h.socketOpen(); h.status({ status: 'completed', rateable: true });
    const tree = await h.lifecycle();
    assert.equal(h.composer(tree), undefined); assert.ok(h.texts(tree).includes(h.t('doctorConsultationStatus_completed')));
    assert.ok(h.texts(tree).includes(h.t('doctorConsultationConversationClosed')));
  } finally { h.cleanup(); }
});

await test('reconnecting WebSocket refreshes lifecycle changes missed while disconnected', async () => {
  const h = harness('vi', { status: 'in_progress', rateable: false });
  try {
    assert.ok(h.composer(await h.settle())); await h.socketOpen();
    h.status({ status: 'completed', rateable: true });
    assert.equal(h.composer(await h.socketOpen()), undefined);
  } finally { h.cleanup(); }
});

for (const status of ['cancelled', 'expired', 'failed', 'forwarded', 'emergency_referred']) await test(`${status}: actual terminal labels are retained instead of calling every case completed`, async () => {
  const h = harness('vi', { status, rateable: false });
  try {
    const tree = await h.settle(); assert.equal(h.composer(tree), undefined);
    assert.ok(h.texts(tree).includes(h.t(`doctorConsultationStatus_${status}`)));
    assert.ok(!h.texts(tree).includes(h.t('doctorConsultationStatus_completed')));
  } finally { h.cleanup(); }
});

await test('completed follow-up stays messageable only within the server-approved window', async () => {
  const h = harness('vi', { status: 'completed', rateable: true, follow_up_open: true, follow_up_until: new Date(Date.now() + 3600000).toISOString() });
  try { assert.ok(h.composer(await h.settle())); } finally { h.cleanup(); }
});

await test('persisted lifecycle fallback unlocks assigned tasks when the remote status is unavailable', async () => {
  const h = harness(); h.fallback({ status: 'assigned' });
  try { assert.ok(h.composer(await h.settle())); } finally { h.cleanup(); }
});

await test('unavailable status and fallback remain unknown and Retry can recover without a new consultation', async () => {
  const h = harness(); h.failList(true);
  try {
    let tree = await h.settle(); assert.ok(!h.texts(tree).includes(h.t('doctorConsultationStatus_completed')));
    h.failList(false); h.status({ status: 'assigned', rateable: false });
    await nodes(tree).find(n => n.props.accessibilityLabel === h.t('common:retry')).props.onPress(); tree = await h.settle();
    assert.ok(h.composer(tree));
  } finally { h.cleanup(); }
});

await test('polling and realtime bursts do not overlap the initial pending request', async () => {
  const h = harness(); let resolve; h.hold(new Promise(done => { resolve = done; }));
  try {
    await h.settle(); await h.socketOpen(); await h.poll(); await h.poll(); await h.lifecycle();
    assert.equal(h.calls.filter(c => c.url.includes('/messages?')).length, 1);
    h.hold(null); resolve(); await h.settle(); h.status({ status: 'assigned', rateable: false });
    assert.ok(h.composer(await h.poll()));
  } finally { h.cleanup(); }
});

await test('temporary lifecycle outage preserves a typed reply until the known active status returns', async () => {
  const h = harness('vi', { status: 'assigned', rateable: false });
  try {
    let tree = await h.settle(); h.composer(tree).props.onChangeText('Nội dung đang soạn.'); await h.settle();
    h.status(null); tree = await h.lifecycle(); assert.equal(h.composer(tree), undefined);
    h.status({ status: 'assigned', rateable: false }); tree = await h.poll();
    assert.equal(h.composer(tree).props.value, 'Nội dung đang soạn.');
  } finally { h.cleanup(); }
});

console.log(`Doctor conversation lifecycle: ${checks} runtime regressions passed.`);
