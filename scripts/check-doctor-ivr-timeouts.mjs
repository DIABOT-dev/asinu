import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync("app/doctor-interview/[sessionId].tsx", "utf8");
const ast = ts.createSourceFile(
  "screen.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
let effect, recordingEffect;
const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(ast) === "useEffect" &&
    node.arguments[0]?.getText(ast).includes("responseRetries.current.question")
  )
    effect = node.arguments[0].getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" &&
      node.arguments[0]?.getText(ast).includes("finishRecording.current"))
    recordingEffect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(effect, "Test must exercise the real response timer effect");
const code = ts.transpileModule(
  `const {q,session,params,busy,recording,voiceOption,error,pending,audioState,responseRetries,screenEpoch,focused,inFlight,recorder,state,replay,sendSkip,setTimeout,clearTimeout}=context;return (${effect})();`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } }
).outputText;
// Execute trusted screen logic with a controlled native clock; no reimplementation.
// eslint-disable-next-line no-new-func
const run = new Function("context", code);
const setup = (patch = {}) => {
  const timers = new Map(),
    events = [];
  let sequence = 0;
  const context = {
    q: { id: "q1" },
    session: { status: "in_progress", response_timeout_seconds: 10 },
    params: { callAttempt: "fixture-call" },
    busy: false,
    recording: false,
    voiceOption: null,
    error: null,
    pending: [],
    audioState: { phase: "finished" },
    responseRetries: { current: { question: "", count: 0 } },
    screenEpoch: { current: 1 },
    focused: { current: true },
    inFlight: { current: false },
    recorder: { current: null },
    state: { current: { current_question_id: "q1" } },
    replay: () => events.push("replay"),
    sendSkip: (reason) => events.push(reason),
    setTimeout: (fn, delay) => {
      const id = ++sequence;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    ...patch,
  };
  return { context, timers, events };
};
const flow = setup();
let dispose = run(flow.context);
assert.equal(flow.timers.size, 1);
assert.equal([...flow.timers.values()][0].delay, 10000);
assert.deepEqual(flow.events, []);
[...flow.timers.values()][0].fn();
assert.deepEqual(flow.events, ["replay"]);
dispose();
dispose = run(flow.context);
[...flow.timers.values()][0].fn();
assert.deepEqual(flow.events, ["replay", "no_response"]);
dispose();
for (const patch of [
  { params: {} },
  { audioState: { phase: "playing" } },
  { audioState: { phase: "loading" } },
  { busy: true },
  { recording: true },
  { voiceOption: {} },
  { error: "offline" },
  { pending: [{ fields: { question_id: "q1" } }] },
]) {
  const item = setup(patch);
  run(item.context);
  assert.equal(item.timers.size, 0, JSON.stringify(patch));
}
for (const change of [
  (c) => {
    c.focused.current = false;
  },
  (c) => {
    c.screenEpoch.current++;
  },
  (c) => {
    c.inFlight.current = true;
  },
  (c) => {
    c.state.current.current_question_id = "q2";
  },
]) {
  const item = setup(),
    cleanup = run(item.context);
  change(item.context);
  [...item.timers.values()][0].fn();
  assert.deepEqual(item.events, []);
  cleanup();
  assert.equal(item.timers.size, 0);
}
console.log(
  "PASS in-app questions have no response timer; calls retry once, with playback, recording, uploads and stale events excluded"
);

assert.ok(recordingEffect);
const runRecording = new Function("context", ts.transpileModule(
  `const {recording,voiceOption,recorder,recordingStart,finishRecording,setSeconds,Date,setInterval,clearInterval}=context;
   return (${recordingEffect})();`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } }
).outputText);
function recordingTimer(limit) {
  let now = 10000, tick, finished = 0, remaining;
  runRecording({
    recording: true, voiceOption: { max_record_s: limit }, recorder: { current: {} },
    recordingStart: { current: now },
    finishRecording: { current: () => finished++ }, setSeconds: (value) => { remaining = value; },
    Date: { now: () => now }, setInterval: (fn) => { tick = fn; }, clearInterval: () => {},
  });
  return {
    silence(ms) { now += ms; tick(); return { finished, remaining }; },
  };
}
for (const limit of [30, 60]) {
  const voice = recordingTimer(limit);
  assert.deepEqual(voice.silence(3000), { finished: 0, remaining: limit - 3 });
  assert.deepEqual(voice.silence((limit - 3) * 1000 - 1), { finished: 0, remaining: 1 });
  assert.deepEqual(voice.silence(1), { finished: 1, remaining: 0 });
}
console.log("PASS silence never sends a recording automatically before its 30 or 60-second limit");
