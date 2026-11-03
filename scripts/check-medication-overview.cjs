const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const slots = []; let cursor = 0, effects = [];
  const memo = (fn, deps) => { const i = cursor++, old = slots[i]; if (!old || deps.some((x, n) => !Object.is(x, old.deps[n]))) slots[i] = { value: fn(), deps }; return slots[i].value; };
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef: initial => memo(() => ({ current: initial }), []), useCallback: (fn, deps) => memo(() => fn, deps),
  };
  const auth = { token: 'account-a', profile: { id: 1 } };
  const useAuthStore = Object.assign(select => select(auth), { getState: () => auth });
  const calls = [], toasts = [], errors = [];
  const schedule = { id: 'schedule-1', time_local: '07:30', item_ids: ['item-1'], consent_state: 'ACTIVE', active: true, pushOnly: false, revision: 1 };
  const overview = id => ({ patientId: id, self: id === 1, schedules: [schedule], items: [{ id: 'item-1', display_name: 'Tên đã xác nhận' }], flags: {} });
  const server = { fail: false, pending: null, late: null };
  const api = {
    flags: async () => { if (server.fail) throw Error('offline'); return { medication: true, patients: [{ id: 1, name: 'Tôi' }, { id: 2, name: 'Người thân' }] }; },
    overview: async id => { calls.push(['read', id]); if (server.late && id === 1) return server.late; return overview(id); },
    doses: async () => ({ items: [] }), weekly: async () => ({ report: { taken: 2, total: 3, skipped: 1, coins: 10 } }),
    saveSchedule: async (...args) => { calls.push(['save', ...args]); if (server.pending) await server.pending; },
    remove: async (...args) => { calls.push(['remove', ...args]); },
    preferences: async (...args) => { calls.push(['preference', ...args]); },
  };
  const deps = {
    react, 'expo-router': { useFocusEffect(callback) { const i = cursor++, old = slots[i]; if (!old || old.callback !== callback) { slots[i] = { callback }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback(); }); } } },
    'react-i18next': { useTranslation: () => ({ t: key => key }) }, '../auth/auth.store': { useAuthStore },
    '../../stores/toast.store': { useToastStore: { getState: () => ({ show: (...args) => toasts.push(args) }) } },
    './V21Layout': { v21Error: e => errors.push(e) }, './v21.api': { v21Api: api },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationOverview.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Execute the production controller with isolated network/native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, key => { assert.ok(key in deps, key); return deps[key]; });
  const read = () => { cursor = 0; return module.exports.useMedicationOverview(); };
  const settle = async () => { for (let n = 0; n < 3; n++) { read(); const work = effects; effects = []; work.forEach(fn => fn()); await flush(); } return read(); };
  return { read, settle, calls, server, auth, toasts, errors, schedule, overview, blur: () => slots.forEach(x => x?.cleanup?.()) };
}
let count = 0;
async function test(name, work) { await work(); count++; console.log('PASS ' + name); }
(async () => {
  await test('opening medication only loads data; schedule actions never write without a chosen action', async () => {
    const h = harness(); const view = await h.settle(); assert.equal(view.data.patientId, 1);
    view.openSchedule(h.schedule); const opened = h.read(); assert.equal(opened.mode, 'menu'); assert.equal(opened.canSave, false);
    await opened.remove(); assert.ok(h.calls.every(x => x[0] === 'read')); h.blur();
  });
  await test('editing validates time and keeps at least one item before saving', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule); h.read().setMode('edit');
    h.read().setTime('28:99'); assert.equal(h.read().canSave, false);
    h.read().setTime('08:00'); h.read().toggleItem('item-1'); assert.equal(h.read().canSave, false);
    h.read().toggleItem('item-1'); await h.read().save();
    assert.deepEqual(h.calls.find(x => x[0] === 'save'), ['save', 1, 'schedule-1', { time_local: '08:00', item_ids: ['item-1'] }]); h.blur();
  });
  await test('rapid save presses send one mutation and closing stays blocked while saving', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule); h.read().setMode('edit'); h.read().setTime('08:00');
    const done = defer(); h.server.pending = done.promise; const first = h.read().save(); await h.read().save(); h.read().closeSchedule();
    assert.ok(h.read().selected); assert.equal(h.calls.filter(x => x[0] === 'save').length, 1);
    done.resolve(); await first; assert.equal(h.read().selected, null); h.blur();
  });
  await test('cancel never deletes; only the removal confirmation submits deletion', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule); h.read().setMode('remove'); h.read().closeSchedule(); await h.read().remove();
    assert.ok(!h.calls.some(x => x[0] === 'remove')); h.read().openSchedule(h.schedule); h.read().setMode('remove'); await h.read().remove();
    assert.deepEqual(h.calls.find(x => x[0] === 'remove'), ['remove', 1, 'schedule-1']); h.blur();
  });
  await test('switching people discards the old editor and rejects late results from the previous person', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule); const old = defer(); h.server.late = old.promise;
    const pending = h.read().refresh(); await flush(); h.read().selectPatient(2); await h.settle();
    old.resolve(h.overview(1)); await pending; assert.equal(h.read().data.patientId, 2); assert.equal(h.read().selected, null); h.blur();
  });
  await test('an unavailable refresh preserves visible data and retry clears its error', async () => {
    const h = harness(); await h.settle(); h.server.fail = true; await h.read().refresh();
    assert.equal(h.read().failed, true); assert.equal(h.read().data.patientId, 1);
    h.server.fail = false; await h.read().refresh(); assert.equal(h.read().failed, false); h.blur();
  });
  await test('account changes reject old edits before any mutation', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule); h.read().setMode('edit'); h.read().setTime('08:00');
    const old = h.read(); h.auth.token = 'account-b'; await old.save(); assert.ok(!h.calls.some(x => x[0] === 'save')); h.blur();
  });
  console.log(`Medication overview: ${count} runtime checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
