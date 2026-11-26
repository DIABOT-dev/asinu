import assert from "node:assert/strict";
import { File as NodeFile } from "node:buffer";
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
const fixtureRecording = Buffer.from("synthetic recording bytes");
const { ivrApi: api, answerAudioKey, hasDoctorIvrReply } = evaluate("src/features/doctor-ivr/ivr.api.ts", {
  "expo-file-system": {
    File: class extends NodeFile {
      constructor(uri) {
        assert.equal(uri, "file:///queued.m4a");
        super([fixtureRecording], "queued.m4a", { type: "audio/mp4" });
      }
    },
  },
  "react-native": { Platform: { OS: "ios" } },
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
});
assert.equal(hasDoctorIvrReply({ doctor_reply: null }), false);
assert.equal(hasDoctorIvrReply({ doctor_reply: "Fixture text" }), true);
assert.equal(hasDoctorIvrReply({ doctor_reply: null, doctor_reply_video: { url: null } }), true);
assert.equal((await api.get("session-a")).id, "session-a");
assert.equal(calls[0].options.headers.Authorization, "Bearer token-a");
await api.list("clinic / a", "task / a");
assert.match(calls.at(-1).path, /clinic%20%2F%20a/);
await api.answerAudio("session-a", "q1", "q1_a");
assert.equal(calls.at(-1).path, "/api/doctor/ivr/sessions/session-a/audio/q1/answers/q1_a");
await api.closingAudio("session-a");
assert.equal(calls.at(-1).path, "/api/doctor/ivr/sessions/session-a/closing-audio");
await api.voice("session-a", { question_id: "q_final" }, "file:///queued.m4a");
const upload = calls.at(-1);
assert.equal(upload.path, "/api/doctor/ivr/sessions/session-a/voice");
assert.equal(upload.options.body.get("question_id"), "q_final");
const recordingPart = upload.options.body.get("file");
assert.ok(recordingPart instanceof NodeFile);
assert.equal(recordingPart.type, "audio/mp4");
assert.deepEqual(Buffer.from(await recordingPart.arrayBuffer()), fixtureRecording);
resolveRequest = true;
const stale = api.get("session-a");
await Promise.resolve();
token = "token-b";
resolveRequest({ ok: true, data: { id: "private-old-patient" } });
await assert.rejects(stale, /Session changed/);
console.log(
  "PASS the API preserves authorization and rejects responses after the active account changes"
);

