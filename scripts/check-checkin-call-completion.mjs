import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(file, imports) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  // Execute the actual API, native bridge and completion helper.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.ok(id in imports, `Missing completion adapter: ${id}`);
    return imports[id];
  });
  return module.exports;
}
let checks = 0;
async function test(label, work) { await work(); checks++; console.log(`PASS ${label}`); }
const call = { attemptId: 'attempt', episodeId: 'episode' };
const closed = { id: 'attempt', episode_id: 'episode', target_role: 'USER', state: 'CANCELLED', episode_state: 'CANCELLED' };
const { isCheckinCallAttemptClosed } = evaluate('src/features/checkin-call/checkin-call.state.ts', {});

function harness({ calls = [call], attempt = closed, saveError, fetchError, ok = true } = {}) {
  const events = [];
  const result = { ok, session: { id: 42 } };
  const { withManualCheckinCallCompletion } = evaluate('src/features/checkin-call/checkin-call.completion.ts', {
    '../../lib/voip': {
      getActiveVoipCalls: async () => { events.push('snapshot'); return calls; },
      endVoipCall: async id => { events.push(`end:${id}`); },
    },
    './checkin-call.api': { checkinCallApi: { attempt: async id => {
      events.push(`verify:${id}`);
      if (fetchError) throw fetchError;
      return { attempt };
    } } },
    './checkin-call.state': { isCheckinCallAttemptClosed },
  });
  const { checkinApi } = evaluate('src/features/checkin/checkin.api.ts', {
    '../checkin-call/checkin-call.completion': { withManualCheckinCallCompletion },
    '../../lib/apiClient': { apiClient: async url => {
      events.push(`save:${url}`);
      if (saveError) throw saveError;
      return result;
    } },
  });
  return { checkinApi, events, result };
}

for (const status of ['fine', 'specific_concern', 'tired', 'very_tired']) {
  await test(`${status}: saved manual check-in ends the original server-closed CallKit call`, async () => {
    const h = harness();
    assert.equal(await h.checkinApi.start(status), h.result);
    assert.deepEqual(h.events, ['snapshot', 'save:/api/mobile/checkin/start', 'verify:attempt', 'end:attempt']);
  });
}
await test('a saved follow-up reconciles a closed native call as well', async () => {
  const h = harness();
  assert.equal(await h.checkinApi.followUp(42, 'fine'), h.result);
  assert.deepEqual(h.events, ['snapshot', 'save:/api/mobile/checkin/followup', 'verify:attempt', 'end:attempt']);
});
await test('check-in without a native call makes no extra backend request', async () => {
  const h = harness({ calls: [] });
  assert.equal(await h.checkinApi.start('fine'), h.result);
  assert.deepEqual(h.events, ['snapshot', 'save:/api/mobile/checkin/start']);
});
for (const action of ['start', 'followUp']) {
  await test(`${action}: a failed save never ends the native call or reads a success state`, async () => {
    const error = new Error('offline');
    const h = harness({ saveError: error });
    await assert.rejects(action === 'start' ? h.checkinApi.start('fine') : h.checkinApi.followUp(42, 'fine'), error);
    assert.ok(!h.events.some(event => event.startsWith('end:') || event.startsWith('verify:')));
  });
}
await test('a rejected application result cannot end CallKit', async () => {
  const h = harness({ ok: false });
  assert.equal(await h.checkinApi.start('fine'), h.result);
  assert.ok(!h.events.some(event => event.startsWith('end:') || event.startsWith('verify:')));
});
await test('an unavailable status endpoint does not invalidate a saved check-in', async () => {
  const h = harness({ fetchError: new Error('offline') });
  assert.equal(await h.checkinApi.start('fine'), h.result);
  assert.ok(!h.events.some(event => event.startsWith('end:')));
});
for (const [name, attempt] of [
  ['unrelated family alert', { ...closed, target_role: 'FAMILY' }],
  ['another episode', { ...closed, episode_id: 'other-episode' }],
  ['another attempt', { ...closed, id: 'other-attempt' }],
  ['ongoing urgent safety flow', { ...closed, state: 'CONNECTED', episode_state: 'URGENT_BROADCAST' }],
]) await test(`${name} is not terminated by this manual check-in`, async () => {
  const h = harness({ attempt });
  assert.equal(await h.checkinApi.start('fine'), h.result);
  assert.ok(!h.events.some(event => event.startsWith('end:')));
});

