import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const TOKEN = 'a'.repeat(43), OTHER = 'b'.repeat(43);
const QR = `asinu-lite://care-circle/scan?token=${TOKEN}`;
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
function evaluate(file, deps) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('require', 'module', 'exports', output)(id => {
    assert.ok(id in deps, `Missing native adapter ${id}`); return deps[id];
  }, module, module.exports);
  return module.exports;
}
function mediaHarness(options = {}) {
  const calls = { picker: [], decode: [], permissions: [], created: [], files: [], imports: 0 };
  const deps = {
    'expo-camera': { scanFromURLAsync: async (...args) => { calls.decode.push(args); return options.decode ? options.decode() : [{ data: QR }]; } },
    'expo-image-picker': { launchImageLibraryAsync: async config => { calls.picker.push(config); return options.pick ? options.pick() : { canceled: false, assets: [{ uri: 'file:///selected.png' }] }; } },
    'expo-linking': { parse: uri => {
      const params = new URL(uri).searchParams;
      return { queryParams: Object.fromEntries([...params.keys()].map(key => [key, params.getAll(key).length > 1 ? params.getAll(key) : params.get(key)])) };
    } },
    'expo-modules-core': { requireOptionalNativeModule: name => { assert.equal(name, 'ExpoMediaLibraryNext'); return options.missing ? null : {}; } },
    '../../lib/native-permissions': { runNativePermission: async (work, config) => { assert.ok(config.canRun()); return work(); } },
    'expo-file-system': { Paths: { cache: 'cache' }, File: class {
      constructor(...args) { this.uri = 'file:///cache/qr.png'; this.args = args; this.exists = false; calls.files.push(this); }
      write(...args) { this.written = args; this.exists = true; }
      delete() { this.deleted = true; this.exists = false; }
    } },
  };
  Object.defineProperty(deps, 'expo-media-library', { get() {
    calls.imports++;
    return { requestPermissionsAsync: async (...args) => { calls.permissions.push(args); return options.permission ? options.permission() : { granted: true }; },
      Asset: { create: async uri => { calls.created.push(uri); if (options.create) return options.create(); return {}; } } };
  } });
  return { ...evaluate('src/features/care-circle/qr-media.service.ts', deps), calls };
}
await test('only well-formed connection tokens are extracted, URLs are never opened', () => {
  const h = mediaHarness();
  for (const value of [QR, TOKEN, `  ${QR}  `]) assert.equal(h.tokenFromQr(value), TOKEN);
  for (const value of ['', 'https://example.com', 'https://example.com?token=short', `${QR}%2Bbad`, `https://example.com?token=${TOKEN}&token=${OTHER}`]) assert.equal(h.tokenFromQr(value), null);
});
await test('photo picker cancellation does not decode or request library-wide access', async () => {
  const h = mediaHarness({ pick: () => ({ canceled: true }) });
  assert.equal(await h.pickQrToken(() => true), null);
  assert.equal(h.calls.decode.length, 0); assert.equal(h.calls.permissions.length, 0);
  assert.deepEqual(h.calls.picker[0].mediaTypes, ['images']);
});
await test('selected photo is decoded on-device and only a token is returned', async () => {
  const h = mediaHarness(); assert.equal(await h.pickQrToken(() => true), TOKEN);
  assert.deepEqual(h.calls.decode, [['file:///selected.png', ['qr']]]);
});
for (const [name, codes, reason] of [
  ['no QR', [], 'noCode'], ['foreign QR', [{ data: 'https://example.com' }], 'invalidCode'],
  ['different family codes', [{ data: QR }, { data: OTHER }], 'multipleCodes'],
]) await test(`photo with ${name} fails with an actionable result`, async () => {
  const h = mediaHarness({ decode: () => codes });
  await assert.rejects(h.pickQrToken(() => true), err => err instanceof h.QrMediaError && err.reason === reason);
});
await test('repeated copies of the same QR in a photo identify the same person', async () => {
  const h = mediaHarness({ decode: () => [{ data: QR }, { data: TOKEN }] });
  assert.equal(await h.pickQrToken(() => true), TOKEN);
});
await test('account change while picking or decoding drops the selected image', async () => {
  for (const stage of ['pick', 'decode']) {
    const pending = deferred(); let current = true;
    const h = mediaHarness({ [stage]: () => pending.promise });
    const work = h.pickQrToken(() => current); await flush(); current = false;
    pending.resolve(stage === 'pick' ? { canceled: false, assets: [{ uri: 'file:///old.png' }] } : [{ data: QR }]);
    assert.equal(await work, null);
    if (stage === 'pick') assert.equal(h.calls.decode.length, 0);
  }
});
await test('older development binaries can import QR features without the photo-save module', async () => {
  const h = mediaHarness({ missing: true });
  await assert.rejects(h.saveQrToPhotos({}, () => true), err => err.reason === 'unavailable');
  assert.equal(h.calls.imports, 0); assert.equal(h.calls.permissions.length, 0);
});
await test('denied photo permission cannot export or report a saved image', async () => {
  const h = mediaHarness({ permission: () => ({ granted: false }) });
  await assert.rejects(h.saveQrToPhotos({ toDataURL: () => assert.fail('No export without permission') }, () => true), err => err.reason === 'permission');
  assert.equal(h.calls.files.length, 0); assert.equal(h.calls.created.length, 0);
});
await test('QR save asks for add-only permission, exports a large PNG and removes its cache file', async () => {
  const h = mediaHarness();
  const saved = await h.saveQrToPhotos({ toDataURL: (cb, size) => { assert.deepEqual(size, { width: 1024, height: 1024 }); cb('png-base64'); } }, () => true);
  assert.equal(saved, true); assert.deepEqual(h.calls.permissions, [[true, []]]);
  assert.deepEqual(h.calls.files[0].written, ['png-base64', { encoding: 'base64' }]);
  assert.equal(h.calls.created.length, 1); assert.equal(h.calls.files[0].deleted, true);
});
await test('native save failure still deletes the temporary image', async () => {
  const h = mediaHarness({ create: () => { throw new Error('disk full'); } });
  await assert.rejects(h.saveQrToPhotos({ toDataURL: cb => cb('png') }, () => true), /disk full/);
  assert.equal(h.calls.files[0].deleted, true);
});
await test('empty or failed SVG export never creates a photo', async () => {
  for (const toDataURL of [cb => cb(''), () => { throw new Error('native export failed'); }]) {
    const h = mediaHarness(); await assert.rejects(h.saveQrToPhotos({ toDataURL }, () => true));
    assert.equal(h.calls.created.length, 0); assert.equal(h.calls.files.length, 0);
  }
});
await test('ownership is checked again after permission and SVG export', async () => {
  for (const stage of ['permission', 'export']) {
    let current = true, exportCallback;
    const pending = deferred();
    const h = mediaHarness({ ...(stage === 'permission' ? { permission: () => pending.promise } : {}) });
    const work = h.saveQrToPhotos({ toDataURL: cb => { exportCallback = cb; } }, () => current);
    await flush(); current = false;
    if (stage === 'permission') pending.resolve({ granted: true }); else exportCallback('png');
    assert.equal(await work, false); assert.equal(h.calls.files.length, 0);
  }
});