const { canAcceptIvrSnapshot, ivrInvitationUnavailable, splitReplyForSpeech } = evaluate(
  "src/features/doctor-ivr/ivr-state.ts",
  {}
);
assert.equal(ivrInvitationUnavailable("sent"), null);
assert.equal(ivrInvitationUnavailable("in_progress"), null);
assert.equal(ivrInvitationUnavailable("draft"), "preparing");
assert.equal(ivrInvitationUnavailable("cancelled"), "cancelled");
assert.equal(ivrInvitationUnavailable("expired"), "expired");
assert.equal(ivrInvitationUnavailable("reported"), "ended");
console.log("PASS the invitation can only start or resume a live questionnaire");
const completeReply = "Một đoạn trong lời giải thích cho bệnh nhân. ".repeat(180).trim();
const sections = splitReplyForSpeech(completeReply, 900);
assert.ok(sections.every((section) => section.length <= 900));
assert.equal(sections.join(" "), completeReply);
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
  if (
    ts.isPropertyAssignment(node) &&
    ["allowDeviceSpeech", "load", "onState"].includes(node.name.getText(ast))
  ) {
    const name = node.name.getText(ast);
    handlers[name === "load" ? "loadPrompt" : name] = node.initializer.getText(ast);
  }
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
    `const {state,focused,screenEpoch,inFlight,events,requests,response,speech,readbacks,poll,answerAudioKey} = dependencies;
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
    answerAudioKey,
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
assert.equal(h.readbacks[0].key, "selected:q1:q1_a");
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
// The audio download, native player and clock are controlled by this test.
const { CheckinCallAudio: ReadbackAudio } = evaluate(
  "src/features/checkin-call/checkin-call.audio.ts", {}
);
for (const outcome of ["done", "error", "unavailableAudio", "timeout", "cancel", "unavailable"]) {
  const timers = new Map(), states = [];
  const key = answerAudioKey("q1", "q1_a");
  let timerId = 0, playback, settled = false, deviceSpoken = false;
  const code = ts.transpileModule(`
    const {timers,states,schedule,loadPromptAudio}=dependencies;
    const promptWaiter={current:null},audio={current:null},focused={current:true};
    const useCallback=fn=>fn,setAudioState=value=>states.push(value);
    const setTimeout=schedule,clearTimeout=id=>timers.delete(id);
    const waitForSpeech=${handlers.waitForSpeech};
    const onState=${handlers.onState};
    return {audio,waitForSpeech,onState,load:${handlers.loadPrompt},allowDeviceSpeech:${handlers.allowDeviceSpeech}};
  `, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  // eslint-disable-next-line no-new-func
  const bridge = new Function("dependencies", code)({
    timers, states,
    schedule: (run, delay) => { const id = ++timerId; timers.set(id, { run, delay }); return id; },
    loadPromptAudio: async (promptKey) => {
      assert.equal(promptKey, key);
      if (outcome === "unavailableAudio") throw new Error("Offline");
      return "file:///vieneu-confirmation.wav";
    },
  });
  const player = new ReadbackAudio({
    load: bridge.load,
    prepare: async () => {},
    create: async (uri) => {
      assert.equal(uri, "file:///vieneu-confirmation.wav");
      return {
        setOnPlaybackStatusUpdate: (listener) => { playback = listener; },
        play: () => playback({ playing: true }),
        pauseAsync: async () => {},
        unloadAsync: async () => {},
      };
    },
    stopSpeech: async () => {},
    allowDeviceSpeech: bridge.allowDeviceSpeech,
    speak: (_prompt, events) => { deviceSpoken = true; events.onDone(); },
    onState: bridge.onState,
  });
  for (const promptKey of [key, "question:q2", "instruction", "skipped", "closing"])
    assert.equal(bridge.allowDeviceSpeech({ key: promptKey }), false);
  if (outcome !== "unavailable") bridge.audio.current = player;
  const result = bridge.waitForSpeech(key, "Bạn đã chọn: Có", 10000)
    .then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  if (outcome === "unavailableAudio") {
    assert.equal(states.at(-1).phase, "error");
  } else if (outcome !== "unavailable") {
    assert.equal(settled, false, "Starting speech cannot advance the question");
    assert.equal(states.at(-1).phase, "playing");
    if (outcome === "done") playback({ didJustFinish: true });
    if (outcome === "error") playback({ error: "Cannot decode audio" });
    if (outcome === "cancel") await player.stop();
    if (outcome === "timeout") {
      const timer = [...timers.values()][0];
      assert.equal(timer.delay, 10000);
      timer.run();
    }
  }
  await result;
  assert.equal(deviceSpoken, false, "Confirmations must never switch to device speech");
  assert.equal(settled, true, `${outcome} must release the transition`);
  assert.equal(timers.size, 0, "Completion and cancellation must clear the guard timer");
  await player.stop(true);
  player.dispose();
}
console.log("PASS actual readback waits for speech completion and cannot strand the session on audio error, timeout, interruption or missing audio");

const previewAst = ts.createSourceFile(
  "preview.tsx",
  fs.readFileSync("src/features/doctor-ivr/DoctorIvrPreview.tsx", "utf8"),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
);
const previewAudio = {};
function findPreviewAudio(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(previewAst) === "previewAnswers")
    previewAudio.answers = node.initializer.getText(previewAst);
  if (ts.isNewExpression(node) && node.expression.getText(previewAst) === "CheckinCallAudio")
    previewAudio.dependencies = node.arguments[0].getText(previewAst);
  ts.forEachChild(node, findPreviewAudio);
}
findPreviewAudio(previewAst);
const clips = Object.fromEntries(["vi", "en"].map((language) => [language,
  Object.fromEntries(["often", "sometimes", "no", "normal", "rest", "stopped", "yes"].map((key) => {
    const file = `assets/sounds/ivr-confirmation/${language}-${key}.mp3`;
    assert.ok(fs.statSync(file).size > 1000);
    return [key, file];
  }))
]));
for (const { language, fail } of [{ language: "vi", fail: false }, { language: "en", fail: true }]) {
  const code = ts.transpileModule(`
    const {language, ivrAnswerAudio, loaded, device, status, Audio} = input;
    const active={current:true},promptWaiter={current:null},currentState={current:{speechRate:0.9}};
    const setState=fn=>status.push(fn({}).audioState);
    const loadIvrAnswerAudio=async (file)=>{loaded.push(file);return file;};
    const Speech={stop:async()=>{},speak:(text)=>device.push(text)};
    const previewAnswers=${previewAudio.answers};
    return ${previewAudio.dependencies};
  `, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = [], device = [], status = [], played = [];
  const Audio = {
    setAudioModeAsync: async () => {},
    Sound: { createAsync: async ({ uri }) => {
      if (fail) throw new Error("Cannot decode the audio");
      let update;
      return { sound: {
        setRateAsync: async () => {},
        setOnPlaybackStatusUpdate: (listener) => { update = listener; },
        play: () => { played.push(uri); update({ didJustFinish: true }); },
        pauseAsync: async () => {},
        unloadAsync: async () => {},
      } };
    } },
  };
  const deps = new Function("input", code)({ language, ivrAnswerAudio: clips, loaded, device, status, Audio });
  const prompt = { key: answerAudioKey("q3", "q3_a"), text: "Yes", language };
  const player = new ReadbackAudio(deps);
  await player.play(prompt);
  assert.deepEqual(loaded, [clips[language].yes]);
  assert.deepEqual(device, []);
  assert.deepEqual(played, fail ? [] : [clips[language].yes]);
  assert.equal(status.at(-1).phase, fail ? "error" : "finished");
  await player.stop(true);
  player.dispose();
}
console.log("PASS preview confirms the Yes choice with its bundled Tuấn Anh recording in each language");

for (const maximum of [30, 60]) {
  const recordingState = { option: null, seconds: null, cueKeepsAudioSession: false };
  const code = ts.transpileModule(`
    const {recordingState,maximum}=dependencies;
    const option={id:'voice',type:'voice',max_record_s:maximum};
    const pendingOption={current:option},state={current:{current_question_id:maximum===60?'q_final':'q2'}},focused={current:true};
    const recordingConsented={current:false},voiceStartVersion={current:0},cue={current:null},recorder={current:null},hasMetering={current:false},heardSound={current:false},recordingStart={current:0};
    let clock=1000;const Date={now:()=>clock};
    const setVoiceOption=value=>{recordingState.option=value;},setSeconds=value=>{recordingState.seconds=value;};
    const setBusy=()=>{},setError=()=>{},setRecording=()=>{},setConsentVisible=()=>{},t=key=>key,waitForSpeech=async()=>{},fail=e=>{throw e;};
    const require=()=> 'beep.wav',FileSystem={deleteAsync:async()=>{}},audio={current:{stop:async()=>{}}};
    const Audio={requestPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{},RecordingOptionsPresets:{HIGH_QUALITY:{}},Sound:{createAsync:async(source, options)=>{
      recordingState.cueKeepsAudioSession=options.keepAudioSessionActive;
      return {sound:{play:()=>{},unloadAsync:async()=>{}}};
    }},Recording:{createAsync:async()=>{
      clock+=2200;return {recording:{stopAndUnloadAsync:async()=>{},getURI:()=> 'file:///voice.m4a'}};
    }}};
    const beginRecording=${handlers.beginRecording};return beginRecording().then(()=>recordingStart.current);
  `, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  // The real modal clears voiceOption before Agree invokes this local handler.
  // eslint-disable-next-line no-new-func
  const startedAt = await new Function("dependencies", code)({ recordingState, maximum });
  assert.equal(recordingState.option.max_record_s, maximum);
  assert.equal(recordingState.seconds, maximum);
  assert.equal(startedAt, 3200, "Microphone setup time must not consume the recording window");
  assert.equal(recordingState.cueKeepsAudioSession, true, "Ending the beep must not deactivate the iOS recorder's audio session");
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
