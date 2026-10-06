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
for (const failure of ['load', 'create', 'nativeDecode']) {
  await test(`Ngọc Lan policy never switches Vietnamese to device speech on ${failure} failure`, async () => {
    const h = harness({ allowDeviceSpeech: p => p.language === 'en' });
    if (failure !== 'nativeDecode') h.dependencies[failure] = async () => { throw new Error('recording unavailable'); };
    await h.owner.play(prompt('user_prompt'));
    if (failure === 'nativeDecode') {
      h.sounds[0].listener({ isLoaded: false, didJustFinish: false, error: 'decode failed' });
      await tick();
      assert.equal(h.sounds[0].released, true);
    }
    assert.equal(h.voices.length, 0);
    assert.equal(h.states.at(-1).phase, 'error');
    assert.equal(h.states.at(-1).prompt.text, 'user_prompt transcript');
    assert.equal(h.states.at(-1).fallback, false);
  });
}
await test('English device fallback is still available with the Ngọc Lan policy', async () => {
  const h = harness({ allowDeviceSpeech: p => p.language === 'en', load: async () => { throw new Error('unavailable'); } });
  await h.owner.play({ ...prompt('user_prompt'), language: 'en' });
  assert.equal(h.voices.length, 1);
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
const names = ['restoreRoomAfterFailedAction', 'join', 'openTriage', 'submitTriage', 'chooseLocation', 'chooseSymptom', 'goBackInTriage', 'answer', 'decline', 'confirm'];
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
function flowHarness({ role = 'USER', api = {}, audio = {}, actionPending = { current: false } } = {}) {
  const events = [], status = {};
  const refs = { actionPending, callEnded: { current: false }, inTriage: { current: false }, screenMounted: { current: true }, accepted: { current: true }, acceptPromise: { current: null }, joinRequested: { current: false }, triageStage: { current: { step: 'location', location: null, symptom: null } }, activeRoom: { current: null }, connectionEnding: { current: false } };
  const deps = {
    ...refs, episodeId: 'episode', attempt: { id: 'attempt', target_role: role }, room: null, router: { back: () => events.push('back') }, getUserCheckinCallOutcome,
    getClosedCheckinCallStatusKey, isCheckinCallAttemptClosed, getCheckinCallTime: value => value ? new Date(value).getTime() : null,
    AsyncStorage: { removeItem: async () => {} }, draftKey: 'draft',
    t: key => key, getApiErrorMessage: () => 'retry',
    stopAudio: async () => { events.push('stop'); }, disconnectRoom: async () => { events.push('disconnect'); },
    endVoipCall: async () => { events.push('endNative'); },
    play: async (key, text) => { events.push(`play:${key}`); status.transcript = text; },
    simulateNextFamilyCall: async () => { events.push('simulate'); },
    checkinCallApi: {
      startTriage: async () => ({ episode: { next_action_at: '2026-10-05T10:00:00Z' }, triage: { locations: [] } }),
      attempt: async () => { events.push('fetchLatest'); return { attempt: { id: 'attempt', state: 'CONNECTED', episode_state: 'CONTACT_USER', target_role: role } }; },
      answer: async () => ({ episode: { state: 'RESOLVED', severity: 'NONE' } }),
      completeTriage: async () => ({ episode: { state: 'URGENT_BROADCAST', severity: 'URGENT' } }),
      confirmFamily: async () => ({ episode: { state: 'RESOLVED' } }),
      accept: async () => ({}), decline: async () => { events.push('decline'); return { ok: true }; }, ...api,
    },
    ...audio,
  };
  deps.acceptCheckinCallOnce = id => deps.checkinCallApi.accept(id);
  for (const name of ['Attempt', 'Joined', 'Busy', 'Error', 'TriageContext', 'SelectedLocation', 'SelectedSymptom', 'TriageStep', 'TriageOpen', 'CompletedAt', 'Ended', 'Room', 'StatusKey', 'EpisodeProgress', 'DraftReady']) {
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
  const h = flowHarness({ role: 'FAMILY', api: { confirmFamily: async (id, action) => { actions.push(action); return { episode: { state: 'RESOLVED', resolved_at: '2026-10-05T01:00:00Z' } }; } } });
  await Promise.all([h.callable.confirm(), h.callable.confirm()]);
  assert.deepEqual(actions, ['ACCEPT_AND_CHECK']);
  assert.equal(h.status.StatusKey, 'statusFamilyConfirmed');
  assert.deepEqual(h.events.filter(e => e.startsWith('play:')), ['play:family_confirmed']);
});
await test('opening triage waits for accept, preserving the triage timeout ordering', async () => {
  let starts = 0;
  const accepting = deferred();
  const h = flowHarness({ api: { startTriage: async () => { starts += 1; return { episode: { next_action_at: '2026-10-05T01:00:00Z' }, triage: { locations: [] } }; } } });
  h.refs.acceptPromise.current = accepting.promise;
  const opening = h.callable.openTriage();
  await tick();
  assert.equal(starts, 0);
  accepting.resolve({});
  await opening;
  assert.equal(starts, 1);
  assert.equal(h.status.TriageOpen, true);
});
await test('resuming triage reads its restored question, including early-signal calls', async () => {
  for (const [step, expected] of [['location', 'triage_location_prompt'], ['symptom', 'triage_symptom_prompt'], ['intensity', 'triage_intensity_prompt']]) {
    const h = flowHarness();
    h.deps.attempt.episode_state = 'TRIAGE_USER';
    h.deps.attempt.trigger_source = 'EARLY_SIGNAL';
    h.refs.triageStage.current.step = step;
    h.callable.join();
    h.callable.join();
    assert.deepEqual(h.events.filter(event => event.startsWith('play:')), [`play:${expected}`]);
  }
});
await test('urgent and skip-details shortcuts remain available at every triage step', async () => {
  for (const choice of [2, 3]) {
    for (const step of ['location', 'symptom', 'intensity']) {
      const submitted = [];
      const h = flowHarness({ api: { answer: async (id, selected) => {
        submitted.push(selected);
        return { episode: { state: choice === 3 ? 'URGENT_BROADCAST' : 'MILD_FAMILY_ESCALATION', severity: choice === 3 ? 'URGENT' : 'MILD' } };
      } } });
      h.refs.inTriage.current = true;
      h.refs.triageStage.current.step = step;
      await h.callable.answer(choice);
      assert.deepEqual(submitted, [choice]);
      assert.equal(h.status.StatusKey, choice === 3 ? 'statusUserUrgent' : 'statusUserMild');
      assert.ok(h.events.indexOf('stop') < h.events.indexOf('disconnect'));
      assert.ok(h.events.indexOf('disconnect') < h.events.indexOf('endNative'));
    }
  }
});
await test('declining notifies backend before navigation and ignores repeated taps', async () => {
  const h = flowHarness();
  await Promise.all([h.callable.decline(), h.callable.decline()]);
  assert.deepEqual(h.events, ['stop', 'disconnect', 'decline', 'endNative', 'back']);
  assert.equal(h.refs.callEnded.current, true);
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

function screenAudioHarness({ claim = async () => false, teardown = async () => {}, playback = null,
  actionPending = { current: false } } = {}) {
  let playExpression, stopExpression, focusExpression, appStateExpression, nativeExpression;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'play') playExpression = node.initializer.arguments[0].getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'stopAudio') stopExpression = node.initializer.arguments[0].getText(ast);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') focusExpression = node.arguments[0].arguments[0].getText(ast);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes("AppState.addEventListener('change'")) appStateExpression = node.arguments[0].getText(ast);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes('addVoipCallAnsweredListener')) nativeExpression = node.arguments[0].getText(ast);
    ts.forEachChild(node, find);
  }
  find(ast);
  const events = [];
  const context = { current: { attempt: null, joined: false, ended: false, prompt: null } };
  const pendingAudioPrompt = { current: null };
  let listener, nativeListener;
  const AppState = { currentState: 'active', addEventListener: (_name, callback) => { listener = callback; return { remove() {} }; } };
  const factory = evaluate(`module.exports = deps => { const { callScreenFocused, playAudio, stopCallAudio, playVersion, audioContext, AppState, setVoipCallUIActive, actionPending, addVoipCallAnsweredListener, pendingAudioPrompt } = deps; const stopAudio = ${stopExpression}; const play = ${playExpression}; return { play, stopAudio, focus: ${focusExpression}, observe: ${appStateExpression}, observeNative: ${nativeExpression} }; };`);
  const h = factory({ callScreenFocused: { current: true }, playVersion: { current: 0 }, audioContext: context, AppState, actionPending, pendingAudioPrompt,
    addVoipCallAnsweredListener: callback => { nativeListener = callback; },
    setVoipCallUIActive: async (id, active) => { events.push(`native:${active}`); return claim(id, active); },
    playAudio: async (key, text) => { events.push('play'); await playback?.owner.play({ ...prompt(key), ...(text ? { text } : {}) }); },
    stopCallAudio: async (clearPrompt = true) => { events.push('stop'); const stopped = playback?.owner.stop(clearPrompt); await teardown(); await stopped; } });
  h.observe();
  h.observeNative();
  return { ...h, context, events, actionPending, pendingAudioPrompt, nativeEnded: call => nativeListener(call),
    appState: state => { AppState.currentState = state; listener(state); } };
}
await test('blur stops reading and prevents a late API response from starting off-screen speech', async () => {
  const h = screenAudioHarness();
  const blur = h.focus();
  await h.play('before');
  blur();
  await h.play('late');
  assert.deepEqual(h.events, ['stop', 'play', 'stop']);
  h.focus();
  await h.play('replay');
  assert.deepEqual(h.events, ['stop', 'play', 'stop', 'stop', 'play']);
});
await test('a native audio claim that finishes after blur cannot start speech', async () => {
  const claim = deferred();
  const h = screenAudioHarness({ claim: (_id, active) => active ? claim.promise : false });
  h.context.current.attempt = { id: 'native-attempt' };
  const blur = h.focus();
  const playing = h.play('user_prompt');
  blur(); await tick();
  claim.resolve(true); await playing;
  assert.equal(h.events.includes('play'), false);
  assert.ok(h.events.includes('native:false'));
});
await test('a quick refocus cannot release the newly reclaimed native audio session', async () => {
  const teardown = deferred();
  const h = screenAudioHarness({ teardown: () => teardown.promise });
  h.context.current.attempt = { id: 'native-attempt' };
  const blur = h.focus();
  blur(); h.focus(); const playing = h.play('user_prompt');
  teardown.resolve(); await playing; await tick();
  assert.equal(h.events.includes('native:false'), false);
  assert.equal(h.events.filter(event => event === 'play').length, 1);
});
await test('backgrounding stops app speech and foregrounding resumes only the current prompt', async () => {
  const h = screenAudioHarness(); h.focus();
  h.context.current = { attempt: { id: 'native-attempt' }, joined: true, ended: false,
    prompt: { key: 'user_prompt', text: 'Choose a response' } };
  h.appState('background'); await tick();
  assert.deepEqual(h.events, ['stop', 'native:false']);
  await h.play('offscreen');
  assert.equal(h.events.includes('play'), false);
  h.appState('active'); await tick();
  assert.deepEqual(h.events, ['stop', 'native:false', 'stop', 'native:true', 'play']);
});
await test('a quick background/foreground transition cannot release the recovered session', async () => {
  const teardown = deferred();
  const h = screenAudioHarness({ teardown: () => teardown.promise }); h.focus();
  h.context.current = { attempt: { id: 'native-attempt' }, joined: true, ended: false,
    prompt: { key: 'user_prompt', text: 'Choose a response' } };
  h.appState('background'); h.appState('active'); await tick();
  teardown.resolve(); await tick();
  assert.equal(h.events.includes('native:false'), false);
  assert.equal(h.events.filter(event => event === 'play').length, 1);
});
await test('only an active prompt resumes after a user hangup releases CallKit audio', async () => {
  let expression;
  ts.forEachChild(ast, function find(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes('addVoipCallAnsweredListener')) {
      expression = node.arguments[0].getText(ast);
    }
    ts.forEachChild(node, find);
  });
  assert.ok(expression);
  const context = { current: { attempt: { id: 'attempt' }, joined: true, ended: false,
    phase: 'playing', prompt: { key: 'user_prompt', text: 'Choose your response' } } };
  const played = []; let listener;
  const actionPending = { current: false };
  const install = evaluate(`module.exports = deps => { const { audioContext, addVoipCallAnsweredListener, play, actionPending } = deps; return (${expression})(); };`);
  install({ audioContext: context, actionPending, addVoipCallAnsweredListener: callback => { listener = callback; },
    play: (...args) => { played.push(args); } });
  const released = { attemptId: 'attempt', nativeEnded: '1', audioSessionReleased: '1' };
  listener({ ...released, audioSessionReleased: undefined });
  listener({ ...released, attemptId: 'other' });
  assert.equal(played.length, 0);
  listener(released);
  assert.deepEqual(played, [['user_prompt', 'Choose your response']]);
  for (const patch of [{ ended: true }, { ended: false, phase: 'finished' }, { phase: 'idle' }, { phase: 'playing', joined: false }]) {
    Object.assign(context.current, patch); listener(released);
  }
  assert.equal(played.length, 1);
});

