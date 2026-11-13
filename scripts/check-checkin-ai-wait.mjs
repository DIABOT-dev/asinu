import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function harness() {
  const timers = new Map();
  let sequence = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/checkin/wait-for-triage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Run the actual request loop with controlled time, without native networking.
  new Function('module', 'exports', 'setTimeout', 'clearTimeout', code)(
    module, module.exports,
    callback => { const id = ++sequence; timers.set(id, callback); return id; },
    id => timers.delete(id),
  );
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    ...module.exports, timers, flush,
    async tick() {
      await flush();
      const entry = timers.entries().next().value;
      assert.ok(entry, 'Polling should remain active while the AI is pending');
      timers.delete(entry[0]); entry[1]();
      await flush();
    },
  };
}

test('many processing responses keep one caller waiting until its actual question arrives', async () => {
  const h = harness();
  let calls = 0, settled = false;
  const expected = { ok: true, isDone: false, question: 'Synthetic accepted question' };
  const pending = h.waitForTriage(async () => ++calls < 41 ? { ok: true, processing: true } : expected)
    .then(value => { settled = true; return value; });
  await h.flush();
  for (let i = 0; i < 39; i++) { assert.equal(settled, false); await h.tick(); }
  assert.equal(settled, false);
  await h.tick();
  assert.deepEqual(await pending, expected);
  assert.equal(calls, 41);
  assert.equal(h.timers.size, 0);
});

for (const error of [Object.assign(new Error('synthetic client timeout'), { name: 'RequestTimeoutError' }), { statusCode: 504 }])
  test(`a transport timeout retries the same request: ${error.name || error.statusCode}`, async () => {
    const h = harness();
    let calls = 0;
    const expected = { ok: true, isDone: true, narrative: 'Synthetic conclusion' };
    const pending = h.waitForTriage(async () => { if (++calls === 1) throw error; return expected; });
    await h.tick();
    assert.deepEqual(await pending, expected);
    assert.equal(calls, 2);
  });

for (const statusCode of [400, 401, 403, 409, 429, 500, 503])
  test(`a non-timeout API error ${statusCode} stops instead of polling forever`, async () => {
    const h = harness();
    const error = Object.assign(new Error('synthetic error'), { statusCode });
    let calls = 0;
    await assert.rejects(h.waitForTriage(async () => { calls++; throw error; }), value => value === error);
    assert.equal(calls, 1);
    assert.equal(h.timers.size, 0);
  });

test('leaving/cancelling the screen clears its polling timer and never requests another result', async () => {
  const h = harness(), controller = new AbortController();
  let calls = 0;
  const pending = h.waitForTriage(async () => { calls++; return { ok: true, processing: true }; }, controller.signal);
  const checked = assert.rejects(pending, { name: 'AbortError' });
  await h.flush();
  assert.equal(h.timers.size, 1);
  controller.abort();
  await checked;
  assert.equal(h.timers.size, 0);
  assert.equal(calls, 1);
});

test('an already cancelled screen makes no API request', async () => {
  const h = harness(), controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(h.waitForTriage(async () => { calls++; }, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});
