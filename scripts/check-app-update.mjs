import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createStore } from 'zustand/vanilla';
import plugin from '../plugins/withAsinuAppUpdates.js';
const read = file => fs.readFileSync(file, 'utf8');
const evaluate = (file, imports = {}, globals = {}) => {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, name => {
    assert.ok(name in imports, `Missing dependency ${name}`); return imports[name];
  }, ...Object.values(globals));
  return module.exports;
};
const policy = evaluate('src/features/app-update/update-policy.ts');
let checks = 0;
async function test(label, run) { await run(); console.log(`PASS ${label}`); checks++; }
const catalog = version => ({ results: [{ trackId: policy.APP_STORE_ID, bundleId: policy.APP_BUNDLE_ID, version, minimumOsVersion: '16.4' }] });

await test('numeric version comparison handles 2.0.10, extra components, invalid and prerelease data', () => {
  assert.equal(policy.compareVersions('2.0.10', '2.0.2'), 1);
  assert.equal(policy.compareVersions('2.0', '2.0.0'), 0);
  assert.equal(policy.compareVersions('2.1.0', '3.0.0'), -1);
  for (const bad of [null, '', '2.0.3-beta', '<script>', 'Infinity', '9007199254740993.0']) {
    assert.equal(policy.compareVersions(bad, '2.0.2'), null);
  }
});
await test('iPhone and iPad use the same public app catalog and native installed version', () => {
  assert.equal(policy.appleUpdate(catalog('2.0.10'), '2.0.2', '18.0').update.version, '2.0.10');
  assert.equal(policy.appleUpdate(catalog('2.0.2'), '2.0.2', '26.5').status, 'current');
  assert.equal(policy.appleUpdate(catalog('2.0.1'), '2.0.2', '26.5').status, 'current');
  assert.equal(policy.appleUpdate(catalog('2.0.2'), '2.0.1', '16.3').status, 'current');
  assert.equal(policy.appleUpdate({ results: [{ ...catalog('2.0.3').results[0], bundleId: 'another.app' }] }, '2.0.2', '18').status, 'unavailable');
  assert.equal(policy.appleUpdate({ results: [] }, '2.0.2', '18').status, 'unavailable');
  assert.equal(policy.appleUpdate(null, '2.0.2', '18').status, 'unavailable');
});
await test('Later snoozes only that release for 24 hours; a new release or downloaded APK can prompt', () => {
  const update = { platform: 'ios', id: 'ios:2.0.3' }, at = Date.now();
  assert.equal(policy.shouldPrompt(update, { id: update.id, at }, at + 60_000), false);
  assert.equal(policy.shouldPrompt(update, { id: update.id, at }, at + policy.UPDATE_SNOOZE_MS), true);
  assert.equal(policy.shouldPrompt({ ...update, id: 'ios:2.0.4' }, { id: update.id, at }, at), true);
  assert.equal(policy.shouldPrompt({ ...update, downloaded: true }, { id: update.id, at }, at), true);
});
await test('check-in, recording, call, purchase and medical screens are excluded from prompting', () => {
  for (const route of ['/checkin', '/checkin-call/episode', '/doctor-interview/session', '/logs/glucose', '/subscription', '/care-circle/invite']) {
    assert.equal(policy.canPromptOnPath(route), false, route);
  }
  for (const route of ['/', '/home', '/profile', '/care-circle']) {assert.equal(policy.canPromptOnPath(route), true);}
});

