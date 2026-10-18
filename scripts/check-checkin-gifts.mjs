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
const { giftPrizeImage } = evaluate('src/features/checkin-rewards/gift-prize-assets.ts', {
  '../../../assets/iphone-18-pro-01_5-1.webp': 180018,
});
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
await test('legacy skipped demo receipts remain readable without offering a new skip action', async () => {
  const h = flowHarness({ reviewExisting: true });
  let tree = await h.settle(); assert.equal(tree.props.onSkip, undefined);
  await createCheckinGiftDemo(h.storage).skip('demo-account');
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
    './CheckinGiftFlow': { CheckinGiftFlow: 'GiftFlow' },
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
await test('preview/practice eligibility keeps the original close action while production uses server gifts', async () => {
  for (const options of [{ eligible: false }, { eligible: false, before: async () => { throw new Error('audio failed'); } }]) {
    const h = buttonHarness(options);
    await nodes(h.render()).find(node => node.type === 'Button').props.onPress();
    assert.deepEqual(h.calls, ['stop audio', 'leave']);
    assert.ok(!nodes(h.render()).some(node => node.type === 'GiftFlow'));
  }
  const readOnly = buttonHarness({ disabled: true });
  await nodes(readOnly.render()).find(node => node.type === 'Button').props.onPress();
  assert.deepEqual(readOnly.calls, []);
  const production = buttonHarness({ prod: true });
  await nodes(production.render()).find(node => node.type === 'Button').props.onPress();
  assert.ok(nodes(production.render()).some(node => node.type === 'GiftFlow'));
});

function animationHarness(automatic = true) {
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate(ranges) { return { value: this, ...ranges }; }
  }
  const pending = [], timings = [];
  const motion = run => {
    let callback;
    const animation = {
      run,
      start(done) {
        callback = done;
        pending.push(animation);
        if (automatic) Promise.resolve().then(() => animation.finish());
      },
      finish() {
        const index = pending.indexOf(animation);
        if (index < 0) return;
        pending.splice(index, 1); run(); callback?.({ finished: true });
      },
      stop() {
        const index = pending.indexOf(animation);
        if (index >= 0) { pending.splice(index, 1); callback?.({ finished: false }); }
      },
    };
    return animation;
  };
  return {
    pending, timings, finishNext: () => pending[0]?.finish(),
    Animated: {
      Value, View: 'AnimatedView',
      timing(value, config) { timings.push(config); return motion(() => value.setValue(config.toValue)); },
      sequence: items => motion(() => items.forEach(item => item.run())),
    },
  };
}
function modalHarness(options = {}) {
  const runtime = hooks(), calls = { opens: [], closes: 0, received: [] };
  const animations = animationHarness(options.automaticAnimation ?? true);
  const catalog = JSON.parse(read('src/i18n/locales/vi/home.json'));
  const { CheckinGiftModal } = evaluate('src/features/checkin-rewards/CheckinGiftModal.tsx', {
    react: runtime, '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-i18next': { useTranslation: () => ({ t: (key, values = {}) => key.split('.').reduce((entry, part) => entry[part], catalog)
      .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')) }) },
    'react-native': { View: 'View', Pressable: 'Button', ScrollView: 'Scroll', ActivityIndicator: 'Spinner',
      Animated: animations.Animated, Easing: { cubic: 'cubic', out: value => value },
      AccessibilityInfo: { isReduceMotionEnabled: async () => options.reduceMotion ?? false,
        addEventListener: () => ({ remove() {} }) },
      StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    '../../components/QueuedModal': { QueuedModal: 'Modal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
    '../../../assets/images/rewards/checkin-gift.png': 'gift.png',
    '../../../assets/images/rewards/box_opening_stage.png': 'box_opening_stage.png',
    '../../../assets/iphone-18-pro-01_5-1.webp': 180018,
    ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`../../../assets/images/rewards/box_${i + 1}.png`, `box_${i + 1}.png`])),
  });
  const props = { visible: true, demo: true, onClose: () => calls.closes++,
    onOpen: async box => { calls.opens.push(box); return options.open ? options.open(box) : { id: 'sample', title: '20 điểm thử' }; },
    onReceived: receipt => calls.received.push(receipt), ...options.props };
  return { calls, props, runtime, animations, settle: () => runtime.settle(() => CheckinGiftModal(props)) };
}
await test('real gift modal guards duplicate taps and closing during a pending opening, then shows the received prize', async () => {
  let resolve;
  const h = modalHarness({ open: () => new Promise(done => { resolve = done; }) });
  let tree = await h.settle();
  const boxes = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  boxes[0].props.onPress(); boxes[1].props.onPress();
  nodes(tree).find(node => node.type === 'Modal').props.onRequestClose();
  assert.deepEqual(h.calls.opens, [0]); assert.equal(h.calls.closes, 0);
  resolve({ id: 'sample', title: '50 điểm thử' }); await tick(); tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === '50 điểm thử'));
  assert.equal(h.calls.received.length, 1);
  assert.equal(nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp')).length, 0);
});
await test('an available gift requires a choice: no skip, close button or Android Back dismissal before success', async () => {
  let failed = true;
  const h = modalHarness({ open: async box => {
    if (failed) throw new Error('offline');
    return { id: 'saved', box, title: 'Lộc của bạn' };
  } });
  let tree = await h.settle();
  const prompt = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'Hãy chọn 1 hộp quà'));
  assert.ok(prompt); assert.equal(prompt.props.disabled, true);
  prompt.props.onPress();
  nodes(tree).find(node => node.type === 'Modal').props.onRequestClose();
  assert.equal(h.calls.closes, 0); assert.deepEqual(h.calls.opens, []);
  assert.ok(!nodes(tree).some(node => node.props.accessibilityLabel === 'Đóng hộp quà'));
  assert.ok(!nodes(tree).some(node => node.type === 'Text' && /Bỏ lượt/.test(node.props.children)));
  const choose = value => nodes(value).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 3');
  choose(tree).props.onPress(); tree = await h.settle();
  nodes(tree).find(node => node.type === 'Modal').props.onRequestClose();
  assert.equal(h.calls.closes, 0, 'An unsuccessful save does not consume or bypass the choice');
  assert.ok(choose(tree)); failed = false;
  choose(tree).props.onPress(); tree = await h.settle();
  const done = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'Tuyệt quá'));
  assert.equal(done.props.disabled, false); done.props.onPress(); assert.equal(h.calls.closes, 1);
  assert.ok(nodes(tree).some(node => node.props.accessibilityLabel === 'Đóng hộp quà'));
  assert.equal(nodes(tree).find(node => node.type === 'Modal').props.interruptible, true, 'Urgent health dialogs can still interrupt gifts');
});
await test('six revealed slots contain exactly one saved gift and five clearly labelled examples, including one illustrative phone', async () => {
  for (let box = 0; box < 6; box++) {
    const h = modalHarness({ props: { demo: false, initialReceipt: { id: 'saved', box, title: 'Chúc bạn bình yên.' } } });
    const tree = await h.settle();
    const grid = nodes(tree).find(node => node.props.testID === 'gift-result-grid');
    assert.ok(grid);
    const received = nodes(grid).filter(node => /^gift-received-/.test(node.props.testID || ''));
    const examples = nodes(grid).filter(node => /^gift-preview-/.test(node.props.testID || ''));
    assert.equal(received.length, 1); assert.equal(received[0].props.testID, `gift-received-${box}`);
    assert.equal(examples.length, 5);
    assert.ok(received[0].props.accessibilityLabel.startsWith('Đã nhận: Chúc bạn bình yên.'));
    assert.ok(examples.every(node => node.props.accessibilityLabel.startsWith('Minh họa:')));
    assert.equal(new Set(examples.map(node => node.props.accessibilityLabel)).size, 5);
    assert.equal(nodes(examples).filter(node => node.type === 'Image' && node.props.source === 180018).length, 1);
    assert.equal(nodes(received).filter(node => node.type === 'Image' && node.props.source === 180018).length, 0);
    assert.ok(nodes(tree).some(node => node.type === 'Text' && /không phải kết quả bốc quà/.test(node.props.children)));
    assert.deepEqual(h.calls.opens, [], 'Reviewing illustrative boxes never makes another claim');
    assert.equal(nodes(grid).some(node => node.type === 'Button'), false, 'Revealed boxes cannot be selected again');
  }
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
await test('the tapped box opens in its own slot and reveals only after the server and opening animation finish', async () => {
  const h = modalHarness({ automaticAnimation: false, open: async box => ({ id: 'fortune', box, title: 'Một ngày bình yên' }) });
  let tree = await h.settle();
  const choose = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  choose[4].props.onPress(); tree = await h.settle();
  const opening = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  assert.equal(opening.length, 6, 'Keep the chosen box in its original position');
  assert.deepEqual(opening.map(box => box.props.accessibilityState.selected), [false, false, false, false, true, false]);
  assert.ok(opening.every(box => box.props.disabled));
  const lid = nodes(opening[4]).find(node => node.props.testID === 'gift-box-lid-4');
  assert.equal(typeof lid.props.style.transform[0].translateY, 'object', 'The selected lid is animated');
  assert.equal(nodes(opening[3]).find(node => node.props.testID === 'gift-box-lid-3').props.style.transform[0].translateY, 0);
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Đang mở hộp quà số 5…'));
  assert.ok(!nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Một ngày bình yên'));
  assert.equal(h.calls.received.length, 1, 'Publish a saved receipt without waiting for the cosmetic animation');
  h.animations.finishNext(); tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Một ngày bình yên'));
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-box-art-4'));
  assert.ok(!nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Chọn 1 hộp quà để mở'));
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Bạn đã nhận lộc hôm nay'));
  assert.ok(h.animations.timings.every(config => config.useNativeDriver));
  h.props.visible = false; await h.settle(); h.props.visible = true; tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Một ngày bình yên'));
  assert.deepEqual(h.calls.opens, [4], 'Hiding and showing the modal keeps the receipt');
});
await test('a delayed gift response waits for success, and reduced motion skips opening animation', async () => {
  let resolve;
  const h = modalHarness({ reduceMotion: true, open: () => new Promise(done => { resolve = done; }) });
  const tree = await h.settle();
  nodes(tree).find(node => node.type === 'Button' && node.props.accessibilityLabel === 'Mở hộp quà số 2').props.onPress();
  assert.equal(h.animations.pending.length, 0);
  assert.equal(h.calls.received.length, 0);
  resolve({ id: 'saved', box: 1, title: 'Lộc đã lưu' });
  assert.ok(nodes(await h.settle()).some(node => node.type === 'Text' && node.props.children === 'Lộc đã lưu'));
  assert.equal(h.animations.timings.length, 0);
});
await test('an opening error can be retried and the server’s first saved box is used on recovery', async () => {
  let failed = true;
  const h = modalHarness({ open: async () => { if (failed) throw new Error('offline'); return { id: 'saved', box: 1, title: 'Quà ban đầu' }; } });
  let tree = await h.settle();
  nodes(tree).find(node => node.type === 'Button' && node.props.accessibilityLabel === 'Mở hộp quà số 2').props.onPress();
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(h.calls.received.length, 0);
  failed = false;
  nodes(tree).find(node => node.type === 'Button' && node.props.accessibilityLabel === 'Mở hộp quà số 6').props.onPress();
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-box-art-1'));
  assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-box-art-5'));
  assert.equal(h.calls.received.length, 1);
});
await test('an unmounted gift modal never reveals or publishes a late receipt', async () => {
  let resolve;
  const h = modalHarness({ automaticAnimation: false, open: () => new Promise(done => { resolve = done; }) });
  const tree = await h.settle();
  nodes(tree).find(node => node.type === 'Button' && node.props.accessibilityLabel === 'Mở hộp quà số 1').props.onPress();
  h.runtime.unmount();
  resolve({ id: 'private', box: 0, title: 'Late receipt' }); await tick();
  assert.equal(h.calls.received.length, 0); assert.equal(h.animations.pending.length, 0);
});
function productionFlowHarness({ today, open, reviewExisting = false, language = 'vi', status = 'fine' } = {}) {
  const runtime = hooks(), calls = { today: 0, open: [], close: 0, unavailable: 0, opened: [] };
  const account = { profile: { id: 'parent-account' } };
  const useAuthStore = select => select(account); useAuthStore.getState = () => account;
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const t = (key, values = {}) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], catalog);
    assert.equal(typeof value, 'string', `Missing production gift copy ${key}`);
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
  };
  const gift = { id: '385c91ce-191f-4d8d-b4cb-af8ccbc2ed59', day: '2026-10-17', openedAt: null, box: null, loc: null, extra: null, ticket: null };
  const receipt = { ...gift, openedAt: '2026-10-17T01:00:00Z', box: 2, loc: { type: 'wish', text: 'Chúc bạn một ngày bình yên.', serif: false }, extra: 'none' };
  const { CheckinGiftFlow } = evaluate('src/features/checkin-rewards/CheckinGiftFlow.tsx', {
    react: runtime,
    'expo-router': { useFocusEffect: callback => runtime.useEffect(callback, [callback]) },
    'react-native': { View: 'View', Pressable: 'Button' },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push() {} }) },
    '../../components/QueuedModal': { QueuedModal: 'Modal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../auth/auth.store': { useAuthStore }, './CheckinGiftModal': { CheckinGiftModal: 'Gift' },
    './gift-prize-assets': { giftPrizeImage },
    './checkin-gifts.api': { checkinGiftsApi: {
      today: async () => { calls.today++; return today ? today({ gift, receipt }) : { enabled: true, gift }; },
      open: async (id, box) => { calls.open.push([id, box]); return open ? open({ gift, receipt }) : { gift: receipt }; },
    } },
  });
  const render = () => {
    let tree = CheckinGiftFlow({ reviewExisting, status, onOpened: gift => calls.opened.push(gift), onClose: () => calls.close++, onUnavailable: () => calls.unavailable++ });
    while (typeof tree?.type === 'function') tree = tree.type(tree.props);
    return tree;
  };
  return { calls, account, runtime, settle: () => runtime.settle(render), t };
}
for (const language of ['vi', 'en']) await test(`${language}: production opens the immutable server receipt and never generates local points`, async () => {
  const h = productionFlowHarness({ language }); const tree = await h.settle();
  assert.equal(tree.type, 'Gift'); assert.equal(Boolean(tree.props.identicalBoxes), false);
  const receipt = await tree.props.onOpen(5);
  assert.deepEqual(h.calls.open, [['385c91ce-191f-4d8d-b4cb-af8ccbc2ed59', 5]]);
  assert.equal(receipt.title, 'Chúc bạn một ngày bình yên.');
  assert.equal(receipt.box, 2, 'Carry the canonical server box into the opened illustration');
  assert.equal(h.calls.opened[0].openedAt, '2026-10-17T01:00:00Z');
  assert.doesNotMatch(JSON.stringify(receipt), /points|value_vnd|store_code|1199000/);
});
await test('viewing an opened fortune keeps the receipt without another claim', async () => {
  const h = productionFlowHarness({ reviewExisting: true, today: ({ receipt }) => ({ enabled: true, gift: receipt }) });
  const tree = await h.settle(); assert.equal(tree.props.initialReceipt.title, 'Chúc bạn một ngày bình yên.'); assert.deepEqual(h.calls.open, []);
});
await test('automatic offerings that are already opened return control to the health result', async () => {
  const h = productionFlowHarness({ today: ({ receipt }) => ({ enabled: true, gift: receipt }) });
  assert.equal(await h.settle(), null); assert.equal(h.calls.unavailable, 1); assert.equal(h.calls.close, 0);
});
await test('a gift network error offers Retry and Later without reporting a failed health save', async () => {
  let failed = true;
  const h = productionFlowHarness({ today: ({ gift }) => { if (failed) throw new Error('offline'); return { enabled: true, gift }; } });
  const tree = await h.settle(); assert.equal(tree.type, 'Modal'); assert.equal(tree.props.interruptible, true);
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === h.t('checkinGift.savedHealthError')));
  const retry = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === h.t('checkinGift.retry')));
  failed = false; retry.props.onPress(); assert.equal((await h.settle()).type, 'Gift');
});
await test('an account change while opening cannot publish the former account’s receipt', async () => {
  let resolve;
  const h = productionFlowHarness({ open: () => new Promise(done => { resolve = done; }) });
  const tree = await h.settle(), pending = tree.props.onOpen(0);
  h.account.profile.id = 'other-account'; resolve({ gift: { id: 'old', loc: { text: 'private fortune' } } });
  await assert.rejects(pending, /account changed/);
  assert.deepEqual(h.calls.opened, []);
});
await test('the three health responses keep their gifts while unwell results also retain a notice', async () => {
  for (const status of ['fine', 'tired', 'very_tired']) {
    const h = productionFlowHarness({ status }); const tree = await h.settle();
    assert.equal(tree.type, 'Gift'); assert.equal(Boolean(tree.props.notice), status !== 'fine');
  }
});
await test('all six boxes have distinct Asinu mascot illustrations and 56px or larger touch targets', async () => {
  const h = modalHarness();
  const tree = await h.settle();
  const boxes = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  assert.equal(boxes.length, 6);
  assert.equal(new Set(boxes.map(box => nodes(box).find(node => node.type === 'Image').props.source)).size, 6);
  for (const box of boxes) assert.ok(box.props.style({ pressed: false })[0].minHeight >= 56);
});
await test('identicalBoxes option makes all six boxes use the fallback gift image', async () => {
  const h = modalHarness({ props: { identicalBoxes: true } });
  const tree = await h.settle();
  const boxes = nodes(tree).filter(node => node.type === 'Button' && node.props.accessibilityLabel?.startsWith('Mở hộp'));
  assert.equal(boxes.length, 6);
  assert.equal(new Set(boxes.map(box => nodes(box).find(node => node.type === 'Image').props.source)).size, 1);
});
await test('production gift modules never import the demo quota, payment, wallet or a random client draw', () => {
  for (const file of ['CheckinGiftFlow.tsx', 'checkin-gifts.api.ts', 'GiftDetailScreen.tsx']) assert.doesNotMatch(read(`src/features/checkin-rewards/${file}`), /AsyncStorage|Math\.random|DEMO_GIFT_POINTS|createCheckinGiftDemo|from.*iap|from.*wallet/);
});
await test('gift notification taps use validated identifiers and never follow arbitrary server links', () => {
  const source = ts.createSourceFile('notifications.ts', read('src/lib/notifications.ts'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'routeFromNotificationData');
  assert.ok(declaration);
  const module = { exports: {} };
  const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', code)(module, module.exports);
  const route = module.exports.routeFromNotificationData;
  const gift = '591ad9fe-1cb3-4f39-b120-a894d22a1150';
  assert.deepEqual(route({ type: 'gift_opened', giftId: gift, screen: 'https://untrusted.invalid' }), { pathname: '/checkin-rewards/receipt', params: { gift } });
  assert.equal(route({ type: 'gift_opened', giftId: '../private' }), '/checkin-rewards/history');
  assert.deepEqual(route({ type: 'gift_draw_result', drawPeriodId: '12' }), { pathname: '/checkin-rewards/results', params: { period: '12' } });
  assert.equal(route({ type: 'gift_draw_result', drawPeriodId: 'https://untrusted.invalid' }), '/checkin-rewards/history');
  assert.equal(route({ type: 'morning_checkin' }), '/checkin');
});
function homeHarness(today) {
    const runtime=hooks(), account={profile:{id:'parent'}}, callbacks=[];
    const useAuthStore=select=>select(account);useAuthStore.getState=()=>account;
    const {HomeGiftCard}=evaluate('src/features/checkin-rewards/HomeGiftCard.tsx',{
      react:runtime,'react-native':{View:'View',Pressable:'Button',AppState:{addEventListener:(_type,cb)=>{callbacks.push(cb);return {remove(){}};}}},
      'expo-router':{useFocusEffect:cb=>runtime.useEffect(cb,[cb])},'@expo/vector-icons':{Ionicons:'Icon'},
      'react-i18next':{useTranslation:()=>({t:key=>key})},'../../components/ScaledText':{ScaledText:'Text'},
      '../../hooks/useThemeColors':{useThemeColors:()=>({colors:{}})},'../../hooks/useGuardedRouter':{useGuardedRouter:()=>({push(){}})},
      '../auth/auth.store':{useAuthStore},'./CheckinGiftFlow':{CheckinGiftFlow:'Gift'},
      './checkin-gifts.api':{checkinGiftsApi:{today}},
    });
    const render=()=>{const root=HomeGiftCard();return root.type(root.props);};
    return { account, callbacks, settle: () => runtime.settle(render) };
}
await test('returning from a call offers its gift once and keeps routine Home visits free of automatic gifts', async () => {
  for (const call of [true, false]) {
    const h=homeHarness(async()=>({enabled:true,gift:{id:'daily-gift',openedAt:null},streak:1,week:[],offerOnAppOpen:call,checkinStatus:'tired'}));
    const tree=await h.settle();
    const modal=nodes(tree).find(node=>node.type==='Gift');
    assert.equal(Boolean(modal),call);
    if(modal){modal.props.onClose();await h.settle();h.callbacks.at(-1)('active');await tick();assert.equal(nodes(await h.settle()).some(node=>node.type==='Gift'),false);}
  }
});
await test('Home switches to review immediately after a saved gift even when a refresh is late or offline', async () => {
  const day = { enabled: true, gift: { id: 'today', openedAt: null, box: null }, streak: 1, week: [] };
  const saved = { ...day.gift, openedAt: '2026-10-17T08:30:00Z', box: 2 };
  let requests = 0, resolveStale;
  const h = homeHarness(async () => {
    requests++;
    if (requests === 2) return new Promise(resolve => { resolveStale = resolve; });
    if (requests === 3) throw new Error('offline');
    return day;
  });
  let tree = await h.settle();
  const texts = value => nodes(value).filter(node => node.type === 'Text').map(node => node.props.children);
  assert.ok(texts(tree).includes('checkinGift.choose'));
  h.callbacks.at(-1)('active');
  const open = nodes(tree).find(node => node.type === 'Button' && texts(node).includes('checkinGift.choose'));
  open.props.onPress(); tree = await h.settle();
  const flow = nodes(tree).find(node => node.type === 'Gift');
  flow.props.onOpened(saved); tree = await h.settle();
  assert.ok(texts(tree).includes('checkinGift.review'));
  assert.ok(!texts(tree).includes('checkinGift.choose'));
  flow.props.onClose(); tree = await h.settle();
  assert.ok(texts(tree).includes('checkinGift.review'), 'Offline refresh keeps the confirmed open');
  resolveStale(day); tree = await h.settle();
  assert.ok(texts(tree).includes('checkinGift.review'), 'A pending older refresh cannot overwrite success');
  h.callbacks.at(-1)('active'); tree = await h.settle();
  assert.ok(texts(tree).includes('checkinGift.review'), 'A stale copy of the same gift cannot undo an open');
  assert.ok(!nodes(tree).some(node => node.type === 'Gift'), 'The saved gift is not offered again automatically');
});
await test('Home accepts the next day’s new gift and ignores a previous account’s opening callback', async () => {
  let day = { enabled: true, gift: { id: 'first-day', openedAt: null }, streak: 1, week: [] };
  const h = homeHarness(async () => day);
  let tree = await h.settle();
  const choose = value => nodes(value).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'checkinGift.choose'));
  choose(tree).props.onPress(); tree = await h.settle();
  const flow = nodes(tree).find(node => node.type === 'Gift');
  flow.props.onOpened({ ...day.gift, openedAt: '2026-10-17T08:30:00Z' });
  flow.props.onClose(); await h.settle();
  day = { ...day, gift: { id: 'second-day', openedAt: null } };
  h.callbacks.at(-1)('active'); tree = await h.settle();
  assert.ok(choose(tree), 'Tomorrow’s turn stays available');
  choose(tree).props.onPress(); tree = await h.settle();
  const stale = nodes(tree).find(node => node.type === 'Gift');
  h.account.profile.id = 'other-account';
  stale.props.onOpened({ ...day.gift, openedAt: '2026-10-18T08:30:00Z' });
  assert.ok(choose(await h.settle()), 'Old callbacks cannot publish an opened state for a different account');
});
await test('ticket prize details still require a server ticket and never mean the phone has been awarded', async () => {
  assert.equal(giftPrizeImage('iPhone 18'), 180018);
  assert.equal(giftPrizeImage('iPhone 17'), undefined);
  assert.equal(giftPrizeImage(null), undefined);
  const ordinary = await productionFlowHarness().settle();
  assert.equal((await ordinary.props.onOpen(0)).prizeImage, undefined);
  const ticket = productionFlowHarness({open:({receipt})=>({gift:{...receipt,extra:'ticket',ticket:{number:'A1049',periodId:'7',prize:'iPhone 18',drawAt:'2026-10-31T10:00:00Z'}}})});
  const receipt = await (await ticket.settle()).props.onOpen(0);
  assert.equal(receipt.prizeImage,180018);
  assert.match(receipt.description,/cơ hội trúng iPhone 18/);
  const normal=modalHarness({props:{demo:false,initialReceipt:{id:'fortune',title:'Lời chúc'}}});
  assert.ok(!nodes(await normal.settle()).some(node=>node.type==='Image'&&node.props.source===180018));
  const shown=modalHarness({props:{demo:false,initialReceipt:receipt}});
  assert.ok(nodes(await shown.settle()).some(node=>node.type==='Image'&&node.props.source===180018));
});
console.log(`Check-in gifts: ${count} runtime regressions passed.`);
