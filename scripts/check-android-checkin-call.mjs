import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
const require = createRequire(import.meta.url);
const plugin = require('../plugins/withAsinuCheckinCalls');
let checks = 0;
const test = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function evaluate(file, imports) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return {
      jsx: (type, props, key) => React.createElement(type, { ...props, key }),
      jsxs: (type, props, key) => React.createElement(type, { ...props, key }),
    };
    assert.ok(Object.hasOwn(imports, id), `Missing Android test adapter ${id}`);
    return imports[id];
  });
  return module.exports;
}

await test('Expo prebuild manifest modifications are idempotent and native receivers are private', () => {
  const fresh = { manifest: { $: {}, application: [{ $: {} }] } };
  const first = plugin.configureManifest(fresh);
  const snapshot = structuredClone(first);
  assert.deepEqual(plugin.configureManifest(first), snapshot);
  const application = first.manifest.application[0];
  assert.equal(application.$['android:allowBackup'], 'false');
  assert.equal(application.activity[0].$['android:exported'], 'false');
  assert.equal(application.receiver[0].$['android:exported'], 'false');
  assert.equal(application.service.find(item => item.$['android:name'] === '.notifications.AsinuFirebaseMessagingService').$['android:exported'], 'false');
});
await test('clean prebuild registers the bridge once and compiles canonical sources/resources outside android/', () => {
  const application = plugin.configureApplication('package com.asinu.lite\n\nclass MainApplication { fun packages() = PackageList(this).packages.apply { } }');
  assert.equal(plugin.configureApplication(application), application);
  assert.equal(application.match(/add\(AsinuCheckinCallPackage\(\)\)/g).length, 1);
  const gradle = plugin.configureGradle('android { namespace "com.asinu.lite" }\ndependencies { }');
  assert.equal(plugin.configureGradle(gradle), gradle);
  assert.ok(gradle.includes('main.java.srcDir("../../native/checkin-call/android")'));
  assert.ok(gradle.includes('main.res.srcDir("../../native/checkin-call/res")'));
  assert.equal(plugin.configureGradle(fs.readFileSync('android/app/build.gradle', 'utf8')), fs.readFileSync('android/app/build.gradle', 'utf8'));
  assert.ok(JSON.parse(fs.readFileSync('app.json')).expo.plugins.includes('./plugins/withAsinuCheckinCalls'));
});

function bridge(platform = 'android', hasModule = true) {
  const calls = []; const listeners = new Map();
  const payload = { episodeId: 'episode', attemptId: 'attempt' };
  const native = {
    getPendingCall: async () => payload, endCall: async id => { calls.push(['end', id]); },
    completeAnswer: async (...args) => { calls.push(['accept', ...args]); },
    setCallUIActive: async (...args) => { calls.push(['ui', ...args]); return true; },
    getRegistration: async () => ({ token: 'ios', environment: 'sandbox' }),
  };
  const api = evaluate('src/lib/voip.ts', { 'react-native': {
    Platform: { OS: platform }, NativeModules: hasModule ? { [platform === 'android' ? 'AsinuCheckinCallModule' : 'AsinuVoipModule']: native } : {},
    NativeEventEmitter: class { addListener(name, callback) { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; } },
  } });
  return { api, calls, listeners, payload };
}
await test('Android answer/foreground recovery uses the same non-destructive authenticated handoff', async () => {
  const { api, calls, payload } = bridge();
  assert.deepEqual(await api.getPendingVoipCall(), payload);
  assert.deepEqual(await api.getPendingVoipCall(), payload);
  await api.completeVoipCallAnswer('attempt', true, 'deadline');
  assert.equal(await api.setVoipCallUIActive('attempt', true, 'deadline'), true);
  await api.endVoipCall('attempt');
  assert.deepEqual(calls, [['accept', 'attempt', true, 'deadline'], ['ui', 'attempt', true, 'deadline'], ['end', 'attempt']]);
  assert.equal(await api.getVoipRegistration(), null);
});
await test('Android events reject malformed identities and listener cleanup is symmetric', () => {
  const { api, listeners, payload } = bridge(); const received = [];
  const remove = api.addVoipCallAnsweredListener(value => received.push(value));
  listeners.get('onVoipCallAnswered')({}); listeners.get('onVoipCallAnswered')(payload);
  assert.deepEqual(received, [payload]); remove(); assert.equal(listeners.size, 0);
  const removeEnd = api.addVoipCallEndedListener(value => received.push(value));
  listeners.get('onVoipCallEnded')(payload); removeEnd(); assert.equal(received.length, 2);
  api.addVoipTokenListener(() => { throw new Error('Android must not register PushKit'); });
  assert.equal(listeners.size, 0);
});
await test('iOS registration/handoff is preserved and old Android builds tolerate a missing bridge', async () => {
  assert.deepEqual(await bridge('ios').api.getVoipRegistration(), { token: 'ios', environment: 'sandbox' });
  const { api } = bridge('android', false);
  assert.equal(await api.getPendingVoipCall(), null); await api.endVoipCall('attempt');
  assert.equal(await api.setVoipCallUIActive('attempt', true), false);
});
await test('native decline base URL is configured before FCM upload, with no login credential', async () => {
  const captured = [];
  const api = evaluate('src/lib/android-checkin-call.ts', {
    'react-native': { Platform: { OS: 'android' }, NativeModules: { AsinuCheckinCallModule: { configure: async value => captured.push(value) } } },
    './env': { env: { apiBaseUrl: 'https://api.test' } },
  });
  await api.configureAndroidCheckinCalls(); assert.deepEqual(captured, ['https://api.test']);
  const source = fs.readFileSync('src/lib/notifications.ts', 'utf8').split('export async function getNativeFcmToken')[1];
  assert.ok(source.indexOf('configureAndroidCheckinCalls()') < source.indexOf('getDevicePushTokenAsync()'));
});

