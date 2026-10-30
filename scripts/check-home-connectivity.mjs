import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function harness(errors) {
  const calls = [];
  const stores = [
    { recent: [], fetchRecent: refresh('logs') },
    { missions: [], fetchMissions: refresh('missions') },
    { summary: null, history: [], fetchTree: refresh('tree') },
  ].map((state, index) => ({ ...state, errorState: errors[index], status: errors[index] === 'none' ? 'success' : 'error', isStale: false }));
  function refresh(name) {
    return signal => {
      calls.push({ name, signal });
      const state = stores[['logs', 'missions', 'tree'].indexOf(name)];
      state.errorState = 'none';
      state.status = 'success';
    };
  }
  const imports = {
    react: { useMemo: work => work(), useCallback: work => work, useState: initial => [initial, () => {}], useEffect() {} },
    '../../i18n': { __esModule: true, default: { language: 'vi' } },
    '../logs/logs.store': { useLogsStore: select => select(stores[0]) },
    '../missions/missions.store': { useMissionsStore: select => select(stores[1]) },
    '../tree/tree.store': { useTreeStore: select => select(stores[2]) },
    '../checkin/checkin.api': { checkinApi: { getHealthScore: async () => { calls.push({ name: 'health-score' }); return {}; } } },
  };
  const code = ts.transpileModule(fs.readFileSync('src/features/home/home.vm.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, name => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected Home dependency: ${name}`);
    return imports[name];
  });
  return { render: module.exports.useHomeViewModel, calls, stores };
}

let checks = 0;
const test = (name, work) => { work(); checks++; console.log(`PASS ${name}`); };
for (const [name, errors, banner, modal] of [
  ['healthy APIs', ['none', 'none', 'none'], false, false],
  ['one failed API with cached data', ['remote-failed', 'none', 'none'], true, false],
  ['one failed API without cached data', ['none', 'no-data', 'none'], true, false],
  ['two failed APIs and one healthy API', ['remote-failed', 'no-data', 'none'], true, false],
  ['all APIs failed with caches', ['remote-failed', 'remote-failed', 'remote-failed'], true, true],
  ['all APIs failed on a first launch without caches', ['no-data', 'no-data', 'no-data'], true, true],
  ['all APIs failed with mixed cache availability', ['remote-failed', 'no-data', 'remote-failed'], true, true],
]) {
  test(`${name}: show the appropriate retry UI`, () => {
    const view = harness(errors).render();
    assert.equal(view.hasRefreshError, banner);
    assert.equal(view.isOffline, modal);
  });
}
test('a successful retry clears the error UI and refreshes every existing source', () => {
  const h = harness(['remote-failed', 'no-data', 'remote-failed']);
  assert.equal(h.render().isOffline, true);
  const cleanup = h.render().refreshAll();
  assert.deepEqual(h.calls.map(call => call.name), ['logs', 'missions', 'tree', 'health-score']);
  assert.equal(h.render().hasRefreshError, false);
  assert.equal(h.render().isOffline, false);
  assert.ok(h.calls.slice(0, 3).every(call => call.signal === h.calls[0].signal));
  cleanup();
  assert.equal(h.calls[0].signal.aborted, true);
});
test('Home uses the partial-error banner separately from the connection modal', () => {
  const source = fs.readFileSync('app/(tabs)/home/index.tsx', 'utf8');
  assert.match(source, /hasRefreshError\s*\?\s*<OfflineBanner/);
  assert.match(source, /visible=\{Boolean\(isOffline && !offlineModalDismissed\)\}/);
});
for (const language of ['vi', 'en']) {
  test(`${language}: data-loading errors do not assert that Wi-Fi or Internet is absent`, () => {
    const copy = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/common.json`, 'utf8'));
    assert.doesNotMatch([copy.offlineBanner, copy.noInternetTitle, copy.noInternetMessage].join(' '), /Wi.?Fi|No Internet|Không có kết nối Internet/i);
    assert.ok(copy.noInternetTitle.includes('Asinu'));
  });
}
console.log(`Home connectivity: ${checks} regression checks passed.`);
