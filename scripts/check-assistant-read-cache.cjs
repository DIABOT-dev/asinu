const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function evaluate(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  // eslint-disable-next-line no-new-func -- Execute the actual cache with isolated device, auth and HTTP adapters.
  new Function('module', 'exports', 'require', code)(module, module.exports, name => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
    return imports[name];
  });
  return module.exports;
}
const hash = text => createHash('sha256').update(text).digest('hex');
const request = (text = 'Tôi còn thông báo nào chưa đọc?', patch = {}) => ({ text, current: { language: 'vi', fontSize: 'normal' }, ...patch });
class ApiError extends Error {
  constructor(code, statusCode) { super(code); this.code = code; this.statusCode = statusCode; }
}
function harness() {
  const values = new Map(), listeners = new Set(), requests = [];
  const now = Date.now();
  let session = { owner: 'A', token: 'session-A' }, balance = 10;
  let planReply, replayError, pausePlan;
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  };
  const cacheModule = evaluate('src/features/app-assistant/assistant-read-cache.storage.ts', {
    '../../lib/secureStorage': { secureStorage: storage },
    '../../lib/healthStoreSession': { healthStoreSession: {
      capture: () => ({ owner: session?.owner ?? null }),
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    } },
  });
  // Exercise the same storage instance used by the exported production wrapper.
  const metadata = key => ({ key, token: `header.${key}.signature`, expiresAt: new Date(now + 60000).toISOString() });
  let planner;
  const api = {
    planAssistantActions: async input => {
      requests.push('plan');
      if (pausePlan) {await pausePlan;}
      const key = hash(planner.canonicalAssistantReadRequest(input));
      return planReply || { status: 'answer', question: '', answer: `Balance ${balance}`, actions: [], readCache: metadata(key) };
    },
    replayAssistantReadCache: async (token, input, signal) => {
      requests.push('replay');
      assert.equal(signal.aborted, false);
      assert.equal(token, metadata(hash(planner.canonicalAssistantReadRequest(input))).token);
      if (replayError) {throw replayError;}
      return { status: 'answer', question: '', answer: `Balance ${balance}`, actions: [] };
    },
  };
  planner = evaluate('src/features/app-assistant/assistant-read-cache.ts', {
    'expo-crypto': { digestStringAsync: async (_algorithm, value) => hash(value), CryptoDigestAlgorithm: { SHA256: 'sha256' } },
    '../../lib/apiClient': { ApiError },
    '../auth/auth.store': { useAuthStore: { getState: () => ({ profile: session ? { id: session.owner } : null, token: session?.token ?? null }) } },
    './app-assistant.api': api,
    './assistant-read-cache.storage': cacheModule,
  });
  return {
    ...planner, ...cacheModule, storage, values, requests, metadata,
    run: input => planner.planAssistantWithReadCache(input, new AbortController().signal),
    balance: value => { balance = value; },
    reply: value => { planReply = value; },
    failReplay: value => { replayError = value; },
    pause: value => { pausePlan = value; },
    session: async value => { session = value; for (const listener of listeners) {listener();} await new Promise(resolve => setImmediate(resolve)); },
  };
}

test('repeated read reuses the device-held plan and receives changed live data without another AI plan', async () => {
  const h = harness();
  assert.equal((await h.run(request())).answer, 'Balance 10');
  h.balance(25);
  assert.equal((await h.run(request())).answer, 'Balance 25');
  assert.deepEqual(h.requests, ['plan', 'replay']);
  assert.ok([...h.values.values()].every(value => !value.includes('Balance')));
});

test('canonical keys preserve meaning and distinguish language, font, article visibility and qualifiers', () => {
  const h = harness();
  const first = request('  Xem bài viết  ', { hiddenArticles: ['b', 'a', 'a'], allowCuratedArticles: undefined });
  assert.equal(h.canonicalAssistantReadRequest(first), JSON.stringify({ text: 'Xem bài viết', current: { language: 'vi', fontSize: 'normal' }, hiddenArticles: ['a', 'b'], allowCuratedArticles: true }));
  assert.equal(h.canonicalAssistantReadRequest(first), h.canonicalAssistantReadRequest({ ...first, conversation: [{ role: 'user', text: 'Earlier context' }] }));
  for (const change of [{ text: 'Xóa bài viết' }, { current: { language: 'en', fontSize: 'normal' } }, { current: { language: 'vi', fontSize: 'large' } }, { hiddenArticles: ['a'] }, { allowCuratedArticles: false }])
    {assert.notEqual(h.canonicalAssistantReadRequest(first), h.canonicalAssistantReadRequest({ ...first, ...change }));}
});

test('device fingerprints match the actual backend canonical contract', () => {
  const h = harness();
  const backend = require(path.resolve('../backend.asinu/src/services/assistant/assistant-request.schema.js'));
  for (const input of [request(), request('  Xem thông báo của tôi  ', { hiddenArticles: ['b', 'a', 'a'] }),
    request('Các bài viết về giấc ngủ 🌙', { current: { language: 'en', fontSize: 'large' }, allowCuratedArticles: false }),
    request('Xem lại kết luận', { conversation: [{ role: 'user', text: 'Previous history is not part of a context-independent cache key.' }] })]) {
    assert.equal(h.canonicalAssistantReadRequest(input), JSON.stringify(backend.canonicalRequest(input)));
    assert.equal(hash(h.canonicalAssistantReadRequest(input)), backend.fingerprint(input));
  }
});

