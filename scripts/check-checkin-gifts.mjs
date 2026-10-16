import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const jsx = (type, props) => ({ type, props });
function evaluate(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency (no network/wallet allowed): ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const { createCheckinGiftDemo, vietnamGiftDay, DEMO_GIFT_POINTS } = evaluate('src/features/checkin-rewards/checkin-gift-demo.ts');
const date = value => Date.parse(value);
function memory() {
  const values = new Map(), writes = [];
  return {
    values, writes,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); writes.push({ key, value }); },
  };
}
let count = 0;
async function test(label, run) { await run(); count++; console.log(`PASS ${label}`); }
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function hooks() {
  let cursor = 0, effects = [];
  const slots = [];
  const memo = (work, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  return {
    useRef: value => slots[cursor++] ??= { current: value },
    useState: initial => {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useMemo: memo, useCallback: (work, deps) => memo(() => work, deps),
    useEffect: (work, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[index].cleanup = work(); });
      }
    },
    render(work) { cursor = 0; const tree = work(); const pending = effects; effects = []; pending.forEach(run => run()); return tree; },
    async settle(work) { let tree; for (let i = 0; i < 4; i++) { tree = this.render(work); await tick(); } return tree; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];

await test('daily reset follows midnight Vietnam, including month/year boundaries', () => {
  assert.equal(vietnamGiftDay(date('2026-10-16T16:59:59Z')), '2026-10-16');
  assert.equal(vietnamGiftDay(date('2026-10-16T17:00:00Z')), '2026-10-17');
  assert.equal(vietnamGiftDay(date('2026-12-31T17:00:00Z')), '2027-01-01');
});
await test('all six demo point prizes can be drawn and persist before success', async () => {
  for (let i = 0; i < DEMO_GIFT_POINTS.length; i++) {
    const storage = memory();
    const gifts = createCheckinGiftDemo(storage, () => date('2026-10-16T08:00:00Z'), () => (i + 0.5) / 6);
    const receipt = await gifts.open('a', i);
    assert.equal(receipt.points, DEMO_GIFT_POINTS[i]);
    assert.equal(storage.writes.length, 1);
    assert.deepEqual((await gifts.today('a')).receipt, receipt);
  }
});
await test('30 simultaneous box taps and retries grant one receipt and one draw', async () => {
  const storage = memory(); let draws = 0;
  const gifts = createCheckinGiftDemo(storage, Date.now, () => { draws++; return 0.99; });
  const receipts = await Promise.all(Array.from({ length: 30 }, (_, i) => gifts.open('a', i % 6)));
  assert.ok(receipts.every(receipt => receipt.id === receipts[0].id && receipt.box === receipts[0].box));
  assert.equal(storage.writes.length, 1); assert.equal(draws, 1);
  const restarted = createCheckinGiftDemo(storage);
  assert.deepEqual(await restarted.open('a', 5), receipts[0], 'App restart cannot reroll');
  assert.equal((await restarted.today('b')).state, 'available', 'Accounts never share the quota');
});
await test('skipping consumes the day; open/skip races never overwrite a prize or grant twice', async () => {
  const storage = memory(), gifts = createCheckinGiftDemo(storage);
  await gifts.skip('a'); await gifts.skip('a');
  await assert.rejects(gifts.open('a', 0), /skipped/);
  assert.equal(storage.writes.length, 1);
  const [receipt] = await Promise.all([gifts.open('b', 2), gifts.skip('b')]);
  assert.deepEqual((await gifts.today('b')).receipt, receipt);
  const results = await Promise.allSettled([gifts.skip('c'), gifts.open('c', 1)]);
  assert.equal(results[1].status, 'rejected');
  assert.equal((await gifts.today('c')).state, 'skipped');
});
await test('next day opens once again and setting the clock backwards cannot reopen a consumed day', async () => {
  let now = date('2026-10-16T16:59:59Z');
  const storage = memory(), gifts = createCheckinGiftDemo(storage, () => now);
  const first = await gifts.open('a', 0);
  now += 1000;
  assert.equal((await gifts.today('a')).state, 'available');
  const second = await gifts.open('a', 1);
  assert.notEqual(first.id, second.id);
  now -= 1000;
  assert.deepEqual(await gifts.open('a', 4), second);
  assert.equal(storage.writes.length, 2);
});
await test('invalid slots, missing identity and damaged receipts never silently grant gifts', async () => {
  const storage = memory(), gifts = createCheckinGiftDemo(storage);
  for (const slot of [-1, 6, 0.5, NaN]) await assert.rejects(gifts.open('a', slot));
  await assert.rejects(gifts.open(' ', 0));
  assert.equal(storage.writes.length, 0);
  await gifts.open('a', 0);
  const key = storage.writes[0].key;
  for (const raw of ['bad json', 'null', '{}', JSON.stringify({ version: 1, state: 'opened', day: vietnamGiftDay(Date.now()) })]) {
    storage.values.set(key, raw);
    await assert.rejects(gifts.open('a', 0));
  }
  assert.equal(storage.writes.length, 1);
});
await test('a failed write does not claim success and an ambiguous committed write is recovered without rerolling', async () => {
  const storage = memory(); let fail = true;
  const gifts = createCheckinGiftDemo({ ...storage, async setItem(key, value) {
    if (fail) throw new Error('disk failed');
    await storage.setItem(key, value);
  } });
  await assert.rejects(gifts.open('a', 0));
  assert.equal((await gifts.today('a')).state, 'available');
  fail = false; await gifts.open('a', 1);
  let draws = 0;
  const ambiguous = createCheckinGiftDemo({ ...storage, async setItem(key, value) {
    await storage.setItem(key, value); throw new Error('result lost');
  } }, Date.now, () => { draws++; return 0.5; });
  await assert.rejects(ambiguous.open('b', 3));
  const retry = await ambiguous.open('b', 5);
  assert.equal(retry.box, 3); assert.equal(draws, 1);
});

function flowHarness({ storage = memory(), reviewExisting = false, prod = false, language = 'vi' } = {}) {
  const runtime = hooks(), closes = [];
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const t = (key, options = {}) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], catalog);
    assert.equal(typeof value, 'string', `Missing translation ${key}`);
    return value.replace('{{count}}', String(options.count));
  };
  const { CheckinGiftDemoFlow } = evaluate('src/features/checkin-rewards/CheckinGiftDemoFlow.tsx', {
    react: runtime, '@react-native-async-storage/async-storage': storage,
    'react-i18next': { useTranslation: () => ({ t }) },
    '../../components/AppAlertModal': { AppAlertModal: 'Alert' },
    '../auth/auth.store': { useAuthStore: select => select({ profile: { id: 'demo-account' } }) },
    '../../lib/appEnv': { isProdBuild: prod }, './CheckinGiftModal': { CheckinGiftModal: 'Gift' },
    './checkin-gift-demo': { createCheckinGiftDemo },
  });
  const render = () => {
    const child = CheckinGiftDemoFlow({ reviewExisting, onClose: () => closes.push('close') });
    return typeof child?.type === 'function' ? child.type(child.props) : child;
  };
  return { storage, closes, runtime, settle: () => runtime.settle(render) };
}
for (const language of ['vi', 'en']) {
  await test(`${language}: interactive opening persists a clearly labelled demo receipt and allows review without a second prize`, async () => {
    const h = flowHarness({ reviewExisting: true, language });
    let tree = await h.settle();
    assert.equal(tree.type, 'Gift'); assert.equal(tree.props.demo, true);
    tree.props.onClose(); assert.equal(h.storage.writes.length, 0, 'X does not consume the daily turn');
    const next = flowHarness({ storage: h.storage, reviewExisting: true, language });
    tree = await next.settle();
    const receipt = await tree.props.onOpen(3);
    assert.match(receipt.title, language === 'vi' ? /điểm thử/ : /demo points/);
    assert.match(receipt.description, language === 'vi' ? /không cộng vào ví/ : /does not change your wallet/);
    const review = flowHarness({ storage: h.storage, reviewExisting: true, language });
    tree = await review.settle();
    assert.equal(tree.props.initialReceipt.id, receipt.id);
    assert.equal(h.storage.writes.length, 1);
    const automatic = flowHarness({ storage: h.storage, language });
    await automatic.settle(); assert.deepEqual(automatic.closes, ['close']);
  });
}
await test('skipped gifts show an explanation in the demo and never interrupt a later health-result close', async () => {
  const h = flowHarness({ reviewExisting: true });
  let tree = await h.settle(); await tree.props.onSkip();
  const review = flowHarness({ storage: h.storage, reviewExisting: true });
  tree = await review.settle(); assert.equal(tree.type, 'Alert'); assert.match(tree.props.message, /bỏ lượt/);
  tree.props.onDismiss(); assert.deepEqual(review.closes, ['close']);
  const automatic = flowHarness({ storage: h.storage });
  await automatic.settle(); assert.deepEqual(automatic.closes, ['close']);
});
await test('production never touches demo storage; storage failure never blocks closing a completed check-in', async () => {
  const storage = { async getItem() { throw new Error('unavailable'); } };
  const production = flowHarness({ prod: true, storage });
  await production.settle(); assert.deepEqual(production.closes, ['close']);
  const automatic = flowHarness({ storage });
  await automatic.settle(); assert.deepEqual(automatic.closes, ['close']);
  const explicit = flowHarness({ storage, reviewExisting: true });
  assert.equal((await explicit.settle()).type, 'Alert');
});

