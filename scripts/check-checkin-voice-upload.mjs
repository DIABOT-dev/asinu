import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function evaluate(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), source)(
    module, module.exports, name => {
      assert.ok(Object.hasOwn(imports, name), `Missing adapter: ${name}`);
      return imports[name];
    }, ...Object.values(globals),
  );
  return module.exports;
}

// Exercise the installed SDK's actual multipart encoder and FormData patch.
// Native file reads are the boundary double; accepted multipart parts are not.
const { convertFormDataAsync } = evaluate('node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() },
});
const { installFormDataPatch } = evaluate('node_modules/expo/src/winter/FormData.ts');
class NativeFormData { constructor() { this._parts = []; } }
const ExpoFormData = installFormDataPatch(NativeFormData);
const audioBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 1, 2, 255]);

function harness(os = 'ios', { response, transport, readResponse } = {}) {
  const requests = [], files = [], localReads = [], timers = new Map();
  class NativeFile {
    constructor(uri) {
      this.uri = uri;
      this.name = uri.split('/').at(-1);
      this.type = uri.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
      files.push(this);
    }
    bytes() { return Promise.resolve(audioBytes); }
  }
  class ApiError extends Error {
    constructor(message, status, details) {
      super(message); this.statusCode = status; this.code = details?.code;
    }
  }
  const { chatApi } = evaluate('src/features/chat/chat.api.ts', {
    'expo-file-system': { File: NativeFile },
    'react-native': { Platform: { OS: os } },
    '../../observability/sentry': {
      monitoredFetch: async (url, options) => {
        const encoded = await convertFormDataAsync(options.body, 'checkin-audio-boundary');
        requests.push({ url, options, encoded });
        if (transport) {return transport(options);}
        return response || { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, text: ' Tôi hơi mệt ' }) };
      },
    },
    '../../i18n': { __esModule: true, default: { t: key => key } },
    '../../lib/apiClient': { ApiError },
    '../../lib/env': { env: { apiBaseUrl: 'https://test.invalid' } },
    '../../lib/tokenStore': { tokenStore: { getToken: () => 'test-token' } },
  }, {
    FormData: os === 'web' ? FormData : ExpoFormData,
    fetch: async uri => { localReads.push(uri); return readResponse; },
    setTimeout: (fn, ms) => { assert.equal(ms, 45000); timers.set(1, fn); return 1; },
    clearTimeout: id => timers.delete(id),
  });
  return { chatApi, requests, files, localReads, timers };
}

test('SDK 57 reproduces the reported failure for the legacy URI-only part', async () => {
  const body = new ExpoFormData();
  body.append('audio', { uri: 'file:///answer.m4a', type: 'audio/m4a', name: 'voice.m4a' });
  await assert.rejects(convertFormDataAsync(body), /Unsupported FormDataPart implementation/);
});

for (const os of ['ios', 'android']) {
  test(`${os}: the real client uploads recording bytes through the SDK 57 encoder`, async () => {
    const h = harness(os);
    assert.equal(await h.chatApi.transcribeAudio('file:///cache/answer.m4a', 'vi', 'checkin'), 'Tôi hơi mệt');
    assert.equal(h.requests.length, 1);
    const { url, options, encoded } = h.requests[0];
    assert.equal(url, 'https://test.invalid/api/mobile/checkin/transcribe');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Accept-Language'], 'vi');
    assert.equal(options.headers['Content-Type'], undefined, 'Fetch generates the multipart boundary');
    assert.ok(options.signal);
    assert.ok(Buffer.from(encoded.body).includes(audioBytes));
    assert.match(new TextDecoder().decode(encoded.body), /name="audio"; filename="answer.m4a"/);
    assert.match(new TextDecoder().decode(encoded.body), /content-type: audio\/mp4/);
    assert.equal(h.files.length, 1);
    assert.equal(h.files[0].uri, 'file:///cache/answer.m4a');
    assert.deepEqual(h.localReads, [], 'Native recordings use File, not fetch(file://)');
    assert.equal(h.timers.size, 0);
  });
}

for (const [mime, extension] of [['audio/webm', 'webm'], ['audio/mp4', 'm4a'], ['audio/wav', 'wav'], ['audio/ogg', 'ogg']]) {
  test(`web: a ${mime} recording uploads as a Blob with the correct filename`, async () => {
    const blob = new Blob([audioBytes], { type: mime });
    const h = harness('web', { readResponse: { ok: true, blob: async () => blob } });
    await h.chatApi.transcribeAudio('blob:test-recording', 'en', 'checkin');
    const { options, encoded } = h.requests[0];
    assert.equal(options.headers['Accept-Language'], 'en');
    assert.equal(options.body.get('audio').name, `voice.${extension}`);
    assert.ok(Buffer.from(encoded.body).includes(audioBytes));
    assert.deepEqual(h.localReads, ['blob:test-recording']);
    assert.equal(h.files.length, 0);
  });
}

test('chat keeps its own endpoint, and backend consent failures stay actionable', async () => {
  const h = harness();
  await h.chatApi.transcribeAudio('file:///answer.m4a');
  assert.equal(h.requests[0].url, 'https://test.invalid/api/mobile/chat/transcribe');
  const denied = harness('ios', {
    response: { ok: false, status: 403, text: async () => JSON.stringify({ ok: false, code: 'AI_CONSENT_REQUIRED', error: 'Consent required' }) },
  });
  await assert.rejects(denied.chatApi.transcribeAudio('file:///answer.m4a', 'vi', 'checkin'),
    error => error.statusCode === 403 && error.code === 'AI_CONSENT_REQUIRED');
  assert.equal(denied.timers.size, 0);
});

test('empty speech returns no invented answer; invalid responses and network failures release the request', async () => {
  const empty = harness('ios', { response: { ok: true, text: async () => JSON.stringify({ ok: true, text: '  ' }) } });
  assert.equal(await empty.chatApi.transcribeAudio('file:///answer.m4a', 'vi', 'checkin'), '');
  const bad = harness('ios', { response: { ok: false, status: 502, text: async () => '<html>unavailable</html>' } });
  await assert.rejects(bad.chatApi.transcribeAudio('file:///answer.m4a', 'vi', 'checkin'), error => error.statusCode === 502);
  assert.equal(bad.timers.size, 0);
  const failed = harness('ios', { transport: () => { throw new TypeError('Network request failed'); } });
  await assert.rejects(failed.chatApi.transcribeAudio('file:///answer.m4a', 'vi', 'checkin'), /Network request failed/);
  assert.equal(failed.timers.size, 0);
});

test('unreadable browser audio stops before a transcription request', async () => {
  const h = harness('web', { readResponse: { ok: false } });
  await assert.rejects(h.chatApi.transcribeAudio('blob:expired', 'vi', 'checkin'), /RECORDING_FILE_UNAVAILABLE/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
});
