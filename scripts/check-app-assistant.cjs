const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const requests = [];
const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/features/app-assistant/app-assistant.api.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
// eslint-disable-next-line no-new-func -- Run the trusted local API module with an isolated HTTP adapter.
new Function('module', 'exports', 'require', source)(moduleUnderTest, moduleUnderTest.exports, id => {
  assert.equal(id, '../../lib/apiClient');
  return { apiClient: async (url, options) => { requests.push({ url, options }); return { ok: true, log_id: 'saved' }; } };
});
const { executeAssistantActions, saveAssistantReading, planAssistantActions, applyAssistantMedication, applyAssistantProfile } = moduleUnderTest.exports;
const base = (overrides = {}) => ({
  actions: [], requestId: 'fixed-request', recordedAt: '2026-11-13T10:00:00.000Z', completed: new Set(),
  isCurrent: () => true, saveReading: async () => {}, setLanguage: () => {}, setFontSize: () => {}, ...overrides,
});

test('journal writes precede a language/font switch and each happens once', async () => {
  const calls = [];
  const run = base({ actions: [{ type: 'language', value: 'en' }, { type: 'water', volume_ml: 500 }, { type: 'font_size', value: 'large' }],
    saveReading: async action => calls.push(action.type), setLanguage: value => calls.push(value), setFontSize: value => calls.push(value) });
  assert.equal(await executeAssistantActions(run), true);
  assert.deepEqual(calls, ['water', 'en', 'large']);
  await executeAssistantActions(run);
  assert.deepEqual(calls, ['water', 'en', 'large']);
});

test('a partial failure retains completed actions and retries the same request identity', async () => {
  const calls = []; let fail = true;
  const run = base({ actions: [{ type: 'water', volume_ml: 250 }, { type: 'glucose', value: 120, unit: 'mg/dL' }],
    saveReading: async (action, id, index, recordedAt) => { calls.push([action.type, id, index, recordedAt]); if (action.type === 'glucose' && fail) { fail = false; throw Error('response lost'); } } });
  await assert.rejects(executeAssistantActions(run));
  await executeAssistantActions(run);
  assert.deepEqual(calls.map(call => call[0]), ['water', 'glucose', 'glucose']);
  assert.deepEqual(calls[1], calls[2]);
});

test('changing accounts during a write blocks all subsequent writes and preferences', async () => {
  let current = true; const writes = [];
  const run = base({ actions: [{ type: 'water', volume_ml: 250 }, { type: 'glucose', value: 120, unit: 'mg/dL' }, { type: 'language', value: 'en' }],
    isCurrent: () => current, saveReading: async action => { writes.push(action.type); current = false; }, setLanguage: () => writes.push('language') });
  assert.equal(await executeAssistantActions(run), false);
  assert.deepEqual(writes, ['water']);
});

test('journal calls use existing ingestion with explicit units and stable idempotency', async () => {
  requests.length = 0;
  await saveAssistantReading({ type: 'blood_pressure', systolic: 120, diastolic: 80, pulse: 70 }, 'request-1', 0, '2026-11-13T10:00:00Z');
  assert.equal(requests[0].url, '/api/mobile/logs');
  assert.deepEqual(requests[0].options.headers, { 'Idempotency-Key': 'assistant:request-1:0' });
  assert.deepEqual(requests[0].options.body.data, { systolic: 120, diastolic: 80, unit: 'mmHg', pulse: 70 });
  await assert.rejects(saveAssistantReading({ type: 'weight', value: 60 }, 'request-1', 1, '2026-11-13T10:00:00Z'));
  assert.equal(requests.length, 1);
});

test('planning never calls a write endpoint', async () => {
  requests.length = 0;
  await planAssistantActions({ text: 'đổi tiếng Anh', current: { language: 'vi', fontSize: 'normal' } }, new AbortController().signal);
  assert.deepEqual(requests.map(request => request.url), ['/api/mobile/assistant/plan']);
});
test('app tool confirmations use only the signed capability and complete writes before native or screen actions', async () => {
  const calls = [];
  const run = base({ actions: [
    { type: 'screen', screen: 'wallet_topup', params: { amount: '100000' } },
    { type: 'native', kind: 'app.share', parameters: {} },
    { type: 'app_tool', tool: 'gifts.open', label: 'Mở hộp 2', planToken: 'signed-gift' },
  ], applyTool: async token => { calls.push(token); return { answer: 'Your actual fortune' }; },
  onReply: value => calls.push(value), performNative: async () => { calls.push('native-share'); }, openScreen: () => calls.push('wallet') });
  await executeAssistantActions(run);
  assert.deepEqual(calls, ['signed-gift', 'Your actual fortune', 'native-share', 'wallet']);
  await executeAssistantActions(run);
  assert.equal(calls.length, 4);
});
test('meal logging preserves exact supplied data and long conclusions reach the audio controller without truncation', async () => {
  requests.length = 0;
  await saveAssistantReading({ type: 'meal', meal_text: 'cơm, cá và rau', protein_g: 20, evidence: 'untrusted routing metadata' }, 'meal-request', 0, '2026-11-14T10:00:00Z');
  assert.deepEqual(requests[0].options.body.data, { meal_text: 'cơm, cá và rau', protein_g: 20 });
  const text = 'Full conclusion and advice. '.repeat(150), spoken = [];
  await executeAssistantActions(base({ actions: [{ type: 'speech', text }], speak: async value => spoken.push(value) }));
  assert.deepEqual(spoken, [text]);
});
test('changing accounts blocks later device actions and navigation after a confirmed app operation', async () => {
  let current = true;
  const seen = [];
  const run = base({ actions: [{ type: 'app_tool', tool: 'notifications.read_all', planToken: 'signed' }, { type: 'native', kind: 'profile.avatar', parameters: {} }],
    isCurrent: () => current, applyTool: async () => { current = false; return { answer: 'Previous owner' }; },
    onReply: value => seen.push(value), performNative: async () => seen.push('picker') });
  assert.equal(await executeAssistantActions(run), false);
  assert.deepEqual(seen, []);
});

