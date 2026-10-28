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
let effect;
const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(ast) === "useEffect" &&
    node.arguments[0]?.getText(ast).includes("responseRetries.current.question")
  )
    effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(effect, "Test must exercise the real response timer effect");
const code = ts.transpileModule(
  `const {q,session,busy,recording,voiceOption,error,pending,audioState,responseRetries,screenEpoch,focused,inFlight,recorder,state,replay,sendSkip,setTimeout,clearTimeout}=context;return (${effect})();`,
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
  "PASS actual QR-10 timer replays once then skips, excludes narration/recording/uploads, and rejects stale/background/answer races"
);