function buttonHarness({ eligible = true, disabled = false, prod = false, before = async () => {} } = {}) {
  const runtime = hooks(), calls = [];
  const { CheckinGiftCloseButton } = evaluate('src/features/checkin-rewards/CheckinGiftCloseButton.tsx', {
    react: runtime, 'react-native': { Pressable: 'Button' },
    '../../lib/appEnv': { isProdBuild: prod }, './CheckinGiftDemoFlow': { CheckinGiftDemoFlow: 'GiftFlow' },
  });
  const render = () => CheckinGiftCloseButton({ eligible, disabled,
    onBeforeClose: async () => { calls.push('stop audio'); await before(); }, onClose: () => calls.push('leave') });
  return { calls, render: () => runtime.render(render) };
}
await test('closing stops audio first, repeated taps cannot reopen, and dismissing the gift navigates once', async () => {
  let resolve;
  const h = buttonHarness({ before: () => new Promise(done => { resolve = done; }) });
  const button = nodes(h.render()).find(node => node.type === 'Button');
  const closing = button.props.onPress(); await button.props.onPress();
  assert.deepEqual(h.calls, ['stop audio']);
  assert.ok(!nodes(h.render()).some(node => node.type === 'GiftFlow'));
  resolve(); await closing;
  const flow = nodes(h.render()).find(node => node.type === 'GiftFlow'); assert.ok(flow);
  flow.props.onClose(); assert.deepEqual(h.calls, ['stop audio', 'leave']);
});
await test('preview/urgent/practice eligibility and production gates keep the original close action', async () => {
  for (const options of [{ eligible: false }, { prod: true }, { eligible: false, before: async () => { throw new Error('audio failed'); } }]) {
    const h = buttonHarness(options);
    await nodes(h.render()).find(node => node.type === 'Button').props.onPress();
    assert.deepEqual(h.calls, ['stop audio', 'leave']);
    assert.ok(!nodes(h.render()).some(node => node.type === 'GiftFlow'));
  }
  const readOnly = buttonHarness({ disabled: true });
  await nodes(readOnly.render()).find(node => node.type === 'Button').props.onPress();
  assert.deepEqual(readOnly.calls, []);
});

