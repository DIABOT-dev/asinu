import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rules = require("../src/lib/blood-pressure.js");
const read = (file) => fs.readFileSync(file, "utf8");
const jsx = (type, props) => ({ type, props });
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
function evaluate(file, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Run the actual screen and submission handlers with isolated device adapters.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (id) => {
      assert.ok(id in imports, `Missing BP adapter: ${id}`);
      return imports[id];
    }
  );
  return module.exports;
}
const theme = evaluate("src/styles/theme.ts");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function hooks() {
  let cursor = 0;
  let focused = true;
  const slots = [],
    effects = [];
  const memo = (work, deps) => {
    const index = cursor++;
    if (
      !slots[index] ||
      deps.some((value, offset) => !Object.is(value, slots[index].deps[offset]))
    ) {
      slots[index] = { value: work(), deps };
    }
    return slots[index].value;
  };
  return {
    useFocusEffect(work) {
      const index = cursor++;
      const previous = slots[index];
      if (focused && (!previous?.active || previous.work !== work)) {
        const slot = (slots[index] = { work, focus: true, active: true });
        effects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = work();
        });
      }
    },
    blur() {
      focused = false;
      slots.filter(slot => slot?.focus && slot.active).forEach(slot => {
        slot.cleanup?.();
        slot.active = false;
        slot.cleanup = undefined;
      });
    },
    focus() { focused = true; },
    react: {
      useState: (initial) => {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [
          slots[index].value,
          (value) => {
            slots[index].value = value;
          },
        ];
      },
      useRef: (initial) => (slots[cursor++] ??= { current: initial }),
      useMemo: memo,
      useCallback: (work, deps) => memo(() => work, deps),
      useEffect: (work, deps) => {
        const index = cursor++;
        if (
          !slots[index] ||
          deps.some(
            (value, offset) => !Object.is(value, slots[index].deps[offset])
          )
        ) {
          const previous = slots[index];
          const slot = (slots[index] = { deps });
          effects.push(() => {
            previous?.cleanup?.();
            slot.cleanup = work();
          });
        }
      },
    },
    render: (component) => {
      cursor = 0;
      const tree = component();
      effects.splice(0).forEach((work) => work());
      return tree;
    },
  };
}
function harness({
  screen = 'blood-pressure',
  language = "vi",
  profile = { id: "owner", age: 40 },
  latest = async () => null,
  today = async () => [],
  fullProfile = async () => ({ id: "owner", age: 40 }),
  save = async () => {},
} = {}) {
  const h = hooks();
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/logs.json`));
  const t = (key) => {
    assert.equal(typeof catalog[key], "string", key);
    return catalog[key];
  };
  const calls = { writes: [], toasts: [], routes: [], phones: [], profiles: 0, latest: 0, totals: 0 };
  let auth = { profile, token: "isolated-test-token" };
  const authStore = (select) => select(auth);
  authStore.getState = () => auth;
  const animation = {
    delay() {
      return this;
    },
    duration() {
      return this;
    },
    springify() {
      return this;
    },
  };
  const validation = evaluate('src/features/logs/logs.validation.ts', {
    '../../i18n': { __esModule: true, default: { t } },
    './logs.service': { isHalfStepNumber: value => Number.isInteger(value * 2) },
    '../../lib/blood-pressure': rules,
  });
  const { default: Component } = evaluate(`app/logs/${screen}.tsx`, {
    react: h.react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      ...Object.fromEntries(
        [
          "ActivityIndicator",
          "KeyboardAvoidingView",
          "ScrollView",
          "View",
          "Pressable",
        ].map((name) => [name, name])
      ),
      StyleSheet: { create: (value) => value },
      Platform: { OS: "ios" },
      Linking: {
        openURL: async (url) => {
          calls.phones.push(url);
        },
      },
    },
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "AnimatedView" },
      FadeInDown: animation,
      ZoomIn: animation,
      useAnimatedStyle: (work) => work(),
      useSharedValue: (value) => ({ value }),
      withSequence() {},
      withTiming() {},
      withRepeat() {},
      withSpring() {},
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
    },
    "expo-router": { Stack: { Screen: "StackScreen" }, useFocusEffect: h.useFocusEffect },
    "@/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ back: () => calls.routes.push("back") }),
    },
    "@expo/vector-icons": { Ionicons: "Icon", MaterialCommunityIcons: 'Icon' },
    "react-i18next": { useTranslation: () => ({ t }) },
    "../../src/components/ScaledText": { ScaledText: "Text" },
    "../../src/components/ScaledTextInput": { ScaledTextInput: "NumericInput" },
    "../../src/components/LogEntryHeader": { LogEntryHeader: "Header" },
    "../../src/components/Screen": { Screen: "Screen" },
    "../../src/components/TextInput": { TextInput: "Field" },
    "../../src/components/VoiceLogButton": { VoiceLogButton: "VoiceInput" },
    "../../src/features/logs/ReadingLevelIndicator": { ReadingLevelIndicator: "ReadingLevelIndicator" },
    "../../src/features/auth/auth.store": { useAuthStore: authStore },
    "../../src/features/auth/auth.api": {
      authApi: {
        fetchProfile: async () => {
          calls.profiles++;
          return fullProfile();
        },
      },
    },
    "../../src/features/logs/logs.api": {
      logsApi: {
        fetchLatestByType: (...args) => { calls.latest++; return latest(...args); },
        fetchTodayByType: (...args) => { calls.totals++; return today(...args); },
      },
    },
    "../../src/features/logs/logs.validation": validation,
    "../../src/features/logs/logs.store": {
      useLogsStore: (select) =>
        select({
          createBloodPressure: async (payload) => {
            calls.writes.push(payload);
            await save(payload);
          },
          createGlucose: async payload => { calls.writes.push(payload); await save(payload); },
          createWater: async payload => { calls.writes.push(payload); await save(payload); },
        }),
    },
    "../../src/hooks/useScaledTypography": {
      useScaledTypography: () => theme.typography,
    },
    "../../src/hooks/useThemeColors": {
      useThemeColors: () => ({ isDark: false, colors: theme.colors }),
    },
    "../../src/stores/toast.store": {
      showToast: (...args) => calls.toasts.push(args),
    },
    "../../src/styles": theme,
    "../../src/lib/blood-pressure": rules,
  });
  const render = () => h.render(Component);
  const all = () => nodes(render());
  return {
    calls,
    t,
    render,
    all,
    refocus() { h.blur(); h.focus(); render(); },
    blur: h.blur,
    level: () => all().find((node) => node.type === "ReadingLevelIndicator"),
    async ready() {
      render();
      for (let i = 0; i < 8; i++) await Promise.resolve();
      render();
    },
    input(sys, dia, pulse = "") {
      const inputs = all().filter((node) => node.type === "NumericInput");
      inputs[0].props.onChangeText(String(sys));
      inputs[1].props.onChangeText(String(dia));
      all()
        .find(
          (node) => node.type === "Field" && node.props.label === t("pulse")
        )
        .props.onChangeText(pulse);
    },
    text: () =>
      all()
        .filter((node) => node.type === "Text")
        .map((node) => node.props.children),
    pulse: () =>
      all().find(
        (node) => node.type === "Field" && node.props.label === t("pulse")
      ),
    values: () =>
      all()
        .filter((node) => node.type === "NumericInput")
        .map((node) => node.props.value),
    save: () =>
      all()
        .find((node) => node.type === "Header")
        .props.onSave(),
    emergency: () =>
      all().find(
        (node) =>
          node.type === "Pressable" &&
          node.props.accessibilityLabel === t("bpCallEmergency")
      ),
    switchAccount(newProfile) {
      auth = { profile: newProfile, token: "different-test-token" };
      render();
    },
  };
}
let checks = 0;
async function test(label, work) {
  await work();
  checks++;
  console.log(`PASS ${label}`);
}

await test("mobile and backend have byte-identical AHA/ACC rules when both checkouts exist", () => {
  const backend = new URL(
    "../../backend.asinu/src/lib/blood-pressure.js",
    import.meta.url
  );
  if (fs.existsSync(backend))
    assert.equal(read(backend), read("src/lib/blood-pressure.js"));
  for (const [sys, dia, expected] of [
    [119, 79, "normal"],
    [120, 79, "elevated"],
    [129, 80, "stage1"],
    [130, 79, "stage1"],
    [139, 89, "stage1"],
    [140, 79, "stage2"],
    [128, 98, "stage2"],
    [150, 55, "stage2"],
    [180, 120, "stage2"],
    [181, 79, "severe"],
    [160, 121, "severe"],
    [200, 55, "severe"],
  ]) {
    assert.equal(
      rules.assessBloodPressure(sys, dia, { age: 40 }).category,
      expected
    );
  }
});
for (const language of ["vi", "en"]) {
  await test(`${language}: actual screen uses both readings and low pressure cannot hide high pressure`, async () => {
    const h = harness({ language });
    await h.ready();
    for (const [sys, dia, expected] of [
      [118, 78, "normal"],
      [125, 79, "elevated"],
      [135, 85, "stage1"],
      [128, 98, "stage2"],
      [150, 55, "stage2"],
      [200, 55, "severe"],
    ]) {
      h.input(sys, dia);
      assert.equal(h.level().props.label, h.t(`bpStatus_${expected}`));
      assert.equal(h.level().props.activeKey, expected);
      assert.equal(h.level().props.reference, h.t("bpReadingReference"));
      assert.ok(!h.text().includes(h.t("bpReadingReference")), "Routine explanations belong behind the information button");
    }
    assert.ok(h.text().includes(h.t("bpHighReadingGuide")));
    assert.equal(h.emergency(), undefined, "The emergency guide remains text without a call button");
    assert.deepEqual(
      h.calls.phones,
      [],
      "Rendering a warning must not place a call"
    );
    assert.deepEqual(h.calls.phones, [], "The high-reading screen must not expose a 115 call action");
  });
  await test(`${language}: invalid pairs and pulse cannot save; correcting them saves unchanged`, async () => {
    const h = harness({ language });
    await h.ready();
    h.input(80, 120);
    await h.save();
    assert.ok(h.text().includes(h.t("errBpOrder")));
    h.input("120abc", 80);
    await h.save();
    assert.ok(h.text().includes(h.t("errBpNumbers")));
    h.input(260, 160);
    await h.save();
    assert.ok(h.text().includes(h.t("errBpRange")));
    assert.ok(
      h.text().includes(h.t("bpHighReadingGuide")),
      "Out-of-range high readings still need safety guidance"
    );
    assert.equal(h.emergency(), undefined);
    h.input(120, 80, "72abc");
    await h.save();
    assert.equal(h.pulse().props.error, h.t("bpPulseInvalid"));
    assert.equal(h.calls.writes.length, 0);
    h.input(200, 55, "72");
    await h.save();
    assert.deepEqual(h.calls.writes, [
      {
        systolic: 200,
        diastolic: 55,
        pulse: 72,
        context: "morning",
        notes: undefined,
      },
    ]);
    assert.deepEqual(h.calls.toasts, [[h.t("savedTitle"), "success"]]);
    assert.deepEqual(h.calls.routes, ["back"]);
  });
  await test(`${language}: under-18 and unknown-age profiles do not receive adult categories`, async () => {
    for (const [profile, key] of [
      [{ id: "owner", age: 12 }, "bpUnder18Reference"],
      [{ id: "owner" }, "bpMissingAgeReference"],
    ]) {
      const h = harness({
        language,
        profile,
        fullProfile: async () => profile,
      });
      await h.ready();
      h.input(118, 78);
      assert.equal(h.level().props.reference, h.t(key));
      assert.equal(h.level().props.activeKey, null);
      assert.equal(h.level().props.label, h.t("readingLevelUnavailable"));
      await h.save();
      assert.equal(
        h.calls.writes.length,
        1,
        "An unassessed reading can still be recorded"
      );
    }
  });
}
await test("basic bootstrap profiles fetch age before classifying; a failed profile fetch stays neutral", async () => {
  const h = harness({ profile: { id: "owner" } });
  await h.ready();
  h.input(135, 85);
  assert.equal(h.calls.profiles, 1);
  assert.equal(h.level().props.activeKey, "stage1");
  const failed = harness({
    profile: { id: "owner" },
    fullProfile: async () => {
      throw new Error("offline");
    },
  });
  await failed.ready();
  failed.input(118, 78);
  assert.equal(failed.level().props.reference, failed.t("bpMissingAgeReference"));
});
await test("rapid duplicate saves write once; stale completions cannot navigate another account", async () => {
  const pending = deferred();
  const h = harness({ save: () => pending.promise });
  await h.ready();
  h.input(128, 98);
  const first = h.save();
  await h.save();
  assert.equal(h.calls.writes.length, 1);
  h.switchAccount({ id: "other", age: 40 });
  await h.ready();
  pending.resolve();
  await first;
  assert.deepEqual(h.calls.routes, []);
  assert.deepEqual(h.calls.toasts, []);
});
await test("a delayed age lookup from a previous account cannot replace the new account profile", async () => {
  const old = deferred();
  const h = harness({
    profile: { id: 'owner' },
    fullProfile: () => old.promise,
  });
  h.render();
  h.switchAccount({ id: "other", age: 12 });
  await h.ready();
  old.resolve({ id: 'owner', age: 40 });
  await h.ready();
  assert.deepEqual(h.values(), ["", ""]);
  h.input(118, 78);
  assert.equal(h.level().props.reference, h.t("bpUnder18Reference"));
});

for (const screen of ['blood-pressure', 'glucose', 'water']) {
  await test(`${screen}: a fresh entry never copies history; returning or changing accounts clears the draft`, async () => {
    const h = harness({ screen,
      latest: async () => ({ systolic: 155, diastolic: 95, value: 180, volume_ml: 500, context: 'evening' }),
      today: async () => [{ volume_ml: 250 }, { volume_ml: 350 }],
    });
    await h.ready();
    const expected = screen === 'blood-pressure' ? ['', ''] : [''];
    assert.deepEqual(h.values(), expected);
    assert.equal(h.calls.latest, 0, 'New entry must not fetch a previous measurement');
    await h.save();
    assert.equal(h.calls.writes.length, 0, 'An empty entry cannot resave a previous measurement');
    h.all().find(node => node.type === 'NumericInput').props.onChangeText('123');
    h.all().find(node => node.type === 'Field' && node.props.label === h.t('notes')).props.onChangeText('draft');
    assert.equal(h.values()[0], '123');
    h.refocus(); await h.ready();
    assert.deepEqual(h.values(), expected);
    assert.equal(h.all().find(node => node.type === 'Field' && node.props.label === h.t('notes')).props.value, '');
    h.all().find(node => node.type === 'NumericInput').props.onChangeText('456');
    h.switchAccount({ id: 'other', age: 40 }); await h.ready();
    assert.deepEqual(h.values(), expected);
    if (screen === 'water') {
      h.all().find(node => node.type === 'NumericInput').props.onChangeText('200');
      await h.save();
      assert.equal(h.calls.writes[0].volume_ml, 200, 'Save this drink, not the day total of 600');
    } else {
      const parsed = screen === 'glucose'
        ? { log_type: 'glucose', value: 142, context: 'post_meal' }
        : { log_type: 'blood_pressure', systolic: 125, diastolic: 82, pulse: 70 };
      h.all().find(node => node.type === 'VoiceInput').props.onParsed({ ok: true, parsed });
      assert.deepEqual(h.values(), screen === 'glucose' ? ['142'] : ['125', '82']);
      await h.save();
      assert.equal(h.calls.writes.length, 1, 'Explicit new voice measurement can still be saved');
    }
    h.blur();
  });
}

await test('water: a previous account day total cannot leak into the next account', async () => {
  const old = deferred();
  let requests = 0;
  const h = harness({ screen: 'water', today: () => ++requests === 1 ? old.promise : Promise.resolve([{ volume_ml: 200 }]) });
  h.render();
  h.switchAccount({ id: 'other', age: 40 }); await h.ready();
  const before = h.text();
  old.resolve([{ volume_ml: 999 }]); await h.ready();
  assert.deepEqual(h.text(), before);
  assert.deepEqual(h.values(), ['']);
  h.blur();
});

for (const language of ["vi", "en"]) {
  await test(`${language}: reading scale stays neutral without a category and opens its explanation on demand`, () => {
    const h = hooks();
    const logs = JSON.parse(read(`src/i18n/locales/${language}/logs.json`));
    const common = JSON.parse(read(`src/i18n/locales/${language}/common.json`));
    const { ReadingLevelIndicator } = evaluate("src/features/logs/ReadingLevelIndicator.tsx", {
      react: h.react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "react-native": {
        View: "View", Pressable: "Pressable", ScrollView: "ScrollView", Modal: "Modal",
        StyleSheet: { create: value => value, absoluteFill: {} },
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": { useTranslation: namespace => ({ t: key => (namespace === "logs" ? logs : common)[key] }) },
      "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useThemeColors": { useThemeColors: () => ({ colors: theme.colors }) },
    });
    const props = {
      levels: [{ key: "normal", color: "#169B78" }, { key: "high", color: "#DB5555" }],
      activeKey: null,
      label: logs.readingLevelUnavailable,
      reference: logs.bpMissingAgeReference,
    };
    const render = () => nodes(h.render(() => ReadingLevelIndicator(props)));
    const modal = () => render().find(node => node.type === "Modal");
    assert.equal(modal().props.visible, false);
    const scale = () => render().find(node => node.props.accessibilityRole === "image");
    assert.equal(scale().props.accessibilityLabel, logs.readingLevelUnavailable);
    assert.ok(!nodes(scale()).some(node => node.props.style?.[0]?.borderTopWidth), "No marker may suggest a normal category when age is missing");
    assert.ok(!nodes(scale()).some(node => node.props.style?.[1]?.backgroundColor === "#169B78"));
    render().find(node => node.props.accessibilityLabel === logs.readingLevelReference).props.onPress();
    assert.equal(modal().props.visible, true);
    assert.ok(nodes(modal()).some(node => node.type === "Text" && node.props.children === logs.bpMissingAgeReference));
    modal().props.onRequestClose();
    assert.equal(modal().props.visible, false);
    props.activeKey = "high";
    props.label = logs.glucoseStatus_high;
    assert.equal(scale().props.accessibilityLabel, logs.glucoseStatus_high);
    assert.equal(nodes(scale()).filter(node => node.props.style?.[0]?.borderTopWidth).length, 1);
  });
}
console.log(`Blood pressure: ${checks} regression groups passed.`);
