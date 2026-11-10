/* eslint-disable no-new-func -- Execute trusted production modules with isolated native/network adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const slots = [], timers=new Map(), clock={now:Date.now()}; let cursor = 0, effects = [], focusCallback;
  class Clock extends Date { constructor(...args){super(...(args.length?args:[clock.now]));} static now(){return clock.now;} }
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
    doses: async () => {server.doseReadCount=(server.doseReadCount||0)+1;const value={items:server.doses||[],serverTime:server.serverTime};if(server.dosesPending)await server.dosesPending;if(server.dosesFail)throw Error('doses unavailable');return value;}, weekly: async () => {if(server.weekPending)await server.weekPending;if(server.weekFail)throw Error('weekly unavailable');return { report: { taken: 2, total: 3, skipped: 1, coins: 10 } };},
    moveItem: async (...args) => { calls.push(['move', ...args]); if (server.pending) await server.pending; if (server.writeFail) throw Error('offline'); return {}; },
    saveSchedule: async (...args) => { calls.push(['save', ...args]); if (server.pending) await server.pending; if (server.writeFail) throw Error('offline'); Object.assign(schedule, args[2]); },
    remove: async (...args) => { calls.push(['remove', ...args]); },
    removeDraft: async (...args) => { calls.push(['removeDraft', ...args]); if(server.pending)await server.pending;if(server.writeFail)throw Error('offline');server.drafts=server.drafts?.filter(d=>d.id!==args[1]);server.draft=server.drafts?.[0]||null; },
    preferences: async (...args) => { calls.push(['preference', ...args]); },
  };
  const deps = { 'expo-crypto': { randomUUID: require('node:crypto').randomUUID },
    react, 'expo-router': { useFocusEffect(callback) { focusCallback=callback;const i = cursor++, old = slots[i]; if (!old || old.callback !== callback) { slots[i] = { callback }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = callback(); }); } } },
    'react-i18next': { useTranslation: () => ({ t: key => key }) }, '../auth/auth.store': { useAuthStore },
    '../../stores/toast.store': { useToastStore: { getState: () => ({ show: (...args) => toasts.push(args) }) } },
    './V21Layout': { v21Error: e => errors.push(e) }, './v21.api': { v21Api: api },
  };
  const module = { exports: {} };
  const inputs = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/features/v21/medication-input.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(inputs, inputs.exports);
  deps['./medication-input'] = inputs.exports;
  const display={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/features/v21/medication-dose-display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(display,display.exports);deps['./medication-dose-display']=display.exports;
  const code = ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationOverview.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Execute the production controller with isolated network/native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', 'setInterval', 'clearInterval', 'Date', code)(module, module.exports, key => { assert.ok(key in deps, key); return deps[key]; }, fn=>{const id=Symbol();timers.set(id,fn);return id;},id=>timers.delete(id),Clock);
  const read = () => { cursor = 0; return module.exports.useMedicationOverview(); };
  const settle = async () => { for (let n = 0; n < 3; n++) { read(); const work = effects; effects = []; work.forEach(fn => fn()); await flush(); } return read(); };
  return { read, settle, calls, server, auth, toasts, errors, schedule, overview, clock, tick:async(ms=15000)=>{clock.now+=ms;for(const fn of timers.values())fn();await flush();}, refocus:()=>focusCallback(),blur: () => {slots.forEach(x => x?.cleanup?.());timers.clear();} };
}
let count = 0;
async function test(name, work) { await work(); count++; console.log('PASS ' + name); }
function answerActions(med) {
  const calls = [];
  const display = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/features/v21/medication-dose-display.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(display, display.exports);
  const jsx = (type, props) => ({ type, props });
  const adapters = {
    react: { useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'react-native': { ActivityIndicator: 'Spinner', Alert: {}, KeyboardAvoidingView: 'View', Platform: { OS: 'ios' }, useWindowDimensions: () => ({ width: 393, fontScale: 1 }), Pressable: 'Pressable', RefreshControl: 'Refresh', ScrollView: 'Scroll', StyleSheet: { create: x => x }, Switch: 'Switch', TextInput: 'Input', View: 'View' },
    'expo-router': { Stack: {} },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../../components/QueuedModal': { QueuedModal: 'Modal' },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({}) },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
    '../../hooks/useScaledTypography': { useScaledFontSize: x => x },
    './HealthCoinIcon': { HealthCoinIcon: 'Coin' },
    './useMedicationOverview': { useMedicationOverview: () => med },
    './medication-overview.styles': { medicationStyles: {} },
    './medication-input': { validMedicationNote: () => true },
    './MedicationPurposeTags': { MedicationPurposeTags: 'Tags' },
    './MedicationBackground': { MedicationBackground: 'Background' },
    './MedicationDraftEntry': { MedicationDraftEntry: 'Draft' },
    './medication-dose-display': display.exports,
    './MedicationTimeField': { MedicationTimeField: 'TimeField' },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/v21/MedicationOverviewScreen.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, id => { assert.ok(id in adapters, id); return adapters[id]; });
  const tree = module.exports.MedicationOverviewPanel({ med, tab: 'today', onAnswer: id => calls.push(id) });
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
  return { calls, actions: nodes(tree).filter(node => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith('medicationAnswerAction ')),
    sheet: () => nodes(module.exports.MedicationScheduleSheet({ med })) };
}
(async () => {
  await test('editing and moving a medicine use the time picker while notes remain editable', async () => {
    const h = harness(); (await h.settle()).openSchedule(h.schedule);
    h.read().setMode('edit');
    const edited = answerActions(h.read()).sheet();
    const time = edited.find(node => node.type === 'TimeField');
    assert.equal(time.props.value, '07:30'); assert.equal(time.props.disabled, false);
    assert.ok(!edited.some(node => node.type === 'Input' && node.props.keyboardType === 'numbers-and-punctuation'));
    assert.ok(edited.some(node => node.type === 'Input' && node.props.accessibilityLabel === 'medicationNoteLabel'));
    time.props.onChange('08:17'); assert.equal(h.read().time, '08:17'); assert.equal(h.read().canSave, true);
    h.read().openMove('item-1');
    const moving = answerActions(h.read()).sheet().find(node => node.type === 'TimeField');
    moving.props.onChange('23:59'); assert.equal(h.read().time, '23:59'); assert.equal(h.read().canMove, true);
    assert.ok(h.calls.every(row => row[0] === 'read'), 'Picking a time must not submit a schedule'); h.blur();
  });
  await test('today exposes missed-call answers only within the server two-hour window and never changes a final answer', async () => {
    const h = harness(); h.clock.now = Date.parse('2020-01-01T00:00:00Z'); h.server.serverTime = '2026-11-06T07:00:00+07:00';
    h.server.doses = [
      { id: 'missed-first', state: 'SCHEDULED', scheduled_at: '2026-11-06T06:45:00+07:00', time_local: '06:45' },
      { id: 'due-now', state: 'SCHEDULED', scheduled_at: '2026-11-06T07:00:00+07:00', time_local: '07:00' },
      { id: 'future', state: 'SCHEDULED', scheduled_at: '2026-11-06T07:01:00+07:00', time_local: '07:01' },
      { id: 'missed-twice', state: 'UNCONFIRMED', scheduled_at: '2026-11-06T06:30:00+07:00', time_local: '06:30' },
      { id: 'exact-boundary', state: 'UNCONFIRMED', scheduled_at: '2026-11-06T05:00:00+07:00', time_local: '05:00' },
      { id: 'expired', state: 'UNCONFIRMED', scheduled_at: '2026-11-06T04:59:59+07:00', time_local: '04:59' },
      { id: 'expired-retry', state: 'SCHEDULED', scheduled_at: '2026-11-06T04:59:59+07:00', time_local: '04:59' },
      { id: 'calling', state: 'CALLING', scheduled_at: '2026-11-06T06:59:00+07:00', time_local: '06:59' },
      { id: 'merged-calling', state: 'CALLING', scheduled_at: '2026-11-06T07:10:00+07:00', time_local: '07:10' },
      ...['TAKEN', 'SKIPPED', 'OUT_OF_MEDS', 'CANCELLED', 'SKIPPED_NO_DEVICE'].map(state => ({ id: state, state, scheduled_at: '2026-11-06T06:45:00+07:00', time_local: '06:45' })),
      { id: 'invalid', state: 'UNCONFIRMED', scheduled_at: 'invalid', time_local: '06:45' },
    ];
    await h.settle();
    const first = answerActions(h.read()); first.actions.forEach(action => action.props.onPress());
    assert.deepEqual(first.calls, ['missed-first', 'due-now', 'missed-twice', 'exact-boundary', 'calling', 'merged-calling']);
    h.server.serverTime = '2026-11-06T07:00:15+07:00';
    await h.tick();
    const after = answerActions(h.read()); after.actions.forEach(action => action.props.onPress());
    assert.deepEqual(after.calls, ['missed-first', 'due-now', 'missed-twice', 'calling', 'merged-calling']);
    assert.equal(answerActions({ ...h.read(), data: { ...h.read().data, self: false } }).actions.length, 0);
    h.auth.token = 'other-account'; h.auth.profile.id = 2;
    assert.equal(answerActions(h.read()).actions.length, 0); h.blur();
  });
  await test('moving one medicine requires an explicit new time and sends one request under repeated presses', async () => {
    const h=harness();(await h.settle()).openSchedule(h.schedule);h.read().openMove('item-1');assert.equal(h.read().mode,'move');assert.equal(h.read().canMove,false);
    h.read().setTime('07:30');assert.equal(h.read().canMove,false);h.read().setTime('19:00');assert.equal(h.read().canMove,true);
    const done=defer();h.server.pending=done.promise;const old=h.read(),first=old.move();await old.move();
    assert.equal(h.calls.filter(row=>row[0]==='move').length,1);assert.deepEqual(h.calls.find(row=>row[0]==='move').slice(1,3),[1,'schedule-1']);
    done.resolve();await first;assert.equal(h.read().selected,null);h.blur();
  });
  await test('move retries preserve the request ID until the destination changes, and stale patient actions cannot move', async () => {
    const h=harness();(await h.settle()).openSchedule(h.schedule);h.read().openMove('item-1');h.read().setTime('19:00');h.server.writeFail=true;
    await h.read().move();await h.read().move();const attempts=()=>h.calls.filter(row=>row[0]==='move');
    assert.equal(attempts()[0][3].request_id,attempts()[1][3].request_id);assert.equal(h.read().selected.id,'schedule-1');
    h.read().setTime('18:30');await h.read().move();assert.notEqual(attempts()[1][3].request_id,attempts()[2][3].request_id);
    const old=h.read();h.read().selectPatient(2);await h.settle();await old.move();assert.equal(attempts().length,3);h.blur();
  });
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
  await test('upcoming is limited to five minutes and never replaces a real answered state',async()=>{
    const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/features/v21/medication-dose-display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);
    const key=m.exports.medicationDoseStatusKey,now=Date.parse('2026-11-06T07:00:00+07:00');
    const event=offset=>({state:'SCHEDULED',scheduled_at:new Date(now+offset).toISOString()});
    assert.equal(key(event(300001),now),'medicationLater');assert.equal(key(event(300000),now),'SCHEDULED');
    assert.equal(key(event(0),now),'medicationDueNow');assert.equal(key(event(-60001),now),'medicationOverdue');
    assert.equal(key(event(1000),now,false),'medicationReminderPaused');assert.equal(key({state:'SCHEDULED',scheduled_at:'invalid'},now),'medicationPlanned');
    for(const state of ['TAKEN','SKIPPED','OUT_OF_MEDS','UNCONFIRMED','CALLING','CANCELLED'])assert.equal(key({...event(1000),state},now),state);
  });
  await test('the visible clock advances without repeatedly fetching medication data',async()=>{
    const h=harness();await h.settle();const before=h.read().now,reads=h.calls.filter(x=>x[0]==='read').length;
    await h.tick();assert.equal(h.read().now,before+15000);assert.equal(h.calls.filter(x=>x[0]==='read').length,reads);h.blur();
  });
  await test('today refreshes once across Vietnamese midnight, independent of device timezone',async()=>{
    const h=harness();h.clock.now=Date.parse('2026-11-06T23:59:50+07:00');await h.settle();const before=h.calls.filter(x=>x[0]==='read').length;
    await h.tick();assert.equal(h.calls.filter(x=>x[0]==='read').length,before+1);await h.tick();assert.equal(h.calls.filter(x=>x[0]==='read').length,before+1);h.blur();
  });
  await test('dose labels use the server clock even if the device clock is wrong',async()=>{
    const h=harness();h.clock.now=Date.parse('2020-01-01T00:00:00Z');h.server.serverTime='2026-11-06T07:00:00+07:00';await h.settle();
    assert.equal(h.read().now,Date.parse(h.server.serverTime));await h.tick();assert.equal(h.read().now,Date.parse(h.server.serverTime)+15000);h.blur();
  });
  await test('only near or active reminders refresh statuses; far-future and completed doses do not refetch the page',async()=>{
    const h=harness();h.clock.now=Date.parse('2026-11-06T07:00:00+07:00');h.server.doses=[{id:'live',state:'SCHEDULED',scheduled_at:'2026-11-06T08:00:00+07:00'}];await h.settle();
    const before=h.server.doseReadCount,original=h.server.doses;
    await h.tick(50*60000);assert.equal(h.server.doseReadCount,before);
    h.server.doses=[{...original[0],state:'CALLING'}];await h.tick(5*60000);assert.equal(h.read().doses[0].state,'CALLING');assert.equal(h.server.doseReadCount,before+1);
    h.server.doses=[{...original[0],state:'TAKEN'}];await h.tick();assert.equal(h.read().doses[0].state,'TAKEN');const done=h.server.doseReadCount;await h.tick();assert.equal(h.server.doseReadCount,done);
    assert.equal(h.calls.filter(x=>x[0]==='read').length,1);h.blur();
  });
  await test('live status reads coalesce and cannot show a previous patient response',async()=>{
    const h=harness();h.server.doses=[{id:'previous-dose',state:'CALLING',scheduled_at:new Date(h.clock.now).toISOString()}];await h.settle();
    const delayed=defer(),before=h.server.doseReadCount;h.server.dosesPending=delayed.promise;await h.tick();await h.tick();
    assert.equal(h.server.doseReadCount,before+1);h.server.dosesPending=null;h.server.doses=[];h.read().selectPatient(2);await h.settle();
    delayed.resolve();await flush();assert.equal(h.read().data.patientId,2);assert.deepEqual(h.read().doses,[]);h.blur();
  });
  console.log(`Medication overview: ${count} runtime checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
