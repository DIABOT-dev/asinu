const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const requests = [];
const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/features/app-assistant/app-assistant.api.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('module', 'exports', 'require', source)(moduleUnderTest, moduleUnderTest.exports, id => {
  assert.equal(id, '../../lib/apiClient');
  return { apiClient: async (url, options) => { requests.push({ url, options }); return { ok: true, log_id: 'saved' }; } };
});
const { executeAssistantActions, saveAssistantReading, planAssistantActions } = moduleUnderTest.exports;
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