function modalHarness(options = {}) {
  const runtime = hooks(), calls = { opens: [], closes: 0, received: [] };
  const catalog = JSON.parse(read('src/i18n/locales/vi/home.json'));
  const { CheckinGiftModal } = evaluate('src/features/checkin-rewards/CheckinGiftModal.tsx', {
    react: runtime, '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-i18next': { useTranslation: () => ({ t: (key, values = {}) => key.split('.').reduce((entry, part) => entry[part], catalog)
      .replace('{{number}}', String(values.number)) }) },
    'react-native': { View: 'View', Pressable: 'Button', ScrollView: 'Scroll', ActivityIndicator: 'Spinner',
      StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    '../../components/QueuedModal': { QueuedModal: 'Modal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
    '../../../assets/images/rewards/checkin-gift.png': 'gift.png',
  });
  const props = { visible: true, demo: true, onClose: () => calls.closes++, onSkip: async () => {},
    onOpen: async box => { calls.opens.push(box); return options.open ? options.open(box) : { id: 'sample', title: '20 điểm thử' }; },
    onReceived: receipt => calls.received.push(receipt), ...options.props };
  return { calls, settle: () => runtime.settle(() => CheckinGiftModal(props)) };
}
await test('real gift modal guards duplicate taps and closing during a pending opening, then shows the received prize', async () => {
  let resolve;
  const h = modalHarness({ open: () => new Promise(done => { resolve = done; }) });
  let tree = await h.settle();
  const boxes = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  boxes[0].props.onPress(); boxes[1].props.onPress();
  nodes(tree).find(node => node.type === 'Button' && node.props.accessibilityLabel === 'Đóng hộp quà').props.onPress();
  assert.deepEqual(h.calls.opens, [0]); assert.equal(h.calls.closes, 0);
  resolve({ id: 'sample', title: '50 điểm thử' }); await tick(); tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === '50 điểm thử'));
  assert.equal(h.calls.received.length, 1);
  assert.equal(nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp')).length, 0);
});
await test('gift UI gallery remains read-only even if its old callbacks are invoked', async () => {
  const h = modalHarness({ props: { readOnly: true } });
  const tree = await h.settle();
  assert.equal(nodes(tree).some(node => node.type === 'Modal'), false, 'Inline previews do not request a native modal');
  for (const node of nodes(tree).filter(item => item.type === 'Button')) {
    assert.equal(node.props.disabled, true);
    await node.props.onPress?.();
  }
  assert.deepEqual(h.calls.opens, []); assert.equal(h.calls.closes, 0);
});
console.log(`Check-in gifts: ${count} runtime regressions passed.`);
