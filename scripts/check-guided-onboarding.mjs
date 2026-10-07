import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const read = file => fs.readFileSync(file, 'utf8');
function evaluate(file, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.ok(Object.hasOwn(imports, id), `Missing guidance adapter: ${id}`); return imports[id];
  });
  return module.exports;
}
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const model = evaluate('src/features/guidance/guidance.model.ts');
const completedWelcome = () => ({ ...model.defaultProgress(), welcomeSeen: true, role: 'self' });
await test('focus-aware guidance uses the installed Expo Router API', () => {
  for (const file of ['src/features/guidance/GuidanceProvider.tsx', 'src/features/guidance/VoiceAnswerButton.tsx']) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const focusImport = ast.statements.find(node => ts.isImportDeclaration(node)
      && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && node.importClause.namedBindings.elements.some(element => (element.propertyName || element.name).text === 'useIsFocused'));
    assert.ok(focusImport, `${file}: missing focus hook`);
    assert.equal(focusImport.moduleSpecifier.text, 'expo-router', `${file}: incompatible focus provider`);
  }
  const exports = read('node_modules/expo-router/build/exports.d.ts');
  assert.match(exports, /export\s*\{\s*useIsFocused\s*\}/);
});
await test('application code never imports external React Navigation packages on SDK 56+', () => {
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!/\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.d.ts')) continue;
      const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true,
        /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const check = node => {
        if (ts.isStringLiteralLike(node) && node.text.startsWith('@react-navigation/')) {
          const parent = node.parent;
          const moduleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent))
            && parent.moduleSpecifier === node;
          const moduleCall = ts.isCallExpression(parent)
            && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || parent.expression.getText(ast) === 'require')
            && parent.arguments[0] === node;
          assert.ok(!moduleSpecifier && !moduleCall, `${file}: import ${node.text} through Expo Router instead`);
        }
        ts.forEachChild(node, check);
      };
      check(ast);
    }
  };
  visit('app'); visit('src');
});
await test('home teaches only its two real controls, not later questions', () => {
  let progress = completedWelcome();
  assert.equal(model.nextGuideStep(progress, ['home.fine', 'home.unwell', 'home.suggestions']), 'home.fine');
  progress = model.mergeProgress(progress, { completed: ['home.fine'] });
  assert.equal(model.nextGuideStep(progress, ['home.fine', 'home.unwell', 'home.suggestions']), 'home.unwell');
  progress = model.mergeProgress(progress, { completed: ['home.unwell'] });
  assert.equal(model.nextGuideStep(progress, ['home.suggestions']), undefined);
  progress = model.mergeProgress(progress, { firstCheckin: true });
  assert.equal(model.nextGuideStep(progress, ['home.suggestions']), 'home.suggestions');
});
await test('answer choices precede Other and only appear when their actual targets exist', () => {
  const progress = completedWelcome();
  assert.equal(model.nextGuideStep(progress, []), undefined);
  assert.equal(model.nextGuideStep(progress, ['checkin.other']), undefined);
  assert.equal(model.nextGuideStep(progress, ['checkin.choices', 'checkin.other']), 'checkin.choices');
  assert.equal(model.nextGuideStep(model.mergeProgress(progress, { completed: ['checkin.choices'] }), ['checkin.other']), 'checkin.other');
});
await test('care-circle steps follow actual form progress without a five-step blocking tour', () => {
  let progress = completedWelcome();
  for (const id of ['circle.add', 'circle.phone', 'circle.relationship', 'circle.send', 'circle.member']) {
    assert.equal(model.nextGuideStep(progress, [id]), id);
    progress = model.mergeProgress(progress, { completed: [id] });
    assert.equal(model.nextGuideStep(progress, [id]), undefined);
  }
});
await test('all fixed Vietnamese coach sentences are short, everyday, and non-clinical', () => {
  const strings = JSON.parse(read('src/i18n/locales/vi/onboarding.json')).guidance.steps;
  for (const id of model.GUIDE_STEPS) {
    const text = strings[id.replace('.', '_')];
    assert.ok(text); assert.ok(text.trim().split(/\s+/).length <= 15, `${id}: too long`);
    assert.doesNotMatch(text, /check-in|chẩn đoán|điều trị|kê đơn|\bbác\b/i);
    assert.equal((text.match(/[.!?]/g) || []).length, 1, id);
  }
});
const luminance = hex => {
  const rgb = hex.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
await test('guide text and button labels exceed 7:1 contrast', () => {
  const colors = model.guideColors;
  for (const [fg, bg] of [[colors.ink, colors.background], [colors.primary, colors.background], [colors.onPrimary, colors.primary]]) {
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 7);
  }
});

