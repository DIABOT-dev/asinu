/* eslint-disable no-new-func -- Execute trusted production modules with isolated native/network adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const slots = []; let cursor = 0, effects = [], focusCallback;
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
    overview: async (id, includePaused) => { calls.push(['read', id, includePaused]); if (server.late && id === 1) return server.late; return {...overview(id),draft:server.draft,drafts:server.drafts}; },
    doses: async () => {if(server.dosesPending)await server.dosesPending;if(server.dosesFail)throw Error('doses unavailable');return {items:server.doses||[]};}, weekly: async () => {if(server.weekPending)await server.weekPending;if(server.weekFail)throw Error('weekly unavailable');return { report: { taken: 2, total: 3, skipped: 1, coins: 10 } };},
    saveSchedule: async (...args) => { calls.push(['save', ...args]); if (server.pending) await server.pending; if (server.writeFail) throw Error('offline'); Object.assign(schedule, args[2]); },
    remove: async (...args) => { calls.push(['remove', ...args]); },
    removeDraft: async (...args) => { calls.push(['removeDraft', ...args]); if(server.pending)await server.pending;if(server.writeFail)throw Error('offline');server.drafts=server.drafts?.filter(d=>d.id!==args[1]);server.draft=server.drafts?.[0]||null; },
    preferences: async (...args) => { calls.push(['preference', ...args]); },
  };
  const deps = {
    react, 'expo-router': { useFocusEffect(callback) { focusCallback=callback;const i = cursor++, old = slots[i]; if (!old || old.callback !== callback) { slots[i] = { callback }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback(); }); } } },
    'react-i18next': { useTranslation: () => ({ t: key => key }) }, '../auth/auth.store': { useAuthStore },
    '../../stores/toast.store': { useToastStore: { getState: () => ({ show: (...args) => toasts.push(args) }) } },
    './V21Layout': { v21Error: e => errors.push(e) }, './v21.api': { v21Api: api },
  };
  const module = { exports: {} };
  const inputs = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/features/v21/medication-input.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(inputs, inputs.exports);
  deps['./medication-input'] = inputs.exports;
  const code = ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationOverview.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Execute the production controller with isolated network/native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, key => { assert.ok(key in deps, key); return deps[key]; });
  const read = () => { cursor = 0; return module.exports.useMedicationOverview(); };
  const settle = async () => { for (let n = 0; n < 3; n++) { read(); const work = effects; effects = []; work.forEach(fn => fn()); await flush(); } return read(); };
  return { read, settle, calls, server, auth, toasts, errors, schedule, overview, refocus:()=>focusCallback(),blur: () => slots.forEach(x => x?.cleanup?.()) };
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
    assert.deepEqual(h.calls.find(x => x[0] === 'save'), ['save', 1, 'schedule-1', { time_local: '08:00', item_ids: ['item-1'], active: true, note: '', meal_anchor: undefined }]); h.blur();
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
  await test('paused schedules remain readable; toggling sends existing note and meal timing and reports success', async () => {
    const h = harness(); h.schedule.note = 'Sau bữa ăn'; h.schedule.meal_anchor = 'after_breakfast';
    await h.settle(); assert.equal(h.calls.find(x => x[0] === 'read')[2], true);
    await h.read().setScheduleActive(h.schedule, false);
    assert.equal(h.read().data.schedules[0].active, false);
    assert.equal(h.calls.find(x => x[0] === 'save')[3].note, 'Sau bữa ăn');
    assert.equal(h.calls.find(x => x[0] === 'save')[3].meal_anchor, 'after_breakfast');
    assert.equal(h.toasts.at(-1)[0], 'schedulePaused');
    await h.read().setScheduleActive(h.schedule, true);
    assert.equal(h.schedule.active, true); assert.equal(h.toasts.at(-1)[0], 'scheduleResumed'); h.blur();
  });
  await test('editing only a note preserves a paused schedule and rejects dosage and excessive text', async () => {
    const h = harness(); h.schedule.active = false; h.schedule.note = 'Sau ăn'; h.schedule.meal_anchor = 'after_breakfast';
    (await h.settle()).openSchedule(h.schedule); h.read().setMode('edit');
    h.read().setNote(' Sau ăn '); assert.equal(h.read().canSave, false);
    for (const invalid of ['a'.repeat(61), 'uống 2 viên', '5 mg', 'dosage']) {
      h.read().setNote(invalid); assert.equal(h.read().canSave, false); await h.read().save();
    }
    assert.equal(h.calls.filter(x => x[0] === 'save').length, 0);
    h.read().setNote(' Sau bữa sáng '); assert.equal(h.read().canSave, true); await h.read().save();
    assert.equal(h.schedule.note, 'Sau bữa sáng'); assert.equal(h.schedule.active, false); assert.equal(h.schedule.meal_anchor, 'after_breakfast'); h.blur();
  });
  await test('toggle failure leaves the accepted state unchanged and does not show success', async () => {
    const h = harness(); await h.settle(); h.server.writeFail = true;
    await h.read().setScheduleActive(h.schedule, false);
    assert.equal(h.schedule.active, true); assert.equal(h.toasts.length, 0); assert.equal(h.errors.length, 1); assert.equal(h.read().busy, false); h.blur();
  });
  await test('rapid toggle presses cannot submit twice and a previous account cannot toggle', async () => {
    const h = harness(); await h.settle(); const done = defer(); h.server.pending = done.promise;
    const pending = h.read().setScheduleActive(h.schedule, false); await h.read().setScheduleActive(h.schedule, false);
    assert.equal(h.calls.filter(x => x[0] === 'save').length, 1); done.resolve(); await pending;
    const old = h.read(); h.auth.token = 'account-b'; await old.setScheduleActive(h.schedule, true);
    assert.equal(h.calls.filter(x => x[0] === 'save').length, 1); h.blur();
  });
  for (const action of ['save', 'toggle', 'refresh']) await test(`old ${action} handlers cannot act on the previous person after switching patients`, async () => {
    const h=harness();(await h.settle()).openSchedule(h.schedule);h.read().setMode('edit');h.read().setNote('Ghi chú mới');const old=h.read();
    h.read().selectPatient(2);await h.settle();
    if(action==='save')await old.save();else if(action==='toggle')await old.setScheduleActive(h.schedule,false);else await old.refresh();
    assert.equal(h.calls.filter(x=>x[0]==='save').length,0);assert.equal(h.read().data.patientId,2);h.blur();
  });
  await test('a new account render immediately hides the previous account names, data and editor',async()=>{
    const h=harness();(await h.settle()).openSchedule(h.schedule);h.auth.token='account-b';h.auth.profile.id=2;
    assert.equal(h.read().data,null);assert.deepEqual(h.read().patients,[]);assert.equal(h.read().selected,null);h.blur();
  });
  await test('deleting one chosen draft keeps all other drafts and saved schedules',async()=>{
    const h=harness();h.server.drafts=[{id:'draft-1',revision:3},{id:'draft-2',revision:2}];await h.settle();
    assert.equal(h.calls.some(x=>x[0]==='removeDraft'),false);
    assert.equal(await h.read().removeDraft('draft-2'),true);
    assert.deepEqual(h.calls.find(x=>x[0]==='removeDraft'),['removeDraft',1,'draft-2',2]);
    assert.deepEqual(h.read().data.drafts,[{id:'draft-1',revision:3}]);assert.equal(h.read().data.schedules[0],h.schedule);
    assert.equal(h.calls.some(x=>x[0]==='save'||x[0]==='remove'),false);h.blur();
  });
  await test('a failed deletion retains the draft and reports failure',async()=>{
    const h=harness();h.server.draft={id:'draft-1',revision:3};await h.settle();h.server.writeFail=true;
    assert.equal(await h.read().removeDraft('draft-1'),false);assert.equal(h.read().data.draft.id,'draft-1');
    assert.equal(h.read().busy,false);assert.equal(h.errors.length,1);h.blur();
  });
  await test('double deletion and stale patient or account actions cannot delete another draft',async()=>{
    const h=harness();h.server.draft={id:'draft-1',revision:3};await h.settle();const done=defer();h.server.pending=done.promise;
    const old=h.read();const first=old.removeDraft('draft-1');assert.equal(await old.removeDraft('draft-1'),false);
    assert.equal(h.calls.filter(x=>x[0]==='removeDraft').length,1);done.resolve();assert.equal(await first,true);
    h.server.draft={id:'draft-2',revision:1};await h.read().refresh();const previous=h.read();
    h.read().selectPatient(2);await h.settle();await previous.removeDraft('draft-2');
    const other=h.read();h.auth.token='other-account';await other.removeDraft('draft-2');
    assert.equal(h.calls.filter(x=>x[0]==='removeDraft').length,1);h.blur();
  });
  await test('returning to the same patient refreshes in the background without clearing the page',async()=>{
    const h=harness();await h.settle();h.blur();h.refocus();
    assert.equal(h.read().loading,false);assert.equal(h.read().data.patientId,1);
    await h.settle();assert.equal(h.read().loading,false);h.blur();
  });
  await test('a slow or failed weekly report cannot delay saved schedules or today doses',async()=>{
    const h=harness(),week=defer();h.server.weekPending=week.promise;h.server.doses=[{id:'dose-1'}];await h.settle();
    assert.equal(h.read().data.patientId,1);assert.deepEqual(h.read().doses,[{id:'dose-1'}]);assert.equal(h.read().loading,false);assert.equal(h.read().failed,false);
    h.server.weekFail=true;week.resolve();await flush();assert.equal(h.read().data.patientId,1);assert.equal(h.read().failed,false);assert.equal(h.read().weekly,null);h.blur();
  });
  await test('a slow today request never blocks the schedule list or invents an empty day',async()=>{
    const h=harness(),today=defer();h.server.dosesPending=today.promise;h.server.doses=[{id:'dose-late'}];await h.settle();
    assert.equal(h.read().data.schedules[0],h.schedule);assert.equal(h.read().loading,false);assert.equal(h.read().todayLoading,true);
    today.resolve();await flush();assert.deepEqual(h.read().doses,[{id:'dose-late'}]);assert.equal(h.read().todayLoading,false);h.blur();
  });
  await test('late optional statistics are ignored after a patient or account changes',async()=>{
    const h=harness(),oldWeek=defer();h.server.weekPending=oldWeek.promise;await h.settle();
    h.server.weekPending=null;h.read().selectPatient(2);await h.settle();const current=h.read().weekly;oldWeek.resolve();await flush();
    assert.equal(h.read().data.patientId,2);assert.equal(h.read().weekly,current);h.blur();
  });
  console.log(`Medication overview: ${count} runtime checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