// Drive the real React hook event handlers with deterministic state/effect scheduling.
function hooks() {
  const slots = []; let cursor = 0, pending = [];
  const memo = (work, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  return {
    react: {
      useRef: value => slots[cursor++] ??= { current: value },
      useState: initial => { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, next => { slots[i].value = next; }]; },
      useMemo: memo, useCallback: (work, deps) => memo(() => work, deps),
      useEffect: (work, deps) => { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) { slots[i] = { deps }; pending.push(() => { old?.cleanup?.(); slots[i].cleanup = work(); }); } },
    },
    render: work => { cursor = 0; const value = work(); const effects = pending; pending = []; effects.forEach(effect => effect()); return value; },
    unmount: () => slots.forEach(slot => slot.cleanup?.()),
  };
}
function scanner(options = {}) {
  const runtime = hooks(), media = mediaHarness();
  const auth = { profile: { id: 2 }, token: 'session' };
  const calls = { previews: [], routes: [], picks: 0 };
  const router = { replace: route => calls.routes.push(route) };
  const { useCareCircleScanner } = evaluate('src/features/care-circle/useCareCircleScanner.ts', {
    react: runtime.react, 'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => router },
    '../../lib/apiClient': { getApiErrorMessage: (_err, t, key) => t(key) },
    '../auth/auth.store': { useAuthStore: { getState: () => auth } },
    './care-circle.api': { careCircleApi: { previewQrToken: async token => { calls.previews.push(token); if (options.preview) await options.preview(); } } },
    './qr-media.service': { ...media, pickQrToken: async isCurrent => { calls.picks++; return options.pick ? options.pick(isCurrent, media) : TOKEN; } },
  });
  return { auth, calls, media, render: () => runtime.render(() => useCareCircleScanner(options.inbound)), unmount: runtime.unmount };
}
await test('ten fast camera callbacks produce one preview and never auto-accept a connection', async () => {
  const pending = deferred(), h = scanner({ preview: () => pending.promise });
  const view = h.render(); const work = Array.from({ length: 10 }, () => view.scan({ data: QR }));
  view.pickImage(); assert.equal(h.calls.picks, 0); assert.equal(h.calls.previews.length, 1);
  pending.resolve(); await Promise.all(work);
  assert.equal(h.calls.routes.length, 1); assert.equal(h.calls.routes[0].pathname, '/care-circle/invite'); h.unmount();
});
await test('camera cannot compete with photo picker and cancellation resumes scanning', async () => {
  const pending = deferred(), h = scanner({ pick: () => pending.promise });
  let view = h.render(); const work = view.pickImage();
  await view.scan({ data: QR }); view.pickImage();
  assert.equal(h.calls.picks, 1); assert.equal(h.calls.previews.length, 0);
  pending.resolve(null); await work; view = h.render(); assert.equal(view.scanning, false);
  await view.scan({ data: QR }); assert.equal(h.calls.previews.length, 1); h.unmount();
});
await test('invalid scan can be replaced by a photo, duplicate photo taps stay locked', async () => {
  const pending = deferred(), h = scanner({ pick: () => pending.promise });
  await h.render().scan({ data: 'foreign' }); const view = h.render(); assert.equal(view.error, 'qrInvalidFormat');
  const work = view.pickImage(); view.pickImage(); view.retry();
  assert.equal(h.calls.picks, 1); assert.equal(h.render().scanning, true);
  pending.resolve(TOKEN); await work; assert.deepEqual(h.calls.previews, [TOKEN]); h.unmount();
});
await test('no QR and multiple-code image errors allow retrying', async () => {
  for (const [reason, label] of [['noCode', 'qrImageNoCode'], ['multipleCodes', 'qrImageMultiple'], ['invalidCode', 'qrInvalidFormat']]) {
    const h = scanner({ pick: (_current, media) => { throw new media.QrMediaError(reason); } });
    await h.render().pickImage(); const view = h.render(); assert.equal(view.error, label);
    view.retry(); await h.render().scan({ data: QR }); assert.deepEqual(h.calls.previews, [TOKEN]); h.unmount();
  }
});
await test('server rejection stays on scanner with a useful error and allows retrying', async () => {
  let failed = true; const h = scanner({ preview: () => { if (failed) throw new Error('self-scan'); } });
  await h.render().scan({ data: QR }); assert.equal(h.render().error, 'qrPreviewError'); assert.equal(h.calls.routes.length, 0);
  failed = false; h.render().retry(); await h.render().scan({ data: QR }); assert.equal(h.calls.routes.length, 1); h.unmount();
});
await test('leaving scanner or changing account during preview cannot navigate to a stale invitation', async () => {
  for (const change of ['unmount', 'account', 'session']) {
    const pending = deferred(), h = scanner({ preview: () => pending.promise });
    const work = h.render().scan({ data: QR });
    if (change === 'unmount') h.unmount(); else if (change === 'account') h.auth.profile = { id: 3 }; else h.auth.token = 'other';
    pending.resolve(); await work; assert.equal(h.calls.routes.length, 0); h.unmount();
  }
});
await test('an inbound token is validated once before showing the invitation', async () => {
  const h = scanner({ inbound: TOKEN }); h.render(); await flush(); h.render(); await flush();
  assert.deepEqual(h.calls.previews, [TOKEN]); assert.equal(h.calls.routes.length, 1); h.unmount();
});
function saver(options = {}) {
  const runtime = hooks(), media = mediaHarness();
  const auth = { profile: { id: 2 }, token: 'session' }, calls = { saves: 0, toasts: [], alerts: [] };
  const { useSaveCareCircleQr } = evaluate('src/features/care-circle/useSaveCareCircleQr.ts', {
    react: runtime.react, 'expo-linking': { openSettings: async () => {} },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../../components/AppAlertModal': { useAppAlert: () => ({ alertState: {}, showAlert: (...args) => calls.alerts.push(args), dismissAlert: () => {} }) },
    '../../lib/native-permissions': { runNativePermission: async work => work() },
    '../../stores/toast.store': { showToast: (...args) => calls.toasts.push(args) },
    '../auth/auth.store': { useAuthStore: { getState: () => auth } },
    './qr-media.service': { ...media, saveQrToPhotos: async (_image, current) => { calls.saves++; return options.save ? options.save(current, media) : true; } },
  });
  const render = () => { const view = runtime.render(() => useSaveCareCircleQr(QR)); view.image.current = {}; return view; };
  return { auth, calls, render, unmount: runtime.unmount };
}
await test('save double tap starts one native operation, success follows completion only', async () => {
  const pending = deferred(), h = saver({ save: () => pending.promise }); const view = h.render();
  const work = view.save(); view.save(); assert.equal(h.calls.saves, 1); assert.equal(h.calls.toasts.length, 0);
  pending.resolve(true); await work; assert.deepEqual(h.calls.toasts, [['qrSaved', 'success']]); h.unmount();
});
await test('save failure, denied permission and old native builds never show a success toast', async () => {
  for (const reason of ['permission', 'unavailable', 'failure']) {
    const h = saver({ save: (_current, media) => { throw reason === 'failure' ? new Error('disk full') : new media.QrMediaError(reason); } });
    await h.render().save(); assert.equal(h.calls.toasts.some(([, kind]) => kind === 'success'), false);
    if (reason === 'permission') assert.equal(h.calls.alerts[0][0], 'qrPhotoPermissionTitle');
    else assert.equal(h.calls.toasts[0][0], reason === 'unavailable' ? 'qrSaveNeedsUpdate' : 'qrSaveError');
    h.unmount();
  }
});
await test('cancelled or stale saves do not show a success message', async () => {
  const h = saver({ save: () => false }); await h.render().save(); assert.equal(h.calls.toasts.length, 0); h.unmount();
  for (const change of ['unmount', 'account']) {
    const pending = deferred();
    const h = saver({ save: async current => { await pending.promise; return current(); } });
    const work = h.render().save(); if (change === 'unmount') h.unmount(); else h.auth.profile = { id: 3 };
    pending.resolve(); await work; assert.equal(h.calls.toasts.length, 0); h.unmount();
  }
});

