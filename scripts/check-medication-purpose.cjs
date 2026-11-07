/* eslint-disable no-new-func -- Execute trusted production modules with isolated native/network adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function harness() {
  let cursor = 0, focused = true, generation = 1, nextTimer = 0;
  const slots = [], effects = [], timers = new Map(), calls = [];
  const props = { enabled: true, patient: 1, scopeKey: 'owner:1', version: 1,
    current: version => focused && version === generation,
    draft: [{ clientId: 'item-1', display_name: 'Hapacol 650', kind: 'MEDICINE', confirmed: true, source: 'CHIP', anchors: [] }],
    setDraft: update => { props.draft = typeof update === 'function' ? update(props.draft) : update; },
  };
  const server = { result: { status: 'matched', tags: ['fever_reduction', 'pain_relief'], token: 'verified-fixture-token', productName: 'Hapacol 650', source: { name: 'DHG Pharma', url: 'https://dhgpharma.com.vn/vi/san-pham/giam-dau-ha-sot/hapacol-650-0' } }, pending: null, error: false };
  const memo = (make, deps) => { const i = cursor++, old = slots[i]; if (!old || deps.some((value, n) => value !== old.deps[n])) slots[i] = { deps, value: make() }; return slots[i].value; };
  const react = {
    useRef: value => memo(() => ({ current: value }), []),
    useEffect(callback, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((value, n) => value !== old.deps[n])) { slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback(); }); } },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationPurposeLookup.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dependencies = { react, './v21.api': { v21Api: { lookupPurpose: async (patient, name) => {
    calls.push({ patient, name }); if (server.error) throw Error('offline'); return server.pending || server.result;
  } } } };
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', source)(module, module.exports,
    name => { assert.ok(name in dependencies, name); return dependencies[name]; },
    callback => { const id = ++nextTimer; timers.set(id, callback); return id; }, id => timers.delete(id));
  const render = () => { cursor = 0; const result = module.exports.useMedicationPurposeLookup(props); effects.splice(0).forEach(work => work()); return result; };
  const runTimers = () => { const current = [...timers.values()]; timers.clear(); current.forEach(work => work()); };
  const settle = async () => { for (let i = 0; i < 4; i++) { render(); runTimers(); await flush(); } return render(); };
  return { props, server, calls, render, runTimers, settle, blur: () => { focused = false; },
    refocus: () => { focused = true; props.version = ++generation; },
    rename: name => { props.draft = props.draft.map(item => ({ ...item, display_name: name, purposeLookup: undefined, selectedPurposeCodes: [] })); },
    account: () => { props.scopeKey = 'next:2'; props.patient = 2; props.version = ++generation; props.draft = [{ ...props.draft[0], purposeLookup: undefined, selectedPurposeCodes: [] }]; },
  };
}
let checks = 0;
async function test(label, run) { await run(); checks++; console.log('PASS ' + label); }
(async () => {
  await test('a saved medicine keeps its confirmed tags and never waits for a second AI lookup', async () => {
    const h=harness();h.props.draft[0].existingItemId='saved-medicine';h.props.draft[0].selectedPurposeCodes=['pain_relief'];
    assert.equal(h.render().pending,false);await h.settle();assert.equal(h.calls.length,0);
    assert.equal(h.props.draft[0].confirmed,true);assert.deepEqual(h.props.draft[0].selectedPurposeCodes,['pain_relief']);
  });
  await test('lookup is pending before debounce, then proposes source tags without confirming them', async () => {
    const h = harness(); assert.equal(h.render().pending, true); assert.equal(h.calls.length, 0);
    await h.settle(); assert.equal(h.calls.length, 1); assert.deepEqual(h.props.draft[0].selectedPurposeCodes, ['fever_reduction', 'pain_relief']);
    assert.equal(h.props.draft[0].confirmed, false); assert.equal(h.render().pending, false);
  });
  await test('successful HTTP lookup metadata is not copied into the strict medication draft', async () => {
    const h = harness();
    const expected = structuredClone(h.server.result);
    h.server.result = { ok: true, ...h.server.result, requestId: 'transport-only', source: { ...h.server.result.source, transport: true } };
    await h.settle();
    assert.deepEqual(h.props.draft[0].purposeLookup.result, expected);
    assert.equal(h.props.draft[0].confirmed, false);
  });
  await test('a late result cannot tag a different medicine or a removed item', async () => {
    const h = harness(), old = deferred(); h.server.pending = old.promise; h.render(); h.runTimers(); h.rename('Another medicine');
    old.resolve(h.server.result); await flush(); assert.equal(h.props.draft[0].purposeLookup, undefined);
    h.props.draft = []; await h.settle(); assert.deepEqual(h.props.draft, []);
  });
  await test('blur discards a result, and refocus resumes a previously pending lookup', async () => {
    const h = harness(), old = deferred(); h.server.pending = old.promise; h.render(); h.runTimers(); h.blur(); old.resolve(h.server.result); await flush();
    assert.equal(h.props.draft[0].purposeLookup.loading, true); h.refocus(); await h.settle();
    assert.equal(h.props.draft[0].purposeLookup.loading, false); assert.equal(h.calls.length, 1);
  });
  await test('another account cannot reuse an old response or its request cache', async () => {
    const h = harness(), old = deferred(); h.server.pending = old.promise; h.render(); h.runTimers(); h.account(); old.resolve(h.server.result); await flush();
    assert.equal(h.props.draft[0].purposeLookup, undefined); h.server.pending = null; await h.settle(); assert.equal(h.calls.length, 2); assert.equal(h.calls[1].patient, 2);
  });
  await test('unavailable or unrecognized names finish without inventing tags and can be retried', async () => {
    const h = harness(); h.server.error = true; await h.settle(); assert.equal(h.render().pending, false); assert.deepEqual(h.props.draft[0].selectedPurposeCodes, []);
    h.server.error = false; h.server.result = { status: 'not_found', tags: [] }; h.render().retry(h.props.draft[0]); await h.settle();
    assert.equal(h.calls.length, 2); assert.equal(h.props.draft[0].purposeLookup.result.status, 'not_found');
  });
  await test('supplements do not receive medicine-purpose tags or an unnecessary lookup', async () => {
    const h = harness(); h.props.draft[0].kind = 'SUPPLEMENT'; await h.settle(); assert.equal(h.calls.length, 0); assert.equal(h.render().pending, false);
  });
  await test('malformed successful responses and unknown tags cannot leave a loading state or attach unsafe data', async () => {
    for (const result of [{}, { status: 'matched', tags: ['invented_tag'] }, { status: 'matched', tags: ['pain_relief'] }, { status: 'matched', tags: ['pain_relief'], token: 'fixture', productName: 'Hapacol', source: { name: 'Source', url: 'javascript:alert(1)' } }]) {
      const h = harness(); h.server.result = result; await h.settle();
      assert.equal(h.render().pending, false); assert.equal(h.props.draft[0].purposeLookup.result.status, 'unavailable'); assert.deepEqual(h.props.draft[0].selectedPurposeCodes, []);
    }
  });
  console.log(`Medication purpose: ${checks} asynchronous regressions passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
