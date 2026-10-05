import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

let checks = 0;
const test = async (label, work) => { await work(); checks++; console.log(`PASS ${label}`); };
const read = file => fs.readFileSync(file, 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  // Execute the checked-in helpers/bridges, never a reimplementation.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, name => {
    assert.ok(name in imports, `Missing stub: ${name}`);
    return imports[name];
  });
  return module.exports;
}
const { CheckinCallHandoff, CheckinCallAcceptance } = evaluate(read('src/features/checkin-call/checkin-call.handoff.ts'));
const call = { episodeId: 'episode-a', attemptId: 'attempt-a' };
const ready = { ready: true, active: true, pathname: '/home' };

for (const [label, gate] of [
  ['waits for authentication/navigation', { ...ready, ready: false }],
  ['does not navigate underneath the lock screen', { ...ready, active: false }],
  ['does not compete with the splash home redirect', { ...ready, pathname: '/' }],
]) await test(label, () => {
  const h = new CheckinCallHandoff(); h.receive(call);
  assert.equal(h.route(gate), null);
  assert.deepEqual(h.route(ready), { kind: 'navigate', call });
});
await test('event, URL and pending recovery open exactly one screen', () => {
  const h = new CheckinCallHandoff();
  for (let i = 0; i < 5; i++) h.receive({ ...call });
  assert.equal(h.route(ready).kind, 'navigate');
  h.receive({ ...call });
  assert.equal(h.route(ready), null);
});
await test('an already opened native route never stacks another screen', () => {
  const h = new CheckinCallHandoff(); h.receive(call);
  assert.equal(h.route({ ...ready, pathname: '/checkin-call/episode-a', attemptId: call.attemptId, nativeAnswered: '1' }), null);
});
await test('a push-opened screen is upgraded to answered without a second receive tap', () => {
  const h = new CheckinCallHandoff(); h.receive(call);
  const gate = { ...ready, pathname: '/checkin-call/episode-a', attemptId: call.attemptId };
  assert.equal(h.route(gate).kind, 'params');
  assert.equal(h.route(gate), null);
});
await test('a different attempt in the same episode replaces stale screen-local refs', () => {
  const h = new CheckinCallHandoff(); h.receive(call);
  assert.equal(h.route({ ...ready, pathname: '/checkin-call/episode-a', attemptId: 'old-attempt' }).kind, 'replace');
});
await test('foreground recovery can reopen a live call after leaving its screen', () => {
  const h = new CheckinCallHandoff(); h.receive(call); h.route(ready);
  h.foreground();
  assert.equal(h.route(ready).call.attemptId, call.attemptId);
});
await test('ended calls cannot reopen and an older end event cannot erase a newer call', () => {
  const h = new CheckinCallHandoff(); h.receive(call); h.clear(call.attemptId);
  assert.equal(h.route(ready), null);
  h.receive(call); h.receive({ ...call, attemptId: 'new' }); h.clear(call.attemptId);
  assert.equal(h.route(ready).call.attemptId, 'new');
});
await test('malformed native events cannot navigate', () => {
  const h = new CheckinCallHandoff(); h.receive({ episodeId: '', attemptId: 'x' });
  assert.equal(h.route(ready), null);
});
await test('native recovery and screen accept share one backend request', async () => {
  const pending = deferred(); let calls = 0;
  const a = new CheckinCallAcceptance(() => { calls++; return pending.promise; });
  const first = a.accept('a', 'session-a'), second = a.accept('a', 'session-a');
  assert.equal(first, second); assert.equal(calls, 1);
  pending.resolve({ ok: true }); await first;
  await a.accept('a', 'session-a'); assert.equal(calls, 1);
});
await test('failed accept can be retried and is not cached as success', async () => {
  let calls = 0;
  const a = new CheckinCallAcceptance(async () => { if (++calls === 1) throw new Error('offline'); return { ok: true }; });
  await assert.rejects(a.accept('a', 'session-a'));
  assert.equal((await a.accept('a', 'session-a')).ok, true); assert.equal(calls, 2);
});
await test('acceptance is never shared with a logged-out or different session', async () => {
  let calls = 0;
  const a = new CheckinCallAcceptance(async () => ({ sequence: ++calls }));
  await assert.rejects(a.accept('a', null)); assert.equal(calls, 0);
  await a.accept('a', 'session-a'); await a.accept('a', 'session-b');
  assert.equal(calls, 2);
});
await test('an old rejection cannot evict the newer session request', async () => {
  const old = deferred(); let calls = 0;
  const a = new CheckinCallAcceptance(() => ++calls === 1 ? old.promise : Promise.resolve({ ok: true }));
  const first = a.accept('a', 'session-a');
  await a.accept('a', 'session-b'); old.reject(new Error('old offline'));
  await assert.rejects(first); await a.accept('a', 'session-b'); assert.equal(calls, 2);
});

function acceptanceHarness() {
  let token = 'session-a'; const pending = deferred(); const native = [];
  const exports = evaluate(read('src/features/checkin-call/checkin-call.accept.ts'), {
    '../auth/auth.store': { useAuthStore: { getState: () => ({ token }) } },
    '../../lib/voip': { completeVoipCallAnswer: async (...args) => native.push(args) },
    './checkin-call.api': { checkinCallApi: { accept: () => pending.promise } },
    './checkin-call.handoff': { CheckinCallAcceptance },
  });
  return { pending, native, ...exports, logout: () => { token = null; } };
}
await test('CallKit connection is fulfilled only after server acceptance', async () => {
  const h = acceptanceHarness(); const request = h.acceptCheckinCallOnce('a');
  assert.deepEqual(h.native, []);
  h.pending.resolve({ ok: true, confirm_deadline: '2026-10-05T12:00:00Z' }); await request;
  assert.deepEqual(h.native, [['a', true, '2026-10-05T12:00:00Z']]);
});
await test('backend failure fails the CallKit connection, not a fake successful check-in', async () => {
  const h = acceptanceHarness(); const request = h.acceptCheckinCallOnce('a');
  h.pending.reject(new Error('offline')); await assert.rejects(request);
  assert.deepEqual(h.native, [['a', false]]);
});
await test('late acceptance after logout cannot connect another account’s native call', async () => {
  const h = acceptanceHarness(); const request = h.acceptCheckinCallOnce('a'); h.logout();
  h.pending.resolve({ ok: true }); await assert.rejects(request);
  assert.deepEqual(h.native, []);
});

