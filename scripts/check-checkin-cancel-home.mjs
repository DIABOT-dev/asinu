import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { progressHarness } from './helpers/checkin-progress-harness.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const jsx = (type, props) => ({ type, props });
function evaluate(source, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports,
    id => { assert.equal(id, 'react/jsx-runtime'); return { jsx, jsxs: jsx }; }, ...Object.values(globals));
  return module.exports;
}
function declaration(file, name) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const node = ast.statements.find(item =>
    (ts.isFunctionDeclaration(item) && item.name?.text === name) ||
    (ts.isVariableStatement(item) && item.declarationList.declarations.some(d => d.name.getText(ast) === name)));
  assert.ok(node, `Actual production declaration ${name} is missing`);
  return node.getText(ast);
}
function hooks() {
  const slots = []; let cursor = 0; const effects = [];
  return {
    useState(initial) {
      const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(work, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = work(); });
      }
    },
    render(work) { cursor = 0; const result = work(); effects.splice(0).forEach(work => work()); return result; },
  };
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
let checks = 0;
const test = async (name, work) => { await work(); checks++; console.log(`PASS ${name}`); };
const draft = { status: 'tired', selected: ['head'], other: '', details: {}, positionNotes: {}, detailIndex: null };
function cancellationHarness({ fail = false, serverSession = null } = {}) {
  const { progress, cardCache } = progressHarness();
  const cancellationHooks = hooks(), locationHooks = hooks();
  const alerts = [], calls = { cancel: 0, navigation: 0, recover: 0 };
  const useCheckinCancellation = evaluate(`${declaration('src/features/checkin/useCheckinCancellation.ts', 'useCheckinCancellation')}\nmodule.exports=useCheckinCancellation;`, {
    ...cancellationHooks, useTranslation: () => ({ t: key => key }), tokenStore: { getToken: () => 'account-a' },
    cancelCheckinProgress: progress.cancelCheckinProgress,
    checkinApi: { cancel: async () => { calls.cancel++; if (fail) throw new Error('offline'); return { ok: true, cancelled: true }; } },
    useAppAlert: () => ({ alertState: {}, dismissAlert() {}, showAlert: (...args) => alerts.push(args) }),
  });
  const locationHelpers = evaluate(read('src/features/checkin/location-details.ts'));
  const animation = { duration: () => animation, delay: () => animation };
  const locationFile = 'src/features/checkin/CheckinLocationFlow.tsx';
  const Location = evaluate(`${declaration(locationFile, 'BODY_LOCATION_OPTIONS')}\n${declaration(locationFile, 'CheckinLocationFlow')}\nmodule.exports=CheckinLocationFlow;`, {
    ...locationHooks, ...locationHelpers, saveLocationDraft: progress.saveLocationDraft,
    useTranslation: () => ({ t: key => key }), useCheckinAddressing: () => ({ honorific: 'bạn', Honorific: 'Bạn', CallName: 'Bạn' }),
    useGuideAcknowledgement: () => () => {},
    View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', Svg: 'Svg', Path: 'Path',
    Ionicons: 'Icon', MaterialCommunityIcons: 'Icon', GuideTarget: 'Guide', VoiceAnswerInput: 'VoiceInput',
    Animated: { View: 'Animated' }, FadeInDown: animation, FadeInLeft: animation,
    asinuChatSticker: 'sticker', colors: { primary: '#08b8a2' }, spacing: { xs: 4 },
  });
  let cancellation;
  const render = () => {
    cancellation = cancellationHooks.render(() => useCheckinCancellation({ account: 7, session: serverSession,
      onConfirmed() {}, onCancelled() { calls.navigation++; }, onRecover() { calls.recover++; } }));
    // Deliberately retain the location form after replace was requested: native
    // navigation does not unmount its previous route in the same microtask.
    locationHooks.render(() => Location({ styles: {}, onConfirm() {}, onBack() {}, initialDraft: draft,
      draftStatus: 'tired', draftAccount: 7, loading: cancellation.busy, onBeforeAi: async () => true }));
    return cancellation;
  };
  return { render, progress, cardCache, calls, alerts };
}

await test('successful cancellation cannot autosave the deleted location draft during delayed navigation', async () => {
  const h = cancellationHarness();
  h.render(); await flush(); assert.deepEqual(await h.progress.readLocationDraft(7), draft);
  const revision = h.cardCache.checkinCardRevision(7);
  h.render().request(); h.alerts.at(-1)[2].find(button => button.style === 'destructive').onPress();
  h.render(); await flush();
  assert.equal(h.calls.navigation, 1);
  assert.equal(h.render().busy, true, 'Keep the form frozen until it actually unmounts');
  await flush();
  assert.equal(await h.progress.readLocationDraft(7), null, 'The old form must not recreate Continue');
  assert.equal(h.cardCache.checkinCardRevision(7), revision + 1);
  assert.deepEqual(await h.progress.loadCheckinEntry({ getToday: async () => ({ ok:true, session:null }) }, 7), { kind:'new' });
  h.render().request(); assert.equal(h.alerts.length, 1, 'A second tap while leaving cannot reopen cancellation');
});
await test('failed cancellation keeps the draft and unlocks the form for continuing', async () => {
  const session = { id: 500, user_id: 7, initial_status: 'tired', current_status: 'tired', triage_completed_at: null,
    triage_messages: [], triage_state: { phase: 'initial', phase_id: 'a' } };
  const h = cancellationHarness({ fail:true, serverSession:session });
  h.render(); await flush(); const revision = h.cardCache.checkinCardRevision(7);
  h.render().request(); h.alerts.at(-1)[2].find(button => button.style === 'destructive').onPress(); h.render(); await flush();
  assert.equal(h.render().busy, false); await flush();
  assert.deepEqual(await h.progress.readLocationDraft(7), draft);
  assert.equal(h.cardCache.checkinCardRevision(7), revision);
  assert.equal(h.calls.navigation, 0); assert.equal(h.calls.recover, 1);
});
await test('a restored earlier completed session replaces a cancelled incomplete Home cache', async () => {
  const { progress, cardCache: cache } = progressHarness();
  const session = { id:500,user_id:7,initial_status:'tired',current_status:'tired',triage_completed_at:null,
    triage_messages:[],triage_state:{phase:'followup',phase_id:'current'} };
  const oldRevision = cache.checkinCardRevision(7);
  cache.cacheCheckinCardSession(7, session, oldRevision);
  await progress.cancelCheckinProgress({ cancel:async()=>({ok:true,cancelled:true}) },7,session);
  assert.equal(cache.readCheckinCardCache(7), undefined);
  assert.equal(cache.cacheCheckinCardSession(7, session, oldRevision), false);
  const previous = { ...session, current_status:'fine',triage_completed_at:new Date().toISOString(),
    triage_state:{phase:'initial',phase_id:'previous',completed:{finalized:true}} };
  assert.equal(cache.cacheCheckinCardSession(7, previous, cache.checkinCardRevision(7)), true);
  assert.equal(progress.isUnfinishedCheckin(cache.readCheckinCardCache(7)), false);
});
console.log(`Check-in cancellation/Home: ${checks} lifecycle regressions passed.`);