function service(platform, native, fetcher = async () => ({ ok: true, json: async () => catalog('2.0.3') }), opens = [], nativeApp = { applicationId: policy.APP_BUNDLE_ID, nativeApplicationVersion: '2.0.2' }) {
  const subscriptions = new Map();
  const result = evaluate('src/features/app-update/app-update.service.ts', {
    '../../observability/sentry': { monitoredFetch: fetcher },
    'expo-modules-core': { requireOptionalNativeModule: () => nativeApp },
    'expo-localization': { getLocales: () => [{ regionCode: 'VN' }] },
    './update-policy': policy,
    'react-native': {
      Platform: { OS: platform, Version: '26.5' }, NativeModules: { AsinuAppUpdate: native },
      Linking: { openURL: async url => { opens.push(url); if (url.startsWith('itms-apps')) {throw Error('No native store in Simulator');} } },
      NativeEventEmitter: class { addListener(name, cb) { if (!subscriptions.has(name)) {subscriptions.set(name, new Set());} subscriptions.get(name).add(cb); return { remove() { subscriptions.get(name)?.delete(cb); } }; } },
    },
  }, { fetch: fetcher, AbortController, setTimeout, clearTimeout });
  return { ...result, notify: (payload, event = 'AsinuUpdateProgress') => { for (const cb of subscriptions.get(event) || []) {cb(payload);} } };
}
await test('iOS queries Vietnam storefront without authentication and uses HTTPS store fallback', async () => {
  let requested;
  const opens = [];
  const api = service('ios', null, async url => { requested = url; return { ok: true, json: async () => catalog('2.0.3') }; }, opens);
  assert.equal((await api.checkStoreUpdate()).status, 'available');
  assert.match(requested, /country=vn/);
  assert.equal((await api.installAppUpdate({ platform: 'ios', id: 'ios:2.0.3' })).outcome, 'external');
  assert.deepEqual(opens, [`itms-apps://apps.apple.com/app/id${policy.APP_STORE_ID}`, policy.IOS_STORE_URL]);
});
await test('Android uses Play eligibility/versionCode, supports background download and user-confirmed installation', async () => {
  let installed = 0;
  const native = { check: async () => ({ available: true, versionCode: 40, downloaded: false }), start: async () => 'started', complete: async () => { installed++; return true; } };
  const api = service('android', native);
  const found = await api.checkStoreUpdate();
  assert.equal(found.update.id, 'android:40');
  await api.installAppUpdate(found.update);
  assert.equal(installed, 0);
  native.check = async () => ({ available: true, versionCode: 40, downloading: true });
  assert.equal((await api.checkStoreUpdate()).status, 'available');
  assert.equal((await api.checkStoreUpdate()).progress.phase, 'pending');
  native.check = async () => ({ available: true, versionCode: 40, downloaded: true });
  await api.installAppUpdate((await api.checkStoreUpdate()).update);
  assert.equal(installed, 1);
  let notified = 0;
  const unsubscribe = api.subscribeUpdateDownloaded(() => notified++);
  api.notify(undefined, 'AsinuUpdateDownloaded'); unsubscribe(); api.notify(undefined, 'AsinuUpdateDownloaded');
  assert.equal(notified, 1);
});
await test('missing native module and malformed/unavailable store responses never force an update', async () => {
  assert.equal((await service('android').checkStoreUpdate()).status, 'unavailable');
  assert.equal((await service('ios', null, async () => ({ ok: false })).checkStoreUpdate()).status, 'unavailable');
  assert.equal((await service('ios', null, async () => ({ ok: true, json: async () => ({}) })).checkStoreUpdate()).status, 'unavailable');
});