test('medication confirmation uses only the signed preview, never client-supplied patient or schedule data', async () => {
  requests.length = 0;
  await applyAssistantMedication('signed-preview');
  assert.equal(requests[0].url, '/api/mobile/assistant/medication/apply');
  assert.deepEqual(requests[0].options.body, { planToken: 'signed-preview' });
});

test('a mixed confirmation retries the same medication plan without repeating completed readings', async () => {
  const seen = []; let fails = true;
  const run = base({ actions: [{ type: 'water', volume_ml: 200 }, { type: 'medication', planToken: 'signed-preview', changes: [] }, { type: 'language', value: 'en' }],
    saveReading: async () => seen.push('water'),
    applyMedication: async token => { seen.push(token); if (fails) { fails = false; throw Error('response lost'); } },
    setLanguage: value => seen.push(value),
  });
  await assert.rejects(executeAssistantActions(run));
  assert.deepEqual(seen, ['water', 'signed-preview']);
  await executeAssistantActions(run);
  assert.deepEqual(seen, ['water', 'signed-preview', 'signed-preview', 'en']);
});

test('a new account cannot confirm a previous account medication preview', async () => {
  const run = base({ actions: [{ type: 'medication', planToken: 'old', changes: [] }], isCurrent: () => false,
    applyMedication: () => assert.fail('A stale account must not apply medication') });
  assert.equal(await executeAssistantActions(run), false);
});

test('profile and routine reminders are confirmed before navigation, with no unrelated identity changes', async () => {
  const seen = [];
  const run = base({ actions: [{ type: 'navigate', destination: 'profile' }, { type: 'profile', planToken: 'signed-profile', changes: { name: 'An' } },
    { type: 'routine_reminders', planToken: 'routine', changes: [] }],
    updateProfile: async token => { seen.push(token); return { profile: { id: '1', name: 'An' } }; },
    onProfile: profile => seen.push(profile.name), applyReminders: async token => seen.push(token), navigate: destination => seen.push(destination),
  });
  await executeAssistantActions(run);
  assert.deepEqual(seen, ['signed-profile', 'An', 'routine', 'profile']);
  requests.length = 0;
  await applyAssistantProfile('signed-profile');
  assert.deepEqual(requests[0].options.body, { planToken: 'signed-profile' });
});

function conversationStorageHarness() {
  const values = new Map(), calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/app-assistant/assistant-conversation.storage.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const secure = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { calls.push(key); values.set(key, value); }, removeItem: async key => values.delete(key) };
  // eslint-disable-next-line no-new-func -- Exercise the trusted storage adapter without a device keychain.
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    assert.equal(id, '../../lib/secureStorage'); return { secureStorage: secure };
  });
  return { ...module.exports, values, calls, secure };
}
const conversation = text => ({ text, messages: [{ id: '1', role: 'user', text }], preview: null, feedback: '', stalePreview: false });
test('conversation history is private to its account, retains pending input and can clear only that account', async () => {
  const h = conversationStorageHarness();
  await h.saveAssistantConversation('A', conversation('private A'), () => true);
  await h.saveAssistantConversation('B', conversation('private B'), () => true);
  assert.equal((await h.readAssistantConversation('A', () => true)).text, 'private A');
  assert.equal((await h.readAssistantConversation('B', () => true)).text, 'private B');
  await h.clearAssistantConversation('A');
  assert.equal(await h.readAssistantConversation('A', () => true), null);
  assert.equal((await h.readAssistantConversation('B', () => true)).text, 'private B');
});
test('a delayed history read after logout cannot hydrate the next account', async () => {
  const h = conversationStorageHarness();
  let resolve, current = true;
  h.secure.getItem = () => new Promise(done => { resolve = done; });
  const pending = h.readAssistantConversation('A', () => current);
  await new Promise(done => setImmediate(done));
  current = false; resolve(JSON.stringify(conversation('old account')));
  assert.equal(await pending, null);
});
test('malformed saved commands cannot become pending confirmations and storage failure never falls back to plaintext', async () => {
  const h = conversationStorageHarness();
  await h.saveAssistantConversation('A', conversation('safe message'), () => true);
  const key = h.calls[0];
  h.values.set(key, JSON.stringify({ ...conversation('safe message'), preview: { actions: [{ type: 'navigate', destination: '/admin' }],
    requestId: 'id', recordedAt: new Date().toISOString(), completed: [] } }));
  assert.equal((await h.readAssistantConversation('A', () => true)).preview, null);
  h.secure.setItem = async () => { throw Error('Keychain unavailable'); };
  await assert.rejects(h.saveAssistantConversation('A', conversation('must stay private'), () => true), /Keychain/);
});