for (const transition of ['location', 'symptom', 'back']) {
  await test(`${transition} selection interrupts the real playing question before a slow native audio claim`, async () => {
    const playback = harness();
    await playback.owner.play(prompt('old_question'));
    const claim = deferred();
    const h = screenAudioHarness({ playback, claim: (_id, active) => active ? claim.promise : false });
    h.context.current = { attempt: { id: 'attempt' }, joined: true, ended: false, triageOpen: true,
      ...playback.states.at(-1) };
    const flow = flowHarness({ audio: { stopAudio: h.stopAudio, play: h.play } });
    const symptom = { key: 'dizzy', urgent: false };
    const location = { key: 'head', symptoms: [symptom] };
    let expected;
    if (transition === 'location') {
      flow.callable.chooseLocation(location);
      expected = 'triage_symptom_prompt';
    } else if (transition === 'symptom') {
      flow.refs.triageStage.current = { step: 'symptom', location, symptom: null };
      flow.callable.chooseSymptom(symptom);
      expected = 'triage_intensity_prompt';
    } else {
      flow.refs.triageStage.current = { step: 'intensity', location, symptom };
      flow.callable.goBackInTriage();
      expected = 'triage_symptom_prompt';
    }
    assert.equal(playback.sounds[0].playing, false, 'The click must pause before awaiting any promise');
    assert.equal(h.context.current.prompt, null, 'The old question cannot be resumed before React renders');
    assert.equal(h.context.current.phase, 'idle');
    assert.equal(playback.states.at(-1).prompt, null);
    await tick();
    assert.equal(playback.sounds.length, 1, 'The new recording waits for native ownership');
    claim.resolve(true);
    await tick();
    assert.deepEqual(playback.events.filter(event => event.startsWith('play:')), ['play:old_question', `play:${expected}`]);
  });
}
await test('replacement cancels a pending old download before the new native audio claim completes', async () => {
  const download = deferred(), claim = deferred();
  const playback = harness({ load: p => p.key === 'old_question' ? download.promise : Promise.resolve(p.key) });
  const old = playback.owner.play(prompt('old_question'));
  await tick();
  const h = screenAudioHarness({ playback, claim: (_id, active) => active ? claim.promise : false });
  h.context.current = { attempt: { id: 'attempt' }, joined: true, ended: false, ...playback.states.at(-1) };
  const replacement = h.play('triage_symptom_prompt');
  download.resolve('old_question');
  await old;
  assert.equal(playback.sounds.length, 0, 'The superseded download must never create a player');
  claim.resolve(true);
  await replacement;
  assert.deepEqual(playback.events.filter(event => event.startsWith('play:')), ['play:triage_symptom_prompt']);
});
await test('rapid question intents and reversed native bridge completions play only the latest question', async () => {
  const playback = harness();
  await playback.owner.play(prompt('old_question'));
  const claims = [];
  const h = screenAudioHarness({ playback, claim: (_id, active) => {
    if (!active) return false;
    const pending = deferred(); claims.push(pending); return pending.promise;
  } });
  h.context.current.attempt = { id: 'attempt' };
  const requests = Array.from({ length: 20 }, (_value, index) => h.play(`question${index}`));
  assert.equal(playback.sounds[0].playing, false);
  for (const claim of claims.slice().reverse()) claim.resolve(true);
  await Promise.all(requests);
  assert.deepEqual(playback.events.filter(event => event.startsWith('play:')), ['play:old_question', 'play:question19']);
});
for (const action of ['answer', 'openTriage', 'submitTriage', 'confirm', 'urgentSymptom']) {
  await test(`${action} silences the real player immediately and rejects stale lifecycle resumes while its API is pending`, async () => {
    const playback = harness();
    await playback.owner.play(prompt('old_question'));
    const result = deferred();
    const h = screenAudioHarness({ playback });
    const stale = { attempt: { id: 'attempt' }, joined: true, ended: false, triageOpen: action !== 'answer',
      ...playback.states.at(-1) };
    h.context.current = { ...stale };
    const blur = h.focus();
    // focus would replay a retained prompt, so settle that startup before tapping.
    await tick();
    const before = playback.events.filter(event => event.startsWith('play:')).length;
    const apiName = action === 'urgentSymptom' ? 'completeTriage'
      : action === 'submitTriage' ? 'completeTriage' : action === 'openTriage' ? 'startTriage'
        : action === 'confirm' ? 'confirmFamily' : 'answer';
    const flow = flowHarness({ role: action === 'confirm' ? 'FAMILY' : 'USER',
      actionPending: h.actionPending, audio: { stopAudio: h.stopAudio, play: h.play }, api: { [apiName]: () => result.promise } });
    const symptom = { key: 'dizzy', urgent: action === 'urgentSymptom' };
    const location = { key: 'head', symptoms: [symptom] };
    flow.refs.triageStage.current = { step: action === 'urgentSymptom' ? 'symptom' : 'intensity', location, symptom };
    const request = action === 'urgentSymptom' ? flow.callable.chooseSymptom(symptom)
      : action === 'answer' ? flow.callable.answer(1)
        : action === 'submitTriage' ? flow.callable.submitTriage('MILD') : flow.callable[action]();
    assert.ok(playback.sounds.every(sound => !sound.playing), 'The response must pause in the click handler');
    assert.equal(h.context.current.prompt, null);
    await tick();
    assert.equal(h.actionPending.current, true);
    // Reproduce a queued lifecycle callback seeing a pre-commit React snapshot.
    h.context.current = { ...stale };
    h.nativeEnded({ attemptId: 'attempt', nativeEnded: '1', audioSessionReleased: '1' });
    blur();
    h.focus();
    h.appState('background');
    h.context.current = { ...stale };
    h.appState('active');
    await tick();
    assert.equal(playback.events.filter(event => event.startsWith('play:')).length, before);
    assert.ok(playback.sounds.every(sound => !sound.playing));
    result.resolve({ episode: { state: 'RESOLVED', severity: 'NONE', next_action_at: '2026-10-05T10:00:00Z' }, triage: { locations: [] } });
    await request; await tick();
    const expected = action === 'confirm' ? 'family_confirmed' : action === 'openTriage' ? 'triage_location_prompt' : 'user_ok';
    assert.equal(playback.events.filter(event => event.startsWith('play:')).at(-1), `play:${expected}`,
      'The explicit next question/result must still play before actionPending is released');
    assert.equal(h.actionPending.current, false);
  });
}
await test('a clear stop revokes a pending native claim immediately, while stop(false) retains the transcript', async () => {
  const claim = deferred();
  const h = screenAudioHarness({ claim: (_id, active) => active ? claim.promise : false });
  h.context.current = { attempt: { id: 'attempt' }, joined: true, ended: false,
    prompt: prompt('old_question'), phase: 'playing' };
  const replacing = h.play('triage_symptom_prompt');
  await h.stopAudio();
  claim.resolve(true); await replacing;
  assert.equal(h.events.includes('play'), false);
  assert.equal(h.context.current.prompt, null);
  assert.equal(h.pendingAudioPrompt.current, null);
  h.context.current.prompt = prompt('retained');
  h.context.current.phase = 'playing';
  await h.stopAudio(false);
  assert.equal(h.context.current.prompt.key, 'retained');
  assert.equal(h.context.current.phase, 'idle');
});
for (const transition of ['background', 'blur']) {
  await test(`${transition} during the next question's native claim resumes only that new question`, async () => {
    const playback = harness();
    await playback.owner.play(prompt('old_question'));
    const firstClaim = deferred(), secondClaim = deferred();
    let claims = 0;
    const h = screenAudioHarness({ playback, claim: (_id, active) => active
      ? (++claims === 1 ? firstClaim.promise : secondClaim.promise) : false });
    const blur = h.focus();
    h.context.current = { attempt: { id: 'attempt' }, joined: true, ended: false, ...playback.states.at(-1) };
    const replacing = h.play('triage_symptom_prompt');
    if (transition === 'background') h.appState('background');
    else blur();
    assert.equal(h.context.current.prompt, null);
    assert.equal(h.pendingAudioPrompt.current.key, 'triage_symptom_prompt');
    firstClaim.resolve(true); await replacing;
    assert.deepEqual(playback.events.filter(event => event.startsWith('play:')), ['play:old_question']);
    if (transition === 'background') h.appState('active');
    else h.focus();
    secondClaim.resolve(true); await tick();
    assert.deepEqual(playback.events.filter(event => event.startsWith('play:')), ['play:old_question', 'play:triage_symptom_prompt']);
    assert.equal(h.pendingAudioPrompt.current, null);
  });
}

