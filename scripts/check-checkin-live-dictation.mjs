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
  const adapters = {
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
      currentState: 'active',
      addEventListener: (_event, fn) => { appListeners.add(fn); return { remove: () => appListeners.delete(fn) }; },
    } },
    'expo-router': { useIsFocused: () => focused },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language: 'vi' } }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../../components/ScaledText': { ScaledText: 'Text' },
    './guidance.model': { guideColors: { primary: '#08b8a2' } },
  };
  const components = evaluate(file, { ...adapters, ...(typeof imports === 'function' ? imports(adapters) : imports) });
  return {
    render(props, ...args) { index = 0; const tree = components[name](props, ...args); effects.splice(0).forEach(fn => fn()); return tree; },
    appState(state) { adapters['react-native'].AppState.currentState = state; appListeners.forEach(fn => fn(state)); },
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

// Run the real assistant owner, voice controller, modal queue and permission
// presenter together. Only native capture and the server are replaced.
function assistantHarness({ granted = false, consent = true, legacy = false, assistantPlan, apply, photo, notificationsGranted = true } = {}) {
  const settings = JSON.parse(fs.readFileSync('src/i18n/locales/vi/settings.json', 'utf8'));
  const { ModalQueue } = evaluate('src/lib/modalQueue.ts', {});
  const queue = new ModalQueue(), native = nativeHarness(), notices = [], uploads = [], routes = [], scans = [];
  const decision = {};
  let permissionRequests = 0, recordings = 0, stopped = 0, tree, consented = consent;
  let auth = { token: 'owner-a', profile: { id: '1' } };
  native.module.getPermissionsAsync = async () => ({ granted });
  native.module.requestPermissionsAsync = () => {
    permissionRequests++;
    return new Promise(resolve => { decision.resolve = value => { granted = value; resolve({ granted }); }; });
  };
  let detach;
  const ui = renderer('src/features/app-assistant/AsinuAssistantDialog.tsx', 'AsinuAssistantDialog', adapters => {
    const { AppState } = adapters['react-native'];
    AppState.addEventListener('change', state => queue.setForeground(state === 'active'));
    const permissions = evaluate('src/lib/native-permissions.ts', {
      'react-native': { AppState }, './tokenStore': { tokenStore: { getToken: () => auth.token } },
    }, { requestAnimationFrame: work => work() });
    detach = permissions.attachNativePermissionPresenter(queue);
    const store = select => select(auth); store.getState = () => auth;
    store.setState = patch => { auth = { ...auth, ...patch }; };
    const voiceModule = evaluate('src/features/guidance/VoiceAnswerButton.tsx', {
      ...adapters,
      './live-dictation.service': { ...native, getLiveDictationModule: () => legacy ? null : native.module },
      '../../lib/native-permissions': permissions,
      '../../lib/audio': { Audio: {
        getPermissionsAsync: async () => ({ granted }),
        requestPermissionsAsync: canRun => permissions.runNativePermission(() => native.module.requestPermissionsAsync(), { key: 'microphone', canRun }),
        setAudioModeAsync: async () => {}, RecordingOptionsPresets: { HIGH_QUALITY: {} },
        Recording: { createAsync: async () => {
          recordings++;
          return { recording: { stopAndUnloadAsync: async () => { stopped++; }, getURI: () => 'captured.m4a' } };
        } },
      } },
      '../chat/chat.api': { chatApi: { transcribeAudio: async (...args) => { uploads.push(args); return 'Tôi vừa uống 200 ml nước'; } } },
      '../../stores/toast.store': { showToast: (...args) => notices.push(args) },
      './guidance.audio': { guidanceAudio: { stop: async () => {} } },
    });
    return {
      'react-i18next': { useTranslation: namespace => ({ t: (key, values = {}) => {
        if (namespace !== 'settings') return key;
        const text = key.split('.').reduce((value, part) => value?.[part], settings);
        assert.equal(typeof text, 'string', `Missing assistant copy: ${key}`);
        return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
      } }) },
      'react-native': { ...adapters['react-native'], Image: 'Image', Keyboard: { dismiss() {} }, KeyboardAvoidingView: 'Keyboard',
        Platform: { OS: 'ios' }, ScrollView: 'Scroll', StyleSheet: { create: value => value, absoluteFill: {} } },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      'expo-crypto': { randomUUID: () => 'unused-preview-id' },
      '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push: route => routes.push(route) }) },
      'expo-image-picker': {
        getMediaLibraryPermissionsAsync: async () => ({ granted: true }),
        requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
        launchImageLibraryAsync: async () => photo || { canceled: true },
      },
      '../../lib/native-permissions': permissions,
      '../../lib/notifications': { checkNotificationPermission: async () => notificationsGranted },
      '../notifications/notifications.api': { getNotificationPreferences: async () => ({ ok: true, reminders_enabled: true }), applyReminderTimes: async () => ({}) },
      '../v21/v21.api': { v21Api: { scan: async (...args) => { scans.push(args); return { readable: true, items: [{ display_name: 'Hapacol' }] }; } } },
      '../v21/medication-photo': { prepareMedicationPhoto: async () => ({ body: 'photo-file', dispose() {} }) },
      './assistant-navigation': evaluate('src/features/app-assistant/assistant-navigation.ts', {}),
      './useAssistantNativeActions': { useAssistantNativeActions: () => async () => undefined },
      '../checkin-call/useCheckinCallAudio': { useCheckinCallAudio: () => ({ audio: { phase: 'idle' }, stopAudio: async () => {}, play: async () => {} }) },
      '../../stores/notification.store': { useNotificationStore: { getState: () => ({ fetchFromBackend: async () => {} }) } },
      '../../lib/device-permission-events': { notifyTaskReminderPreferenceChanged() {} },
      '../../lib/health-action-events': { notifyHealthAction() {} },
      '../health-feed/useHealthFeedDismissals': { useHealthFeedDismissals: () => ({ hiddenIds: new Set(), canShowCurated: true, dismiss: async () => {} }) },
      './useAssistantConversation': { useAssistantConversation: () => {
        const [messages, setMessages] = adapters.react.useState([]);
        return { messages, storageError: false, edited() {}, clear: async () => setMessages([]),
          append: (role, text) => setMessages(previous => [...previous, { id: String(previous.length), role, text }]) };
      } },
      '../../components/ScaledTextInput': { ScaledTextInput: 'Input' },
      '../../components/QueuedModal': { QueuedModal: 'QueuedModal' },
      '../../components/AiDataConsentModal': { AiDataConsentModal: 'Consent', hasAiDataConsent: async () => consented },
      '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {}, isDark: false }) },
      '../../lib/apiClient': { ApiError: class extends Error {} },
      '../../stores/font-size.store': { useFontSizeStore: select => select({ scale: 'normal' }) },
      '../../stores/language.store': { useLanguageStore: select => select({ language: 'vi' }) },
      '../auth/auth.store': { useAuthStore: store },
      '../logs/logs.store': { useLogsStore: { getState: () => ({ fetchRecent: async () => {} }) } },
      '../guidance/VoiceAnswerButton': voiceModule,
      './app-assistant.api': {
        executeAssistantActions: apply || (() => assert.fail('Mic must not execute actions')),
        planAssistantActions: () => assistantPlan || assert.fail('Mic must not submit a plan'),
      },
      '../../../assets/asinu_assistant_listening_v1.png': 'mascot',
    };
  });
  const render = () => {
    tree = ui.render({ onClose() {} });
    const all = nodes(tree), modal = all.find(node => node.type === 'QueuedModal'), consentModal = all.find(node => node.type === 'Consent');
    if (modal.props.visible) queue.request('assistant', { ...modal.props, content: modal.props.children });
    else queue.remove('assistant');
    if (consentModal.props.visible) queue.request('consent', { content: consentModal, priority: 40 });
    else queue.remove('consent');
    return tree;
  };
  const settle = async () => { for (let i = 0; i < 4; i++) { render(); await tick(); } };
  const find = id => nodes(render()).find(node => node.props?.testID === id);
  const active = () => queue.getSnapshot().active;
  const show = () => { assert.equal(active()?.phase, 'opening'); queue.didShow(active().presentation); };
  const dismiss = () => { assert.equal(active()?.phase, 'closing'); queue.didDismiss(active().presentation); };
  render(); show();
  return { ...ui, native, queue, notices, uploads, routes, scans, decision, settle, find, active, show, dismiss,
    input: () => find('asinu-assistant-text').props.value,
    mic: () => find('assistant-voice-answer'),
    agree() { consented = true; nodes(render()).find(node => node.type === 'Consent').props.onAgree(); },
    switchAccount() { auth = { token: 'owner-b' }; render(); },
    get permissionRequests() { return permissionRequests; },
    get recordings() { return recordings; }, get stopped() { return stopped; },
    dispose() { ui.unmount(); detach(); },
  };
}

function nativeActionsHarness({ cameraGranted = false, swapAfterPicking = false, locationGranted = false, swapAfterLocation = false } = {}) {
  const seen = []; let current = true;
  const control = { permission: { granted: true }, loading: false, pending: false, change: async enabled => seen.push(['change', enabled]), refresh: async () => ({ granted: false }) };
  const h = renderer('src/features/app-assistant/useAssistantNativeActions.ts', 'useAssistantNativeActions', {
    'react-native': { Linking: { openURL: async () => seen.push('open-support') }, Share: { share: async () => seen.push('share-sheet') } },
    'expo-image-picker': { getMediaLibraryPermissionsAsync: async () => ({ granted: true }), requestMediaLibraryPermissionsAsync: async () => assert.fail('already granted'),
      launchImageLibraryAsync: async () => { seen.push('picker'); if (swapAfterPicking) current = false; return { canceled: false, assets: [{ uri: 'private-image' }] }; } },
    'expo-camera': { Camera: { getCameraPermissionsAsync: async () => ({ granted: cameraGranted }) } },
    'expo-location': { getForegroundPermissionsAsync: async () => ({ granted: locationGranted }),
      requestForegroundPermissionsAsync: async () => { seen.push('location-permission'); return { granted: false }; },
      Accuracy: { Balanced: 'balanced' }, getCurrentPositionAsync: async () => {
        seen.push('location'); if (swapAfterLocation) current = false;
        return { coords: { latitude: 21.028511, longitude: 105.804817 } };
      } },
    '../checkin-call/checkin-call.api': { checkinCallApi: {
      voicePreferences: async () => { seen.push('fresh-preferences'); return { preferences: { use_name: false, use_health: true, address: 'chu', weather_enabled: false, region: 'hanoi', location: null } }; },
      saveVoicePreferences: async value => { seen.push(['save-weather', value]); },
    } },
    '../profile/useDevicePermission': { useDevicePermission: () => control },
    '../care-circle/useQrCameraPermission': { useQrCameraPermission: () => ({ change: async enabled => seen.push(['camera', enabled]) }) },
    '../../lib/android-checkin-call': { getAndroidCallPermissions: async () => null, openAndroidCallSettings: async () => {} },
    '../../lib/android-call-access': { requestAndroidCallAccess: async () => {} },
    '../../lib/native-permissions': { runNativePermission: async operation => operation() },
    '../auth/auth.api': { authApi: { uploadAvatar: async uri => { seen.push(['upload', uri]); return { id: 'A' }; } } },
    '../auth/auth.store': { useAuthStore: { setState: value => seen.push(['profile', value]) } },
    '../app-update/app-update.store': { useAppUpdateStore: { getState: () => ({ check: async () => ({ status: 'current' }) }) } },
    '../guidance/guidance.store': { useGuidanceStore: { getState: () => ({ replay: async () => seen.push('guide') }) } },
  });
  const run = h.render({ present: async operation => { seen.push('dialog-dismissed'); return operation(); }, isCurrent: () => current, openHome: () => seen.push('home'), dismissArticle: async id => seen.push(['hide', id]) });
  return { run, seen, h };
}

test('assistant device actions wait for dismissal and report the actual permission result instead of assuming approval', async () => {
  const h = nativeActionsHarness();
  await h.run({ type: 'native', kind: 'device.permission', parameters: { kind: 'camera', enabled: true } });
  assert.deepEqual(h.seen, ['dialog-dismissed', ['camera', true]]);
  h.seen.length = 0;
  await h.run({ type: 'native', kind: 'app.share', parameters: {} });
  assert.deepEqual(h.seen, ['dialog-dismissed', 'share-sheet']);
});
test('selecting an avatar for an account that leaves cannot upload the image or update the next profile', async () => {
  const h = nativeActionsHarness({ swapAfterPicking: true });
  await h.run({ type: 'native', kind: 'profile.avatar', parameters: {} });
  assert.deepEqual(h.seen, ['dialog-dismissed', 'picker']);
});
test('weather cannot access location or change preferences when permission is denied or the account leaves', async () => {
  const denied = nativeActionsHarness();
  await assert.rejects(denied.run({ type: 'native', kind: 'calls.weather_device', parameters: {} }), /Location permission/);
  assert.deepEqual(denied.seen, ['dialog-dismissed', 'location-permission']);
  const switched = nativeActionsHarness({ locationGranted: true, swapAfterLocation: true });
  await switched.run({ type: 'native', kind: 'calls.weather_device', parameters: {} });
  assert.deepEqual(switched.seen, ['dialog-dismissed', 'location']);
});
test('device weather preserves fresh call preferences and sends only rounded area coordinates', async () => {
  const h = nativeActionsHarness({ locationGranted: true });
  await h.run({ type: 'native', kind: 'calls.weather_device', parameters: {} });
  assert.deepEqual(h.seen, ['dialog-dismissed', 'location', 'fresh-preferences', ['save-weather', {
    use_name: false, use_health: true, address: 'chu', weather_enabled: true, region: 'device', location: { latitude: 21.03, longitude: 105.8 },
  }]]);
});

test('assistant mic waits for modal dismissal, survives native permission and displays live words once', async () => {
  const h = assistantHarness();
  try {
    h.mic().props.onPress(); await h.settle();
    assert.equal(h.active().phase, 'closing'); assert.equal(h.permissionRequests, 0);
    h.dismiss(); await h.settle();
    assert.equal(h.permissionRequests, 1); assert.equal(h.native.starts.length, 0);
    h.appState('inactive'); h.appState('active'); h.decision.resolve(true); await h.settle();
    assert.equal(h.native.starts.length, 1); assert.equal(h.active().id, 'assistant'); h.show();
    h.native.result('Tôi uống'); await h.settle(); assert.equal(h.input(), 'Tôi uống');
    h.native.result('Tôi uống 200 ml nước'); await h.settle(); assert.equal(h.input(), 'Tôi uống 200 ml nước');
    h.mic().props.onPress(); await h.settle(); h.native.emit('end'); await h.settle();
    assert.equal(h.input(), 'Tôi uống 200 ml nước');
    assert.equal(h.find('asinu-assistant-send').props.disabled, false);
    assert.deepEqual(h.notices, []); assert.deepEqual(h.uploads, []);
  } finally { h.dispose(); }
});

test('assistant with permission already granted starts without hiding its dialog or requesting another OS sheet', async () => {
  const h = assistantHarness({ granted: true });
  try {
    h.mic().props.onPress(); await h.settle();
    assert.equal(h.permissionRequests, 0); assert.equal(h.native.starts.length, 1);
    assert.equal(h.active().phase, 'open');
    h.native.result('Đổi sang tiếng Anh', true); h.native.emit('end'); await h.settle();
    assert.equal(h.input(), 'Đổi sang tiếng Anh');
  } finally { h.dispose(); }
});

test('assistant permission denial returns to a usable mic; leaving before dismissal never opens an OS sheet', async () => {
  for (const leave of [false, true]) {
    const h = assistantHarness();
    try {
      h.mic().props.onPress(); await h.settle();
      if (leave) { h.focus(false); await h.settle(); }
      h.dismiss(); await h.settle();
      if (leave) { assert.equal(h.permissionRequests, 0); assert.equal(h.active(), null); }
      else {
        h.decision.resolve(false); await h.settle(); h.show();
        assert.equal(h.mic().props.disabled, false);
        assert.ok(nodes(h.render({ onClose() {} })).some(node => node.type === 'Text' && node.props.children === 'guidance.speechRecognitionDenied'));
        assert.deepEqual(h.notices, [], 'Permission failures are shown inside the assistant, not under its modal');
      }
      assert.equal(h.native.starts.length, 0); assert.equal(h.input(), '');
    } finally { h.dispose(); }
  }
});

test('assistant first obtains AI consent, then resumes the requested mic after the consent modal dismisses', async () => {
  const h = assistantHarness({ consent: false, granted: true });
  try {
    h.mic().props.onPress(); await h.settle();
    assert.equal(h.permissionRequests, 0); assert.equal(h.native.starts.length, 0);
    h.dismiss(); await h.settle(); assert.equal(h.active().id, 'consent'); h.show();
    h.agree(); await h.settle(); h.dismiss(); await h.settle();
    assert.equal(h.active().id, 'assistant'); h.show(); await h.settle();
    assert.equal(h.native.starts.length, 1);
  } finally { h.dispose(); }
});

test('older assistant clients can request recording permission, then transcribe one captured file for the assistant', async () => {
  const h = assistantHarness({ legacy: true });
  try {
    h.mic().props.onPress(); await h.settle(); h.dismiss(); await h.settle();
    h.decision.resolve(true); await h.settle(); h.show();
    assert.equal(h.recordings, 1); assert.equal(h.native.starts.length, 0);
    h.mic().props.onPress(); await h.settle();
    assert.deepEqual(h.uploads, [['captured.m4a', 'vi', 'assistant']]);
    assert.equal(h.stopped, 1); assert.equal(h.input(), 'Tôi vừa uống 200 ml nước');
    assert.equal(h.find('asinu-assistant-send').props.disabled, false);
  } finally { h.dispose(); }
});

test('changing accounts cancels an assistant dictation and ignores its remaining words', async () => {
  const h = assistantHarness({ granted: true });
  try {
    h.mic().props.onPress(); await h.settle(); h.native.result('Tôi uống'); await h.settle();
    h.switchAccount(); await h.settle();
    h.native.result('old account text', true); h.native.emit('end'); await h.settle();
    assert.equal(h.input(), ''); assert.equal(h.native.aborted, 1);
    assert.equal(h.native.listeners, 0);
  } finally { h.dispose(); }
});

test('the same assistant chat previews readable medication changes and only applies after explicit confirmation', async () => {
  const applied = [];
  const action = { type: 'medication', planToken: 'private-signed-plan', changes: [
    { operation: 'create', name: 'Hapacol', times: ['07:00'] },
    { operation: 'move', name: 'Vitamin D3', previousTime: '07:00', times: ['08:00'] },
  ] };
  const h = assistantHarness({ assistantPlan: { status: 'ready', question: '', actions: [action] },
    apply: async options => { applied.push(options.actions); return true; } });
  try {
    h.find('asinu-assistant-text').props.onChangeText('Nhắc uống Hapacol mỗi ngày lúc 7 giờ sáng');
    h.find('asinu-assistant-send').props.onPress(); await h.settle();
    assert.deepEqual(applied, []);
    assert.ok(h.find('asinu-assistant-apply'));
    const visible = nodes(h.render({ onClose() {} })).filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
    assert.match(visible, /Nhắc uống Hapacol mỗi ngày lúc 07:00/);
    assert.match(visible, /Đổi giờ uống Vitamin D3 từ 07:00 sang 08:00/);
    assert.ok(!visible.includes('private-signed-plan'));
    h.find('asinu-assistant-apply').props.onPress(); await h.settle();
    assert.deepEqual(applied, [[action]]);
    assert.equal(h.find('asinu-assistant-apply'), undefined);
  } finally { h.dispose(); }
});

test('assistant answers are shown directly, without turning a question into a confirmed write', async () => {
  const h = assistantHarness({ assistantPlan: { status: 'answer', question: '', answer: 'Hôm nay bạn đã ghi 750 ml nước.', actions: [] } });
  try {
    h.find('asinu-assistant-text').props.onChangeText('Hôm nay tôi uống bao nhiêu nước?');
    h.find('asinu-assistant-send').props.onPress(); await h.settle();
    const visible = nodes(h.render({ onClose() {} })).filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
    assert.match(visible, /750 ml/); assert.equal(h.find('asinu-assistant-apply'), undefined);
  } finally { h.dispose(); }
});

test('assistant navigation waits for the real modal dismissal; reminder access still honors notification permission', async () => {
  for (const [destination, granted] of [['medication', true], ['reminders', false]]) {
    const h = assistantHarness({ notificationsGranted: granted, assistantPlan: { status: 'ready', question: '', actions: [{ type: 'navigate', destination }] } });
    try {
      h.find('asinu-assistant-text').props.onChangeText('mở mục này');
      h.find('asinu-assistant-send').props.onPress(); await h.settle();
      assert.deepEqual(h.routes, []);
      if (granted) { h.dismiss(); await h.settle(); assert.deepEqual(h.routes, ['/medication']); }
      else { assert.equal(h.active().phase, 'open'); assert.deepEqual(h.routes, []); }
    } finally { h.dispose(); }
  }
});

test('photo upload uses the existing scan for this account after the picker modal closes, and only prefills reviewed names', async () => {
  const h = assistantHarness({ photo: { canceled: false, assets: [{ uri: 'private-photo' }] } });
  try {
    h.find('asinu-assistant-photo').props.onPress(); await h.settle();
    assert.equal(h.scans.length, 0); h.dismiss(); await h.settle();
    assert.deepEqual(h.scans, [[1, 'photo-file']]);
    assert.match(h.input(), /Hapacol/); assert.equal(h.find('asinu-assistant-apply'), undefined);
  } finally { h.dispose(); }
});

test('history hydration cannot overwrite a new request typed while secure storage is loading', async () => {
  let resolve;
  const restores = [], saved = [];
  const auth = { token: 'owner-a', profile: { id: 'A' } };
  const store = select => select(auth); store.getState = () => auth;
  const h = renderer('src/features/app-assistant/useAssistantConversation.ts', 'useAssistantConversation', {
    '../auth/auth.store': { useAuthStore: store },
    './assistant-conversation.storage': { readAssistantConversation: () => new Promise(done => { resolve = done; }),
      saveAssistantConversation: async (_owner, value) => saved.push(value), clearAssistantConversation: async () => {} },
  });
  let snapshot = { text: '', preview: null, feedback: '', stalePreview: false };
  const render = () => h.render(snapshot, value => restores.push(value));
  try {
    render().edited(); snapshot = { ...snapshot, text: 'new request' }; render();
    resolve({ ...snapshot, text: 'old draft', messages: [{ id: 'old', role: 'assistant', text: 'old reply' }] }); await tick();
    const history = render(); await tick();
    assert.deepEqual(restores, []); assert.equal(history.messages[0].text, 'old reply');
    assert.equal(saved.at(-1).text, 'new request');
  } finally { h.unmount(); }
});

test('a failed history read preserves the old stored conversation instead of overwriting it with an empty one', async () => {
  const auth = { token: 'owner-a', profile: { id: 'A' } };
  const store = select => select(auth); store.getState = () => auth;
  let writes = 0;
  const h = renderer('src/features/app-assistant/useAssistantConversation.ts', 'useAssistantConversation', {
    '../auth/auth.store': { useAuthStore: store },
    './assistant-conversation.storage': { readAssistantConversation: async () => { throw Error('device locked'); },
      saveAssistantConversation: async () => { writes++; }, clearAssistantConversation: async () => {} },
  });
  try {
    const snapshot = { text: '', preview: null, feedback: '', stalePreview: false };
    h.render(snapshot, () => assert.fail('Unread history must not hydrate')); await tick();
    const value = h.render({ ...snapshot, text: 'new input' }, () => {}); await tick();
    assert.equal(value.storageError, true); assert.equal(writes, 0);
  } finally { h.unmount(); }
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
