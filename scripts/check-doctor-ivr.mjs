import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";
function evaluate(file, modules, isDevelopment = true) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  // Execute trusted project TypeScript with deterministic native dependencies.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", "__DEV__", output)(
    module,
    module.exports,
    (name) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    isDevelopment
  );
  return module.exports;
}
const memory = new Map(),
  files = new Set(["file:///original.m4a"]);
let failStorage = false;
const storage = {
  getAllKeys: async () => [...memory.keys()],
  multiGet: async (keys) => keys.map((k) => [k, memory.get(k)]),
  setItem: async (k, v) => {
    if (failStorage) throw new Error("Storage full");
    memory.set(k, v);
  },
  removeItem: async (k) => memory.delete(k),
  multiRemove: async (keys) => keys.forEach((k) => memory.delete(k)),
};
const fileSystem = {
  documentDirectory: "file:///private/",
  makeDirectoryAsync: async () => {},
  copyAsync: async ({ from, to }) => {
    assert.ok(files.has(from));
    files.add(to);
  },
  deleteAsync: async (uri) => {
    for (const file of [...files])
      if (file === uri || file.startsWith(uri)) files.delete(file);
  },
};
const queue = evaluate("src/features/doctor-ivr/ivr-voice-queue.ts", {
  "@react-native-async-storage/async-storage": storage,
  "expo-file-system/legacy": fileSystem,
});
const first = await queue.savePendingVoice(
  "patient-a",
  "session-a",
  "file:///original.m4a",
  {
    request_id: "request-1",
    question_id: "q1",
    option_id: "q1_x",
    revision: "0",
  }
);
assert.ok(first.uri.startsWith("file:///private/doctor-ivr-voice/patient-a-"));
assert.equal(
  (await queue.listPendingVoices("patient-a", "session-a"))[0].fields
    .request_id,
  "request-1"
);
assert.equal(
  (await queue.listPendingVoices("patient-b", "session-a")).length,
  0
);
assert.equal(
  (await queue.listPendingVoices("patient-a", "session-b")).length,
  0
);
const originalCount = files.size;
failStorage = true;
await assert.rejects(
  queue.savePendingVoice("patient-a", "session-a", "file:///original.m4a", {
    request_id: "request-failed",
  })
);
assert.equal(
  files.size,
  originalCount,
  "A failed metadata write must not leave an orphan original"
);
failStorage = false;
await queue.removePendingVoice(first);
assert.equal(files.has(first.uri), false);
assert.equal(
  (await queue.listPendingVoices("patient-a", "session-a")).length,
  0
);
await queue.savePendingVoice("patient-a", "session-a", "file:///original.m4a", {
  request_id: "request-2",
});
await queue.clearIvrVoiceQueue();
assert.equal(memory.size, 0);
assert.equal(
  [...files].some((p) => p.includes("doctor-ivr-voice")),
  false
);
console.log(
  "PASS original recording survives retries, stays scoped to its patient/session and is removed on logout"
);

let token = "token-a",
  resolveRequest;
const calls = [];
const api = evaluate("src/features/doctor-ivr/ivr.api.ts", {
  "../../lib/tokenStore": {
    tokenStore: { getToken: () => token, loadToken: async () => token },
  },
  "../../lib/apiClient": {
    apiClient: async (path, options) => {
      calls.push({ path, options });
      if (resolveRequest === true)
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      return { ok: true, enabled: true, data: { id: "session-a" } };
    },
  },
}).ivrApi;
assert.equal((await api.get("session-a")).id, "session-a");
assert.equal(calls[0].options.headers.Authorization, "Bearer token-a");
await api.list("clinic / a", "task / a");
assert.match(calls.at(-1).path, /clinic%20%2F%20a/);
resolveRequest = true;
const stale = api.get("session-a");
await Promise.resolve();
token = "token-b";
resolveRequest({ ok: true, data: { id: "private-old-patient" } });
await assert.rejects(stale, /Session changed/);
console.log(
  "PASS the API preserves authorization and rejects responses after the active account changes"
);

