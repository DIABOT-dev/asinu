import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function evaluate(source, requireModule = () => { throw new Error('Unexpected runtime import'); }) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  // Test the actual local TypeScript modules, with native dependencies injected.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, requireModule);
  return module.exports;
}
const audioSource = fs.readFileSync('src/features/checkin-call/checkin-call.audio.ts', 'utf8');
const { CheckinCallAudio, isFamilyNoticePrompt } = evaluate(audioSource);
const { getUserCheckinCallOutcome, getClosedCheckinCallStatusKey, isCheckinCallAttemptClosed } = evaluate(fs.readFileSync('src/features/checkin-call/checkin-call.state.ts', 'utf8'));
let checks = 0;
const test = async (name, run) => {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const prompt = key => ({ key, text: `${key} transcript`, language: 'vi' });
function harness(overrides = {}) {
  const events = [], states = [], sounds = [], voices = [];
  const dependencies = {
    load: async p => p.key,
    prepare: async () => {},
    create: async uri => {
      const sound = {
        uri, playing: false, released: false, listener: null,
        play() {
          assert.equal(sound.released, false, 'Released player must not play');
          assert.equal(sounds.filter(s => s.playing).length, 0, 'Only one recording may play');
          sound.playing = true;
          events.push(`play:${uri}`);
          sound.listener?.({ isLoaded: true, didJustFinish: false, playing: true });
        },
        async pauseAsync() { sound.playing = false; events.push(`pause:${uri}`); },
        async unloadAsync() { sound.playing = false; sound.released = true; events.push(`unload:${uri}`); },
        setOnPlaybackStatusUpdate(listener) { sound.listener = listener; },
      };
      sounds.push(sound);
      return sound;
    },
    stopSpeech: async () => { events.push('speech:stop'); },
    speak: (p, callbacks) => { voices.push({ prompt: p, callbacks }); events.push(`speak:${p.key}`); callbacks.onStart(); },
    onState: state => states.push(state),
    ...overrides,
  };
  return { owner: new CheckinCallAudio(dependencies), dependencies, events, states, sounds, voices };
}

await test('replacement pauses the old recording immediately, before awaiting native cancellation', async () => {
  const h = harness();
  await h.owner.play(prompt('first'));
  const replaced = h.owner.play(prompt('second'));
  assert.equal(h.sounds[0].playing, false);
  await replaced;
  assert.deepEqual(h.events.filter(e => e.startsWith('play:')), ['play:first', 'play:second']);
  assert.equal(h.sounds[0].released, true);
});
await test('slow old download completing after a newer prompt cannot play', async () => {
  const old = deferred();
  const h = harness({ load: p => p.key === 'old' ? old.promise : Promise.resolve(p.key) });
  const first = h.owner.play(prompt('old'));
  await tick();
  await h.owner.play(prompt('new'));
  old.resolve('old');
  await first;
  assert.deepEqual(h.events.filter(e => e.startsWith('play:')), ['play:new']);
  assert.equal(h.states.at(-1).prompt.key, 'new');
});
await test('a stale synthesis failure cannot enqueue a fallback voice', async () => {
  const old = deferred();
  const h = harness({ load: p => p.key === 'old' ? old.promise : Promise.resolve(p.key) });
  const first = h.owner.play(prompt('old'));
  await tick();
  await h.owner.play(prompt('new'));
  old.reject(new Error('offline'));
  await first;
  assert.equal(h.voices.length, 0);
});
await test('pending native player is released without ever autoplaying after replacement', async () => {
  const creation = deferred();
  const h = harness();
  const create = h.dependencies.create;
  h.dependencies.create = uri => uri === 'old' ? creation.promise : create(uri);
  const first = h.owner.play(prompt('old'));
  await tick();
  await h.owner.play(prompt('new'));
  const stale = await create('old');
  creation.resolve(stale);
  await first;
  assert.equal(stale.released, true);
  assert.equal(stale.playing, false);
  assert.deepEqual(h.events.filter(e => e.startsWith('play:')), ['play:new']);
});
for (const boundary of ['load', 'prepare', 'create']) {
  await test(`stop during ${boundary} prevents delayed playback`, async () => {
    const pending = deferred();
    const h = harness();
    const original = h.dependencies[boundary];
    h.dependencies[boundary] = () => pending.promise;
    const playing = h.owner.play(prompt('pending'));
    await tick();
    await h.owner.stop(true);
    pending.resolve(boundary === 'create' ? await original('pending') : 'pending');
    await playing;
    assert.equal(h.events.some(e => e.startsWith('play:')), false);
    assert.equal(h.voices.length, 0);
    assert.equal(h.states.at(-1).prompt, null);
  });
}
await test('repeated replay taps play only the latest request', async () => {
  const pending = deferred();
  const h = harness({ load: () => pending.promise });
  const requests = [];
  for (let index = 0; index < 20; index += 1) requests.push(h.owner.play(prompt(`replay${index}`)));
  pending.resolve('latest');
  await Promise.all(requests);
  assert.equal(h.sounds.length, 1);
  assert.equal(h.states.at(-1).prompt.key, 'replay19');
});
await test('new audio waits for asynchronous device speech stop', async () => {
  const pending = deferred();
  const h = harness({ stopSpeech: () => pending.promise });
  const playing = h.owner.play(prompt('next'));
  await tick();
  assert.equal(h.sounds.length, 0);
  pending.resolve();
  await playing;
  assert.equal(h.sounds[0].playing, true);
});
await test('native stop failure does not enqueue another possibly overlapping voice', async () => {
  const h = harness({ stopSpeech: async () => { throw new Error('native stop failed'); } });
  await h.owner.play(prompt('next'));
  assert.equal(h.voices.length, 0);
  assert.equal(h.states.at(-1).phase, 'error');
});
await test('synthesis failure falls back with exactly the displayed text and language', async () => {
  const h = harness({ load: async () => { throw new Error('TTS unavailable'); } });
  const p = { ...prompt('family_urgent'), text: 'Mẹ của bạn: Nguyễn Lan, 0901234567.', language: 'en' };
  await h.owner.play(p);
  assert.deepEqual(h.voices[0].prompt, p);
  assert.equal(h.states.at(-1).fallback, true);
});
await test('late callbacks from cancelled fallback speech cannot replace the new transcript', async () => {
  const h = harness({ load: async () => { throw new Error('TTS unavailable'); } });
  await h.owner.play(prompt('old'));
  const stale = h.voices[0].callbacks;
  await h.owner.play(prompt('new'));
  stale.onDone(); stale.onStart(); stale.onError();
  assert.equal(h.states.at(-1).prompt.key, 'new');
  assert.equal(h.states.at(-1).phase, 'playing');
});
await test('play failure releases the recording before starting fallback speech', async () => {
  const h = harness();
  const create = h.dependencies.create;
  h.dependencies.create = async uri => {
    const sound = await create(uri);
    sound.play = () => { throw new Error('native play failed'); };
    return sound;
  };
  await h.owner.play(prompt('fallback'));
  assert.equal(h.sounds[0].released, true);
  assert.equal(h.voices.length, 1);
});
await test('completion releases the player; late completion cannot end a newer prompt', async () => {
  const h = harness();
  await h.owner.play(prompt('first'));
  const first = h.sounds[0];
  first.listener({ didJustFinish: true, isLoaded: true });
  await tick();
  assert.equal(first.released, true);
  assert.equal(h.states.at(-1).phase, 'finished');
  await h.owner.play(prompt('second'));
  first.listener({ didJustFinish: true, isLoaded: true });
  assert.equal(h.states.at(-1).prompt.key, 'second');
});
await test('closing a screen cancels pending downloads without updating unmounted UI', async () => {
  const pending = deferred();
  const h = harness({ load: () => pending.promise });
  const playing = h.owner.play(prompt('pending'));
  await tick();
  h.owner.dispose();
  const count = h.states.length;
  pending.resolve('pending');
  await playing;
  await h.owner.play(prompt('late'));
  assert.equal(h.sounds.length, 0);
  assert.equal(h.states.length, count);
});
await test('stop-reading retains transcript; navigation clears it', async () => {
  const h = harness();
  await h.owner.play(prompt('message'));
  await h.owner.stop();
  assert.equal(h.states.at(-1).prompt.key, 'message');
  assert.equal(h.states.at(-1).phase, 'idle');
  await h.owner.stop(true);
  assert.equal(h.states.at(-1).prompt, null);
});
await test('family confirmation is not mistaken for another incoming family warning', async () => {
  for (const key of ['family_mild', 'family_urgent', 'family_unknown']) assert.equal(isFamilyNoticePrompt(key), true);
  for (const key of ['family_confirmed', 'family_unavailable', 'user_ok']) assert.equal(isFamilyNoticePrompt(key), false);
});
await test('asynchronous native decode failure stops the recording and starts one fallback', async () => {
  const h = harness();
  await h.owner.play(prompt('message'));
  const sound = h.sounds[0];
  sound.listener({ didJustFinish: false, isLoaded: false, error: 'decode failed' });
  sound.listener({ didJustFinish: false, isLoaded: false, error: 'decode failed' });
  await tick();
  assert.equal(sound.released, true);
  assert.equal(h.voices.length, 1);
  assert.equal(h.states.at(-1).fallback, true);
});
await test('a stale native error cannot trigger fallback after the prompt has changed', async () => {
  const h = harness();
  await h.owner.play(prompt('first'));
  const first = h.sounds[0];
  await h.owner.play(prompt('second'));
  first.listener({ didJustFinish: false, isLoaded: false, error: 'late error' });
  await tick();
  assert.equal(h.voices.length, 0);
  assert.equal(h.states.at(-1).prompt.key, 'second');
});
await test('speaking status waits for real native playback, not player creation', async () => {
  const h = harness();
  const create = h.dependencies.create;
  h.dependencies.create = async uri => {
    const sound = await create(uri);
    sound.play = () => {};
    return sound;
  };
  await h.owner.play(prompt('buffering'));
  assert.equal(h.states.at(-1).phase, 'loading');
  h.sounds[0].listener({ didJustFinish: false, isLoaded: true, playing: true });
  assert.equal(h.states.at(-1).phase, 'playing');
});
await test('the real expo-audio adapter forwards native playback and error status', async () => {
  let listener;
  const native = { play() {}, pause() {}, remove() {}, addListener: (event, callback) => { listener = callback; return { remove() {} }; } };
  const { Audio } = evaluate(fs.readFileSync('src/lib/audio.ts', 'utf8'), id => {
    if (id === 'expo-audio') return { AudioModule: {}, RecordingPresets: { HIGH_QUALITY: {} }, createAudioPlayer: () => native };
    if (id === 'react-native') return { Platform: { OS: 'ios' } };
    throw new Error(`Unexpected adapter dependency ${id}`);
  });
  const { sound } = await Audio.Sound.createAsync({ uri: 'test' }, { shouldPlay: false });
  let status;
  sound.setOnPlaybackStatusUpdate(value => { status = value; });
  listener({ didJustFinish: false, isLoaded: false, playing: false, error: 'native error' });
  assert.equal(status.error, 'native error');
  listener({ didJustFinish: false, isLoaded: true, playing: true });
  assert.equal(status.playing, true);
  assert.equal(status.error, null);
});

// Execute actual event handlers extracted from the screen, not hand-copied
// approximations. State setters are synchronous stubs; API/audio stay async.
const screenSource = fs.readFileSync('app/checkin-call/[episodeId].tsx', 'utf8');
const ast = ts.createSourceFile('screen.tsx', screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map();
const names = ['restoreRoomAfterFailedAction', 'openTriage', 'submitTriage', 'chooseLocation', 'chooseSymptom', 'goBackInTriage', 'answer', 'confirm'];
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) {
    const initializer = ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useCallback'
      ? node.initializer.arguments[0] : node.initializer;
    handlers.set(node.name.getText(ast), initializer.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(handlers.size, names.length);
function flowHarness({ role = 'USER', api = {} } = {}) {
  const events = [], status = {};
  const refs = { actionPending: { current: false }, callEnded: { current: false }, inTriage: { current: false }, screenMounted: { current: true }, accepted: { current: true }, acceptPromise: { current: null }, triageStage: { current: { step: 'location', location: null, symptom: null } }, activeRoom: { current: null }, connectionEnding: { current: false } };
  const deps = {
    ...refs, episodeId: 'episode', attempt: { id: 'attempt', target_role: role }, getUserCheckinCallOutcome,
    getClosedCheckinCallStatusKey, isCheckinCallAttemptClosed,
    t: key => key, getApiErrorMessage: () => 'retry',
    stopAudio: async () => { events.push('stop'); }, disconnectRoom: async () => { events.push('disconnect'); },
    endVoipCall: async () => { events.push('endNative'); },
    play: async (key, text) => { events.push(`play:${key}`); status.transcript = text; },
    simulateNextFamilyCall: async () => { events.push('simulate'); },
    checkinCallApi: {
      startTriage: async () => ({ triage: { locations: [] } }),
      attempt: async () => { events.push('fetchLatest'); return { attempt: { id: 'attempt', state: 'CONNECTED', episode_state: 'CONTACT_USER', target_role: role } }; },
      answer: async () => ({ episode: { state: 'RESOLVED', severity: 'NONE' } }),
      completeTriage: async () => ({ episode: { state: 'URGENT_BROADCAST', severity: 'URGENT' } }),
      confirmFamily: async () => ({ episode: { state: 'RESOLVED' } }),
      accept: async () => ({}), ...api,
    },
  };
  for (const name of ['Attempt', 'Busy', 'Error', 'TriageContext', 'SelectedLocation', 'SelectedSymptom', 'TriageStep', 'TriageOpen', 'CompletedAt', 'Ended', 'Room', 'StatusKey']) {
    deps[`set${name}`] = value => { status[name] = value; };
  }
  const body = `module.exports = (deps) => { const { ${Object.keys(deps).join(',')} } = deps; ${[...handlers].map(([key, value]) => `const ${key} = ${value};`).join('\n')} return { ${names.join(',')} }; };`;
  const callable = evaluate(body)(deps);
  return { deps, refs, events, status, callable };
}

await test('double-tapping a final response submits exactly one API request', async () => {
  const result = deferred();
  let calls = 0;
  const h = flowHarness({ api: { answer: async () => { calls += 1; return result.promise; } } });
  const first = h.callable.answer(1);
  const second = h.callable.answer(3);
  await tick();
  assert.equal(calls, 1);
  result.resolve({ episode: { state: 'RESOLVED', severity: 'NONE' } });
  await Promise.all([first, second]);
  assert.equal(h.status.StatusKey, 'statusUserOk');
  assert.ok(h.events.indexOf('disconnect') < h.events.indexOf('endNative'));
  assert.equal(h.events.filter(e => e.startsWith('play:')).length, 1);
});
await test('rapid location selections cannot reorder the symptom step', async () => {
  const h = flowHarness();
  const first = { key: 'head', label: 'Head', symptoms: [] };
  const second = { key: 'chest', label: 'Chest', symptoms: [] };
  h.callable.chooseLocation(first);
  h.callable.chooseLocation(second);
  assert.equal(h.refs.triageStage.current.location, first);
  assert.equal(h.status.TriageStep, 'symptom');
  assert.deepEqual(h.events, ['play:triage_symptom_prompt']);
});
await test('back and forward update the selected context synchronously, without waiting for speech', async () => {
  const h = flowHarness();
  const symptom = { key: 'dizzy', label: 'Dizzy', urgent: false };
  const location = { key: 'head', label: 'Head', symptoms: [symptom] };
  h.callable.chooseLocation(location);
  h.callable.chooseSymptom(symptom);
  assert.equal(h.refs.triageStage.current.step, 'intensity');
  h.callable.goBackInTriage();
  assert.equal(h.refs.triageStage.current.symptom, null);
  assert.equal(h.status.TriageStep, 'symptom');
  h.callable.goBackInTriage();
  assert.equal(h.refs.triageStage.current.location, null);
  assert.equal(h.status.TriageStep, 'location');
  h.callable.chooseSymptom(symptom);
  assert.equal(h.status.TriageStep, 'location', 'Stale symptom press must be ignored');
});
await test('urgent symptom goes directly to urgent submission without another severity question', async () => {
  const submitted = [];
  const h = flowHarness({ api: { completeTriage: async (id, selection) => {
    submitted.push(selection);
    return { episode: { state: 'URGENT_BROADCAST', severity: 'URGENT' } };
  } } });
  const symptom = { key: 'fainting', urgent: true };
  h.callable.chooseLocation({ key: 'head', symptoms: [symptom] });
  h.callable.chooseSymptom(symptom);
  h.callable.chooseSymptom(symptom);
  await tick();
  assert.deepEqual(submitted, [{ body_location: 'head', symptom: 'fainting', intensity: 'URGENT' }]);
  assert.equal(h.status.StatusKey, 'statusUserUrgent');
  assert.equal(h.events.includes('play:triage_intensity_prompt'), false);
});
await test('backend severity, not a stale button intensity, selects the result voice', async () => {
  const h = flowHarness();
  h.refs.triageStage.current = { step: 'intensity', location: { key: 'chest' }, symptom: { key: 'pain' } };
  await h.callable.submitTriage('MILD');
  assert.equal(h.status.StatusKey, 'statusUserUrgent');
  assert.equal(h.events.includes('play:user_urgent'), true);
  assert.equal(h.events.includes('play:user_mild'), false);
});
await test('no eligible family produces an honest result and does not play a notifying-family claim', async () => {
  const h = flowHarness({ api: { answer: async () => ({ episode: { state: 'EXHAUSTED_URGENT', severity: 'URGENT' } }) } });
  await h.callable.answer(3);
  assert.equal(h.status.StatusKey, 'statusFamilyUnavailable');
  assert.equal(h.status.transcript, 'result.familyUnavailableMessage');
  assert.equal(h.events.includes('play:user_urgent'), false);
  assert.equal(h.events.includes('simulate'), false);
});
await test('API failure unlocks buttons for retry and does not play success', async () => {
  const h = flowHarness({ api: { answer: async () => { throw new Error('offline'); } } });
  await h.callable.answer(1);
  assert.equal(h.refs.actionPending.current, false);
  assert.equal(h.status.Busy, false);
  assert.equal(h.status.Error, 'retry');
  assert.equal(h.events.includes('fetchLatest'), true);
  assert.equal(h.events.some(e => e.startsWith('play:')), false);
  assert.equal(h.refs.callEnded.current, false);
});
await test('closing the screen before API completion never starts result speech', async () => {
  const pending = deferred();
  const h = flowHarness({ api: { answer: () => pending.promise } });
  const request = h.callable.answer(1);
  await tick();
  h.refs.screenMounted.current = false;
  pending.resolve({ episode: { state: 'RESOLVED', severity: 'NONE' } });
  await request;
  assert.equal(h.events.some(e => e.startsWith('play:')), false);
});
await test('family confirmation sends one action and plays only the confirmation, not the incoming alert', async () => {
  const actions = [];
  const h = flowHarness({ role: 'FAMILY', api: { confirmFamily: async (id, action) => { actions.push(action); return {}; } } });
  await Promise.all([h.callable.confirm(), h.callable.confirm()]);
  assert.deepEqual(actions, ['ACCEPT_AND_CHECK']);
  assert.equal(h.status.StatusKey, 'statusFamilyConfirmed');
  assert.deepEqual(h.events.filter(e => e.startsWith('play:')), ['play:family_confirmed']);
});
await test('opening triage waits for accept, preserving the triage timeout ordering', async () => {
  let starts = 0;
  const accepting = deferred();
  const h = flowHarness({ api: { startTriage: async () => { starts += 1; return { triage: { locations: [] } }; } } });
  h.refs.acceptPromise.current = accepting.promise;
  const opening = h.callable.openTriage();
  await tick();
  assert.equal(starts, 0);
  accepting.resolve({});
  await opening;
  assert.equal(starts, 1);
  assert.equal(h.status.TriageOpen, true);
});
await test('lost triage response recovers committed backend state instead of stale initial buttons', async () => {
  let starts = 0;
  const h = flowHarness({ api: {
    startTriage: async () => { starts += 1; if (starts === 1) throw new Error('response lost'); return { triage: { locations: [] } }; },
    attempt: async () => ({ attempt: { id: 'attempt', state: 'CONNECTED', episode_state: 'TRIAGE_USER', target_role: 'USER' } }),
  } });
  await h.callable.openTriage();
  assert.equal(h.status.TriageOpen, true);
  assert.equal(h.refs.inTriage.current, true);
  assert.equal(h.status.Error, '');
  assert.equal(h.events.includes('play:triage_location_prompt'), true);
  await h.callable.answer(1);
  assert.equal(h.events.includes('play:user_ok'), false, 'The obsolete initial response must not submit');
});
await test('lost final response recovers the recorded outcome without claiming failure', async () => {
  const h = flowHarness({ api: {
    answer: async () => { throw new Error('response lost'); },
    attempt: async () => ({ attempt: { id: 'attempt', state: 'COMPLETED', episode_state: 'RESOLVED', target_role: 'USER', severity: 'NONE' } }),
  } });
  await h.callable.answer(1);
  assert.equal(h.status.Ended, true);
  assert.equal(h.status.Error, '');
  assert.equal(h.status.StatusKey, 'statusUserOk');
  assert.equal(h.events.includes('play:user_ok'), true);
});

await test('blur stops reading and prevents a late API response from starting off-screen speech', async () => {
  let playExpression, focusExpression;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'play') playExpression = node.initializer.arguments[0].getText(ast);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') focusExpression = node.arguments[0].arguments[0].getText(ast);
    ts.forEachChild(node, find);
  }
  find(ast);
  const events = [];
  const factory = evaluate(`module.exports = deps => { const { callScreenFocused, playAudio, stopAudio } = deps; return { play: ${playExpression}, focus: ${focusExpression} }; };`);
  const h = factory({ callScreenFocused: { current: true }, playAudio: async () => events.push('play'), stopAudio: async () => events.push('stop') });
  const blur = h.focus();
  await h.play('before');
  blur();
  await h.play('late');
  assert.deepEqual(events, ['play', 'stop']);
  h.focus();
  await h.play('replay');
  assert.deepEqual(events, ['play', 'stop', 'play']);
});

// The native adapter is exercised with filesystem/API stubs as well, so cache
// coalescing, exact-attempt identity and no-autoplay are tested at the seam.
function hookHarness(initialAttempt, initialFile = { exists: false }) {
  const refs = [], states = [], effects = [], calls = [];
  let fileInfo = initialFile;
  let refIndex = 0, installed = false;
  const h = harness();
  const api = {
    familyAudio: async id => { calls.push(`family:${id}`); return { base64: 'audio' }; },
    audio: async key => { calls.push(key); return { base64: 'audio' }; },
    conclusionAudio: async text => { calls.push(`conclusion:${text}`); return { base64: 'audio' }; },
  };
  const { useCheckinCallAudio } = evaluate(fs.readFileSync('src/features/checkin-call/useCheckinCallAudio.ts', 'utf8'), id => {
    if (id === 'react') return {
      useRef: initial => refs[refIndex++] ||= { current: initial },
      useState: initial => [initial, state => states.push(state)],
      useCallback: callback => callback,
      useEffect: effect => { if (!installed) effects.push(effect); },
    };
    if (id === 'expo-file-system/legacy') return {
      cacheDirectory: 'cache/', getInfoAsync: async () => fileInfo, writeAsStringAsync: async () => {},
      deleteAsync: async () => { calls.push('deleteInvalidAudio'); fileInfo = { exists: false }; },
    };
    if (id === 'expo-speech') return { stop: h.dependencies.stopSpeech, speak: () => {} };
    if (id === '../../lib/audio') return { Audio: {
      setAudioModeAsync: h.dependencies.prepare,
      Sound: { createAsync: async (source, initial) => {
        assert.equal(initial.shouldPlay, false, 'Unowned native player must not autoplay');
        return { sound: await h.dependencies.create(source.uri) };
      } },
    } };
    if (id === './checkin-call.audio') return { CheckinCallAudio, isFamilyNoticePrompt };
    if (id === './checkin-call.api') return { checkinCallApi: api };
    throw new Error(`Unexpected dependency ${id}`);
  });
  const renderHook = attempt => {
    refIndex = 0;
    // This deterministic native-adapter harness supplies its own React hook
    // implementations; no React renderer is loaded in these Node regressions.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCheckinCallAudio(attempt, 'vi', key => key);
  };
  const controls = renderHook(initialAttempt);
  const cleanup = effects[0]();
  installed = true;
  return { controls, render: renderHook, cleanup, calls, api, h, states };
}
await test('overlapping replay reuses one pending audio download', async () => {
  const h = hookHarness(null);
  const pending = deferred();
  h.api.audio = key => { h.calls.push(key); return pending.promise; };
  const first = h.controls.play('user_prompt');
  await tick();
  const second = h.controls.play('user_prompt');
  await tick();
  assert.deepEqual(h.calls, ['user_prompt']);
  pending.resolve({ base64: 'audio' });
  await Promise.all([first, second]);
  assert.equal(h.h.sounds.length, 1);
  h.cleanup();
});
await test('family identity is captured with the prompt, even when the active attempt changes', async () => {
  const first = { id: 'first', target_role: 'FAMILY', family_notice: { audio_text: 'First person' } };
  const second = { id: 'second', target_role: 'FAMILY', family_notice: { audio_text: 'Second person' } };
  const h = hookHarness(first);
  const old = h.controls.play('family_urgent');
  h.render(second);
  await old;
  assert.deepEqual(h.calls, ['family:first']);
  assert.equal(h.states.at(-1).prompt.text, 'First person');
  await h.controls.play('family_urgent');
  assert.deepEqual(h.calls, ['family:first', 'family:second']);
  assert.equal(h.states.at(-1).prompt.text, 'Second person');
  h.cleanup();
});
await test('family confirmation uses the conclusion endpoint with its own transcript', async () => {
  const h = hookHarness({ id: 'family', target_role: 'FAMILY', family_notice: { audio_text: 'Incoming warning' } });
  await h.controls.play('family_confirmed', 'You will check on your relative.');
  assert.deepEqual(h.calls, ['conclusion:You will check on your relative.']);
  h.cleanup();
});
await test('a valid local recording plays without another server round trip', async () => {
  const h = hookHarness(null, { exists: true, isDirectory: false, size: 100 });
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, []);
  assert.equal(h.h.sounds.length, 1);
  h.cleanup();
});
await test('an empty cached recording is downloaded again, not treated as ready', async () => {
  const h = hookHarness(null, { exists: true, isDirectory: false, size: 0 });
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, ['user_prompt']);
  h.cleanup();
});
await test('native decode failure evicts only the corrupt recording and replay fetches a fresh copy', async () => {
  const h = hookHarness(null, { exists: true, isDirectory: false, size: 100 });
  await h.controls.play('user_prompt');
  h.h.sounds[0].listener({ isLoaded: false, didJustFinish: false, error: 'corrupt MP3' });
  await tick();
  assert.deepEqual(h.calls, ['deleteInvalidAudio']);
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, ['deleteInvalidAudio', 'user_prompt']);
  h.cleanup();
});
await test('a cancelled native failure cannot delete a recording after another prompt starts', async () => {
  const invalidated = [];
  const h = harness({ invalidate: async p => invalidated.push(p.key) });
  await h.owner.play(prompt('first'));
  h.sounds[0].listener({ isLoaded: false, didJustFinish: false, error: 'late error' });
  await h.owner.play(prompt('new'));
  assert.deepEqual(invalidated, []);
});
await test('question changes reset the real user scroll view to the new heading', async () => {
  let scrollEffect;
  function find(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect') {
      scrollEffect = node.arguments[0].getText(ast);
      assert.equal(node.arguments[1].getText(ast), '[triageOpen, triageStep]', 'Audio/poll updates must not jump the scroll position');
    }
    ts.forEachChild(node, find);
  }
  find(ast);
  const offsets = [];
  const factory = evaluate(`module.exports = userContent => (${scrollEffect});`);
  const onQuestionChange = factory({ current: { scrollTo: offset => offsets.push(offset) } });
  onQuestionChange();
  assert.deepEqual(offsets, [{ y: 0, animated: false }]);
  assert.ok(screenSource.includes('<ScrollView ref={userContent}'), 'Attach the tested reset to the user call scroll view');
});
console.log(`Check-in call audio and real UI handlers: ${checks} runtime regressions passed.`);