await test('native call snapshot is taken before saving; a new call is never selected afterward', async () => {
  const events = [];
  let current = [call];
  const { withManualCheckinCallCompletion: complete } = evaluate('src/features/checkin-call/checkin-call.completion.ts', {
    '../../lib/voip': {
      getActiveVoipCalls: async () => { events.push('snapshot'); return current; },
      endVoipCall: async id => events.push(`end:${id}`),
    },
    './checkin-call.api': { checkinCallApi: { attempt: async id => { events.push(`verify:${id}`); return { attempt: closed }; } } },
    './checkin-call.state': { isCheckinCallAttemptClosed },
  });
  await complete(async () => { current = [{ episodeId: 'new', attemptId: 'new-attempt' }]; return { ok: true }; });
  assert.deepEqual(events, ['snapshot', 'verify:attempt', 'end:attempt']);
});
await test('slow call reconciliation never keeps a successful check-in loading', async () => {
  const events = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { withManualCheckinCallCompletion: complete } = evaluate('src/features/checkin-call/checkin-call.completion.ts', {
    '../../lib/voip': {
      getActiveVoipCalls: async () => [call],
      endVoipCall: async id => events.push(`end:${id}`),
    },
    './checkin-call.api': { checkinCallApi: { attempt: () => pending } },
    './checkin-call.state': { isCheckinCallAttemptClosed },
  });
  let saved = false;
  const request = complete(async () => ({ ok: true })).then(() => { saved = true; });
  for (let index = 0; index < 10; index++) await Promise.resolve();
  assert.equal(saved, true);
  assert.deepEqual(events, []);
  release({ attempt: closed });
  await request;
  for (let index = 0; index < 10; index++) await Promise.resolve();
  assert.deepEqual(events, ['end:attempt']);
});

function bridge(native) {
  return evaluate('src/lib/voip.ts', { 'react-native': {
    Platform: { OS: 'ios' }, NativeModules: native ? { AsinuVoipModule: native } : {},
    NativeEventEmitter: class {},
  } });
}
await test('active native getter is non-destructive and rejects malformed identifiers', async () => {
  let pendingReads = 0;
  const h = bridge({ getActiveCalls: async () => [call, {}, null, { attemptId: 7, episodeId: 'e' }, { attemptId: '', episodeId: 'e' }],
    consumePendingCall: () => { pendingReads++; } });
  assert.deepEqual(await h.getActiveVoipCalls(), [call]);
  assert.deepEqual(await h.getActiveVoipCalls(), [call]);
  assert.equal(pendingReads, 0);
});
await test('older builds, missing modules and native failures do not block check-in', async () => {
  for (const native of [null, {}, { getActiveCalls: async () => null }, { getActiveCalls: async () => { throw new Error('native unavailable'); } }]) {
    assert.deepEqual(await bridge(native).getActiveVoipCalls(), []);
  }
});
await test('the active-call getter is exported through both iOS bridge declarations on the main queue', () => {
  assert.ok(read('ios/Asinu/AsinuVoipModule.m').includes('RCT_EXTERN_METHOD(getActiveCalls:'));
  const native = read('ios/Asinu/AsinuVoipModule.swift');
  assert.ok(native.includes('@objc(getActiveCalls:rejecter:)'));
  assert.ok(native.includes('DispatchQueue.main.async { resolve(VoipCallManager.shared.activeCalls()) }'));
});
console.log(`Check-in native completion: ${checks} runtime/bridge regressions passed.`);
