import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const sdkRoot = path.resolve(path.dirname(require.resolve('livekit-client')), '..');
const files = ['src/api/SignalClient.ts', 'dist/livekit-client.esm.mjs', 'dist/livekit-client.umd.js'];

function awaiter(context, args, unused, factory) {
  const iterator = factory.apply(context, args || []);
  return new Promise((resolve, reject) => {
    function step(method, value) {
      let next;
      try { next = iterator[method](value); } catch (error) { reject(error); return; }
      if (next.done) resolve(next.value);
      else Promise.resolve(next.value).then(result => step('next', result), error => step('throw', error));
    }
    step('next');
  });
}

function loadReadingLoop(file) {
  const source = fs.readFileSync(path.join(sdkRoot, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const methods = [];
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name && node.name.getText(ast) === 'startReadingLoop') {
      methods.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(methods.length, 1, `${file}: expected one SDK signal reader`);
  const output = ts.transpileModule(`const harness = { ${methods[0].getText(ast)} };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  // Execute the installed SDK method itself, including each compiled runtime,
  // with deterministic readers instead of connecting to anyone's phone/server.
  // eslint-disable-next-line no-new-func
  return new Function('__awaiter', 'kr', 'sleep', 'za', 'parseSignalResponse', 'Yo',
    `${output}\nreturn harness.startReadingLoop;`)(awaiter, awaiter,
    () => Promise.resolve(), () => Promise.resolve(), value => value, value => value);
}

async function failureWhileReading(readLoop, stateAfterRead, replaceAttempt = false) {
  const errors = [], debug = [], closed = [];
  let rejectRead, signalRead;
  const started = new Promise(resolve => { signalRead = resolve; });
  const client = {
    attemptId: 1, lifecycleState: 'connected', signalLatency: 0,
    log: { error: (...args) => errors.push(args), debug: (...args) => debug.push(args) },
    handleOnClose: async (...args) => closed.push(args), handleSignalResponse: () => {},
  };
  const task = readLoop.call(client, {
    read: () => { signalRead(); return new Promise((resolve, reject) => { rejectRead = reject; }); },
  });
  await started;
  client.lifecycleState = stateAfterRead;
  if (replaceAttempt) client.attemptId += 1;
  rejectRead(Object.assign(new Error('WS closed unexpectedly'), { name: 'ConnectionError', reasonName: 'WebSocket' }));
  await task;
  return { errors, debug, closed };
}

let checks = 0;
for (const file of files) {
  const readLoop = loadReadingLoop(file);
  for (const state of ['disconnecting', 'closed']) {
    const result = await failureWhileReading(readLoop, state);
    assert.equal(result.errors.length, 0, `${file}: ${state} must not become a red console error`);
    assert.equal(result.closed.length, 0, `${file}: planned shutdown must not trigger reconnect`);
    assert.equal(result.debug.length, 1, `${file}: keep a debug diagnostic for expected shutdown`);
    checks += 1;
  }
  for (const state of ['connected', 'reconnecting']) {
    const result = await failureWhileReading(readLoop, state, true);
    assert.equal(result.errors.length, 0, `${file}: replaced transport cannot report a current call error`);
    assert.equal(result.closed.length, 0, `${file}: stale reader cannot close the new transport`);
    checks += 1;
  }
  for (const state of ['connected', 'offline', 'connecting', 'reconnecting']) {
    const result = await failureWhileReading(readLoop, state);
    assert.equal(result.errors.length, 1, `${file}: real ${state} transport failure must still be reported`);
    assert.equal(result.closed.length, 1, `${file}: retain real failure handling/reconnect`);
    checks += 1;
  }
  const cleanErrors = [];
  await readLoop.call({
    attemptId: 1, lifecycleState: 'closed', signalLatency: 0,
    log: { error: value => cleanErrors.push(value) },
  }, { read: async () => ({ done: true }) });
  assert.equal(cleanErrors.length, 0, `${file}: clean end-of-stream stays successful`);
  checks += 1;
}
console.log(`LiveKit signal lifecycle: ${checks} regression checks passed across source, ESM and React Native UMD.`);