// The native adapter is exercised with filesystem/API stubs as well, so cache
// coalescing, exact-attempt identity and no-autoplay are tested at the seam.
function hookHarness(initialAttempt, initialFile = { exists: false }, nativeOwner = false, files = new Map()) {
  const refs = [], states = [], effects = [], calls = [];
  const configCalls = [], audioLocales = [];
  let voiceVersion = 'voice-v1';
  let audioModeChanges = 0;
  let fileInfo = initialFile;
  let refIndex = 0, installed = false;
  const h = harness();
  const api = {
    audioConfig: async language => { configCalls.push(language); return { version: voiceVersion, language }; },
    userAudio: async (id, key, version, language) => { calls.push(`user:${id}:${key}:${version}`); audioLocales.push(language); return { base64: 'audio', audioVersion: voiceVersion }; },
    familyAudio: async (id, language) => { calls.push(`family:${id}`); audioLocales.push(language); return { base64: 'audio', audioVersion: voiceVersion }; },
    audio: async (key, language) => { calls.push(key); audioLocales.push(language); return { base64: 'audio', audioVersion: voiceVersion }; },
    conclusionAudio: async (text, language) => { calls.push(`conclusion:${text}`); audioLocales.push(language); return { base64: 'audio', audioVersion: voiceVersion }; },
  };
  const { useCheckinCallAudio } = evaluate(fs.readFileSync('src/features/checkin-call/useCheckinCallAudio.ts', 'utf8'), id => {
    if (id === '../../lib/voip') return { setVoipCallUIActive: async () => nativeOwner };
    if (id === 'react') return {
      useRef: initial => refs[refIndex++] ||= { current: initial },
      useState: initial => [initial, state => states.push(state)],
      useCallback: callback => callback,
      useEffect: effect => { if (!installed) effects.push(effect); },
    };
    if (id === 'expo-file-system/legacy') return {
      cacheDirectory: 'cache/', getInfoAsync: async uri => files.has(uri)
        ? { exists: true, isDirectory: false, size: files.get(uri).length } : fileInfo,
      writeAsStringAsync: async (uri, base64) => { files.set(uri, base64); },
      deleteAsync: async uri => { calls.push('deleteInvalidAudio'); files.delete(uri); fileInfo = { exists: false }; },
    };
    if (id === 'expo-speech') return { stop: h.dependencies.stopSpeech, speak: (text) => { calls.push(`deviceSpeech:${text}`); } };
    if (id === '../../lib/audio') return { Audio: {
      setAudioModeAsync: async () => { audioModeChanges++; await h.dependencies.prepare(); },
      Sound: { createAsync: async (source, initial) => {
        assert.equal(initial.shouldPlay, false, 'Unowned native player must not autoplay');
        assert.equal(initial.keepAudioSessionActive, nativeOwner && Boolean(initialAttempt));
        return { sound: await h.dependencies.create(source.uri) };
      } },
    } };
    if (id === './checkin-call.audio') return { CheckinCallAudio, isFamilyNoticePrompt };
    if (id === './checkin-call.api') return { checkinCallApi: api };
    throw new Error(`Unexpected dependency ${id}`);
  });
  const renderHook = (attempt, language = 'vi') => {
    refIndex = 0;
    // This deterministic native-adapter harness supplies its own React hook
    // implementations; no React renderer is loaded in these Node regressions.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCheckinCallAudio(attempt, language, key => key);
  };
  const controls = renderHook(initialAttempt);
  const cleanup = effects[0]();
  installed = true;
  return { controls, render: renderHook, cleanup, calls, api, h, states, files, configCalls, audioLocales,
    set voiceVersion(value) { voiceVersion = value; },
    get audioModeChanges() { return audioModeChanges; } };
}
await test('an answered native call keeps its audio session and skips Expo category changes', async () => {
  const h = hookHarness({ id: 'native-attempt', target_role: 'USER' }, { exists: false }, true);
  await h.controls.play('user_prompt');
  assert.equal(h.audioModeChanges, 0);
  h.cleanup();
});
await test('the real Vietnamese adapter preserves transcript and never uses Apple speech when synthesis fails', async () => {
  const h = hookHarness(null);
  h.api.audio = async () => { throw new Error('offline'); };
  await h.controls.play('user_prompt');
  assert.equal(h.states.at(-1).phase, 'error');
  assert.equal(h.states.at(-1).fallback, false);
  assert.equal(h.calls.some(call => call.startsWith('deviceSpeech:')), false);
  h.cleanup();
});
await test('a non-native call still prepares its own Expo audio session', async () => {
  const h = hookHarness(null);
  await h.controls.play('user_prompt');
  assert.equal(h.audioModeChanges, 1);
  h.cleanup();
});
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
await test('personalized user speech captures the recipient, exact transcript and snapshot before the active call changes', async () => {
  const first = { id: 'first-user', target_role: 'USER', user_notice: { version: 'first-version', prompts: { user_prompt: 'Chào bác Lan, đây là tổng đài Asinu.' } } };
  const second = { id: 'second-user', target_role: 'USER', user_notice: { version: 'second-version', prompts: { user_prompt: 'Chào anh Nam, đây là tổng đài Asinu.' } } };
  const h = hookHarness(first);
  const old = h.controls.play('user_prompt'); h.render(second); await old;
  assert.deepEqual(h.calls, ['user:first-user:user_prompt:first-version']);
  assert.equal(h.states.at(-1).prompt.text, first.user_notice.prompts.user_prompt);
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, ['user:first-user:user_prompt:first-version', 'user:second-user:user_prompt:second-version']);
  assert.equal(h.states.at(-1).prompt.text, second.user_notice.prompts.user_prompt); h.cleanup();
});
await test('personalized replay reuses a download but a new consent snapshot cannot use its old cache', async () => {
  const attempt = { id: 'own', target_role: 'USER', user_notice: { version: 'before', prompts: { user_ok: 'Asinu đã ghi nhận bạn vẫn ổn.' } } };
  const h = hookHarness(attempt);
  await h.controls.play('user_ok'); await h.controls.play('user_ok');
  assert.deepEqual(h.calls, ['user:own:user_ok:before']);
  h.render({ ...attempt, user_notice: { ...attempt.user_notice, version: 'after' } });
  await h.controls.play('user_ok');
  assert.deepEqual(h.calls, ['user:own:user_ok:before', 'user:own:user_ok:after']); h.cleanup();
});
await test('missing optional personalization keeps the old working Ngọc Lan prompt path', async () => {
  const h = hookHarness({ id: 'own', target_role: 'USER', user_notice: null });
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, ['user_prompt']); assert.equal(h.states.at(-1).fallback, false); h.cleanup();
});
await test('an answered choice cancels an in-flight personalized question before it can play', async () => {
  const h = hookHarness({ id: 'own', target_role: 'USER', user_notice: { version: 'snapshot', prompts: { user_prompt: 'Old personalized question', user_ok: 'New personalized response' } } });
  const pending = deferred();
  h.api.userAudio = (id, key) => key === 'user_prompt' ? pending.promise : Promise.resolve({ base64: 'audio' });
  const first = h.controls.play('user_prompt'); await tick();
  await h.controls.stopAudio(); await h.controls.play('user_ok');
  pending.resolve({ base64: 'old-audio' }); await first;
  assert.equal(h.h.sounds.length, 1); assert.equal(h.states.at(-1).prompt.text, 'New personalized response'); h.cleanup();
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
await test('a valid current-version recording plays without another synthesis or audio download', async () => {
  const h = hookHarness(null, { exists: true, isDirectory: false, size: 100 });
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.configCalls, ['vi']);
  assert.equal(h.h.sounds.length, 1);
  h.cleanup();
});

for (const scenario of [
  { name: 'fixed question', attempt: null, key: 'user_prompt' },
  { name: 'personalized user greeting', attempt: { id: 'own', target_role: 'USER',
    user_notice: { version: 'notice', prompts: { user_prompt: 'Chào bác Lan.' } } }, key: 'user_prompt' },
  { name: 'family notice', attempt: { id: 'family', target_role: 'FAMILY',
    family_notice: { audio_text: 'Người thân cần được kiểm tra.' } }, key: 'family_mild' },
  { name: 'conclusion', attempt: null, key: 'family_confirmed', text: 'Bạn sẽ kiểm tra người thân.' },
]) {
  await test(`a backend voice change refreshes ${scenario.name} in the same open call`, async () => {
    const h = hookHarness(scenario.attempt);
    await h.controls.play(scenario.key, scenario.text);
    const oldUri = h.h.sounds.at(-1).uri;
    await h.controls.play(scenario.key, scenario.text);
    assert.equal(h.calls.length, 1, 'Unchanged voice must reuse the recording');
    h.voiceVersion = 'voice-v2';
    await h.controls.play(scenario.key, scenario.text);
    const newUri = h.h.sounds.at(-1).uri;
    assert.notEqual(newUri, oldUri);
    assert.ok(newUri.includes('voice-v2'));
    assert.equal(h.calls.length, 2);
    await h.controls.play(scenario.key, scenario.text);
    assert.equal(h.calls.length, 2, 'The refreshed voice must also be cached');
    assert.equal(h.configCalls.length, 4, 'Every replay checks the backend revision');
    h.cleanup();
  });
}

await test('a voice change between config and synthesis stores only the actual recording version', async () => {
  const h = hookHarness(null);
  h.api.audio = async () => {
    h.calls.push('user_prompt');
    h.voiceVersion = 'voice-v2';
    return { base64: 'new-voice', audioVersion: 'voice-v2' };
  };
  await h.controls.play('user_prompt');
  assert.ok(h.h.sounds.at(-1).uri.includes('voice-v2'));
  assert.ok([...h.files.keys()].every(uri => !uri.includes('voice-v1')));
  await h.controls.play('user_prompt');
  assert.equal(h.calls.length, 1);
  h.voiceVersion = 'voice-v1';
  await h.controls.play('user_prompt');
  assert.equal(h.calls.length, 2, 'The previous revision must not contain the new recording');
  h.cleanup();
});

for (const scenario of [
  { name: 'fixed question', attempt: null, key: 'user_prompt' },
  { name: 'personalized greeting', attempt: { id: 'user', target_role: 'USER', user_notice: { version: 'notice', prompts: { user_prompt: 'Chào bạn.' } } }, key: 'user_prompt' },
  { name: 'family warning', attempt: { id: 'family', target_role: 'FAMILY', family_notice: { audio_text: 'Người thân cần được kiểm tra.' } }, key: 'family_mild' },
  { name: 'conclusion', attempt: null, key: 'family_confirmed', text: 'Bạn sẽ kiểm tra người thân.' },
]) {
  await test(`private clone WAV ${scenario.name} uses the correct file format and cache on replay`, async () => {
    const h = hookHarness(scenario.attempt);
    h.api.audioConfig = async () => ({ version: 'clone-version', mimeType: 'audio/wav' });
    let downloads = 0;
    for (const method of ['audio', 'userAudio', 'familyAudio', 'conclusionAudio']) {
      h.api[method] = async () => { downloads++; return { base64: 'clone-wav', mimeType: 'audio/wav', audioVersion: 'clone-version' }; };
    }
    await h.controls.play(scenario.key, scenario.text);
    const uri = h.h.sounds.at(-1).uri;
    assert.ok(uri.endsWith('.wav'));
    assert.ok(uri.includes('clone-version'));
    await h.controls.play(scenario.key, scenario.text);
    assert.equal(h.h.sounds.at(-1).uri, uri);
    assert.equal(downloads, 1);
    h.h.sounds.at(-1).listener({ isLoaded: false, didJustFinish: false, error: 'invalid WAV' });
    await tick();
    assert.equal(h.files.has(uri), false, 'Decode failure must evict the actual WAV file');
    await h.controls.play(scenario.key, scenario.text);
    assert.equal(downloads, 2);
    h.cleanup();
  });
}
await test('a catalogue-to-clone change during synthesis saves the actual WAV format', async () => {
  const h = hookHarness(null);
  h.api.audioConfig = async () => ({ version: 'catalogue-version', mimeType: 'audio/mpeg' });
  h.api.audio = async () => ({ base64: 'clone-wav', mimeType: 'audio/wav', audioVersion: 'clone-version' });
  await h.controls.play('user_prompt');
  assert.ok(h.h.sounds.at(-1).uri.endsWith('.wav'));
  assert.ok(h.h.sounds.at(-1).uri.includes('clone-version'));
  assert.ok([...h.files.keys()].every(uri => !uri.includes('catalogue-version')));
  h.cleanup();
});

await test('a backend without version metadata keeps working without trusting old cached audio', async () => {
  const h = hookHarness(null, { exists: true, isDirectory: false, size: 100 });
  h.api.audioConfig = async () => { throw new Error('404 old backend'); };
  h.api.audio = async () => { h.calls.push('user_prompt'); return { base64: 'fresh-audio' }; };
  await h.controls.play('user_prompt');
  await h.controls.play('user_prompt');
  assert.deepEqual(h.calls, ['user_prompt', 'user_prompt']);
  assert.equal(h.states.at(-1).phase, 'playing');
  h.cleanup();
});

await test('unversioned responses are not persisted as the revision claimed by metadata', async () => {
  const h = hookHarness(null);
  h.api.audio = async () => { h.calls.push('user_prompt'); return { base64: 'legacy-audio' }; };
  await h.controls.play('user_prompt');
  await h.controls.play('user_prompt');
  assert.equal(h.calls.length, 2);
  assert.ok([...h.files.keys()].every(uri => uri.includes('unversioned')));
  h.cleanup();
});

await test('switching language snapshots the locale for metadata, synthesis and cache identity', async () => {
  const h = hookHarness(null);
  const first = h.controls.play('user_prompt');
  h.render(null, 'en');
  await first;
  const viUri = h.h.sounds.at(-1).uri;
  await h.controls.play('user_prompt');
  assert.deepEqual(h.configCalls, ['vi', 'en']);
  assert.deepEqual(h.audioLocales, ['vi', 'en']);
  assert.notEqual(h.h.sounds.at(-1).uri, viUri);
  h.cleanup();
});

await test('reopening the call rejects files from an older voice and reuses files for the current voice', async () => {
  const first = hookHarness(null);
  await first.controls.play('user_prompt');
  const oldUri = first.h.sounds.at(-1).uri;
  first.cleanup();
  const changed = hookHarness(null, { exists: false }, false, first.files);
  changed.voiceVersion = 'voice-v2';
  await changed.controls.play('user_prompt');
  assert.deepEqual(changed.calls, ['user_prompt']);
  const newUri = changed.h.sounds.at(-1).uri;
  assert.notEqual(newUri, oldUri);
  changed.cleanup();
  const reopened = hookHarness(null, { exists: false }, false, first.files);
  reopened.voiceVersion = 'voice-v2';
  await reopened.controls.play('user_prompt');
  assert.deepEqual(reopened.calls, []);
  assert.equal(reopened.h.sounds.at(-1).uri, newUri);
  reopened.cleanup();
});

await test('cancelling during revision lookup prevents a late recording from playing', async () => {
  const h = hookHarness(null);
  const metadata = deferred();
  h.api.audioConfig = () => metadata.promise;
  const playing = h.controls.play('user_prompt');
  await tick();
  await h.controls.stopAudio();
  metadata.resolve({ version: 'voice-v2', language: 'vi' });
  await playing;
  assert.equal(h.h.sounds.length, 0);
  assert.equal(h.states.at(-1).phase, 'idle');
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
