import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const jsx = (type, props) => ({ type, props });
function evaluate(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency (no network/wallet allowed): ${id}`);
    return dependencies[id];
  }, ...Object.values(globals));
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

function replayTools(api, { dev = false, appDev = dev, account = 'parent-account', apiUrl = 'http://localhost:3300', replayUrl = apiUrl, randomByte = () => 0 } = {}) {
  return evaluate('src/features/checkin-rewards/checkin-gift-replay.ts', {
    '../../lib/appEnv': { isDevBuild: appDev },
    '../../lib/env': { env: { apiBaseUrl: apiUrl } },
    './checkin-gifts.api': { checkinGiftsApi: api },
    'expo-crypto': { getRandomBytes: size => { assert.equal(size, 1); return Uint8Array.of(randomByte()); } },
  }, { __DEV__: dev, process: { env: {
    EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_ACCOUNT_ID: account,
    EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_API_BASE_URL: replayUrl,
  } } });
}

await test('gift replay requires a development build, the opted-in account and the configured API', () => {
  for (const options of [
    {}, { dev: true, appDev: false }, { dev: true, replayUrl: 'https://another-api.invalid' },
    { dev: true, account: '' }, { dev: true, replayUrl: '' },
  ]) assert.equal(replayTools({}, options).canReplayCheckinGift('parent-account'), false);
  const tools = replayTools({}, { dev: true });
  assert.equal(tools.canReplayCheckinGift('parent-account'), true);
  assert.equal(tools.canReplayCheckinGift('other-account'), false);
});

await test('local replay can use the latest receipt without inventing a check-in or touching the daily quota', async () => {
  const day = { enabled: true, gift: null, streak: 0, week: [] };
  const receipt = { id: 'old-receipt', openedAt: '2026-10-19T01:00:00Z' };
  let historyCalls = 0;
  const api = { today: async () => day, history: async () => { historyCalls++; return { items: [receipt] }; } };
  const tools = replayTools(api, { dev: true });
  assert.equal((await tools.loadCheckinGiftDay('parent-account', true)).gift, receipt);
  assert.equal(day.gift, null, 'The server day is not mutated');
  assert.equal(historyCalls, 1);
  assert.equal(await tools.loadCheckinGiftDay('parent-account'), day);
  assert.equal(await tools.loadCheckinGiftDay('other-account', true), day);
  assert.equal(await replayTools(api).loadCheckinGiftDay('parent-account', true), day);
  assert.equal(historyCalls, 1, 'Production, other accounts and automatic check-in offers never load a replay receipt');
});

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
      parallel: items => motion(() => items.forEach(item => item.run())),
    },
  };
}
function giftClock() {
  let now = 0, sequence = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout(callback, delay) { const id = ++sequence; pending.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { pending.delete(id); },
    async advance(milliseconds, settle) {
      const target = now + milliseconds;
      while (true) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at; pending.delete(next[0]); next[1].callback(); await settle();
      }
      now = target;
      return settle();
    },
  };
}
function modalHarness(options = {}) {
  const runtime = hooks(), calls = { opens: [], closes: 0, received: [] };
  const animations = animationHarness(options.automaticAnimation ?? true);
  const clock = giftClock();
  const catalog = JSON.parse(read('src/i18n/locales/vi/home.json'));
  const { CheckinGiftModal } = evaluate('src/features/checkin-rewards/CheckinGiftModal.tsx', {
    react: runtime, '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop' },
    'react-i18next': { useTranslation: () => ({ t: (key, values = {}) => key.split('.').reduce((entry, part) => entry[part], catalog)
      .replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')) }) },
    'react-native': { View: 'View', Pressable: 'Button', ScrollView: 'Scroll', ActivityIndicator: 'Spinner',
      Animated: animations.Animated, Easing: { cubic: 'cubic', linear: 'linear', out: value => value },
      AccessibilityInfo: { isReduceMotionEnabled: async () => options.reduceMotion ?? false,
        addEventListener: () => ({ remove() {} }) },
      StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    '../../components/QueuedModal': { QueuedModal: 'Modal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
    '../../hooks/useScaledTypography': { useScaledFontSize: size => size * (options.fontScale ?? 1) },
    '../../../assets/images/rewards/checkin-gift.png': 'gift.png',
    '../../../assets/images/rewards/gift-open-box.png': 'gift-open-box.png',
    '../../../assets/asinu_chat_sticker.png': 'mascot.png',
    '../../../assets/images/rewards/box_opening_stage.png': 'box_opening_stage.png',
    '../../../assets/iphone-18-pro-01_5-1.webp': 180018,
    '../../../assets/images/rewards/opened_gift_mascot_hero.png': 'opened_gift_mascot_hero.png',
    '../../../assets/images/rewards/fortune_heart_header.png': 'fortune_heart_header.png',
    '../../../assets/images/rewards/fortune_branch_left.png': 'fortune_branch_left.png',
    '../../../assets/images/rewards/daily_reward_box_ticket.png': 'daily_reward_box_ticket.png',
    '../../../assets/images/rewards/daily_reward_box_phone.png': 'daily_reward_box_phone.png',
    '../../../assets/images/rewards/daily_reward_box_book.png': 'daily_reward_box_book.png',
    '../../../assets/images/rewards/daily_reward_box_bulb.png': 'daily_reward_box_bulb.png',
    '../../../assets/images/rewards/daily_reward_box_coupon.png': 'daily_reward_box_coupon.png',
    '../../../assets/images/rewards/daily_reward_box_wish.png': 'daily_reward_box_wish.png',
    ...Object.fromEntries(['ticket', 'wish', 'proverb', 'tip', 'coupon'].map(key => [
      `../../../assets/images/rewards/product-photos-v2/reward-${key}-photo-v2.png`,
      `reward-${key}-photo-v2.png`,
    ])),
    ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`../../../assets/images/rewards/box_${i + 1}.png`, `box_${i + 1}.png`])),
  }, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const props = { visible: true, demo: true, onClose: () => calls.closes++,
    onOpen: async box => { calls.opens.push(box); return options.open ? options.open(box) : { id: 'sample', title: '20 điểm thử' }; },
    onReceived: receipt => calls.received.push(receipt), ...options.props };
  let shown = false, canPresent = options.presented !== false;
  const render = () => CheckinGiftModal(props);
  const settle = async () => {
    let tree = await runtime.settle(render);
    const modal = nodes(tree).find(node => node.type === 'Modal');
    if (!modal?.props.visible) shown = false;
    if (modal?.props.visible && canPresent && !shown) {
      shown = true; modal.props.onShow?.(); tree = await runtime.settle(render);
    }
    return tree;
  };
  return { calls, props, runtime, animations, clock, settle,
    advance: milliseconds => clock.advance(milliseconds, settle),
    async present(value) {
      canPresent = value;
      if (!value) {
        const tree = await runtime.settle(render);
        nodes(tree).find(node => node.type === 'Modal')?.props.onDismiss?.(); shown = false;
      }
      return settle();
    },
  };
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
await test('the chooser uses all six Asinu mascot gift images with no skip, QR instruction or footer', async () => {
  let failed = true;
  const h = modalHarness({ open: async box => {
    if (failed) throw new Error('offline');
    return { id: 'saved', box, title: 'Lộc của bạn' };
  } });
  let tree = await h.settle();
  const grid = nodes(tree).find(node => node.props.testID === 'gift-chooser-grid');
  const choices = nodes(grid).filter(node => node.type === 'Button');
  assert.equal(choices.length, 6);
  assert.deepEqual(choices.map(node => nodes(node).find(child => child.type === 'Image').props.source),
    Array.from({ length: 6 }, (_, index) => `box_${index + 1}.png`));
  assert.ok(!nodes(tree).some(node => node.type === 'Text' && /Bỏ lượt|Hãy chọn 1 hộp quà|mã QR|Sẽ đóng/.test(String(node.props.children))));
  await h.advance(10000);
  nodes(tree).find(node => node.type === 'Modal').props.onRequestClose();
  assert.equal(h.calls.closes, 0);
  const choose = value => nodes(value).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 3');
  assert.equal(choose(tree).props.accessibilityState.disabled, false);
  choose(tree).props.onPress(); tree = await h.settle();
  await h.advance(10000);
  assert.equal(h.calls.closes, 0, 'A failed opening never starts the countdown');
  assert.ok(nodes(tree).some(node => node.props.accessibilityRole === 'alert'));
  failed = false; choose(tree).props.onPress(); tree = await h.settle();
  const done = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.props.children === 'Sẽ đóng sau 5s'));
  assert.equal(done.props.disabled, false);
  done.props.onPress(); tree = await h.settle(); await h.advance(10000);
  assert.equal(h.calls.closes, 0, 'Closing the reward page returns to the grid rather than dismissing the whole sheet');
  const close = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.props.children === 'Đóng'));
  close.props.onPress(); assert.equal(h.calls.closes, 1);
  assert.equal(nodes(tree).find(node => node.type === 'Modal').props.interruptible, true);
});
await test('each selected gift returns to its original cell in the same six-slot grid', async () => {
  for (let box = 0; box < 6; box++) {
    const h = modalHarness({ props: { demo: false, initialReceipt: { id: 'saved', box, title: 'Chúc bạn bình yên.' } } });
    const tree = await h.settle();
    const grid = nodes(tree).find(node => node.props.testID === 'gift-result-grid');
    assert.equal(grid.props.children.length, 6);
    const chosen = grid.props.children[box];
    assert.equal(chosen.props.testID, `gift-received-${box}`);
    assert.ok(chosen.props.accessibilityLabel.startsWith('Đã nhận: Chúc bạn bình yên.'));
    assert.equal(nodes(grid).filter(node => /^gift-other-\d+$/.test(node.props.testID || '')).length, 5);
    assert.equal(nodes(chosen).filter(node => node.type === 'Text' && node.props.children === 'Đã nhận').length, 1);
    assert.equal(nodes(grid).filter(node => node.type === 'Image' && node.props.source === 180018).length, 1);
    assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-fortune'), 'The grid does not repeat the full wish below the boxes');
    assert.deepEqual(h.calls.opens, [], 'Review never claims another gift');
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
await test('completed wish and proverb grids omit the repeated fortune underneath the boxes', async () => {
  for (const kind of ['wish', 'proverb', 'health_tip']) {
    const title = 'Nội dung đầy đủ chỉ đọc ở màn quà riêng.';
    const h = modalHarness({ props: { demo: false, initialReceipt: { id: 'saved', box: 2,
      title, description: 'Không lặp lại bên dưới.', shortTitle: 'Loại lộc', kind } } });
    const tree = await h.settle();
    assert.ok(nodes(tree).some(node => node.props.testID === 'gift-received-2'));
    assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-fortune'));
    assert.ok(!nodes(tree).some(node => node.type === 'Text' && node.props.children === title));
    const grid = nodes(tree).find(node => node.props.testID === 'gift-result-grid');
    assert.equal(grid.props.children.length, 6);
    assert.equal(nodes(grid).filter(node => /^gift-other-\d+$/.test(node.props.testID || '')).length, 5);
    assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Đóng'));
    assert.deepEqual(h.calls.opens, []);
  }
});
await test('all five remaining boxes share one lid-opening and reward-reveal animation below the fortune', async () => {
  const h = modalHarness({ automaticAnimation: false, open: async box => ({ id: 'fortune', box, title: 'Một ngày bình yên' }) });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 5').props.onPress();
  tree = await h.settle();
  assert.equal(nodes(tree).filter(node => node.props.accessibilityLabel?.startsWith('Mở hộp')).length, 6);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-opening-scene'));
  assert.equal(h.calls.received.length, 1);
  assert.equal(h.clock.pending.size, 0);
  h.animations.finishNext(); tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-emerging-reward'));
  h.animations.finishNext(); tree = await h.settle();
  const upper = nodes(tree).find(node => node.props.testID === 'gift-reward-page');
  const grid = nodes(tree).find(node => node.props.testID === 'gift-result-grid');
  assert.ok(upper); assert.ok(grid);
  assert.ok(nodes(tree).indexOf(upper) < nodes(tree).indexOf(grid), 'Fortune is above the grid in the same result view');
  assert.equal(grid.props.children.length, 6);
  assert.equal(grid.props.children[4].props.testID, 'gift-received-4');
  assert.equal(nodes(grid).filter(node => /^gift-other-\d+$/.test(node.props.testID || '')).length, 5);
  assert.equal(h.animations.pending.length, 1, 'One native animation opens every remaining box, with no per-slot sequence');
  const openings = nodes(grid).filter(node => /^gift-other-opening-\d+$/.test(node.props.testID || ''));
  const reveals = nodes(grid).filter(node => /^gift-other-reveal-\d+$/.test(node.props.testID || ''));
  assert.equal(openings.length, 5); assert.equal(reveals.length, 5);
  const sharedProgress = reveals[0].props.style.opacity.value;
  assert.equal(sharedProgress.value, 0, 'Rewards start hidden behind the closed boxes');
  assert.ok(reveals.every(node => node.props.style.opacity.value === sharedProgress));
  assert.ok(openings.every(node => node.props.style[1].opacity.value === sharedProgress));
  for (const box of [0, 1, 2, 3, 5]) {
    const lid = nodes(grid).find(node => node.props.testID === `gift-box-lid-${box}`);
    assert.equal(lid.props.style.transform[0].translateY.value, sharedProgress, 'All five lids move on the same timeline');
  }
  assert.equal(h.animations.timings.at(-1).duration, 1100);
  assert.equal(h.animations.timings.at(-1).useNativeDriver, true);
  h.animations.finishNext(); tree = await h.settle();
  assert.equal(sharedProgress.value, 1, 'All five prizes finish revealing together');
  assert.equal(h.animations.pending.length, 0);
  tree = await h.advance(4999);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  assert.equal(nodes(tree).filter(node => /^gift-other-\d+$/.test(node.props.testID || '')).length, 5);
  tree = await h.advance(1);
  assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  assert.equal(h.animations.pending.length, 0);
  assert.equal(h.clock.pending.size, 0);
  await h.advance(10000); assert.equal(h.calls.closes, 0);
  assert.deepEqual(h.calls.opens, [4]); assert.equal(h.calls.received.length, 1);
});
await test('interrupting the simultaneous reveal stops its animation and keeps all saved rewards visible on return', async () => {
  const h = modalHarness({ automaticAnimation: false });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 1').props.onPress();
  await h.settle(); h.animations.finishNext(); await h.settle();
  h.animations.finishNext(); tree = await h.settle();
  const reveal = nodes(tree).find(node => /^gift-other-reveal-\d+$/.test(node.props.testID || ''));
  const progress = reveal.props.style.opacity.value;
  assert.equal(progress.value, 0); assert.equal(h.animations.pending.length, 1);
  await h.present(false);
  assert.equal(h.animations.pending.length, 0); assert.equal(progress.value, 1);
  tree = await h.present(true);
  assert.equal(h.animations.pending.length, 0, 'Returning does not replay the lids');
  assert.equal(nodes(tree).filter(node => /^gift-other-reveal-\d+$/.test(node.props.testID || '')).length, 5);
  assert.deepEqual(h.calls.opens, [0]);
});
await test('a slow response keeps every box locked and never starts an early countdown or reveals a prize', async () => {
  let resolve;
  const h = modalHarness({ automaticAnimation: false, open: () => new Promise(done => { resolve = done; }) });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 1').props.onPress();
  await h.settle(); h.animations.finishNext(); tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-opening-scene'));
  assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-emerging-reward' || node.props.testID === 'gift-fortune'));
  await h.advance(10000); assert.equal(h.calls.closes, 0);
  const choices = nodes(tree).filter(node => node.props.accessibilityLabel?.startsWith('Mở hộp quà số'));
  assert.ok(choices.every(box => box.props.disabled)); choices[1].props.onPress();
  assert.deepEqual(h.calls.opens, [0]);
  resolve({ id: 'saved', box: 0, title: 'Lộc đã lưu' }); tree = await h.settle();
  while (h.animations.pending.length) { h.animations.finishNext(); tree = await h.settle(); }
  assert.ok(nodes(tree).some(node => node.props.children === 'Lộc đã lưu'));
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
for (const fontScale of [1, 1.5]) await test(`font scale ${fontScale}: the full fortune is read on the reward page, then omitted from the six-cell grid`, async () => {
  const h = modalHarness({ fontScale, open: async box => ({ id: 'saved', box, title: 'Lộc của bạn' }) });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 3').props.onPress();
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  const rewardFortune = nodes(tree).find(node => node.props.testID === 'gift-fortune');
  assert.ok(rewardFortune);
  assert.equal(nodes(rewardFortune).find(node => node.props.children === 'Lộc của bạn').props.numberOfLines, undefined);
  tree = await h.advance(5000);
  const grid = nodes(tree).find(node => node.props.testID === 'gift-result-grid');
  assert.equal(grid.props.children.length, 6);
  assert.equal(grid.props.children[2].props.testID, 'gift-received-2');
  const scroll = nodes(tree).find(node => node.type === 'Scroll');
  assert.ok(!nodes(scroll).some(node => node.props.testID === 'gift-fortune'));
  assert.ok(!nodes(scroll).some(node => node.type === 'Text' && node.props.children === 'Sẽ đóng sau 5s'));
  assert.deepEqual(h.calls.opens, [2]);
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
  tree = await h.advance(5000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-box-art-1'));
  assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-received-5'));
  assert.equal(h.calls.received.length, 1);
});
await test('the reward page counts down 5, 4, 3, 2, 1, returns once and never automatically closes the sheet', async () => {
  const h = modalHarness({ open: async box => ({ id: 'saved', box, title: 'Lộc của bạn' }) });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 2').props.onPress();
  tree = await h.settle();
  for (let second = 5; second >= 1; second--) {
    assert.ok(nodes(tree).some(node => node.props.children === `Sẽ đóng sau ${second}s`));
    assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
    assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
    assert.equal(nodes(tree).filter(node => /^gift-other-\d+$/.test(node.props.testID || '')).length, 5);
    tree = await h.advance(1000);
  }
  assert.equal(h.calls.closes, 0);
  assert.ok(!nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  await h.advance(10000); assert.equal(h.calls.closes, 0);
  assert.deepEqual(h.calls.opens, [1]); assert.equal(h.calls.received.length, 1);
});
await test('a queued, interrupted or hidden reward page gets five visible seconds before returning', async () => {
  const h = modalHarness({ presented: false });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 3').props.onPress();
  await h.settle(); tree = await h.advance(10000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  await h.present(true); await h.advance(2000);
  await h.present(false); tree = await h.advance(10000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  tree = await h.present(true);
  assert.ok(nodes(tree).some(node => node.props.children === 'Sẽ đóng sau 5s'));
  await h.advance(4000);
  h.props.visible = false; await h.settle(); tree = await h.advance(10000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  h.props.visible = true; await h.settle(); tree = await h.advance(5000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  assert.equal(h.calls.closes, 0);
});
await test('callback updates never restart the reward countdown; unmount cancels it and receipt reviews have no timer', async () => {
  const h = modalHarness();
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 1').props.onPress();
  await h.settle(); await h.advance(3000);
  let latest = 0; h.props.onClose = () => latest++; await h.settle();
  tree = await h.advance(2000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  assert.equal(latest, 0); assert.equal(h.calls.closes, 0);
  const close = nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.props.children === 'Đóng'));
  close.props.onPress(); assert.equal(latest, 1);
  const unmounted = modalHarness();
  tree = await unmounted.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 1').props.onPress();
  await unmounted.settle(); unmounted.runtime.unmount(); await unmounted.advance(10000);
  assert.equal(unmounted.clock.pending.size, 0); assert.equal(unmounted.calls.closes, 0);
  for (const readOnly of [true, false]) {
    const review = modalHarness({ props: { readOnly, initialReceipt: { id: 'saved', box: 0, title: 'Lộc' } } });
    await review.settle(); tree = await review.advance(10000);
    assert.equal(review.clock.pending.size, 0); assert.equal(review.calls.closes, 0);
    assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  }
});
await test('a saved gift still reaches the separate reward page if a receipt callback fails', async () => {
  const h = modalHarness({ props: { onReceived() { throw new Error('local callback failed'); } } });
  let tree = await h.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 4').props.onPress();
  tree = await h.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  tree = await h.advance(5000);
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-result-grid'));
  assert.deepEqual(h.calls.opens, [3]);
  assert.equal(h.calls.closes, 0);
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
function productionFlowHarness({ today, open, reviewExisting = false, language = 'vi', status = 'fine', replay = false, randomByte } = {}) {
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
  const api = {
    today: async () => { calls.today++; return today ? today({ gift, receipt }) : { enabled: true, gift }; },
    open: async (id, box) => { calls.open.push([id, box]); return open ? open({ gift, receipt }) : { gift: receipt }; },
  };
  const { CheckinGiftFlow } = evaluate('src/features/checkin-rewards/CheckinGiftFlow.tsx', {
    react: runtime,
    'expo-router': { useFocusEffect: callback => runtime.useEffect(callback, [callback]) },
    'react-native': { View: 'View', Pressable: 'Button' },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language } }) },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push() {} }) },
    '../../components/NoInternetModal': {
      NoInternetModal: ({ visible, notice, onClose, onRetry, retryText, laterText }) => ({
        type: 'Modal',
        props: {
          interruptible: true,
          visible,
          onRequestClose: onClose,
          children: [
            notice ? { type: 'Text', props: { children: notice } } : null,
            { type: 'Button', props: { onPress: onRetry, children: [{ type: 'Text', props: { children: retryText } }] } },
            { type: 'Button', props: { onPress: onClose, children: [{ type: 'Text', props: { children: laterText } }] } },
          ].filter(Boolean),
        },
      }),
    },
    '../../components/QueuedModal': { QueuedModal: 'Modal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../auth/auth.store': { useAuthStore }, './CheckinGiftModal': { CheckinGiftModal: 'Gift' },
    './gift-prize-assets': { giftPrizeImage },
    './checkin-gifts.api': { checkinGiftsApi: api },
    './checkin-gift-replay': replayTools(api, { dev: replay, randomByte }),
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
for (const [kind, photo, label] of [
  ['wish', 'wish', 'previewWish'], ['proverb', 'proverb', 'previewProverb'],
  ['health_tip', 'tip', 'previewTip'], ['coupon', 'coupon', 'couponLabel'],
]) await test(`server ${kind} receipts retain their category, full content and matching reward artwork`, async () => {
  const h = productionFlowHarness({ open: ({ receipt }) => ({ gift: {
    ...receipt, loc: { type: kind === 'coupon' ? 'wish' : kind, text: `Saved ${kind} content`, serif: kind === 'proverb' },
    extra: kind === 'coupon' ? 'coupon' : 'none',
  } }) });
  const entry = await h.settle();
  assert.equal(entry.props.preview, false, 'Normal receipt flow does not show preview mode');
  const receipt = await entry.props.onOpen(3);
  assert.equal(receipt.kind, kind);
  assert.equal(receipt.title, `Saved ${kind} content`);
  assert.equal(receipt.shortTitle, h.t(`checkinGift.${label}`));
  const modal = modalHarness({ props: { demo: false }, open: async () => receipt });
  let tree = await modal.settle();
  nodes(tree).find(node => node.props.accessibilityLabel === 'Mở hộp quà số 4').props.onPress();
  tree = await modal.settle();
  assert.ok(nodes(tree).some(node => node.props.testID === 'gift-reward-page'));
  assert.equal(nodes(tree).find(node => node.props.testID === 'gift-detail-photo').props.source, `reward-${photo}-photo-v2.png`);
  const fortune = nodes(tree).find(node => node.props.testID === 'gift-fortune');
  const text = nodes(fortune).find(node => node.type === 'Text' && node.props.children === receipt.title);
  assert.ok(text);
  assert.equal(text.props.numberOfLines, undefined);
  assert.equal(Object.assign({}, ...text.props.style).fontStyle, kind === 'proverb' ? 'italic' : 'normal');
  tree = await modal.advance(5000);
  assert.equal(nodes(tree).find(node => node.props.testID === 'gift-received-photo').props.source, `reward-${photo}-photo-v2.png`);
  assert.equal(nodes(tree).some(node => node.props.testID === 'gift-fortune'), kind === 'coupon');
});
await test('the opted-in local account can reopen every visual box without another gift claim', async () => {
  for (let box = 0; box < 6; box++) {
    const h = productionFlowHarness({ replay: true, reviewExisting: true, today: ({ receipt }) => ({ enabled: true, gift: receipt }) });
    const tree = await h.settle();
    assert.equal(tree.props.initialReceipt, null, 'Each new visit starts with closed boxes');
    const receipt = await tree.props.onOpen(box);
    assert.equal(receipt.box, box);
    assert.equal(receipt.title, h.t('checkinGift.previewContent.wish'));
    assert.equal(receipt.id, 'local-preview:wish');
    assert.deepEqual(h.calls.open, []);
    assert.deepEqual(h.calls.opened, [], 'Replays never publish another real opening');
    h.account.profile.id = 'other-account';
    await assert.rejects(tree.props.onOpen(box), /account changed/);
  }
});
for (const [draw, kind] of ['wish', 'proverb', 'health_tip', 'ticket', 'coupon'].entries()) await test(`local random opening can reveal ${kind} without altering the real saved reward`, async () => {
  const h = productionFlowHarness({ replay: true, randomByte: () => draw, reviewExisting: true, today: ({ receipt }) => ({ enabled: true, gift: receipt }) });
  const tree = await h.settle();
  assert.equal(tree.props.preview, true);
  const receipt = await tree.props.onOpen(1);
  assert.equal(receipt.kind, kind);
  assert.equal(receipt.title, h.t(`checkinGift.previewContent.${kind}`));
  assert.equal(receipt.serif, kind === 'proverb');
  assert.equal(receipt.rulesPeriod, undefined);
  assert.deepEqual(h.calls.open, []);
  assert.deepEqual(h.calls.opened, []);
  if (kind === 'coupon') assert.equal(receipt.description, h.t('checkinGift.previewCouponDescription'));
  if (kind === 'ticket') assert.equal(receipt.description, h.t('checkinGift.previewTicketDescription'));
});
await test('local opening has only six mystery boxes and no gift-type controls', async () => {
  const h = modalHarness({ props: { demo: false, preview: true } });
  const tree = await h.settle();
  const buttons = nodes(tree).filter(node => node.type === 'Button');
  assert.equal(buttons.length, 6, 'Only the six mystery boxes, without a skip or instruction button');
  assert.equal(buttons.filter(node => node.props.accessibilityLabel?.startsWith('Mở hộp quà số')).length, 6);
  assert.equal(buttons.filter(node => !node.props.disabled).length, 6);
  assert.ok(!nodes(tree).some(node => node.type === 'Text' && ['Lời chúc', 'Ca dao', 'Mẹo nhỏ', 'Phiếu ưu đãi'].includes(node.props.children)));
});
await test('all six local slots can draw every eligible kind, with exactly zero phone outcomes', () => {
  let random = 0;
  const tools = replayTools({}, { dev: true, randomByte: () => random });
  for (let box = 0; box < 6; box++) {
    const counts = { wish: 0, proverb: 0, health_tip: 0, ticket: 0, coupon: 0 };
    for (random = 0; random < 255; random++) {
      const receipt = tools.previewCheckinGift('parent-account', box, key => key);
      assert.equal(receipt.box, box);
      assert.ok(Object.hasOwn(counts, receipt.kind), 'The phone is not in the prize pool');
      counts[receipt.kind]++;
    }
    assert.deepEqual(Object.values(counts), [51, 51, 51, 51, 51]);
  }
  const values = [255, 2];
  const rejection = replayTools({}, { dev: true, randomByte: () => values.shift() });
  assert.equal(rejection.previewCheckinGift('parent-account', 0, key => key).kind, 'health_tip');
  assert.equal(values.length, 0, 'Out-of-range bytes are redrawn instead of biasing the result');
});
await test('preview receipts require the opted-in local environment and cannot be issued for another account', () => {
  const enabled = replayTools({}, { dev: true });
  assert.throws(() => enabled.previewCheckinGift('other-account', 0, key => key), /unavailable/);
  assert.throws(() => replayTools({}).previewCheckinGift('parent-account', 0, key => key), /unavailable/);
  for (const box of [-1, 6, 1.5]) assert.throws(() => enabled.previewCheckinGift('parent-account', box, key => key), /unavailable/);
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
await test('the default Asinu mascot illustrations retain distinct images and accessible touch targets', async () => {
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
function homeHarness(today, { replay = false, history = async () => ({ items: [] }) } = {}) {
    const runtime=hooks(), account={profile:{id:'parent'}}, callbacks=[];
    const useAuthStore=select=>select(account);useAuthStore.getState=()=>account;
    const {HomeGiftCard}=evaluate('src/features/checkin-rewards/HomeGiftCard.tsx',{
      react:runtime,'react-native':{View:'View',Pressable:'Button',StyleSheet:{create:s=>s},AppState:{addEventListener:(_type,cb)=>{callbacks.push(cb);return {remove(){}};}}},
      'expo-router':{useFocusEffect:cb=>runtime.useEffect(cb,[cb])},'@expo/vector-icons':{Ionicons:'Icon'},
      'expo-linear-gradient':{LinearGradient:'View'},'expo-image':{Image:'Image'},
      'react-i18next':{useTranslation:()=>({t:key=>key})},'../../components/ScaledText':{ScaledText:'Text'},
      '../../hooks/useThemeColors':{useThemeColors:()=>({colors:{},isDark:false})},'../../hooks/useGuardedRouter':{useGuardedRouter:()=>({push(){}})},
      '../auth/auth.store':{useAuthStore},'./CheckinGiftFlow':{CheckinGiftFlow:'Gift'},
      './checkin-gift-replay':replayTools({today,history},{dev:replay,account:'parent'}),
      '../../../assets/images/rewards/daily_clover.png':1001,
      '../../../assets/images/rewards/daily_gift_hero.png':1002,
      '../../../assets/images/rewards/daily_chest.png':1003,
    });
    const render=()=>{const root=HomeGiftCard();return root.type(root.props);};
    return { account, callbacks, settle: () => runtime.settle(render) };
}
await test('local Home keeps the test opening action available after closing, even with no check-in today', async () => {
  const day = { enabled: true, gift: null, streak: 0, week: [] };
  const gift = { id: 'saved', openedAt: '2026-10-19T01:00:00Z' };
  const h = homeHarness(async () => day, { replay: true, history: async () => ({ items: [gift] }) });
  const button = tree => nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'checkinGift.replay'));
  for (let i = 0; i < 3; i++) {
    let tree = await h.settle();
    assert.ok(button(tree));
    button(tree).props.onPress();
    tree = await h.settle();
    const flow = nodes(tree).find(node => node.type === 'Gift');
    assert.ok(flow);
    flow.props.onClose();
    tree = await h.settle();
    assert.ok(!nodes(tree).some(node => node.type === 'Gift'));
  }
});
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
  const normalTree = await normal.settle();
  assert.ok(!nodes(normalTree).some(node=>node.props.testID==='gift-prize-details'));
  const selected = nodes(normalTree).find(node => node.props.testID === 'gift-received-0');
  assert.ok(!nodes(selected).some(node => node.type === 'Image' && node.props.source === 180018));
  const shown=modalHarness({props:{demo:false,initialReceipt:receipt}});
  const shownTree = await shown.settle();
  const details = nodes(shownTree).find(node => node.props.testID === 'gift-prize-details');
  assert.ok(nodes(details).some(node=>node.type==='Image'&&node.props.source===180018));
});
console.log(`Check-in gifts: ${count} runtime regressions passed.`);
