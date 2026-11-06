const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness(initialAppState = 'active') {
  const slots = [];
  const listeners = new Set();
  const app = {
    currentState: initialAppState,
    addEventListener(event, listener) {
      assert.equal(event, 'change');
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  let cursor = 0, focused = true, reduced = false, focusWork, cleanup, writes = 0;
  const adapters = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value) => { slots[index] = value; writes++; }];
      },
      useCallback(work, deps) {
        const index = cursor++;
        if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
          slots[index] = { work, deps };
        }
        return slots[index].work;
      },
    },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }) },
    'expo-router': { useFocusEffect(work) {
      if (focused && work !== focusWork) {
        if (cleanup) cleanup();
        focusWork = work;
        cleanup = work();
      }
    } },
    'expo-image': { Image: 'ExpoImage' },
    'react-native': { AppState: app, StyleSheet: { absoluteFill: { position: 'absolute' } } },
    'react-native-reanimated': { useReducedMotion: () => reduced },
    '../../../assets/images/profile/profile-ocean-wave-loop-v2.webp': 'loop',
    '../../../assets/images/profile/profile-ocean-wave-poster-v2.webp': 'poster',
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/profile/ProfileOceanWave.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // Run the actual component with controllable navigation and native app lifecycle.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, (id) => {
    assert.ok(id in adapters, `Missing ocean adapter: ${id}`);
    return adapters[id];
  });
  const render = () => { cursor = 0; return module.exports.ProfileOceanWave(); };
  render(); // Focus effects run after the first render; read their resulting state next.
  return {
    render, listeners, writes: () => writes,
    state(value) { app.currentState = value; for (const listener of listeners) listener(value); },
    blur() { focused = false; if (cleanup) cleanup(); cleanup = undefined; focusWork = undefined; },
    focus() { focused = true; render(); },
    reduced(value) { reduced = value; },
  };
}

const active = harness();
assert.equal(active.render().props.source, 'loop');
assert.equal(active.render().props.autoplay, true);
assert.equal(active.render().props.transition, 0);
assert.equal(active.render().props.accessible, false);
const oldKey = active.render().key;
active.state('background');
assert.equal(active.render().props.source, 'poster');
assert.notEqual(active.render().key, oldKey, 'Backgrounding unmounts the animated decoder');
active.state('inactive');
assert.equal(active.render().props.autoplay, false);
active.state('active');
assert.equal(active.render().props.source, 'loop');
console.log('PASS foreground/background/inactive select the correct resource');

const stale = [...active.listeners];
active.blur();
assert.equal(active.listeners.size, 0);
assert.equal(active.render().props.source, 'poster');
const writes = active.writes();
stale.forEach((listener) => listener('active'));
assert.equal(active.writes(), writes, 'A queued event after blur/unmount cannot restart the loop');
active.focus();
assert.equal(active.listeners.size, 1);
assert.equal(active.render().props.source, 'loop');
active.blur();
console.log('PASS navigation blur/unmount releases listeners and refocus resumes');

const reduced = harness();
reduced.reduced(true);
assert.equal(reduced.render().props.source, 'poster');
assert.equal(reduced.render().props.autoplay, false);
reduced.state('background'); reduced.state('active');
assert.equal(reduced.render().props.source, 'poster');
reduced.reduced(false);
assert.equal(reduced.render().props.source, 'loop');
reduced.blur();
console.log('PASS reduced motion remains static through lifecycle changes');

const failure = harness();
failure.render().props.onError();
assert.equal(failure.render().props.source, 'poster');
failure.blur(); failure.focus();
assert.equal(failure.render().props.source, 'poster', 'A failed decoder does not retry on every focus');
failure.blur();
const cold = harness('background');
assert.equal(cold.render().props.source, 'poster');
cold.state('active');
assert.equal(cold.render().props.source, 'loop');
cold.blur();
console.log('PASS decoder errors and background launches keep a usable poster');

const asset = fs.readFileSync('assets/images/profile/profile-ocean-wave-loop-v2.webp');
assert.equal(asset.toString('ascii', 0, 4), 'RIFF');
assert.equal(asset.toString('ascii', 8, 12), 'WEBP');
assert.ok(asset.length < 6 * 1024 * 1024, 'Full-screen water stays below 6 MiB without a network request');
let frameCount = 0, duration = 0, loop;
for (let offset = 12; offset + 8 <= asset.length;) {
  const tag = asset.toString('ascii', offset, offset + 4);
  const length = asset.readUInt32LE(offset + 4);
  if (tag === 'ANIM') loop = asset.readUInt16LE(offset + 12);
  if (tag === 'ANMF') {
    if (frameCount === 0) {
      assert.equal(asset.readUIntLE(offset + 14, 3) + 1, 640);
      assert.equal(asset.readUIntLE(offset + 17, 3) + 1, 960);
      assert.equal(asset.toString('ascii', offset + 24, offset + 28), 'VP8 ',
        'The first full-screen frame is opaque, with no circular/oval mask');
    }
    frameCount++;
    duration += asset.readUIntLE(offset + 20, 3);
  }
  offset += 8 + length + (length % 2);
}
assert.equal(loop, 0, 'Animation loops indefinitely');
assert.equal(frameCount, 80, 'Contains real changing frames, not a still image');
assert.equal(duration, 4000);
const poster = fs.readFileSync('assets/images/profile/profile-ocean-wave-poster-v2.webp');
assert.equal(poster.includes(Buffer.from('ANIM')), false, 'Reduced-motion poster is not animated');
console.log(`PASS bundled footage: ${frameCount} frames / ${duration}ms / ${Math.round(asset.length / 1024)} KiB`);
