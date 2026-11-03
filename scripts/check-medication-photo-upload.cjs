const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');

function evaluate(file, deps, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(
    module, module.exports, id => { assert.ok(id in deps, `Missing adapter ${id}`); return deps[id]; }, ...Object.values(globals)
  );
  return module.exports;
}

function photoHarness(os = 'ios', options = {}) {
  const files = [], requests = [];
  class Form {
    constructor() { this.parts = []; }
    append(...args) { this.parts.push(args); }
    *entries() { for (const [name, value] of this.parts) yield [name, value]; }
  }
  class File {
    constructor(...parts) { this.uri = parts.join('/'); this.name = parts.at(-1); this.type = this.name.endsWith('.png') ? 'image/png' : this.name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'; this.exists = false; files.push(this); }
    async bytes() { return new Uint8Array(this.buffer); }
    async arrayBuffer() { return (await this.bytes()).buffer; }
    write(encoded, config) {
      assert.deepEqual(config, { encoding: 'base64' });
      this.buffer = Buffer.from(encoded, 'base64'); this.size = options.fileSize ?? this.buffer.length; this.exists = true;
      if (options.writeFails) throw new Error('cache unavailable');
    }
    delete() { this.exists = false; if (options.deleteFails) throw new Error('cleanup unavailable'); }
  }
  const loaded = evaluate('src/features/v21/medication-photo.ts', {
    'react-native': { Platform: { OS: os } }, 'expo-crypto': { randomUUID },
    'expo-file-system': { File, Paths: { cache: 'file:///cache' } },
  }, { FormData: Form, fetch: async uri => { requests.push(uri); return options.response; } });
  return { ...loaded, files, requests, Form };
}

const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=', 'base64');
const webp = Buffer.from([82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80]);
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`PASS ${name}`); }