const elements = tree => Array.isArray(tree) ? tree.flatMap(elements) : !tree || typeof tree !== 'object' ? [] : [tree, ...elements(tree.props?.children)];
for (const lang of ['vi', 'en']) {
  await test(`${lang}: QR photo selection is available even when camera permission is denied`, () => {
    for (const granted of [false, true]) for (const isDark of [false, true]) {
      const runtime = hooks(); let picked = 0;
      const catalogs = Object.fromEntries(['careCircle', 'common'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${lang}/${ns}.json`))]));
      let controller = { scanning: false, pickingImage: false, error: '', pickImage: () => { picked++; }, retry: () => {}, scan: () => {} };
      const { default: Screen } = evaluate('src/features/care-circle/screens/CareCircleScanScreen.tsx', {
        react: runtime.react,
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        'react-native': { View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: value => value, absoluteFill: {} } },
        'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [{ granted, canAskAgain: false }, () => assert.fail('Photo selection must not request camera')] },
        'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'expo-linking': { openSettings: () => {} },
        'expo-router': { Stack: { Screen: 'Stack' }, useLocalSearchParams: () => ({}) },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        'react-i18next': { useTranslation: ns => ({ t: key => { assert.equal(typeof catalogs[ns][key], 'string', `${ns}/${key}`); return catalogs[ns][key]; } }) },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
        '../../../lib/native-permissions': { runNativePermission: () => assert.fail('Only the explicit camera button may request camera') },
        '../../../components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
        '../../../components/ScaledText': { ScaledText: 'Text' },
        '../../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ back: () => {}, replace: () => {} }) },
        '../../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } }) },
        '../../../hooks/useThemeColors': { useThemeColors: () => ({ isDark }) },
        '../../../styles': { spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }, radius: { full: 999, lg: 16 } },
        '../useCareCircleScanner': { useCareCircleScanner: () => controller },
        '../useQrCameraPermission': { useQrCameraPermission: () => ({ permission: { granted, canAskAgain: false }, pending: false, change: () => {} }) },
        ...Object.fromEntries(['header_cross_leaves_left.png', 'scan_header_heart_ecg.png', 'scan_bottom_leaves.png', 'camera_permission_family_hero.png'].map(name => [`../../../../assets/images/care-circle/${name}`, name])),
      });
      let nodes = elements(runtime.render(Screen));
      const button = nodes.find(node => node.props?.accessibilityLabel === catalogs.careCircle.qrChoosePhoto);
      assert.ok(button); assert.equal(button.props.disabled, false); button.props.onPress(); assert.equal(picked, 1);
      assert.ok(button.props.style({ pressed: false })[0].minHeight >= 56);
      controller = { ...controller, scanning: true, pickingImage: true };
      nodes = elements(runtime.render(Screen));
      assert.equal(nodes.find(node => node.props?.accessibilityLabel === catalogs.careCircle.qrChoosePhoto).props.disabled, true);
      if (granted) { const camera = nodes.find(node => node.type === 'Camera'); assert.equal(camera.props.active, false); assert.equal(camera.props.onBarcodeScanned, undefined); }
      runtime.unmount();
    }
  });
}

console.log(`Care Circle QR media: ${checks} runtime checks passed.`);
