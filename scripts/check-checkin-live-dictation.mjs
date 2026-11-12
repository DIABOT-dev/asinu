import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function evaluate(file, imports, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports,
    name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; }, ...Object.values(globals));
  return module.exports;
}
const tick = async () => { for (let i = 0; i < 30; i++) {await Promise.resolve();} };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];

function nativeHarness({ available = true } = {}) {
  const listeners = new Map(), timers = new Map(), starts = [];
  let nextTimer = 0, stopped = 0, aborted = 0;
  const emit = (event, payload) => [...(listeners.get(event) || [])].forEach(fn => fn(payload));
  const module = {
    isRecognitionAvailable: () => available,
    requestPermissionsAsync: async () => ({ granted: true }),
    addListener(event, fn) {
      if (!listeners.has(event)) {listeners.set(event, new Set());}
      listeners.get(event).add(fn);
      return { remove: () => listeners.get(event).delete(fn) };
    },
    start: options => starts.push(options),
    stop: () => { stopped++; },
    abort: () => { aborted++; emit('end'); },
  };
  const service = evaluate('src/features/guidance/live-dictation.service.ts', {
    'expo-modules-core': { requireOptionalNativeModule: () => available ? module : null },
    'react-native': { Platform: { OS: 'ios' } },
  }, {
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  return { ...service, module, starts, timers, emit,
    result: (text, isFinal = false) => emit('result', { results: [{ transcript: text }], isFinal }),
    fire(delay) { for (const [id, timer] of [...timers]) {if (timer.delay === delay) { timers.delete(id); timer.fn(); }} },
    get stopped() { return stopped; }, get aborted() { return aborted; },
    get listeners() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}

function renderer(file, name, imports) {
  const slots = [], effects = [], appListeners = new Set();
  let index = 0, focused = true;
  const memo = (work, deps) => {
    const id = index++, old = slots[id];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {slots[id] = { value: work(), deps };}
    return slots[id].value;
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const components = evaluate(file, {
    react: {
      useState(initial) { const id = index++; slots[id] ??= { value: initial }; return [slots[id].value, value => { slots[id].value = typeof value === 'function' ? value(slots[id].value) : value; }]; },
      useRef(initial) { return slots[index++] ??= { current: initial }; },
      useCallback: (fn, deps) => memo(() => fn, deps),
      useEffect(work, deps) {
        const id = index++, old = slots[id];
        if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
          slots[id] = { deps }; effects.push(() => { old?.cleanup?.(); slots[id].cleanup = work(); });
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Pressable: 'Button', ActivityIndicator: 'Spinner', AppState: {
      addEventListener: (_event, fn) => { appListeners.add(fn); return { remove: () => appListeners.delete(fn) }; },
    } },
    'expo-router': { useIsFocused: () => focused },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language: 'vi' } }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../../components/ScaledText': { ScaledText: 'Text' },
    './guidance.model': { guideColors: { primary: '#08b8a2' } },
    ...imports,
  });
  return {
    render(props) { index = 0; const tree = components[name](props); effects.splice(0).forEach(fn => fn()); return tree; },
    appState(state) { appListeners.forEach(fn => fn(state)); },
    focus(value) { focused = value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('interim words replace a previous hypothesis; only one final answer is returned after native end', () => {
  const h = nativeHarness(), preview = [], done = [];
  const live = h.createLiveDictation(h.module, { language: 'vi', onInterim: text => preview.push(text), onDone: value => done.push(value) });
  live.start();
  assert.equal(h.starts[0].lang, 'vi-VN'); assert.equal(h.starts[0].interimResults, true);
  assert.equal(h.starts[0].recordingOptions.persist, false);
  h.result('Tôi'); h.result('Tôi đau'); h.result('Tôi đau đầu', true);
  assert.deepEqual(preview, ['Tôi', 'Tôi đau', 'Tôi đau đầu']); assert.deepEqual(done, []);
  h.emit('end'); h.emit('end');
  assert.deepEqual(done, [{ text: 'Tôi đau đầu' }]); assert.equal(h.listeners, 0); assert.equal(h.timers.size, 0);
});

test('Stop without a final event preserves visible words and releases all native resources', () => {
  const h = nativeHarness(), done = [];
  const live = h.createLiveDictation(h.module, { language: 'en', onInterim() {}, onDone: value => done.push(value) });
  live.start(); h.result('I feel tired'); live.stop(); live.stop();
  assert.equal(h.starts[0].lang, 'en-US'); assert.equal(h.stopped, 1);
  h.fire(2500);
  assert.deepEqual(done, [{ text: 'I feel tired' }]); assert.equal(h.aborted, 1); assert.equal(h.listeners, 0);
});

test('an Android-style client error after Stop cannot delete the last visible words', () => {
  const h = nativeHarness(), done = [];
  const live = h.createLiveDictation(h.module, { language: 'vi', onInterim() {}, onDone: value => done.push(value) });
  live.start(); h.result('Hơi mệt'); live.stop(); h.emit('error', { error: 'client' }); h.emit('end');
  assert.deepEqual(done, [{ text: 'Hơi mệt', error: 'client' }]); assert.equal(h.timers.size, 0);
});

test('cancellation ignores late words and never commits an answer; a recording ends after 60 seconds', () => {
  const h = nativeHarness(), previews = [], done = [];
  const make = () => h.createLiveDictation(h.module, { language: 'vi', onInterim: text => previews.push(text), onDone: value => done.push(value) });
  const first = make(); first.start(); first.cancel(); h.result('late'); h.emit('end');
  assert.deepEqual(previews, []); assert.deepEqual(done, []); assert.equal(h.listeners, 0);
  const second = make(); second.start(); h.fire(60000); assert.equal(h.stopped, 1); h.emit('end');
  assert.deepEqual(done, [{ text: '' }]);
});

test('older development clients safely retain the file upload fallback', () => {
  assert.equal(nativeHarness({ available: false }).getLiveDictationModule(), null);
});

function buttonHarness({ permission = true } = {}) {
  const native = nativeHarness(), texts = [], preview = [], notices = [];
  native.module.requestPermissionsAsync = async () => ({ granted: typeof permission === 'function' ? await permission() : permission });
  const ui = renderer('src/features/guidance/VoiceAnswerButton.tsx', 'VoiceAnswerButton', {
    './live-dictation.service': native,
    '../../lib/native-permissions': { runNativePermission: fn => fn() },
    '../../lib/audio': { Audio: { setAudioModeAsync: async () => {} } },
    '../chat/chat.api': { chatApi: { transcribeAudio: () => assert.fail('Live dictation must not upload a second copy') } },
    '../../stores/toast.store': { showToast: (...args) => notices.push(args) },
    './guidance.audio': { guidanceAudio: { stop: async () => {} } },
  });
  const props = { onBeforeAi: async () => true, onText: text => texts.push(text), onInterimText: text => preview.push(text) };
  return { ...ui, native, texts, preview, notices, props, render: () => ui.render(props) };
}

test('the real mic button shows partial text, keeps Stop bound to its session, and commits once', async () => {
  const h = buttonHarness();
  try {
    h.render().props.onPress(); await tick();
    assert.equal(h.render().props.accessibilityLabel, 'guidance.stopRecording');
    h.native.result('Tôi đau'); assert.deepEqual(h.preview, ['Tôi đau']); assert.deepEqual(h.texts, []);
    h.render().props.onPress(); await tick(); assert.equal(h.render().props.disabled, true);
    h.native.result('Tôi đau đầu', true); h.native.emit('end'); await tick();
    assert.deepEqual(h.texts, ['Tôi đau đầu']); assert.equal(h.preview.at(-1), '');
    assert.equal(h.render().props.disabled, false); assert.deepEqual(h.notices, []);
  } finally { h.unmount(); }
});

test('backgrounding or leaving a question cancels live recognition without filling a later input', async () => {
  for (const cancel of [h => h.appState('background'), h => { h.focus(false); h.render(); }]) {
    const h = buttonHarness();
    try {
      h.render().props.onPress(); await tick(); h.native.result('Tôi'); cancel(h);
      h.native.result('late text', true); h.native.emit('end');
      assert.deepEqual(h.texts, []); assert.equal(h.native.aborted, 1); assert.equal(h.native.listeners, 0);
    } finally { h.unmount(); }
  }
});

test('speech permission denial never starts capture and keeps the mic usable', async () => {
  const h = buttonHarness({ permission: false });
  try {
    h.render().props.onPress(); await tick();
    assert.equal(h.native.starts.length, 0); assert.equal(h.render().props.disabled, false);
    assert.deepEqual(h.notices, [['guidance.speechRecognitionDenied', 'info']]);
  } finally { h.unmount(); }
});

test('the first iOS speech permission dialog does not cancel dictation; a real background still cancels the pending start', async () => {
  for (const state of ['inactive', 'background']) {
    let resolve;
    const permission = new Promise(done => { resolve = done; });
    const h = buttonHarness({ permission: () => permission });
    try {
      h.render().props.onPress(); await tick();
      h.appState(state); h.appState('active'); resolve(true); await tick();
      assert.equal(h.native.starts.length, state === 'inactive' ? 1 : 0);
    } finally { h.unmount(); }
  }
});

test('the real description field displays each partial phrase without duplicate or prematurely saved words', () => {
  const changes = [];
  const h = renderer('src/features/guidance/VoiceAnswerInput.tsx', 'VoiceAnswerInput', {
    '../../components/ScaledTextInput': { ScaledTextInput: 'Input' },
    './GuidanceProvider': { GuideTarget: 'Guide' }, './VoiceAnswerButton': { VoiceAnswerButton: 'Mic' },
  });
  let props = { value: 'Từ sáng', onChangeText: text => { changes.push(text); props = { ...props, value: text }; },
    onBeforeAi: async () => true, onProcessingChange() {}, placeholder: 'Describe', maxLength: 200 };
  const find = type => nodes(h.render(props)).find(node => node.type === type);
  find('Mic').props.onProcessingChange(true);
  find('Mic').props.onInterimText('tôi');
  assert.equal(find('Input').props.value, 'Từ sáng tôi'); assert.equal(find('Input').props.editable, false);
  find('Mic').props.onInterimText('tôi đau đầu');
  assert.equal(find('Input').props.value, 'Từ sáng tôi đau đầu'); assert.deepEqual(changes, []);
  find('Mic').props.onText('tôi đau đầu'); find('Mic').props.onProcessingChange(false);
  assert.deepEqual(changes, ['Từ sáng tôi đau đầu']); assert.equal(find('Input').props.value, changes[0]);
  assert.equal(find('Input').props.editable, true);
  find('Mic').props.onInterimText('temporary'); find('Mic').props.onProcessingChange(false);
  assert.equal(find('Input').props.value, changes[0]);
  props = { ...props, readOnly: true };
  assert.equal(find('Input').props.editable, false); assert.equal(find('Input').props.onChangeText, undefined);
  assert.equal(find('Mic').props.disabled, true);
});

test('measurement dictation replaces a prior reading while description dictation still appends', () => {
  const changes = [];
  const h = renderer('src/features/guidance/VoiceAnswerInput.tsx', 'VoiceAnswerInput', {
    '../../components/ScaledTextInput': { ScaledTextInput: 'Input' },
    './GuidanceProvider': { GuideTarget: 'Guide' }, './VoiceAnswerButton': { VoiceAnswerButton: 'Mic' },
  });
  let props = { value: '120/80', dictationMode: 'replace', onChangeText: text => { changes.push(text); props = { ...props, value: text }; },
    onBeforeAi: async () => true, onProcessingChange() {}, placeholder: 'Reading' };
  const find = type => nodes(h.render(props)).find(node => node.type === type);
  find('Mic').props.onProcessingChange(true);
  find('Mic').props.onInterimText('130');
  assert.equal(find('Input').props.value, '130'); assert.deepEqual(changes, []);
  find('Mic').props.onText('130/85'); find('Mic').props.onProcessingChange(false);
  assert.deepEqual(changes, ['130/85']); assert.equal(find('Input').props.value, '130/85');
  find('Mic').props.onProcessingChange(true); find('Mic').props.onInterimText('140');
  find('Mic').props.onProcessingChange(false);
  assert.equal(find('Input').props.value, '130/85');
});