function store(checkStoreUpdate, storage = new Map(), options = {}) {
  return evaluate('src/features/app-update/app-update.store.ts', {
    '@react-native-async-storage/async-storage': { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
    zustand: { create: fn => createStore(fn) }, 'react-native': { Platform: { OS: options.platform || 'ios' } },
    './app-update.service': { checkStoreUpdate, installAppUpdate: options.install || (async () => ({ outcome: 'external' })) }, './update-policy': policy,
  }, options.globals || {}).useAppUpdateStore;
}
await test('startup/foreground requests coalesce; dismissal is durable; manual checks bypass snooze', async () => {
  let calls = 0, resolve;
  const instance = store(() => { calls++; return new Promise(done => { resolve = done; }); });
  const first = instance.getState().check(), second = instance.getState().check();
  assert.equal(first, second); assert.equal(calls, 1);
  resolve({ status: 'available', update: { platform: 'ios', id: 'ios:2.0.3' } }); await first;
  assert.equal(instance.getState().visible, true);
  instance.getState().dismiss();
  assert.equal(instance.getState().visible, false);
  await instance.getState().check(); assert.equal(calls, 1);
  const manual = instance.getState().check(true); assert.equal(calls, 2);
  resolve({ status: 'available', update: { platform: 'ios', id: 'ios:2.0.3' } }); await manual;
  assert.equal(instance.getState().visible, true);
});
await test('network failure and broken device storage fail open without a stuck loading indicator', async () => {
  const instance = store(async () => { throw Error('offline'); });
  assert.equal((await instance.getState().check()).status, 'unavailable');
  assert.equal(instance.getState().checking, false);
  assert.equal(instance.getState().visible, false);
  const brokenStorage = { get() { throw Error('storage unavailable'); }, set() { throw Error('storage unavailable'); } };
  const available = store(async () => ({ status: 'available', update: { platform: 'ios', id: 'ios:2.0.3' } }), brokenStorage);
  await available.getState().check();
  assert.equal(available.getState().visible, true);
  available.getState().dismiss();
  assert.equal(available.getState().visible, false);
});

await test('Play progress listener forwards real bytes, rejects malformed input and unsubscribes cleanly', () => {
  const api = service('android', {});
  const received = [];
  const off = api.subscribeUpdateProgress(progress => received.push(progress));
  api.notify({ phase: 'downloading', downloadedBytes: 4321, totalBytes: 10000, versionCode: 40 });
  api.notify({ phase: 'pending', downloadedBytes: NaN, totalBytes: -100 });
  api.notify({ phase: 'made_up', downloadedBytes: 90, totalBytes: 100 });
  api.notify(null);
  off();
  api.notify({ phase: 'downloaded', downloadedBytes: 10000, totalBytes: 10000 });
  assert.equal(received.length, 2);
  assert.deepEqual(received[0], { phase: 'downloading', downloadedBytes: 4321, totalBytes: 10000, versionCode: 40 });
  assert.equal(received[1].totalBytes, 0);
  assert.equal(received[1].downloadedBytes, 0);
  let iosEvents = 0;
  const ios = service('ios');
  const offIos = ios.subscribeUpdateProgress(() => iosEvents++);
  ios.notify({ phase: 'downloading', downloadedBytes: 50, totalBytes: 100 }); offIos();
  assert.equal(iosEvents, 0);
});
await test('Play cancellation/failure never opens the Store or starts a second download', async () => {
  const opens = [];
  let starts = 0;
  const native = { start: async () => { starts++; return 'cancelled'; }, complete: async () => false };
  const api = service('android', native, undefined, opens);
  const update = { platform: 'android', id: 'android:40' };
  assert.equal((await api.installAppUpdate(update)).outcome, 'cancelled');
  native.start = async () => 'failed';
  assert.equal((await api.installAppUpdate(update)).outcome, 'error');
  assert.equal((await api.installAppUpdate({ ...update, downloaded: true })).outcome, 'error');
  assert.equal(starts, 1);
  assert.equal(opens.length, 0);
});
await test('Play snapshot restores actual bytes after app resume rather than pretending download is current', async () => {
  const api = service('android', { check: async () => ({ available: true, versionCode: 41, phase: 'downloading', downloadedBytes: 700, totalBytes: 1000 }) });
  const check = await api.checkStoreUpdate();
  assert.equal(check.status, 'available');
  assert.equal(check.update.id, 'android:41');
  assert.equal(check.progress.downloadedBytes, 700);
  assert.equal(check.progress.totalBytes, 1000);
});
const playUpdate = { platform: 'android', id: 'android:40' };
const playProgress = (phase, downloadedBytes = 0, totalBytes = 0, versionCode = 40) => ({ phase, downloadedBytes, totalBytes, versionCode });
await test('store follows real Play download, allows minimize and resume, and waits for explicit install', async () => {
  let resolveStart, installs = 0;
  const instance = store(async () => ({ status: 'available', update: playUpdate }), new Map(), {
    platform: 'android', install: () => { installs++; return new Promise(resolve => { resolveStart = resolve; }); },
  });
  await instance.getState().check();
  instance.getState().minimize();
  const started = instance.getState().install();
  assert.equal(instance.getState().phase, 'starting');
  assert.equal(instance.getState().visible, false);
  assert.equal(instance.getState().userMinimized, false);
  assert.equal(instance.getState().install(), started);
  instance.getState().applyProgress(playProgress('pending'));
  assert.equal(instance.getState().visible, true);
  assert.equal(instance.getState().totalBytes, 0);
  instance.getState().applyProgress(playProgress('downloading', 230, 1000));
  assert.equal(instance.getState().downloadedBytes, 230);
  assert.equal(instance.getState().phase, 'downloading');
  instance.getState().minimize();
  instance.getState().applyProgress(playProgress('downloading', 650, 1000));
  assert.equal(instance.getState().visible, false);
  assert.equal(instance.getState().downloadedBytes, 650);
  instance.getState().open();
  assert.equal(instance.getState().visible, true);
  instance.getState().applyProgress(playProgress('downloaded', 1000, 1000));
  resolveStart({ outcome: 'started' }); await started;
  assert.equal(instance.getState().phase, 'downloaded');
  assert.equal(instance.getState().update.downloaded, true);
  assert.equal(installs, 1, 'downloaded event must not auto-install');
  instance.getState().applyProgress(playProgress('installed', 1000, 1000));
  assert.equal(instance.getState().update, null);
  assert.equal(instance.getState().visible, false);
});
await test('cancel result clears busy state and stale acceptance cannot re-open cancelled consent', async () => {
  let resolveInstall, now = 10000;
  const instance = store(async () => ({ status: 'available', update: { ...playUpdate, inProgress: true } }), new Map(), {
    platform: 'android', install: () => new Promise(resolve => { resolveInstall = resolve; }), globals: { Date: { now: () => now } },
  });
  await instance.getState().check();
  const task = instance.getState().install();
  instance.getState().applyProgress(playProgress('cancelled'));
  resolveInstall({ outcome: 'started' }); await task;
  assert.equal(instance.getState().phase, 'available');
  assert.equal(instance.getState().visible, false);
  now += 11000; await instance.getState().check();
  assert.equal(instance.getState().visible, false, 'cancelled consent must not immediately nag on foreground');
  await instance.getState().check(true);
  assert.equal(instance.getState().visible, true, 'manual check can retry cancelled consent');
});
await test('native failure and rejected install leave a retryable error instead of stuck progress', async () => {
  const instance = store(async () => ({ status: 'available', update: playUpdate }), new Map(), {
    platform: 'android', install: async () => ({ outcome: 'error' }),
  });
  await instance.getState().check(); await instance.getState().install();
  assert.equal(instance.getState().phase, 'error');
  assert.equal(instance.getState().visible, true);
  assert.equal(instance.getState().update.id, 'android:40');
  instance.getState().applyProgress({ ...playProgress('error'), errorCode: -6 });
  assert.equal(instance.getState().errorCode, -6);
  const rejected = store(async () => ({ status: 'available', update: playUpdate }), new Map(), {
    platform: 'android', install: async () => { throw Error('native refused'); },
  });
  await rejected.getState().check();
  await assert.rejects(rejected.getState().install());
  assert.equal(rejected.getState().phase, 'error');
});
await test('late checks and storage reads cannot rewind a newer download event', async () => {
  let resolveCheck;
  const instance = store(() => new Promise(resolve => { resolveCheck = resolve; }), new Map(), { platform: 'android' });
  const checking = instance.getState().check();
  instance.getState().applyProgress(playProgress('downloaded', 1000, 1000));
  resolveCheck({ status: 'available', update: playUpdate, progress: playProgress('downloading', 250, 1000) });
  await checking;
  assert.equal(instance.getState().phase, 'downloaded');
  assert.equal(instance.getState().downloadedBytes, 1000);
  let resolveStorage;
  const slow = store(async () => ({ status: 'available', update: playUpdate }), { get: () => new Promise(resolve => { resolveStorage = resolve; }) }, { platform: 'android' });
  const loading = slow.getState().check(); await Promise.resolve();
  slow.getState().applyProgress(playProgress('downloading', 600, 1000));
  resolveStorage(null); await loading;
  assert.equal(slow.getState().phase, 'downloading');
  assert.equal(slow.getState().downloadedBytes, 600);
});
await test('iOS external store never shows Android download progress and old version events are ignored', async () => {
  const ios = store(async () => ({ status: 'available', update: { platform: 'ios', id: 'ios:2.0.3' } }));
  await ios.getState().check(); await ios.getState().install();
  assert.equal(ios.getState().phase, 'available'); assert.equal(ios.getState().visible, false);
  assert.equal(ios.getState().totalBytes, 0);
  ios.getState().applyProgress(playProgress('downloading', 100, 200));
  assert.equal(ios.getState().phase, 'available');
  const android = store(async () => ({ status: 'available', update: { ...playUpdate, id: 'android:41' } }), new Map(), { platform: 'android' });
  await android.getState().check();
  android.getState().applyProgress(playProgress('cancelled', 0, 0, 40));
  assert.equal(android.getState().update.id, 'android:41');
  assert.equal(android.getState().visible, true);
});
await test('downloaded restart requires explicit user action and late completion cannot resurrect installed state', async () => {
  let resolveInstall, calls = 0;
  const instance = store(async () => ({ status: 'available', update: { ...playUpdate, downloaded: true }, progress: playProgress('downloaded') }), new Map(), {
    platform: 'android', install: update => { assert.equal(update.downloaded, true); calls++; return new Promise(resolve => { resolveInstall = resolve; }); },
  });
  await instance.getState().check(); assert.equal(calls, 0);
  const installing = instance.getState().install();
  instance.getState().applyProgress(playProgress('installed'));
  resolveInstall({ outcome: 'installing' }); await installing;
  assert.equal(instance.getState().update, null);
  assert.equal(instance.getState().visible, false);
});
await test('native progress bridge subscribes and cleans consent results instead of resolving before consent', () => {
  const source = read('native/app-update/android/com/asinu/lite/updates/AsinuAppUpdateModule.kt');
  assert.match(source, /AsinuUpdateProgress/);
  assert.match(source, /state\.bytesDownloaded\(\)/);
  assert.match(source, /state\.totalBytesToDownload\(\)/);
  assert.match(source, /BaseActivityEventListener/);
  assert.match(source, /UPDATE_REQUEST = 7643/);
  assert.match(source, /Activity.RESULT_CANCELED/);
  assert.match(source, /removeActivityEventListener/);
  assert.match(source, /manager.unregisterListener/);
});
await test('prebuild plugin preserves existing packages and is idempotent', () => {
  const input = 'package app\nfun packages() = PackageList(this).packages.apply { add(ExistingPackage()) }';
  const output = plugin.configureApplication(input);
  assert.match(output, /add\(AsinuAppUpdatePackage\(\)\)\s+add\(ExistingPackage\(\)\)/);
  assert.equal(plugin.configureApplication(output), output);
  const gradle = plugin.configureGradle('android {}\ndependencies {}');
  assert.equal(plugin.configureGradle(gradle), gradle);
  assert.match(gradle, /com.google.android.play:app-update:2.1.0/);
});
await test('older development clients without ExpoApplication and Expo Go stay usable', async () => {
  assert.equal((await service('ios', null, undefined, [], null).checkStoreUpdate()).status, 'unavailable');
  assert.equal((await service('ios', null, undefined, [], { applicationId: 'host.exp.Exponent', nativeApplicationVersion: '2.0.0' }).checkStoreUpdate()).status, 'unavailable');
});
await test('an iOS Store launch failure remains retryable without entering Android progress', async () => {
  let attempts = 0;
  const instance = store(async () => ({ status: 'available', update: { platform: 'ios', id: 'ios:2.0.3' } }), new Map(), {
    install: async () => { attempts++; throw Error('Store unavailable'); },
  });
  await instance.getState().check();
  await assert.rejects(instance.getState().install());
  assert.equal(instance.getState().phase, 'error'); assert.equal(instance.getState().visible, true);
  assert.equal(instance.getState().downloadedBytes, 0);
  await assert.rejects(instance.getState().install()); assert.equal(attempts, 2);
});

const translations = JSON.parse(read('src/i18n/locales/vi/common.json'));
function experience(phase, frame = { width: 393, height: 852 }, counts = {}, nativeStyleIds = false) {
  const jsx = (type, props) => ({ type, props });
  const { AppUpdateExperience } = evaluate('src/features/app-update/AppUpdateExperience.tsx', {
    react: { useMemo: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ActivityIndicator: 'Spinner', Platform: { OS: 'android' }, Pressable: 'Button', ScrollView: 'Scroll', View: 'View', useWindowDimensions: () => frame, StyleSheet: { create: value => nativeStyleIds ? Object.fromEntries(Object.keys(value).map((key, index) => [key, index + 1])) : value, absoluteFill: {} } },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: (key, vars = {}) => {
      const value = key.split('.').reduce((part, name) => part?.[name], translations) || key;
      return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
    } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    '../../components/QueuedModal': { QueuedModal: 'QueuedModal' }, '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark: false }) },
    '../../../assets/images/app-update/update-hero.jpg': 'photo-hero', '../../../assets/images/app-update/update-download.jpg': 'photo-download', '../../../assets/icon.png': 'icon',
  });
  return AppUpdateExperience({ visible: true, phase, version: '2.0.3', downloadedBytes: 124 * 1024 * 1024, totalBytes: 183 * 1024 * 1024, ...counts, onClose() {}, onAction() {}, onDismiss() {} });
}
function nodes(root) {
  if (Array.isArray(root)) { return root.flatMap(nodes); }
  return root && typeof root === 'object' ? [root, ...nodes(root.props?.children)] : [];
}
function textOf(root) {
  if (Array.isArray(root)) { return root.map(textOf).join(''); }
  return root && typeof root === 'object' ? textOf(root.props?.children) : root == null ? '' : String(root);
}
const flatten = styles => Object.assign({}, ...[styles].flat().filter(Boolean));
await test('custom update screen fills phone, stays bounded on iPad, and keeps accessible update actions', () => {
  const phone = experience('available'), ipad = experience('available', { width: 1032, height: 1376 });
  assert.equal(phone.type, 'QueuedModal'); assert.equal(phone.props.interruptible, true);
  assert.equal(flatten(nodes(phone).find(node => node.props?.accessibilityViewIsModal).props.style).height, '100%');
  assert.equal(flatten(nodes(ipad).find(node => node.props?.accessibilityViewIsModal).props.style).width, 600);
  assert.ok(nodes(phone).some(node => node.type === 'Scroll'));
  assert.ok(nodes(phone).some(node => node.type === 'Gradient' && flatten(node.props.style).minHeight >= 56));
  assert.match(textOf(phone), /Cập nhật ngay/); assert.match(textOf(phone), /Để sau/);
});
await test('download UI renders the actual byte ratio and accessible progress, never a scripted meter', () => {
  const tree = experience('downloading');
  assert.match(textOf(tree), /68%/);
  assert.match(textOf(tree), /124\.0 MB \/ 183\.0 MB/);
  assert.equal(nodes(tree).find(node => node.props?.accessibilityRole === 'progressbar').props.accessibilityValue.now, 68);
  assert.match(textOf(tree), /Tiếp tục dùng Asinu/);
});
await test('unknown totals and installation have no fabricated percentage or installation checklist', () => {
  for (const tree of [experience('pending', undefined, { downloadedBytes: 0, totalBytes: 0 }), experience('installing')]) {
    assert.doesNotMatch(textOf(tree), /\d+%/);
    assert.equal(nodes(tree).find(node => node.props?.accessibilityRole === 'progressbar').props.accessibilityValue.now, undefined);
  }
});
await test('downloaded state explicitly asks before restarting to install', () => {
  const tree = experience('downloaded');
  assert.match(textOf(tree), /Bản cập nhật đã tải xong/);
  assert.match(textOf(tree), /Cài đặt và mở lại/);
});
await test('photo fades keep explicit colors when native StyleSheet uses numeric IDs', () => {
  for (const phase of ['available', 'downloading']) {
    const tree = experience(phase, undefined, {}, true);
    for (const node of nodes(tree).filter(item => item.type === 'Gradient')) {
      assert.ok(node.props.colors.every(color => typeof color === 'string' && color.length > 0));
    }
  }
});
console.log(`${checks} app update behavior checks passed.`);
