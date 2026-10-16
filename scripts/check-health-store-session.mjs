import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const load = (file, imports) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import ${name}`);
  }, Date, setTimeout, clearTimeout, console });
  return exports;
};
const persisted = new Map();
const secureStorage = {
  getItem: async key => persisted.get(key) ?? null,
  setItem: async (key, value) => { persisted.set(key, value); },
  removeItem: async key => { persisted.delete(key); },
};
const { tokenStore } = load('../src/lib/tokenStore.ts', { 'expo-secure-store': {
  getItemAsync: secureStorage.getItem, setItemAsync: secureStorage.setItem, deleteItemAsync: secureStorage.removeItem,
} });
const sessionModule = load('../src/lib/healthStoreSession.ts', { './secureStorage': { secureStorage }, './tokenStore': { tokenStore } });
const { healthStoreSession } = sessionModule;
const tick = () => new Promise(resolve => setImmediate(resolve));
let finish;
const deferred = () => new Promise(resolve => { finish = resolve; });
const api = Object.fromEntries(['getWellnessState', 'getWellnessHistory', 'getDailySummaries', 'getMyAlerts',
  'getCaregiverAlerts', 'checkShouldPrompt', 'logAppOpen', 'logMoodCheck', 'logActivity', 'sendHelpRequest', 'acknowledgeAlert'].map(name => [name, deferred]));
const common = { zustand: require('zustand'), 'zustand/middleware': require('zustand/middleware'),
  '../../../lib/secureStorage': { secureStorage }, '../../../lib/healthStoreSession': sessionModule,
  '../../../i18n': { __esModule: true, default: { t: key => key } },
};
const wellness = load('../src/features/wellness/store/wellness.store.ts', { ...common, '../api/wellness.api': api }).useWellnessStore;
const pulse = load('../src/features/care-pulse/store/carePulse.store.ts', { ...common,
  '../api/carePulse.api': { fetchCarePulseState: deferred, sendCarePulseEvent: deferred },
  '../types': { initialEngineState: { status: 'initial' } },
}).useCarePulseStore;
const signIn = async owner => { await tokenStore.setToken(`session-${owner}`); healthStoreSession.setOwner(owner); await tick(); };
const responseA = { ok: true, state: { owner: 'A' }, history: [{ owner: 'A' }], summaries: [{ owner: 'A' }],
  alerts: [{ owner: 'A' }], evaluation: { score: 17, status: 'A' }, shouldPrompt: true, promptType: 'A', alertsSent: 1, message: 'A' };
const wellnessActions = [['syncState'], ['fetchHistory'], ['fetchSummaries'], ['fetchAlerts'], ['fetchCaregiverAlerts'],
  ['checkPrompt'], ['recordAppOpen'], ['recordMoodCheck', 'good'], ['recordActivity', 'walk'], ['requestHelp'], ['ackAlert', 'alert-a']];
const pulseActions = [['syncState'], ['sendAppOpened'], ['recordPopupShown'], ['recordPopupDismiss'], ['checkIn', 'OK', undefined, 'MANUAL']];
for (const [store, actions] of [[wellness, wellnessActions], [pulse, pulseActions]]) {
  for (const [method, ...args] of actions) {
    await signIn('A');
    const request = store.getState()[method](...args);
    const resolve = finish;
    await signIn('B');
    resolve(responseA);
    await request; await tick();
    const state = store.getState();
    assert.equal(state.state?.owner, undefined, method);
    assert.equal(state.engineState?.owner, undefined, method);
    assert.equal(JSON.stringify({ history: state.history, alerts: state.alerts, summaries: state.summaries }).includes('"A"'), false, method);
    assert.equal(state.isLoading === true, false, method);
  }
}
// Reset must also invalidate a response in the SAME credential (A -> reset -> A).
await signIn('A');
const sameSession = wellness.getState().syncState();
const resolveSame = finish;
wellness.getState().reset();
resolveSame(responseA); await sameSession;
assert.equal(wellness.getState().state, null);
const finishRotation = tokenStore.beginTokenRotation();
await tokenStore.setToken('rotated-session-A');
finishRotation();
assert.equal(healthStoreSession.capture().owner, 'A');
assert.equal(healthStoreSession.isCurrent(healthStoreSession.capture()), true);
// Secure persistence survives restart only for its owner. It never trusts the
// old unowned store, and it cannot hydrate A into B after a delayed read.
persisted.set('wellness-store', JSON.stringify({ state: { state: { owner: 'legacy-A' } } }));
const storage = sessionModule.createHealthStoreStorage('regression_v2');
await storage.setItem('ignored', 'private-A');
await signIn('B');
assert.equal(await storage.getItem('ignored'), null);
await signIn('A');
assert.equal(await storage.getItem('ignored'), 'private-A');
const delayed = storage.getItem('ignored');
await signIn('B');
assert.equal(await delayed, null);
assert.equal([...persisted.keys()].some(key => key.startsWith('regression_v2_')), true);
console.log('PASS 16 store actions reject previous-session results; reset, owner persistence and delayed hydration are isolated');
