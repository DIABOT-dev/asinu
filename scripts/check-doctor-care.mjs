import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import ts from "typescript";
const require = createRequire(import.meta.url),
  read = (file) => fs.readFileSync(file, "utf8");
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  new Function("module", "exports", "require", source)(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime") return require(name);
      assert.ok(name in imports, `Unexpected dependency ${name}`);
      return imports[name];
    }
  );
  return module.exports;
}
function hooks() {
  let cursor = 0,
    effects = [];
  const slots = [];
  const memo = (run, deps) => {
    const index = cursor++,
      old = slots[index];
    if (!old || deps.some((item, i) => !Object.is(item, old.deps[i])))
      slots[index] = { deps, value: run() };
    return slots[index].value;
  };
  return {
    useRef: (value) => (slots[cursor++] ??= { current: value }),
    useState: (initial) => {
      const index = cursor++;
      slots[index] ??= {
        value: typeof initial === "function" ? initial() : initial,
      };
      return [
        slots[index].value,
        (value) => {
          slots[index].value =
            typeof value === "function" ? value(slots[index].value) : value;
        },
      ];
    },
    useMemo: (run, deps) => memo(run, deps),
    useCallback: (run, deps) => memo(() => run, deps),
    useEffect: (run, deps) => {
      const index = cursor++,
        old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[index].cleanup = run();
        });
      }
    },
    render(run) {
      cursor = 0;
      const result = run();
      const pending = effects;
      effects = [];
      pending.forEach((work) => work());
      return result;
    },
    async settle(run) {
      let result;
      for (let i = 0; i < 7; i++) {
        result = this.render(run);
        await tick();
      }
      return result;
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
    },
    remount() {
      this.unmount();
      slots.length = 0;
      effects = [];
    },
  };
}
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
const theme = load("src/styles/theme.ts");
function harness(consent = "pending", planState = "proposed") {
  const runtime = hooks(),
    calls = [],
    catalog = JSON.parse(read("src/i18n/locales/vi/home.json"));
  let owner = "A";
  const state = {
    id: crypto.randomUUID(),
    tenant_id: "demo",
    source_task_id: crypto.randomUUID(),
    doctor_name: "DEMO clinician",
    doctor_available: true,
    consent_state: consent,
    consent_version: "care-v1",
    plans:
      consent === "pending"
        ? []
        : [
            {
              id: crypto.randomUUID(),
              title: "DEMO plan",
              goal: "DEMO goal",
              state: planState,
              version: 1,
              close_reason: null,
              items: [
                {
                  id: crypto.randomUUID(),
                  description: "DEMO action",
                  owner_role: "patient",
                  due_at: "2026-12-01T00:00:00Z",
                  state: "pending",
                  version: 1,
                  updates: [
                    {
                      id: crypto.randomUUID(),
                      actor_role: "patient",
                      content: "DEMO private A",
                      created_at: "2026-11-01T00:00:00Z",
                    },
                  ],
                },
              ],
            },
          ],
  };
  const t = (key) => {
    if (key === "common:back") return "Quay lại";
    assert.equal(typeof catalog[key], "string", key);
    return catalog[key];
  };
  const apiClient = async (url, input) => {
    calls.push({ url, input });
    const operation = input?.body?.operation;
    if (!input)
      return {
        data: { items: owner === "A" ? [{ ...state, plans: [] }] : [] },
      };
    if (operation === "get")
      return { data: { item: JSON.parse(JSON.stringify(state)) } };
    if (operation === "consent")
      state.consent_state =
        input.body.decision === "accept" ? "active" : "revoked";
    if (operation === "accept_plan") state.plans[0].state = "active";
    if (operation === "submit") {
      assert.equal(state.plans[0].state, "active");
      state.plans[0].items[0].state = "submitted";
    }
    return { data: {} };
  };
  const Screen = load("app/doctor-care.tsx", {
    react: runtime,
    "expo-router": {
      Stack: { Screen: "Stack" },
      useLocalSearchParams: () => ({ relationshipId: state.id }),
      useFocusEffect: (callback) => runtime.useEffect(callback, [callback]),
    },
    "react-i18next": {
      useTranslation: () => ({ t, i18n: { language: "vi" } }),
    },
    "react-native": {
      ActivityIndicator: "Spinner",
      Alert: { alert() {} },
      Pressable: "Button",
      ScrollView: "Scroll",
      StyleSheet: { create: (value) => value },
      View: "View",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
    },
    "expo-crypto": { randomUUID: crypto.randomUUID },
    "../src/components/ScaledText": { ScaledText: "Text" },
    "../src/components/ScaledTextInput": { ScaledTextInput: "Input" },
    "../src/components/Screen": { Screen: "Screen" },
    "../src/components/ScreenHeaderButton": { ScreenBackButton: "Back" },
    "../src/features/auth/auth.store": {
      useAuthStore: (selector) => selector({ profile: { id: owner } }),
    },
    "../src/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ back() {} }),
    },
    "../src/hooks/useThemeColors": {
      useThemeColors: () => ({ colors: theme.lightColors }),
    },
    "../src/lib/apiClient": {
      apiClient,
      getApiErrorMessage: (_e, _t, key) => t(key),
    },
    "../src/stores/toast.store": { showToast() {} },
  }).default;
  const render = () => runtime.render(Screen),
    settle = () => runtime.settle(Screen),
    button = (tree, key) =>
      nodes(tree).find(
        (n) => n.type === "Button" && n.props.accessibilityLabel === t(key)
      );
  return {
    state,
    calls,
    render,
    settle,
    button,
    owner: (value) => {
      owner = value;
    },
    cleanup: () => runtime.unmount(),
  };
}
let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log("PASS " + name);
}
await test("care requires separate consent before plans can be accepted", async () => {
  const h = harness();
  try {
    let tree = await h.settle();
    assert.ok(h.button(tree, "doctorCareAgree"));
    assert.ok(!h.button(tree, "doctorCareAcceptPlan"));
    h.button(tree, "doctorCareAgree").props.onPress();
    await h.settle();
    const request = h.calls.find((c) => c.input?.body?.operation === "consent")
      .input.body;
    assert.equal(request.decision, "accept");
    assert.equal(request.consent_version, "care-v1");
    assert.match(request.action_id, /^[a-f0-9-]{36}$/);
  } finally {
    h.cleanup();
  }
});
await test("patient accepts the proposed plan before submitting; submission awaits clinician review", async () => {
  const h = harness("active");
  try {
    let tree = await h.settle();
    assert.equal(nodes(tree).filter((n) => n.type === "Input").length, 0);
    h.button(tree, "doctorCareAcceptPlan").props.onPress();
    tree = await h.settle();
    nodes(tree)
      .find((n) => n.type === "Input")
      .props.onChangeText("DEMO patient response");
    tree = await h.settle();
    h.button(tree, "doctorCareSend").props.onPress();
    tree = await h.settle();
    assert.equal(h.state.plans[0].items[0].state, "submitted");
    assert.ok(!h.button(tree, "doctorCareSend"));
    assert.ok(
      nodes(tree).some(
        (n) =>
          n.type === "Text" &&
          n.props.children === "Đã gửi, chờ chuyên gia kiểm tra"
      )
    );
  } finally {
    h.cleanup();
  }
});
await test("account switch hides the previous clinical history immediately", async () => {
  const h = harness("active", "active");
  try {
    let tree = await h.settle();
    assert.ok(nodes(tree).some((n) => n.props.children === "DEMO private A"));
    h.owner("B");
    tree = h.render();
    assert.ok(!nodes(tree).some((n) => n.props.children === "DEMO private A"));
    tree = await h.settle();
    assert.ok(!nodes(tree).some((n) => n.props.children === "DEMO private A"));
  } finally {
    h.cleanup();
  }
});
await test("revoked care stays read-only and cannot reopen the old consent", async () => {
  const h = harness("revoked", "cancelled");
  try {
    const tree = await h.settle();
    assert.ok(!h.button(tree, "doctorCareAgree"));
    assert.ok(!h.button(tree, "doctorCareSend"));
    assert.ok(!h.button(tree, "doctorCareAcceptPlan"));
  } finally {
    h.cleanup();
  }
});
console.log(`Doctor care: ${checks} runtime regressions passed.`);
