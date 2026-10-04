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