test('write previews and mixed actions are never retained even if a response contains cache metadata', async () => {
  const h = harness();
  const input = request('Mở hộp lộc số 2');
  h.reply({ status: 'ready', question: '', actions: [{ type: 'app_tool', tool: 'gifts.open', planToken: 'write-token' }], readCache: h.metadata(hash(h.canonicalAssistantReadRequest(input))) });
  await h.run(input); await h.run(input);
  assert.deepEqual(h.requests, ['plan', 'plan']);
  assert.equal(h.values.size, 0);
});

test('clarification inputs bypass cache lookup and cache writes', async () => {
  const h = harness();
  await h.run(request());
  const input = request(undefined, { clarification: { original: 'Xem thông báo', question: 'Thông báo nào?' } });
  await h.run(input); await h.run(input);
  assert.deepEqual(h.requests, ['plan', 'plan', 'plan']);
});

test('only the explicit cache-miss response performs one normal replan', async () => {
  const h = harness();
  await h.run(request());
  h.failReplay(new ApiError('APP_ASSISTANT_READ_CACHE_MISS', 409));
  await h.run(request());
  assert.deepEqual(h.requests, ['plan', 'replay', 'plan']);
});

test('revoked permissions, consent, auth and transport failures never fall through to AI planning', async () => {
  for (const error of [new ApiError('AI_CONSENT_REQUIRED', 403), new ApiError('CAREGIVER_VIEW_DISABLED', 403), new ApiError('UNAUTHORIZED', 401), new Error('Network request failed')]) {
    const h = harness();
    await h.run(request()); h.failReplay(error);
    await assert.rejects(h.run(request()), reason => reason === error);
    assert.deepEqual(h.requests, ['plan', 'replay']);
  }
});

test('logout removes encrypted cache and another user cannot reuse its capability', async () => {
  const h = harness();
  await h.run(request());
  assert.ok(h.values.size > 0);
  await h.session(null);
  assert.equal(h.values.size, 0);
  await h.session({ owner: 'B', token: 'session-B' });
  await h.run(request());
  assert.deepEqual(h.requests, ['plan', 'plan']);
});

test('an account switch during a pending AI response cannot persist the previous owner capability', async () => {
  const h = harness();
  let resolve;
  h.pause(new Promise(done => { resolve = done; }));
  const pending = h.run(request());
  await new Promise(done => setImmediate(done));
  await h.session({ owner: 'B', token: 'session-B' });
  resolve();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(h.values.size, 0);
});

test('expired records are deleted, records are owner scoped and the cache evicts beyond eight entries', async () => {
  const h = harness();
  let now = Date.now();
  const cache = h.createAssistantReadCacheStorage(h.storage, () => now);
  for (let i = 0; i < 9; i++) {await cache.set('A', { ...h.metadata(hash(String(i))), expiresAt: new Date(now + 60000).toISOString() }, () => true);}
  assert.equal(await cache.get('A', hash('0'), () => true), null);
  assert.ok(await cache.get('A', hash('8'), () => true));
  assert.equal(await cache.get('B', hash('8'), () => true), null);
  now += 61000;
  assert.equal(await cache.get('A', hash('8'), () => true), null);
});

test('SecureStore chunks survive a cold cache instance and are removed together', async () => {
  const h = harness();
  const key = hash('large read');
  const value = { ...h.metadata(key), token: `${'a'.repeat(7000)}.body.signature` };
  const cache = h.createAssistantReadCacheStorage(h.storage);
  await cache.set('A', value, () => true);
  assert.ok(h.values.size > 3);
  assert.ok([...h.values.values()].every(part => part.length <= 1400));
  const reopened = h.createAssistantReadCacheStorage(h.storage);
  assert.deepEqual(await reopened.get('A', key, () => true), value);
  await reopened.clear('A');
  assert.equal(h.values.size, 0);
});

test('a storage write failure remains optional and cannot retain a partial capability', async () => {
  const h = harness();
  const broken = { ...h.storage, setItem: async (key, value) => { if (key.endsWith('_1')) {throw Error('Secure storage unavailable');} await h.storage.setItem(key, value); } };
  const cache = h.createAssistantReadCacheStorage(broken);
  const value = { ...h.metadata(hash('large')), token: `${'a'.repeat(4000)}.body.signature` };
  await cache.set('A', value, () => true);
  assert.equal(h.values.size, 0);
});

test('clearing during an in-flight secure write fences the late response', async () => {
  const h = harness();
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const slow = { ...h.storage, setItem: async (key, value) => { await wait; await h.storage.setItem(key, value); } };
  const cache = h.createAssistantReadCacheStorage(slow);
  const pending = cache.set('A', h.metadata(hash('x')), () => true);
  await new Promise(resolve => setImmediate(resolve));
  const clear = cache.clear('A');
  release(); await pending; await clear;
  assert.equal(h.values.size, 0);
});