const storage = new Map(); let requestImpl;
const create = init => {
  let state; const get = () => state;
  const set = value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) }; };
  state = init(set, get); return { getState: get, setState: set };
};
const { useGuidanceStore: store } = evaluate('src/features/guidance/guidance.store.ts', {
  zustand: { create }, './guidance.model': model,
  '@react-native-async-storage/async-storage': { getItem: async key => storage.get(key) || null,
    setItem: async (key, value) => { storage.set(key, value); } },
  '../../lib/apiClient': { apiClient: (...args) => requestImpl(...args) },
});
const remote = new Map();
const server = async (path, options = {}) => {
  const account = store.getState().account;
  let progress = remote.get(account) || completedWelcome();
  if (path.endsWith('/replay')) progress = { ...progress, completed: [], welcomeSeen: false, epoch: progress.epoch + 1 };
  else if (options.method === 'PUT') {
    if (options.body.epoch !== progress.epoch) throw Object.assign(new Error('stale'), { code: 'GUIDANCE_STALE' });
    progress = model.mergeProgress(progress, options.body);
  }
  remote.set(account, progress); return { ok: true, progress };
};
await test('account progress synchronizes across reloads and never leaks to a different account', async () => {
  requestImpl = server; await store.getState().load('a');
  store.getState().acknowledge('home.fine'); await tick();
  await store.getState().load('a'); assert.deepEqual(store.getState().progress.completed, ['home.fine']);
  await store.getState().load('b'); assert.deepEqual(store.getState().progress.completed, []);
});
await test('a late request for account A cannot replace account B or resurrect logout state', async () => {
  const old = deferred(); requestImpl = () => old.promise;
  const load = store.getState().load('slow'); await tick();
  requestImpl = server; await store.getState().load('current');
  old.resolve({ ok: true, progress: { ...completedWelcome(), completed: ['home.fine'] } }); await load;
  assert.equal(store.getState().account, 'current'); assert.deepEqual(store.getState().progress.completed, []);
  await store.getState().load(null); assert.equal(store.getState().ready, false);
});
await test('offline acknowledgements remain pending, then merge with server progress', async () => {
  requestImpl = server; await store.getState().load('offline');
  requestImpl = async () => { throw new Error('offline'); };
  store.getState().acknowledge('home.fine'); await tick();
  assert.ok(store.getState().progress.completed.includes('home.fine'));
  requestImpl = server; await store.getState().refresh();
  assert.ok(remote.get('offline').completed.includes('home.fine'));
});
await test('rapid acknowledgements and a sound toggle keep both batches and account cache intact', async () => {
  requestImpl = server; await store.getState().load('rapid');
  const first = deferred(); let calls = 0;
  requestImpl = (path, options) => options?.method === 'PUT' && ++calls === 1 ? first.promise : server(path, options);
  store.getState().acknowledge('home.fine');
  store.getState().acknowledge('home.unwell'); store.getState().update({ readAloud: false }); await tick();
  const saved = JSON.parse(storage.get('guidance:account:rapid:v1'));
  assert.deepEqual(saved.pending.completed, ['home.fine', 'home.unwell']);
  assert.equal(saved.pending.readAloud, false);
  first.resolve(await server('/api/mobile/guidance', { method: 'PUT', body: { epoch: 0, completed: ['home.fine'] } }));
  await tick(); assert.deepEqual(remote.get('rapid').completed, ['home.fine', 'home.unwell']);
  assert.equal(remote.get('rapid').readAloud, false);
});
await test('replay invalidates an older in-flight save and retains the sound preference', async () => {
  requestImpl = server; await store.getState().load('replay');
  const old = deferred();
  requestImpl = (path, options) => options?.method === 'PUT' ? old.promise : server(path, options);
  store.getState().acknowledge('home.fine');
  await store.getState().replay();
  old.resolve({ ok: true, progress: { ...completedWelcome(), completed: ['home.fine'] } }); await tick();
  assert.equal(store.getState().progress.epoch, 1); assert.deepEqual(store.getState().progress.completed, []);
});