function bridgeHarness(native, platform = 'ios') {
  return evaluate(read('src/lib/voip.ts'), { 'react-native': {
    NativeModules: native ? { AsinuVoipModule: native } : {}, Platform: { OS: platform },
    NativeEventEmitter: class { addListener() { return { remove() {} }; } },
  } });
}
await test('new native pending getter is non-destructive', async () => {
  let consumes = 0;
  const h = bridgeHarness({ getPendingCall: async () => call, consumePendingCall: async () => { consumes++; } });
  assert.deepEqual(await h.getPendingVoipCall(), call); assert.deepEqual(await h.getPendingVoipCall(), call);
  assert.equal(consumes, 0);
});
await test('older builds and platforms tolerate missing new bridge methods', async () => {
  for (const h of [bridgeHarness({ consumePendingCall: async () => call }), bridgeHarness(null), bridgeHarness(null, 'android')]) {
    await h.completeVoipCallAnswer('a', true); assert.equal(await h.setVoipCallUIActive('a', true), false);
  }
});

const native = read('ios/Asinu/VoipCallManager.swift');
const screen = read('app/checkin-call/[episodeId].tsx');
const provider = read('src/providers/SessionProvider.tsx');
const index = read('app/index.tsx');
await test('native foreground URL is intercepted and has only one routing owner', () => {
  assert.ok(read('ios/Asinu/AppDelegate.swift').includes('handleAnsweredCallURL(url)'));
  assert.ok(native.includes('call["nativeAnswered"] == "1", url.path =='));
  assert.ok(provider.includes('router.navigate(route as any)'));
  assert.ok(index.indexOf('getPendingVoipCall()') < index.indexOf('Notifications.getLastNotificationResponseAsync()'));
  assert.ok(index.includes('if (cancelled) return;'));
});
await test('the response screen stops native guidance before playing its prompt', () => {
  const start = screen.indexOf('const play = useCallback');
  const play = screen.slice(start, screen.indexOf('useFocusEffect', start));
  assert.ok(play.indexOf('await setVoipCallUIActive') < play.indexOf('await playAudio'));
  assert.ok(play.includes('version !== playVersion.current'));
  assert.ok(screen.includes('AppState.addEventListener'));
});
await test('native guidance is bounded, localized, and never submits a health response', () => {
  const guidance = native.slice(native.indexOf('private func playHandoffPromptIfNeeded'), native.indexOf('private func removeCall'));
  assert.ok(guidance.includes('guard audioSessionActive'));
  assert.ok(guidance.includes('!callUIOwners.contains'));
  assert.ok(guidance.includes('answerActionsByUUID[entry.key] == nil'));
  assert.ok(guidance.includes('stopSpeaking(at: .immediate)'));
  assert.ok(native.includes('scheduleResponseTimeout(uuid: uuid, deadline: deadline)'));
  assert.ok(!native.includes('family-confirm') && !native.includes('/answer'));
  for (const lang of ['vi', 'en']) {
    const catalog = JSON.parse(read(`locales/${lang}.json`));
    const text = catalog.ios['Localizable.strings'].checkin_call_open_app_prompt;
    assert.ok(text && read(`ios/Asinu/Supporting/${lang}.lproj/Localizable.strings`).includes(text));
  }
});
await test('late incoming-call completion cannot re-arm the ring timer after answering', () => {
  const incoming = native.slice(native.indexOf('provider.reportNewIncomingCall'), native.indexOf('#if DEBUG\n  func simulateIncoming'));
  assert.ok(incoming.includes('DispatchQueue.main.async'));
  assert.ok(incoming.indexOf('current["nativeAnswered"] != "1"') < incoming.indexOf('self.scheduleRingTimeout'));
});
await test('CallKit audio is not replaced or deactivated after a short Expo prompt', () => {
  const audio = read('src/features/checkin-call/useCheckinCallAudio.ts');
  assert.ok(audio.includes('if (!ownsNativeAudioSession) await Audio.setAudioModeAsync'));
  assert.ok(audio.includes('keepAudioSessionActive: ownsNativeAudioSession'));
  assert.ok(read('src/lib/audio.ts').includes('createAudioPlayer(source, { keepAudioSessionActive })'));
  assert.ok(JSON.parse(read('app.json')).expo.ios.infoPlist.UIBackgroundModes.includes('audio'));
  assert.ok(read('ios/Asinu/Info.plist').includes('<string>audio</string>'));
});
await test('device guidance describes in-app choices, not an unsupported number pad', () => {
  for (const lang of ['vi', 'en']) {
    const frontend = JSON.parse(read(`src/i18n/locales/${lang}/checkinCall.json`));
    assert.ok(frontend.audio.userPrompt.includes('Asinu'));
    assert.ok(!/Nhấn một|Press one/.test(frontend.audio.userPrompt));
    assert.ok(frontend.audio.familyUrgent.includes(lang === 'vi' ? 'Tôi nhận, sẽ kiểm tra' : 'I will check on them'));
  }
});
console.log(`Check-in call handoff: ${checks} regression checks passed.`);