function accessCard({ platform = 'android', language = 'vi', permissions = { notifications: true, channels: true, fullScreen: false }, open = true } = {}) {
  let cursor = 0; const state = []; const effects = []; const queued = []; const events = {}; const calls = []; const toasts = [];
  const strings = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/checkinCall.json`, 'utf8'));
  const colors = { surface: '#fff', border: '#ddd', primaryDark: '#087c68', textPrimary: '#123', textSecondary: '#567' };
  const t = key => {
    const result = key.split('.').reduce((value, part) => value?.[part], strings);
    assert.equal(typeof result, 'string', `Missing localized permission copy ${key}`); return result;
  };
  const Component = evaluate('src/features/checkin-call/AndroidCallAccessCard.tsx', {
    react: {
      useState(initial) { const id = cursor++; if (!(id in state)) state[id] = initial; return [state[id], value => { state[id] = value; }]; },
      useEffect(effect) { const id = cursor++; if (!effects[id]) { effects[id] = true; queued.push(effect); } },
      useCallback(callback) { cursor++; return callback; },
    },
    'react-native': { Platform: { OS: platform }, View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value }, AppState: {
      addEventListener(name, callback) { events[name] = callback; return { remove: () => { delete events[name]; } }; },
    } },
    'react-i18next': { useTranslation: namespace => ({ t: namespace === 'common' ? () => language === 'vi' ? 'Để sau' : 'Later' : t }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../../components/AppAlertModal': { AppAlertModal: 'AppModal' },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors }) },
    '../../lib/android-checkin-call': {
      getAndroidCallPermissions: async () => permissions,
      openAndroidCallSettings: async fullScreen => { calls.push(fullScreen); return open; },
    },
    '../../stores/toast.store': { showToast: (...args) => toasts.push(args) },
  }).AndroidCallAccessCard;
  const render = props => {
    cursor = 0; const root = Component(props); const nodes = [];
    const visit = node => { if (!node || typeof node !== 'object') return; nodes.push(node);
      React.Children.toArray(node.props?.children).forEach(visit); };
    visit(root); while (queued.length) queued.shift()(); return { root, nodes };
  };
  return { render, calls, toasts, events, permissions };
}
for (const language of ['vi', 'en']) {
  await test(`${language}: full-screen help uses app modal, not an unsolicited OS sheet`, async () => {
    const h = accessCard({ language }); h.render(); await flush();
    let view = h.render(); assert.equal(h.calls.length, 0);
    view.nodes.find(node => node.type === 'Pressable').props.onPress();
    view = h.render(); const modal = view.nodes.find(node => node.type === 'AppModal');
    assert.equal(modal.props.visible, true); assert.equal(modal.props.stackButtons, true); assert.equal(modal.props.scrollable, true);
    assert.ok(modal.props.message.length > 50);
    await modal.props.buttons[0].onPress(); assert.deepEqual(h.calls, [true]);
  });
}
await test('blocked notification channels route to notification settings first, not unrelated overlays', async () => {
  const h = accessCard({ permissions: { notifications: false, channels: false, fullScreen: false } }); h.render(); await flush();
  h.render().nodes.find(node => node.type === 'Pressable').props.onPress();
  await h.render().nodes.find(node => node.type === 'AppModal').props.buttons[0].onPress();
  assert.deepEqual(h.calls, [false]);
});
await test('failed Android settings opens use toast, and returning from OS settings refreshes permissions', async () => {
  const h = accessCard({ open: false }); h.render(); await flush();
  h.render().nodes.find(node => node.type === 'Pressable').props.onPress();
  await h.render().nodes.find(node => node.type === 'AppModal').props.buttons[0].onPress();
  assert.equal(h.toasts[0][1], 'error');
  h.permissions.fullScreen = true; h.events.change('active'); await flush();
  assert.equal(h.render().nodes.filter(node => node.type === 'Pressable').length, 0);
  assert.equal(h.render({ onlyWhenNeeded: true }).root, null);
});
await test('iOS and older builds show no Android permission UI', async () => {
  const ios = accessCard({ platform: 'ios' }); assert.equal(ios.render().root, null);
  const old = accessCard({ permissions: null }); old.render(); await flush(); assert.equal(old.render().root, null);
});
await test('Android keeps a single app audio owner and both native locales have matching keys', () => {
  const module = fs.readFileSync('native/checkin-call/android/com/asinu/lite/notifications/AsinuCheckinCallModule.kt', 'utf8');
  const method = module.split('@ReactMethod fun setCallUIActive')[1].split('@ReactMethod fun endCall')[0];
  assert.ok(method.includes('promise.resolve(false)'), 'Native Android owns no audio session: Expo must configure playback');
  const keys = locale => [...fs.readFileSync(`native/checkin-call/res/${locale}/asinu_checkin_calls.xml`, 'utf8').matchAll(/name="([^"]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(keys('values'), keys('values-en'));
});
console.log(`Android check-in call: ${checks} runtime/plugin regressions passed.`);
