import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const source = read('app/care-circle/qr.tsx');
const file = ts.createSourceFile('qr.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CareCircleQrScreen');
assert.ok(component);
const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
  : [tree, ...nodes(tree.props?.children)];
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
let checks = 0;
const test = async (name, run) => { await run(); ++checks; console.log(`PASS ${name}`); };

function harness(language, options = {}) {
  const slots = []; let cursor = 0, pending = [];
  const auth = { profile: { id: 7, name: 'Owner' }, token: 'session', ...options.auth };
  const calls = { loads: 0, routes: [], profileWrites: [] };
  const code = { token: 'x'.repeat(43), value: `asinu-lite://care-circle/scan?token=${'x'.repeat(43)}` };
  const catalogs = Object.fromEntries(['careCircle', 'common'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`))]));
  const translators = Object.fromEntries(Object.entries(catalogs).map(([ns, catalog]) => [ns, key => {
    assert.ok(Object.hasOwn(catalog, key), `Missing ${language}/${ns}/${key}`); return catalog[key];
  }]));
  const memo = (work, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  const runtime = {
    useRef: initial => slots[cursor++] ??= { current: initial },
    useState: initial => {
      const index = cursor++; slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useMemo: memo, useCallback: (work, deps) => memo(() => work, deps),
    useEffect: (work, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        slots[index] = { deps }; pending.push(() => { old?.cleanup?.(); slots[index].cleanup = work(); });
      }
    },
  };
  const useAuthStore = Object.assign(select => select(auth), { getState: () => auth,
    setState: patch => { calls.profileWrites.push(patch); Object.assign(auth, patch); } });
  const globals = { ...runtime,
    ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'Screen', 'Image', 'Ionicons', 'MaterialCommunityIcons', 'ActivityIndicator', 'LinearGradient', 'Svg', 'Path', 'QRCode'].map(name => [name, name])),
    Stack: { Screen: 'Stack' },
    useTranslation: ns => ({ t: translators[ns] }), useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
    useWindowDimensions: () => ({ width: 393 }), useScaledTypography: () => ({}),
    useThemeColors: () => ({ colors: { primary: '#08b8a2' }, isDark: false }), createStyles: () => ({}),
    useAuthStore, useProfileStore: select => select({ profile: null }),
    useRouter: () => ({ back: () => calls.routes.push('back'), push: route => calls.routes.push(route) }),
    authApi: { fetchProfile: options.profileLoad ?? (async () => null) },
    careCircleApi: { createQrToken: async () => { calls.loads++; return options.load ? options.load(auth.profile?.id) : code; } },
    getApiErrorMessage: (_error, t, fallback) => t(fallback),
  };
  const module = { exports: {} };
  const compiled = ts.transpileModule(`${component.getText(file)}\nmodule.exports = CareCircleQrScreen;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), compiled)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id.includes('assets/images/care-circle/')) return id;
    assert.fail(`Unexpected QR screen dependency: ${id}`);
  }, ...Object.values(globals));
  const render = () => { cursor = 0; return module.exports(); };
  return { auth, calls, code, render, async settle() {
    let tree;
    for (let i = 0; i < 5; i++) { tree = render(); const effects = pending; pending = []; effects.forEach(work => work()); await tick(); }
    return tree;
  }, unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}

