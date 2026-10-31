import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import ts from "typescript";
import { randomUUID } from "node:crypto";

// Execute the actual response screen; replace only hooks, network and native I/O.
// Deferred promises reproduce device conflicts and out-of-order network replies.
const code = ts.transpileModule(
  fs.readFileSync("app/medication/call/[doseId].tsx", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }
).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const detail = (state = "CALLING", extra = {}) => ({
  event: { id: "dose", state, checkin_pending: false },
  items: [],
  canAnswer: state === "CALLING",
  ...extra,
});

function harness({
  dose = async () => detail(),
  answer = async () => ({ event: { state: "SKIPPED" }, needsCheckin: false }),
  pending = null,
} = {}) {
  const hooks = [],
    effects = [],
    intervals = new Map(),
    audio = [],
    answers = [],
    checkins = [],
    errors = [];
  const auth = { profile: { id: 2 }, token: "session-a" };
  const params = { doseId: "dose" };
  let cursor = 0,
    dirty = true,
    tree,
    mounted = true;
  const index = () => cursor++;
  const react = {
    useState: (initial) => {
      const i = index();
      if (!(i in hooks)) hooks[i] = { value: initial };
      return [
        hooks[i].value,
        (value) => {
          hooks[i].value =
            typeof value === "function" ? value(hooks[i].value) : value;
          dirty = true;
        },
      ];
    },
    useRef: (initial) => {
      const i = index();
      return (hooks[i] ||= { current: initial });
    },
    useEffect: (run, deps) => {
      const i = index(),
        old = hooks[i];
      if (!old || !deps || deps.some((d, n) => !Object.is(d, old.deps[n]))) {
        hooks[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => {
          hooks[i].cleanup?.();
          hooks[i].cleanup = run();
        });
      }
    },
  };
  const useAuthStore = (select) => select(auth);
  useAuthStore.getState = () => auth;
  const audioAdapter = {
    state: { phase: "idle", prompt: null },
    play: async (key) => {
      audio.push(key);
    },
    stop: async () => {},
  };
  const adapters = {
    react,
    "react/jsx-runtime": jsxRuntime(),
    "react-native": { View: "View", Image: "Image" },
    "expo-router": {
      useLocalSearchParams: () => params,
      useRouter: () => ({ replace: () => {} }),
    },
    "expo-crypto": { randomUUID },
    "react-i18next": {
      useTranslation: () => ({ t: (key) => key, i18n: { language: "vi" } }),
    },
    "../../../src/features/v21/v21.api": {
      v21Api: {
        dose: (...args) => dose(...args),
        answer: (...args) => {
          answers.push(args);
          return answer(...args);
        },
        checkin: async (...args) => {
          checkins.push(args);
          return {};
        },
      },
    },
    "../../../src/features/v21/medication.pending": {
      loadPendingAnswer: async () => pending,
      savePendingAnswer: async (_owner, _dose, value) => {
        pending = value;
      },
      clearPendingAnswer: async () => {
        pending = null;
      },
    },
    "../../../src/features/v21/V21Layout": {
      V21Layout: "Layout",
      Heading: "Heading",
      Note: "Note",
      Action: "Action",
      v21Error: (e) => errors.push(e.message),
    },
    "../../../src/features/v21/useMedicationAudio": {
      useMedicationAudio: () => audioAdapter,
    },
    "../../../src/features/v21/medication.accept": {
      acceptMedicationCallOnce: async () => {},
    },
    "../../../src/features/auth/auth.store": { useAuthStore },
    "../../../src/lib/voip": { endVoipCall: async () => {} },
    "../../../src/lib/env": { env: { apiBaseUrl: "https://example.invalid" } },
    "../../../src/stores/toast.store": {
      useToastStore: { getState: () => ({ show: () => {} }) },
    },
  };
  const module = { exports: {} };
  new Function(
    "module",
    "exports",
    "require",
    "setInterval",
    "clearInterval",
    code
  )(
    module,
    module.exports,
    (name) => {
      assert.ok(name in adapters, `Missing medication screen adapter ${name}`);
      return adapters[name];
    },
    (fn) => {
      const key = Symbol();
      intervals.set(key, fn);
      return key;
    },
    (key) => intervals.delete(key)
  );
  const Screen = module.exports.default;
  async function flush() {
    for (let n = 0; n < 35; n++) {
      if (dirty && mounted) {
        dirty = false;
        cursor = 0;
        tree = Screen();
        while (effects.length) effects.shift()();
      }
      await Promise.resolve();
    }
  }
  function nodes(node, result = []) {
    if (Array.isArray(node)) {
      for (const child of node) nodes(child, result);
    } else if (node && typeof node === "object") {
      result.push(node);
      nodes(node.props?.children, result);
    }
    return result;
  }
  const action = (label) =>
    nodes(tree).find((x) => x.type === "Action" && x.props.label === label);
  return {
    flush,
    audio,
    answers,
    checkins,
    errors,
    auth,
    params,
    action,
    text: () =>
      nodes(tree)
        .filter((x) => ["Heading", "Note"].includes(x.type))
        .map((x) => x.props.children)
        .flat()
        .join(" "),
    click: async (label) => {
      const node = action(label);
      assert.ok(node, `Missing action ${label}`);
      assert.ok(!node.props.disabled, `${label} disabled`);
      node.props.onPress();
      await flush();
    },
    poll: async () => {
      for (const fn of intervals.values()) fn();
      await flush();
    },
    rerender: async () => {
      dirty = true;
      await flush();
    },
    unmount: () => {
      mounted = false;
      for (const hook of hooks) hook?.cleanup?.();
    },
  };
}
// The JSX runtime takes a key as its third argument, whereas createElement takes
// children. Preserve children supplied in props when adapting it for inspection.
const jsx = (type, props, key) =>
  React.createElement(type, {
    ...props,
    ...(key === undefined ? {} : { key }),
  });