(async () => {
  for (const os of ['ios', 'android']) {
    await test(`${os}: a HEIC library selection uploads the actual JPEG export in an owned cache file`, async () => {
      const h = photoHarness(os);
      const asset = { uri: 'ph://original.heic', fileName: 'IMG_1234.HEIC', mimeType: 'image/heic', base64: jpeg.toString('base64') };
      const upload = await h.prepareMedicationPhoto(asset);
      const [field, part] = upload.body.parts[0];
      assert.equal(field, 'image'); assert.equal(part.type, 'image/jpeg'); assert.match(part.name, /\.jpg$/);
      assert.notEqual(part.uri, asset.uri); assert.equal(part.uri, h.files[0].uri);
      assert.deepEqual(h.files[0].buffer, jpeg); assert.equal(h.files[0].exists, true);
      const second = await h.prepareMedicationPhoto(asset);
      assert.notEqual(second.body.parts[0][1].uri, part.uri);
      upload.dispose(); upload.dispose(); second.dispose(); assert.ok(h.files.every(file => !file.exists));
    });
    for (const [mime, extension, buffer] of [['image/png', 'png', png], ['image/webp', 'webp', webp]]) {
      await test(`${os}: supported ${extension} bytes keep the correct MIME and extension`, async () => {
        const h = photoHarness(os);
        const upload = await h.prepareMedicationPhoto({ uri: 'content://selected', mimeType: 'image/jpeg', base64: buffer.toString('base64') });
        assert.equal(upload.body.parts[0][1].type, mime); assert.ok(upload.body.parts[0][1].name.endsWith('.' + extension));
        assert.deepEqual(h.files[0].buffer, buffer); upload.dispose();
      });
    }
  }
  await test('unreadable and unsupported native bytes do not create an upload', async () => {
    const h = photoHarness();
    for (const base64 of [undefined, '', Buffer.from('not an image').toString('base64')]) {
      await assert.rejects(h.prepareMedicationPhoto({ uri: 'ph://selected', base64 }), { code: 'MED_LOCAL_PHOTO_UNREADABLE' });
    }
    assert.equal(h.files.length, 0);
  });
  await test('failed cache writes are cleaned up and reported as local read errors', async () => {
    const h = photoHarness('ios', { writeFails: true });
    await assert.rejects(h.prepareMedicationPhoto({ uri: 'ph://selected', base64: jpeg.toString('base64') }), { code: 'MED_LOCAL_PHOTO_UNREADABLE' });
    assert.equal(h.files[0].exists, false);
  });
  await test('native upload size is checked before writing and after exporting', async () => {
    const h = photoHarness();
    await assert.rejects(h.prepareMedicationPhoto({ uri: 'ph://large', base64: '/9j/' + 'A'.repeat(14 * 1024 * 1024) }), { code: 'MED_LOCAL_PHOTO_TOO_LARGE' });
    assert.equal(h.files.length, 0);
    const oversizedFile = photoHarness('ios', { fileSize: 10 * 1024 * 1024 + 1 });
    await assert.rejects(oversizedFile.prepareMedicationPhoto({ uri: 'ph://large', base64: jpeg.toString('base64') }), { code: 'MED_LOCAL_PHOTO_TOO_LARGE' });
    assert.equal(oversizedFile.files[0].exists, false);
  });
  await test('cleanup errors cannot hide a successful upload', async () => {
    const h = photoHarness('ios', { deleteFails: true });
    const upload = await h.prepareMedicationPhoto({ uri: 'ph://selected', base64: jpeg.toString('base64') });
    assert.doesNotThrow(upload.dispose);
  });
  for (const [mime, extension, buffer] of [['image/jpeg', 'jpg', jpeg], ['image/png', 'png', png], ['image/webp', 'webp', webp]]) {
    await test(`web: ${extension} uses the selected file directly with a matching filename`, async () => {
      const h = photoHarness('web'); const file = new Blob([buffer], { type: mime });
      const upload = await h.prepareMedicationPhoto({ uri: 'blob:selected', file });
      assert.deepEqual(upload.body.parts[0], ['image', file, `medicine.${extension}`]);
      assert.equal(h.requests.length, 0); assert.equal(h.files.length, 0); upload.dispose();
    });
  }
  await test('web: a URI-only selection can upload without a File property', async () => {
    const blob = new Blob([png], { type: 'image/png' });
    const h = photoHarness('web', { response: { ok: true, blob: async () => blob } });
    const upload = await h.prepareMedicationPhoto({ uri: 'blob:selected' });
    assert.deepEqual(h.requests, ['blob:selected']); assert.equal(upload.body.parts[0][2], 'medicine.png');
  });
  await test('web: unsupported, oversized and empty files produce specific errors before sending', async () => {
    const h = photoHarness('web');
    for (const type of ['image/heic', 'image/gif', 'application/octet-stream']) {
      await assert.rejects(h.prepareMedicationPhoto({ file: new Blob(['content'], { type }) }), { code: 'MED_LOCAL_PHOTO_UNSUPPORTED' });
    }
    await assert.rejects(h.prepareMedicationPhoto({ file: new Blob([]) }), { code: 'MED_LOCAL_PHOTO_UNREADABLE' });
    await assert.rejects(h.prepareMedicationPhoto({ file: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' }) }), { code: 'MED_LOCAL_PHOTO_TOO_LARGE' });
  });
  const blobUtils = evaluate('node_modules/expo/src/utils/blobUtils.ts', {});
  const expoMultipart = evaluate('node_modules/expo/src/winter/fetch/convertFormData.ts', {
    '../../utils/blobUtils': blobUtils,
  });
  await test('Expo SDK 57 actual serializer reproduces the legacy URI failure before sending a request', async () => {
    const legacy = { entries: () => [['image', { uri: 'file:///cache/medicine.jpg', type: 'image/jpeg', name: 'medicine.jpg' }]] };
    await assert.rejects(expoMultipart.convertFormDataAsync(legacy), /Unsupported FormDataPart implementation/);
  });
  for (const os of ['ios', 'android']) {
    await test(`${os}: actual Expo 57 request normalization produces valid multipart image bytes`, async () => {
      const h = photoHarness(os);
      const upload = await h.prepareMedicationPhoto({ uri: 'ph://original.heic', base64: jpeg.toString('base64') });
      const expoRequest = evaluate('node_modules/expo/src/winter/fetch/RequestUtils.ts', {
        './convertFormData': expoMultipart, '../../utils/blobUtils': blobUtils,
      }, { FormData: h.Form });
      const encoded = await expoRequest.normalizeBodyInitAsync(upload.body);
      const headers = Object.fromEntries(encoded.overriddenHeaders);
      assert.match(headers['Content-Type'], /^multipart\/form-data; boundary=/);
      const parsed = await new Response(encoded.body, { headers }).formData();
      const image = parsed.get('image');
      assert.equal(image.type, 'image/jpeg'); assert.match(image.name, /\.jpg$/);
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), jpeg);
      assert.equal(h.files[0].exists, true); upload.dispose(); assert.equal(h.files[0].exists, false);
    });
  }
  await test('upload errors are localized without exposing backend exception text', () => {
    const common = { t: key => `common:${key}` };
    const api = evaluate('src/lib/apiClient.ts', {
      './health-action-events': {}, '../observability/sentry': {}, '../i18n': common,
      './env': {}, './logger': {}, './tokenStore': {},
    });
    const messages = [];
    const layout = evaluate('src/features/v21/V21Layout.tsx', {
      'react/jsx-runtime': {}, 'react-native': { StyleSheet: { create: x => x } },
      'react-native-safe-area-context': {}, 'expo-router': {}, '@expo/vector-icons': {},
      'react-i18next': {}, '../../components/Screen': {}, '../../components/ScaledText': {}, '../../hooks/useThemeColors': {},
      '../../lib/apiClient': api, '../../stores/toast.store': { useToastStore: { getState: () => ({ show: (...args) => messages.push(args) }) } },
    });
    const t = key => `v21:${key}`;
    for (const [code, key] of [
      ['UPLOAD_FILE_TOO_LARGE', 'medicationPhotoTooLarge'], ['IMAGE_TYPE_UNSUPPORTED', 'scanPhotoUnsupported'],
      ['IMAGE_INVALID', 'medicationPhotoReadError'], ['IMAGE_REQUIRED', 'medicationPhotoReadError'],
      ['MED_SCAN_LIMIT', 'scanRateLimited'], ['AI_CONSENT_REQUIRED', 'aiConsentNeeded'],
    ]) {
      layout.v21Error(new api.ApiError('internal response', 400, { code }), t);
      assert.deepEqual(messages.at(-1), [`v21:${key}`, 'error']);
    }
    layout.v21Error(new api.ApiError('private database exception', 503), t);
    assert.deepEqual(messages.at(-1), ['common:errorServer', 'error']);
    layout.v21Error(new api.ApiError('{"ok":false,"code":"UNKNOWN_CODE"}', 429), t);
    assert.deepEqual(messages.at(-1), ['common:errorRateLimited', 'error']);
    layout.v21Error(new Error('unknown device error'), t, 'medicationPhotoUploadError');
    assert.deepEqual(messages.at(-1), ['v21:medicationPhotoUploadError', 'error']);
  });
  console.log(`Medication photo upload: ${checks} runtime checks passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