const { canAcceptIvrSnapshot } = evaluate(
  "src/features/doctor-ivr/ivr-state.ts",
  {}
);
const snapshot = { id: "session-a", status: "in_progress", revision: 3 };
assert.equal(
  canAcceptIvrSnapshot(snapshot, { ...snapshot, revision: 2 }),
  false
);
assert.equal(
  canAcceptIvrSnapshot(
    { ...snapshot, status: "reported" },
    { ...snapshot, status: "completed" }
  ),
  false
);
assert.equal(
  canAcceptIvrSnapshot(snapshot, { ...snapshot, revision: 4 }),
  true
);
assert.equal(
  canAcceptIvrSnapshot(
    { ...snapshot, status: "replied" },
    { ...snapshot, status: "closed" }
  ),
  true
);
console.log(
  "PASS delayed polls/uploads cannot undo answers, reports or replies; a newer Back revision is accepted"
);

const screenSource = fs.readFileSync(
  "app/doctor-interview/[sessionId].tsx",
  "utf8"
);
const ast = ts.createSourceFile(
  "screen.tsx",
  screenSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const handlers = {};
function findHandlers(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ["act", "select", "beginRecording", "load", "waitForSpeech"].includes(node.name.getText(ast))
  )
    handlers[node.name.getText(ast)] = node.initializer.getText(ast);
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "onState")
    handlers.onState = node.initializer.getText(ast);
  ts.forEachChild(node, findHandlers);
}
findHandlers(ast);
function interaction({ voice = false } = {}) {
  const option = {
    id: "q1_a",
    key: 1,
    label: "Có",
    type: voice ? "voice" : "option",
  };
  const current = {
    id: "session-a",
    current_question_id: "q1",
    revision: 2,
    content: { questions: [{ id: "q1", options: [option] }] },
  };
  const state = { current },
    focused = { current: true },
    screenEpoch = { current: 1 },
    inFlight = { current: false };
  const events = [],
    requests = [], readbacks = [];
  let finishReadback;
  const speech = new Promise(resolve => { finishReadback = resolve; });
  let resolvePoll;
  const poll = new Promise(resolve => { resolvePoll = resolve; });
  let resolve, rejectRequest;
  const response = new Promise((yes, no) => {
    resolve = yes;
    rejectRequest = no;
  });
  const code = ts.transpileModule(
    `const {state,focused,screenEpoch,inFlight,events,requests,response,speech,readbacks,poll} = dependencies;
    const id='session-a', busy=false, recording=false, voiceOption=null, pending=[], pendingOption={current:null}, recordingConsented={current:false},validId=true,useCallback=fn=>fn,setLoading=()=>{},getApiErrorMessage=e=>e.message;
    const setBusy=value=>events.push(['busy',value]),setError=()=>{},setSelectedOption=value=>events.push(['selected',value]),setVoiceOption=value=>events.push(['voice',value]),setAiConsent=value=>events.push(['consent',value]),setConsentVisible=value=>events.push(['recordingConsent',value]);
    const audio={current:{stop:()=>{events.push(['stop']);return new Promise(()=>{});}}};
    const waitForSpeech=async(key,text,limit)=>{readbacks.push({key,text,limit});events.push(['readback',text]);await speech;},t=(key,values)=>'Bạn đã chọn: '+values.answer;
    const ivrApi={get:()=>poll,act:async(id,input)=>{requests.push(input);return response;}},Crypto={randomUUID:()=> 'request-a'};
    const accept=value=>{if(focused.current){events.push(['accept',value]);state.current=value;}}, fail=e=>events.push(['error',e.message]),ApiError=class extends Error{},hasAiDataConsent=async()=>false,beginRecording=async()=>events.push(['record']);
    const load=${handlers.load};const act=${handlers.act};const select=${handlers.select};return {act,select,load};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }
  ).outputText;
  // Exercise the real handlers extracted from the local screen, without a native runtime.
  // eslint-disable-next-line no-new-func
  const actions = new Function("dependencies", code)({
    state,
    focused,
    screenEpoch,
    inFlight,
    events,
    requests,
    response,
    speech,
    readbacks,
    poll,
  });
  return {
    ...actions,
    option,
    state,
    focused,
    screenEpoch,
    events,
    requests,
    resolve,
    rejectRequest,
    finishReadback,
    readbacks,
    inFlight,
    resolvePoll,
  };
}
const h = interaction();
const latePoll = h.load();
const choosing = h.select(h.option);
assert.equal(
  h.requests.length,
  1,
  "A tap must submit without awaiting native speech cancellation"
);
await h.select(h.option);
assert.equal(
  h.requests.length,
  1,
  "Double taps while saving must not submit twice"
);
const next = {
  ...h.state.current,
  current_question_id: "q2",
  revision: 3,
  content: { questions: [{ id: "q2", options: [{ id: "q2_a" }] }] },
};
h.resolve(next);
await new Promise(resolve => setImmediate(resolve));
assert.equal(h.state.current.current_question_id, "q1", "Keep the current question during confirmation");
assert.equal(h.readbacks.length, 1);
assert.equal(h.readbacks[0].text, "Bạn đã chọn: Có");
assert.equal(h.inFlight.current, true);
h.resolvePoll(next);
await latePoll;
assert.equal(h.state.current.current_question_id, "q1", "A late poll must not bypass confirmation");
await h.select(h.option);
assert.equal(h.requests.length, 1, "Taps during confirmation cannot submit another answer");
h.finishReadback();
await Promise.race([
  choosing,
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Next choices did not follow the completed readback")), 500)
  ),
]);
assert.equal(h.state.current.current_question_id, "q2");
assert.equal(h.events.filter((e) => e[0] === "accept").length, 1);
await h.select(h.option);
assert.equal(
  h.requests.length,
  1,
  "A queued tap from the old question must not answer the next one"
);
const offscreen = interaction();
const leaving = offscreen.select(offscreen.option);
offscreen.focused.current = false;
offscreen.screenEpoch.current++;
offscreen.resolve(next);
await leaving;
assert.equal(
  offscreen.events.some((e) => e[0] === "accept"),
  false
);
const interruptedReadback = interaction();
const confirming = interruptedReadback.select(interruptedReadback.option);
interruptedReadback.resolve(next);
await new Promise(resolve => setImmediate(resolve));
assert.equal(interruptedReadback.readbacks.length, 1);
interruptedReadback.focused.current = false;
interruptedReadback.screenEpoch.current++;
interruptedReadback.finishReadback();
await confirming;
assert.equal(interruptedReadback.state.current.current_question_id, "q1",
  "Leaving during confirmation must not reveal the next question offscreen");
assert.equal(interruptedReadback.inFlight.current, false);
const failed = interaction();
const failing = failed.select(failed.option);
failed.rejectRequest(new Error("Connection interrupted"));
await failing;
assert.equal(failed.state.current.current_question_id, "q1");
assert.equal(failed.readbacks.length, 0, "Do not confirm an answer that failed to save");
assert.equal(failed.events.at(-1)[0], "selected");
assert.equal(failed.events.at(-1)[1], null);
await failed.select(failed.option);
assert.equal(failed.requests.length, 2, "Saving errors must leave the current answer retryable");
const recordingChoice = interaction({ voice: true });
await recordingChoice.select(recordingChoice.option);
assert.equal(recordingChoice.requests.length, 0);
assert.equal(
  recordingChoice.events.some((e) => e[0] === "consent"),
  true
);
assert.equal(
  recordingChoice.events.some((e) => e[0] === "record"),
  false
);
console.log(
  "PASS answers save immediately, read back once before advancing, reject duplicate taps and never confirm failed saves"
);

// Exercise the real waiter and audio state callback with the shared player.
// Only the native speech bridge and clock are controlled by this test.
const { CheckinCallAudio: ReadbackAudio } = evaluate(
  "src/features/checkin-call/checkin-call.audio.ts", {}
);
for (const outcome of ["done", "error", "timeout", "cancel", "unavailable"]) {
  const timers = new Map(), states = [];
  let timerId = 0, callbacks, settled = false;
  const code = ts.transpileModule(`
    const {timers,states,schedule}=dependencies;
    const promptWaiter={current:null},audio={current:null},focused={current:true};
    const useCallback=fn=>fn,setAudioState=value=>states.push(value);
    const setTimeout=schedule,clearTimeout=id=>timers.delete(id);
    const waitForSpeech=${handlers.waitForSpeech};
    const onState=${handlers.onState};
    return {audio,waitForSpeech,onState};
  `, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  // eslint-disable-next-line no-new-func
  const bridge = new Function("dependencies", code)({
    timers, states,
    schedule: (run, delay) => { const id = ++timerId; timers.set(id, { run, delay }); return id; },
  });
  const player = new ReadbackAudio({
    load: async () => { throw new Error("Use device speech for confirmation"); },
    prepare: async () => {},
    create: async () => { throw new Error("Unexpected recording playback"); },
    stopSpeech: async () => {},
    speak: (_prompt, events) => { callbacks = events; events.onStart(); },
    onState: bridge.onState,
  });
  if (outcome !== "unavailable") bridge.audio.current = player;
  const result = bridge.waitForSpeech("selected:answer", "Bạn đã chọn: Có", 10000)
    .then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  if (outcome !== "unavailable") {
    assert.equal(settled, false, "Starting speech cannot advance the question");
    assert.equal(states.at(-1).phase, "playing");
    if (outcome === "done") callbacks.onDone();
    if (outcome === "error") callbacks.onError();
    if (outcome === "cancel") await player.stop();
    if (outcome === "timeout") {
      const timer = [...timers.values()][0];
      assert.equal(timer.delay, 10000);
      timer.run();
    }
  }
  await result;
  assert.equal(settled, true, `${outcome} must release the transition`);
  assert.equal(timers.size, 0, "Completion and cancellation must clear the guard timer");
  await player.stop(true);
  player.dispose();
}
console.log("PASS actual readback waits for speech completion and cannot strand the session on audio error, timeout, interruption or missing audio");

for (const maximum of [30, 60]) {
  const recordingState = { option: null, seconds: null };
  const code = ts.transpileModule(`
    const {recordingState,maximum}=dependencies;
    const option={id:'voice',type:'voice',max_record_s:maximum};
    const pendingOption={current:option},state={current:{current_question_id:maximum===60?'q_final':'q2'}},focused={current:true};
    const recordingConsented={current:false},voiceStartVersion={current:0},cue={current:null},recorder={current:null},heardSound={current:false},lastSound={current:0},recordingStart={current:0};
    const setVoiceOption=value=>{recordingState.option=value;},setSeconds=value=>{recordingState.seconds=value;};
    const setBusy=()=>{},setError=()=>{},setRecording=()=>{},setConsentVisible=()=>{},t=key=>key,waitForSpeech=async()=>{},Crypto={randomUUID:()=> 'instruction-test'},fail=e=>{throw e;};
    const require=()=> 'beep.wav',FileSystem={deleteAsync:async()=>{}},audio={current:{stop:async()=>{}}};
    const Audio={requestPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{},RecordingOptionsPresets:{HIGH_QUALITY:{}},Sound:{createAsync:async()=>({sound:{play:()=>{},unloadAsync:async()=>{}}})},Recording:{createAsync:async()=>({recording:{stopAndUnloadAsync:async()=>{},getURI:()=> 'file:///voice.m4a'}})}};
    const beginRecording=${handlers.beginRecording};return beginRecording();
  `, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  // The real modal clears voiceOption before Agree invokes this local handler.
  // eslint-disable-next-line no-new-func
  await new Function("dependencies", code)({ recordingState, maximum });
  assert.equal(recordingState.option.max_record_s, maximum);
  assert.equal(recordingState.seconds, maximum);
}
console.log("PASS dismissing recording consent preserves 30-second answers and the 60-second final question");

const theme = evaluate("src/styles/theme.ts", {});
function renderQuestion(phase, disabled = false, isDark = false, recording = false) {
  const catalog = JSON.parse(
    fs.readFileSync("src/i18n/locales/vi/home.json", "utf8")
  );
  const t = (key, values = {}) =>
    key
      .split(".")
      .reduce((v, k) => v[k], catalog)
      .replace(/\{\{(\w+)\}\}/g, (_, k) => String(values[k] ?? ""));
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync("src/features/doctor-ivr/DoctorIvrQuestion.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText;
  const adapters = {
    "react/jsx-runtime": {
      jsx: React.createElement,
      jsxs: React.createElement,
    },
    "react-native": {
      ActivityIndicator: "Spinner",
      Image: "Image",
      Pressable: "Button",
      View: "View",
      StyleSheet: { create: (v) => v },
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react-i18next": { useTranslation: () => ({ t }) },
    "../../components/ScaledText": { ScaledText: "Text" },
    "../../hooks/useThemeColors": {
      useThemeColors: () => ({
        colors: isDark ? theme.darkColors : theme.lightColors,
      }),
    },
    "../../styles/theme": theme,
  };
  // Render trusted component JSX against native adapters to inspect actual button state.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", code)(
    module,
    module.exports,
    (name) => {
      if (name.endsWith(".png")) return name;
      assert.ok(name in adapters, name);
      return adapters[name];
    }
  );
  const tree = module.exports.DoctorIvrQuestion({
    question: {
      id: "q1",
      text: "Bác thường khó ngủ theo cách nào?",
      options: [
        { id: "q1_a", key: 1, label: "Khó vào giấc ngủ", type: "option" },
        { id: "q1_b", key: 2, label: "Thức giấc giữa đêm", type: "option" },
        { id: "q1_x", key: 3, label: "Khác, nói câu trả lời", type: "voice" },
      ],
    },
    index: 0,
    total: 4,
    disabled,
    selectedOptionId: disabled ? "q1_a" : null,
    audioPhase: phase,
    recording,
    onSelect: () => {},
    onReplay: () => {},
    onStopAudio: () => {},
  });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  return nodes;
}
for (const phase of ["loading", "playing", "finished"])
  for (const dark of [false, true]) {
    const choices = renderQuestion(phase, false, dark).filter(
      (n) =>
        n.type === "Button" && /^\d\./.test(n.props.accessibilityLabel || "")
    );
    assert.equal(choices.length, 3);
    assert.ok(
      choices.every((n) => n.props.disabled === false),
      "All choices must be enabled while narration loads or plays"
    );
    assert.ok(
      choices.every((n) => n.props.style({ pressed: false })[0].minHeight >= 56)
    );
  }
assert.ok(
  renderQuestion("playing", true)
    .filter((n) => n.type === "Button")
    .every((n) => n.props.disabled)
);
console.log(
  "PASS rendered questions keep every answer available during narration in both themes, with large text and touch targets"
);
const recordingQuestion = renderQuestion("idle", true, false, true);
assert.ok(recordingQuestion.some(n => n.props.accessibilityRole === "header"));
assert.equal(recordingQuestion.filter(n => n.type === "Button" && /^\d\./.test(n.props.accessibilityLabel || "")).length, 0);
console.log("PASS recording keeps the current question visible without an inactive answer list");

for (const runtime of [false, true]) for (const enabled of [false, true]) {
  const { default: PreviewRoute } = evaluate("app/doctor-interview/preview.tsx", {
    "react/jsx-runtime": await import("react/jsx-runtime"),
    "expo-router": { Redirect: "Redirect" },
    "../../src/lib/appEnv": { isCheckinUiGalleryEnabled: enabled },
    "../../src/features/doctor-ivr/DoctorIvrPreview": { DoctorIvrPreview: "Preview" },
  }, runtime);
  const rendered = PreviewRoute();
  assert.equal(rendered.type, runtime && enabled ? "Preview" : "Redirect");
  if (rendered.type === "Redirect") assert.equal(rendered.props.href, "/(tabs)/profile");
}
console.log("PASS direct Doctor preview links stay closed outside the development runtime and environment");