for (const language of ['vi', 'en']) {
  await test(`${language}: QR is shown without expiry, countdown, regeneration or polling`, async () => {
    const h = harness(language); const tree = await h.settle();
    assert.equal(nodes(tree).find(node => node.type === 'QRCode')?.props.value, h.code.value);
    assert.equal(h.calls.loads, 1);
    assert.equal(nodes(tree).some(node => node.type === 'Pressable' && nodes(node).some(child => child.props?.name === 'reload')), false);
    assert.doesNotMatch(source, /setInterval|secondsUntil|formatRemaining|expiresAt|qrExpires|qrExpired|qrRefresh/);
    await h.settle(); assert.equal(h.calls.loads, 1);
    const scan = nodes(tree).find(node => node.props?.accessibilityLabel === JSON.parse(read(`src/i18n/locales/${language}/careCircle.json`)).scanSomeoneQr);
    scan.props.onPress(); assert.deepEqual(h.calls.routes, ['/care-circle/scan']);
    h.unmount();
  });
  await test(`${language}: reopening fetches the same fixed code`, async () => {
    const first = harness(language); const before = nodes(await first.settle()).find(node => node.type === 'QRCode').props.value; first.unmount();
    const second = harness(language); const after = nodes(await second.settle()).find(node => node.type === 'QRCode').props.value;
    assert.equal(after, before); second.unmount();
  });
  await test(`${language}: a failed load offers retry without claiming the code expired`, async () => {
    let attempts = 0;
    const h = harness(language, { load: async () => { if (++attempts === 1) throw new Error('Offline fixture'); return h.code; } });
    let tree = await h.settle(); assert.equal(nodes(tree).some(node => node.type === 'QRCode'), false);
    const retry = nodes(tree).find(node => node.props?.accessibilityLabel === JSON.parse(read(`src/i18n/locales/${language}/common.json`)).retry);
    assert.ok(retry); retry.props.onPress(); tree = await h.settle();
    assert.equal(nodes(tree).find(node => node.type === 'QRCode').props.value, h.code.value);
    assert.equal(h.calls.loads, 2); h.unmount();
  });
}

await test('late QR/profile responses cannot replace another account after logout or account switching', async () => {
  const qrA = deferred(), profileA = deferred();
  const codeB = { token: 'y'.repeat(43), value: 'account-b-fixed-code' };
  const h = harness('vi', { load: id => id === 7 ? qrA.promise : Promise.resolve(codeB), profileLoad: () => profileA.promise });
  await h.settle();
  h.auth.profile = { id: 8, name: 'Other owner' }; h.auth.token = 'other-session';
  let tree = await h.settle(); assert.equal(nodes(tree).find(node => node.type === 'QRCode').props.value, codeB.value);
  qrA.resolve(h.code); profileA.resolve({ id: 7, name: 'Stale owner' }); tree = await h.settle();
  assert.equal(nodes(tree).find(node => node.type === 'QRCode').props.value, codeB.value);
  assert.deepEqual(h.calls.profileWrites, []);
  h.auth.profile = null; h.auth.token = null;
  tree = h.render(); assert.equal(nodes(tree).some(node => node.type === 'QRCode'), false);
  await h.settle(); h.unmount();
});

await test('closing the QR screen ignores pending network responses', async () => {
  const pending = deferred(), profile = deferred();
  const h = harness('vi', { load: () => pending.promise, profileLoad: () => profile.promise });
  await h.settle(); h.unmount(); pending.resolve(h.code); profile.resolve({ id: 7, name: 'Late owner' }); await tick();
  assert.equal(nodes(h.render()).some(node => node.type === 'QRCode'), false);
  assert.deepEqual(h.calls.profileWrites, []);
});

await test('the fixed QR contract has no expiry and all copy agrees in both languages', () => {
  const api = ts.createSourceFile('api.ts', read('src/features/care-circle/care-circle.api.ts'), ts.ScriptTarget.Latest, true);
  for (const name of ['CareCircleQrToken', 'CareCircleQrPreview']) {
    const type = api.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === name);
    assert.ok(type); assert.doesNotMatch(type.getText(api), /expiresAt/);
  }
  for (const language of ['vi', 'en']) {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/careCircle.json`));
    assert.doesNotMatch(catalog.qrPrivacy, /10|minutes|phút/);
    assert.equal(Object.hasOwn(catalog, 'qrRefresh'), false);
  }
});
console.log(`Permanent Care Circle QR: ${checks} runtime regressions passed.`);