function jsxRuntime() {
  return { jsx, jsxs: jsx, Fragment: React.Fragment };
}

let count = 0;
async function test(name, run) {
  await run();
  count++;
  console.log("PASS " + name);
}
await test("another device wins: speech follows the accepted answer rather than the pressed button", async () => {
  const h = harness({
    answer: async () => ({ event: { state: "TAKEN" }, needsCheckin: false }),
  });
  await h.flush();
  await h.click("SKIPPED");
  assert.ok(h.audio.includes("taken"));
  assert.ok(!h.audio.includes("skipped"));
  h.unmount();
});
await test("an expired response never plays success audio and explains the closed window", async () => {
  const h = harness({
    answer: async () => ({
      event: { state: "UNCONFIRMED" },
      answerWindowClosed: true,
      needsCheckin: false,
    }),
  });
  await h.flush();
  await h.click("TAKEN");
  assert.ok(!h.audio.includes("taken"));
  assert.match(h.text(), /answerClosed/);
  h.unmount();
});
await test("after an unaccepted network failure, a changed choice gets its own request", async () => {
  let n = 0;
  const h = harness({
    answer: async () => {
      if (n++ === 0) throw Error("offline");
      return { event: { state: "SKIPPED" }, needsCheckin: false };
    },
  });
  await h.flush();
  await h.click("TAKEN");
  await h.click("SKIPPED");
  assert.deepEqual(
    h.answers.map((x) => x[1]),
    [1, 2]
  );
  assert.notEqual(h.answers[0][2], h.answers[1][2]);
  h.unmount();
});
await test("retrying the same choice reuses its request id", async () => {
  let n = 0;
  const h = harness({
    answer: async () => {
      if (n++ === 0) throw Error("offline");
      return { event: { state: "TAKEN" }, needsCheckin: false };
    },
  });
  await h.flush();
  await h.click("TAKEN");
  await h.click("TAKEN");
  assert.equal(h.answers[0][2], h.answers[1][2]);
  h.unmount();
});
await test("a poll started before an answer cannot overwrite the accepted result", async () => {
  const stale = deferred();
  let n = 0;
  const h = harness({
    dose: () => (++n === 1 ? Promise.resolve(detail()) : stale.promise),
  });
  await h.flush();
  await h.poll();
  await h.click("SKIPPED");
  stale.resolve(detail());
  await h.flush();
  assert.match(h.text(), /SKIPPED/);
  assert.doesNotMatch(h.text(), /CALLING/);
  assert.equal(h.action("TAKEN"), undefined);
  h.unmount();
});
await test("reopening a secondary merged dose reads check-in and submits to its pending first dose", async () => {
  let checked = false;
  const h = harness({
    dose: async () =>
      detail("TAKEN", { needsCheckin: !checked, checkinDoseId: "first" }),
  });
  await h.flush();
  assert.ok(h.audio.includes("checkin"));
  await h.click("fine");
  checked = true;
  assert.deepEqual(h.checkins, [["first", "fine"]]);
  assert.ok(h.action("home"));
  await h.poll();
  assert.equal(h.action("fine"), undefined);
  h.unmount();
});
await test("a previous account answer arriving late cannot change the new account screen or play audio", async () => {
  const late = deferred();
  const h = harness({ answer: () => late.promise });
  await h.flush();
  await h.click("SKIPPED");
  h.auth.token = "session-b";
  h.auth.profile = { id: 3 };
  await h.rerender();
  late.resolve({ event: { state: "SKIPPED" }, needsCheckin: false });
  await h.flush();
  assert.ok(!h.audio.includes("skipped"));
  assert.ok(h.action("TAKEN"));
  assert.equal(h.action("TAKEN").props.disabled, false);
  h.unmount();
});
console.log(`Medication response screen: ${count} runtime regressions passed.`);