const { CheckinCallAudio } = evaluate('src/features/checkin-call/checkin-call.audio.ts');
const assetImports = Object.fromEntries([...read('src/features/guidance/guidance.assets.ts').matchAll(/require\('([^']+)'\)/g)]
  .map((match, index) => [match[1], index + 1]));
const { guidanceAssets } = evaluate('src/features/guidance/guidance.assets.ts', assetImports);
let platform = 'ios'; let silent = false; let mode;
const native = { isGuidanceSoundAllowed: async () => !silent };
const played = [], created = [], events = [];
let unloadBarrier = Promise.resolve(); let createBarrier = null;
let failCreate = false; let failRelease = false;
const { guidanceAudio } = evaluate('src/features/guidance/guidance.audio.ts', {
  'react-native': { Platform: { get OS() { return platform; } }, NativeModules: {
    AsinuCheckinCallModule: native,
  } }, '../checkin-call/checkin-call.audio': { CheckinCallAudio },
  './guidance.assets': { guidanceAssets },
  '../../lib/audio': { Audio: { setAudioModeAsync: async value => { mode = value; },
    Sound: { createAsync: async (source, initial) => {
      if (failCreate) throw new Error('Audio unavailable');
      const sound = { source, initial, listener: null,
        pauseAsync: () => { events.push(['pause', source]); return failRelease ? Promise.reject(new Error('pause')) : Promise.resolve(); },
        unloadAsync: () => { events.push(['unload', source]); return failRelease ? Promise.reject(new Error('unload')) : unloadBarrier; },
        play: () => { played.push(source); },
        setOnPlaybackStatusUpdate: callback => { sound.listener = callback; },
      };
      created.push(sound);
      if (createBarrier) await createBarrier.promise;
      return { sound };
    } },
  } },
});
await test('Vietnamese guidance plays its offline Tuấn Anh recording and respects iOS silent mode', async () => {
  await guidanceAudio.speak('welcome', 'vi');
  assert.equal(mode.playsInSilentModeIOS, false);
  assert.equal(played.at(-1), guidanceAssets.vi.welcome);
  assert.equal(created.at(-1).initial.shouldPlay, false, 'The player must be owned before it starts');
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(mode.playsInSilentModeIOS, true);
});
await test('English guidance selects English recordings by the same Asinu narrator', async () => {
  await guidanceAudio.speak('home.fine', 'en-US');
  assert.equal(played.at(-1), guidanceAssets.en['home.fine']);
});
await test('Android silent mode suppresses autoplay but explicit Replay remains usable', async () => {
  platform = 'android'; silent = true; const count = played.length;
  await guidanceAudio.speak('welcome', 'vi'); assert.equal(played.length, count);
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(played.length, count + 1);
});
await test('older Android builds stay silent automatically but permit manual listening', async () => {
  const permission = native.isGuidanceSoundAllowed; delete native.isGuidanceSoundAllowed;
  const count = played.length;
  await guidanceAudio.speak('welcome', 'vi'); assert.equal(played.length, count);
  await guidanceAudio.speak('welcome', 'vi', true); assert.equal(played.length, count + 1);
  native.isGuidanceSoundAllowed = permission;
});
await test('a second guide reading waits for native cancellation, and only the latest intent speaks', async () => {
  platform = 'ios'; silent = false;
  await guidanceAudio.speak('home.fine', 'vi');
  const previous = played.at(-1); const blocked = deferred(); unloadBarrier = blocked.promise;
  const first = guidanceAudio.speak('home.unwell', 'vi');
  assert.deepEqual(events.at(-1), ['pause', previous], 'Pause must begin synchronously');
  const second = guidanceAudio.speak('home.suggestions', 'vi');
  const count = played.length; await tick(); assert.equal(played.length, count);
  blocked.resolve(); await Promise.all([first, second]);
  assert.equal(played.at(-1), guidanceAssets.vi['home.suggestions']);
  assert.equal(played.length, count + 1);
  unloadBarrier = Promise.resolve();
});
await test('leaving a bubble during native creation unloads its player without autoplay', async () => {
  createBarrier = deferred(); const count = played.length;
  const pending = guidanceAudio.speak('circle.phone', 'vi'); await tick();
  const orphan = created.at(-1);
  await guidanceAudio.stop();
  createBarrier.resolve(); await pending; createBarrier = null;
  assert.equal(played.length, count);
  assert.ok(events.some(([event, source]) => event === 'unload' && source === orphan.source));
});
await test('opening a real call cancels guidance before loading call audio', async () => {
  await guidanceAudio.speak('welcome', 'vi');
  const blocked = deferred(); unloadBarrier = blocked.promise; let loaded = false;
  const player = new CheckinCallAudio({ stopSpeech: async () => {}, onState: () => {}, speak: () => {},
    load: async () => { loaded = true; return 'call.mp3'; }, prepare: async () => {},
    create: async () => ({ play: () => {}, pauseAsync: async () => {}, unloadAsync: async () => {}, setOnPlaybackStatusUpdate: () => {} }) });
  const call = player.play({ key: 'call', text: 'Call', language: 'vi' });
  await tick(); assert.equal(loaded, false); blocked.resolve(); await call;
  assert.equal(loaded, true); player.dispose(); unloadBarrier = Promise.resolve();
});
await test('recording failures never substitute an OS voice and an explicit retry can recover', async () => {
  failCreate = true; const count = played.length;
  await guidanceAudio.speak('home.fine', 'vi'); assert.equal(played.length, count);
  assert.doesNotMatch(read('src/features/guidance/guidance.audio.ts'), /expo-speech|Speech\s*\./);
  failCreate = false; await guidanceAudio.speak('home.fine', 'vi', true);
  assert.equal(played.length, count + 1);
});
await test('an unpausable and unreleasable old recording cannot overlap a new guide', async () => {
  failRelease = true; const count = played.length;
  await guidanceAudio.speak('home.unwell', 'vi'); assert.equal(played.length, count);
  failRelease = false; await guidanceAudio.speak('home.unwell', 'vi', true);
  assert.equal(played.length, count + 1);
});
await test('finished clips release their native player and stale completion cannot stop a new clip', async () => {
  const old = created.at(-1);
  await guidanceAudio.speak('circle.add', 'vi'); const current = created.at(-1);
  const priorEvents = events.length;
  old.listener({ didJustFinish: true, isLoaded: true }); await tick();
  assert.equal(events.length, priorEvents);
  current.listener({ didJustFinish: true, isLoaded: true }); await tick();
  assert.ok(events.slice(priorEvents).some(([event, source]) => event === 'unload' && source === current.source));
});
await test('all 22 bundled clips match their fixed translations, voice identity and verified audio bytes', () => {
  const manifest = JSON.parse(read('assets/sounds/guidance/manifest.json'));
  const nativeVoice = JSON.parse(read('assets/sounds/asinu_checkin_open_app_vi.json')).voice;
  assert.equal(manifest.voice, nativeVoice); assert.equal(manifest.voiceLabel, 'Asinu Tuan Anh v4');
  assert.equal(manifest.engine, 'v4'); assert.ok(manifest.speed < 1 && manifest.speed >= 0.75);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const ids = ['welcome', ...model.GUIDE_STEPS];
  for (const language of ['vi', 'en']) {
    const strings = JSON.parse(read(`src/i18n/locales/${language}/onboarding.json`)).guidance;
    assert.deepEqual(Object.keys(manifest.clips[language]).sort(), [...ids].sort());
    for (const id of ids) {
      const clip = manifest.clips[language][id];
      const expected = id === 'welcome' ? `${strings.welcomeTitle}. ${strings.welcomeBody}`
        : id === 'circle.member' ? strings.circleMemberAudio : strings.steps[id.replace('.', '_')];
      assert.equal(clip.text, expected); assert.ok(!clip.text.includes('{{'));
      assert.equal(clip.textSha256, hash(expected));
      const bytes = fs.readFileSync(`assets/sounds/guidance/${clip.file}`);
      assert.equal(clip.audioSha256, hash(bytes)); assert.equal(clip.bytes, bytes.length);
      assert.ok(bytes.length > 1000 && bytes.length < 2_000_000);
      assert.ok(bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 0xff);
      assert.ok(Math.abs(clip.integratedLufs + 16) <= 0.5); assert.ok(clip.truePeakDbtp <= -1);
      assert.ok(Object.hasOwn(guidanceAssets[language], id));
    }
  }
});

await test('onboarding uses inline touch-through scrims, native text scaling and no carousel', () => {
  const source = read('src/features/guidance/GuidanceProvider.tsx');
  assert.doesNotMatch(source, /<Modal|<FlatList|numberOfLines|allowFontScaling=\{false\}/);
  assert.match(source, /fontSize: 30/); assert.match(source, /fontSize: 22/);
  assert.match(source, /minHeight: 60/); assert.match(source, /minHeight: 56/);
  assert.match(source, /useQueuedModalBusy/); assert.match(source, /!foreground \|\| keyboard \|\| backgroundCall/);
  assert.match(source, /onTouchEnd=.*acknowledge/);
  for (const file of ['app/(tabs)/home/index.tsx', 'app/checkin/index.tsx', 'app/(tabs)/profile/index.tsx'])
    assert.doesNotMatch(read(file), /<CheckinGuideCarousel/);
  assert.match(source, /assets\/asinu_chat_sticker\.png/);
});
console.log(`Guided onboarding: ${checks} regression checks passed.`);
