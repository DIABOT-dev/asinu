import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const braces = require('braces');
const forge = require('node-forge');
const ts = require('typescript');

assert.deepEqual(braces.expand('assets/{icons,images}/*.{png,svg}'), [
  'assets/icons/*.png', 'assets/icons/*.svg', 'assets/images/*.png', 'assets/images/*.svg',
]);
assert.equal(braces.compile('{a,b}'), '(a|b)');
assert.equal(braces.stringify(braces.parse('{a,b}')), '{a,b}');
for (const [open, close] of [['{', '}'], ['(', ')']]) {
  const nested = open.repeat(4000) + 'a,b' + close.repeat(4000);
  for (const operation of ['compile', 'expand', 'stringify', 'parse']) {
    assert.throws(() => braces[operation](nested), /maximum nesting depth/);
  }
}
// Callers may supply their own AST rather than passing through parse().
let ast = { type: 'text', value: 'safe' };
for (let i = 0; i < 8000; i++) ast = { type: 'root', nodes: [ast] };
for (const operation of ['compile', 'expand', 'stringify']) {
  assert.throws(() => braces[operation](ast), /maximum nesting depth/);
}
console.log('PASS bounded brace parsing and AST traversal; normal patterns preserved');

const keys = generateKeyPairSync('rsa', {
  modulusLength: 1024,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const privateKey = forge.pki.privateKeyFromPem(keys.privateKey);
const publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
const md = forge.md.sha256.create().update('security regression fixture');
const digest = md.digest().bytes();
assert.equal(publicKey.verify(digest, privateKey.sign(md)), true);
const { asn1 } = forge;
const node = (type, constructed, value) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
const oid = node(asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes());
const nullParameter = node(asn1.Type.NULL, false, '');
const signatureFor = (parameters) => {
  const info = node(asn1.Type.SEQUENCE, true, [
    node(asn1.Type.SEQUENCE, true, [oid, ...parameters]),
    node(asn1.Type.OCTETSTRING, false, digest),
  ]);
  return privateKey.sign(asn1.toDer(info).getBytes(), 'NONE');
};
// Preserve the library's compatibility with omitted SHA-256 NULL parameters.
assert.equal(publicKey.verify(digest, signatureFor([])), true);
for (const parameters of [
  [nullParameter, node(asn1.Type.INTEGER, false, '\x01')],
  [node(asn1.Type.INTEGER, false, '\x01')],
  [node(asn1.Type.NULL, false, '\x01')],
]) {
  assert.throws(() => publicKey.verify(digest, signatureFor(parameters)), /valid RSASSA-PKCS1-v1_5/);
}
console.log('PASS RSA signature validation rejects extra/malformed DigestAlgorithm elements');

const oauth = fs.readFileSync(new URL('../src/features/auth/oauth.service.ts', import.meta.url), 'utf8');
assert.doesNotMatch(oauth, /JSON\.stringify\((?:data|loginErr|profileJson)\)/);
assert.doesNotMatch(oauth, /accessToken\.slice\(/);
console.log('PASS OAuth does not log tokens or full provider responses');

const gradle = fs.readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
assert.doesNotMatch(gradle, /release\s*\{[^}]*signingConfig signingConfigs\.debug/s);
assert.match(gradle, /android-release-signing\.gradle/);
const config = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
assert.ok(config.expo.plugins.includes('./plugins/withReleaseSigning'));
console.log('PASS release signing has no debug fallback and survives Expo prebuild');

const { applyReleaseSigning } = require('../plugins/withReleaseSigning');
const template = 'android { buildTypes { release { signingConfig signingConfigs.debug } } }';
const generated = applyReleaseSigning(template);
assert.ok(generated.endsWith('apply from: "../../plugins/android-release-signing.gradle"\n'));
assert.equal(applyReleaseSigning(generated), generated);
console.log('PASS release-signing plugin is idempotent and applies after generated build settings');

const storeSource = fs.readFileSync(new URL('../src/lib/tokenStore.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(storeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
const storedTokens = new Map();
const secureStore = {
  getItemAsync: async key => storedTokens.get(key) ?? null,
  setItemAsync: async (key, value) => storedTokens.set(key, value),
  deleteItemAsync: async key => storedTokens.delete(key),
};
runInNewContext(compiled, {
  require: name => {
    assert.equal(name, 'expo-secure-store');
    return secureStore;
  },
  exports: moduleExports,
});
const { tokenStore } = moduleExports;
await tokenStore.setToken('old-test-session');
const finish = tokenStore.beginTokenRotation();
assert.equal(tokenStore.isRotatingToken(), true);
await tokenStore.setToken('fresh-test-session');
finish();
finish();
assert.equal(tokenStore.isRotatingToken(), false);
assert.equal(tokenStore.getToken(), 'fresh-test-session');
assert.equal(await tokenStore.loadToken(), 'fresh-test-session');
await tokenStore.clearToken();
assert.equal(tokenStore.getToken(), null);
const apiClient = fs.readFileSync(new URL('../src/lib/apiClient.ts', import.meta.url), 'utf8');
assert.match(apiClient, /token === tokenStore\.getToken\(\)/);
assert.match(apiClient, /!tokenStore\.isRotatingToken\(\)/);
console.log('PASS password-change token rotation persists securely without stale-request logout');

const draftStorageSource = fs.readFileSync(new URL('../src/features/checkin-call/triage-draft.storage.ts', import.meta.url), 'utf8');
const draftExports = {};
const draftStored = new Map();
let draftStorageFails = false;
runInNewContext(ts.transpileModule(draftStorageSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  require: name => {
    assert.equal(name, 'expo-secure-store');
    return {
      getItemAsync: async k => draftStored.get(k) ?? null,
      setItemAsync: async (k, v) => { if (draftStorageFails) throw Error('locked'); await new Promise(r => setTimeout(r, 2)); draftStored.set(k, v); },
      deleteItemAsync: async k => { draftStored.delete(k); },
    };
  }, exports: draftExports,
});
const { triageDraftKey: keyFor, triageDraftStorage: drafts } = draftExports;
const first = keyFor(1, 'episode:123');
const second = keyFor(2, 'episode:123');
assert.match(first, /^[\w.-]+$/);
assert.notEqual(first, second);
assert.notEqual(keyFor('a.b', 'c'), keyFor('a', 'b.c'));
assert.equal(keyFor(undefined, 'episode'), null);
const freshDraft = JSON.stringify({ location: 'head', symptom: 'pain', expiresAt: Date.now() + 60000 });
await drafts.setItem(first, freshDraft);
assert.equal(await drafts.getItem(first), freshDraft);
assert.equal(await drafts.getItem(second), null);
await drafts.setItem(first, JSON.stringify({ expiresAt: Date.now() - 1 }));
assert.equal(await drafts.getItem(first), null);
assert.equal(draftStored.has(first), false);
await drafts.setItem(first, 'invalid JSON');
assert.equal(await drafts.getItem(first), null);
const saving = drafts.setItem(first, freshDraft);
const clearing = drafts.removeItem(first);
await Promise.all([saving, clearing]);
assert.equal(await drafts.getItem(first), null);
draftStorageFails = true;
await drafts.setItem(first, freshDraft);
assert.equal(await drafts.getItem(first), null);
const callScreen = fs.readFileSync(new URL('../app/checkin-call/[episodeId].tsx', import.meta.url), 'utf8');
assert.doesNotMatch(callScreen, /AsyncStorage/);
console.log('PASS symptom drafts are account-scoped, expire, serialize clear after save, and never fall back to plaintext');

const cacheExports = {};
const legacy = new Map([
  ['checkin-call-triage:v1:old', 'symptoms'], ['auth-storage', 'token'], ['theme', 'dark'],
]);
const cacheSecure = new Map();
runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/localCache.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  require: name => {
    if (name === './cacheKeys') return { CACHE_KEYS: { profile: 'profile' } };
    if (name === '@react-native-async-storage/async-storage') return { getAllKeys: async () => [...legacy.keys()], multiRemove: async keys => keys.forEach(k => legacy.delete(k)) };
    assert.equal(name, 'expo-secure-store');
    return {
      getItemAsync: async k => { assert.match(k, /^[\w.-]+$/); return cacheSecure.get(k) ?? null; },
      setItemAsync: async (k, v) => { assert.match(k, /^[\w.-]+$/); cacheSecure.set(k, v); },
      deleteItemAsync: async k => { assert.match(k, /^[\w.-]+$/); cacheSecure.delete(k); },
    };
  }, exports: cacheExports,
});
await cacheExports.localCache.clearLegacyPlaintextCache();
assert.deepEqual([...legacy.keys()], ['theme']);
cacheExports.localCache.setUserId('user:one');
await cacheExports.localCache.setCached('profile', '1', { health: 'fixture' });
assert.equal((await cacheExports.localCache.getCached('profile', '1')).health, 'fixture');
cacheExports.localCache.setUserId('user:two');
assert.equal(await cacheExports.localCache.getCached('profile', '1'), null);
console.log('PASS legacy health drafts are purged and secure cache accepts scoped keys');
cacheExports.localCache.setUserId(null);
await cacheExports.localCache.setCached('profile', '1', { health: 'unowned' });
assert.equal(await cacheExports.localCache.getCached('profile', '1'), null);
cacheExports.localCache.setUserId('user:one');
await cacheExports.localCache.setCached('profile', '1', { health: 'fixture' });
const delayedRead = cacheExports.localCache.getCached('profile', '1');
cacheExports.localCache.setUserId('user:two');
assert.equal(await delayedRead, null);
console.log('PASS health cache refuses unauthenticated writes and discards reads completed after account changes');

// Provider consent is account-scoped; a stale storage operation cannot authorize
// a different signed-in account or reuse the legacy OpenAI-only disclosure.
const consentExports = {};
const consentValues = new Map([['@asinu/ai_data_consent_v1', 'true']]);
let consentSession = { profile: { id: 'owner-one' }, token: 'session-one' };
let pauseConsentRead = null;
let pauseConsentWrite = null;
runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/aiDataConsent.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: consentExports,
  require: name => {
    if (name === '../features/auth/auth.store') return { useAuthStore: { getState: () => consentSession } };
    assert.equal(name, '@react-native-async-storage/async-storage');
    return { __esModule: true, default: {
      getItem: async key => { const value = consentValues.get(key) ?? null; if (pauseConsentRead) await new Promise(resolve => { pauseConsentRead = resolve; }); return value; },
      setItem: async (key, value) => { if (pauseConsentWrite) await new Promise(resolve => { pauseConsentWrite = resolve; }); consentValues.set(key, value); },
      removeItem: async key => { consentValues.delete(key); },
    } };
  },
});
assert.equal(await consentExports.hasAiDataConsent(), false);
assert.equal(await consentExports.saveAiDataConsent(), true);
assert.equal(await consentExports.hasAiDataConsent(), true);
consentSession = { profile: { id: 'owner-two' }, token: 'session-two' };
assert.equal(await consentExports.hasAiDataConsent(), false);
consentSession = { profile: { id: 'owner-one' }, token: 'session-one' };
pauseConsentRead = true;
const consentRead = consentExports.hasAiDataConsent();
consentSession = { profile: { id: 'owner-two' }, token: 'session-two' };
pauseConsentRead();pauseConsentRead = null;
assert.equal(await consentRead, false);
pauseConsentWrite = true;
const consentWrite = consentExports.saveAiDataConsent();
consentSession = { profile: { id: 'owner-one' }, token: 'session-one' };
pauseConsentWrite();pauseConsentWrite = null;
assert.equal(await consentWrite, false);
await consentExports.revokeAiDataConsent();
assert.equal(await consentExports.hasAiDataConsent(), false);
assert.equal(consentValues.has('@asinu/ai_data_consent_v1'), false);
console.log('PASS updated provider consent requires a fresh account grant and rejects account-switch races');
