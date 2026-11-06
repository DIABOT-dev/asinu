const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const jsx = (type, props) => ({ type, props });
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
function evaluate(file, adapters, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Execute the production component with a deterministic lifecycle and clock.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", ...Object.keys(globals), code)(
    module,
    module.exports,
    (id) => {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.ok(id in adapters, `Missing animation adapter: ${id}`);
      return adapters[id];
    },
    ...Object.values(globals)
  );
  return module.exports;
}
function clock() {
  const tasks = new Map();
  let time = 0,
    sequence = 0;
  return {
    setTimeout(work, delay) {
      const id = ++sequence;
      tasks.set(id, { work, at: time + delay });
      return id;
    },
    clearTimeout: (id) => tasks.delete(id),
    pending: () => tasks.size,
    callbacks: () => [...tasks.values()].map((task) => task.work),
    advance(duration) {
      const target = time + duration;
      for (;;) {
        const next = [...tasks.entries()]
          .filter(([, task]) => task.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, task] = next;
        tasks.delete(id);
        time = task.at;
        task.work();
      }
      time = target;
    },
  };
}
function harness(text, reducedMotion = false) {
  const timer = clock(),
    slots = [];
  let cursor = 0,
    focused = true,
    callback,
    cleanup,
    writes = 0;
  let props = { text, style: { fontSize: 18 } };
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
  const { TypewriterText } = evaluate(
    "src/components/TypewriterText.tsx",
    {
      react: {
        useMemo: memo,
        useCallback: (work, deps) => memo(() => work, deps),
        useState: (initial) => {
          const index = cursor++;
          slots[index] ??= { value: initial };
          return [
            slots[index].value,
            (value) => {
              writes++;
              slots[index].value = value;
            },
          ];
        },
      },
      "expo-router": {
        useFocusEffect: (work) => {
          if (focused && callback !== work) {
            cleanup?.();
            callback = work;
            cleanup = work();
          }
        },
      },
      "react-native": {
        Text: "NativeText",
        StyleSheet: { create: (styles) => styles },
      },
      "react-native-reanimated": { useReducedMotion: () => reducedMotion },
      "./ScaledText": { ScaledText: "ScaledText" },
    },
    { setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout }
  );
  const render = () => {
    cursor = 0;
    return TypewriterText(props);
  };
  const parts = () => {
    const spans = nodes(render()).filter((node) => node.type === "NativeText");
    return { shown: spans[0].props.children, pending: spans[1].props.children };
  };
  render();
  return {
    timer,
    render,
    parts,
    writes: () => writes,
    text: () => parts().shown,
    changeText: (text) => {
      props = { ...props, text };
      render();
    },
    blur() {
      focused = false;
      cleanup?.();
      cleanup = undefined;
      callback = undefined;
    },
    focus() {
      focused = true;
      render();
    },
    unmount() {
      focused = false;
      cleanup?.();
      cleanup = undefined;
    },
    until(predicate) {
      for (let i = 0; i < 200 && !predicate(); i++) timer.advance(30);
      assert.ok(predicate(), "Animation did not reach the expected frame");
    },
  };
}

let checks = 0;
function test(label, work) {
  work();
  checks++;
  console.log(`PASS ${label}`);
}
const translations = (language) => ({
  careCircle: JSON.parse(
    fs.readFileSync(`src/i18n/locales/${language}/careCircle.json`, "utf8")
  ),
  profile: JSON.parse(
    fs.readFileSync(`src/i18n/locales/${language}/profile.json`, "utf8")
  ),
});
for (const language of ["vi", "en"]) {
  const catalogs = translations(language);
  for (const text of [
    catalogs.careCircle.qrConnectFamilyNow,
    catalogs.profile.mascotGreeting,
  ]) {
    test(`${language}/${text}: letters appear progressively and reserve the complete line`, () => {
      const h = harness(text);
      assert.equal(h.text(), "");
      h.timer.advance(100);
      assert.ok(h.text().length > 0 && h.text().length < text.length);
      let previous = h.text().length;
      for (let frame = 0; frame < 100 && h.text() !== text; frame++) {
        h.timer.advance(90);
        const { shown, pending } = h.parts();
        assert.equal(
          shown + pending,
          text,
          "Typing cannot resize the complete text line"
        );
        assert.ok(
          shown.length >= previous && shown.length <= previous + 1,
          "Reveal one character at a time"
        );
        previous = shown.length;
        assert.equal(
          h.timer.pending(),
          1,
          "Rerenders must not create duplicate typing loops"
        );
        assert.equal(h.render().props.accessibilityLabel, text);
        assert.equal(h.render().props.accessibilityLiveRegion, "none");
      }
      assert.equal(h.text(), text, "Finish the complete phrase");
      h.timer.advance(2000);
      assert.equal(
        h.text(),
        text,
        "Keep the complete phrase visible long enough to read"
      );
      h.until(() => h.text() === "");
      h.timer.advance(100);
      assert.equal(h.text(), "");
      h.until(() => h.text().length === 1);
      assert.notEqual(h.text(), text);
      h.unmount();
      assert.equal(h.timer.pending(), 0);
    });
    test(`${language}/${text}: reduced motion shows the complete phrase without timers`, () => {
      const h = harness(text, true);
      assert.equal(h.text(), text);
      assert.equal(h.timer.pending(), 0);
      h.timer.advance(10000);
      assert.equal(h.text(), text);
    });
  }
  test(`${language}: both mascot labels share the same bubble format, theme and typing component`, () => {
    function TypewriterText() {}
    let isDark = false;
    const native = {
      Image: "Image",
      StyleSheet: { create: (styles) => styles },
      View: "View",
    };
    const theme = {
      useThemeColors: () => ({
        colors: { primaryText: "#007f73" },
        isDark,
      }),
    };
    const i18n = {
      useTranslation: (namespace) => ({ t: (key) => catalogs[namespace][key] }),
    };
    const { MascotSpeechBubble } = evaluate("src/components/MascotSpeechBubble.tsx", {
      react: {}, "react-native": native,
      "react-native-svg": { __esModule: true, default: "Svg", Path: "Path" },
      "../hooks/useThemeColors": theme, "./TypewriterText": { TypewriterText },
    });
    const speech = evaluate(
      "src/features/care-circle/components/CareCircleScanSpeech.tsx",
      {
        react: {},
        "react-i18next": i18n,
        "../../../components/MascotSpeechBubble": { MascotSpeechBubble },
      }
    ).CareCircleScanSpeech();
    const profile = evaluate("src/features/profile/ProfileMascotGreeting.tsx", {
      react: { useCallback: (work) => work },
      "react-native": native,
      "react-native-svg": {
        __esModule: true,
        default: "Svg",
        Defs: "Defs",
        LinearGradient: "LinearGradient",
        Path: "Path",
        Stop: "Stop",
      },
      "react-i18next": i18n,
      "expo-router": { useFocusEffect: (work) => work() },
      "react-native-reanimated": {
        __esModule: true,
        default: { View: "AnimatedView" },
        useReducedMotion: () => true,
        useSharedValue: (value) => ({ value }),
        useAnimatedStyle: (work) => work(),
        cancelAnimation() {},
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../components/MascotSpeechBubble": { MascotSpeechBubble },
      "../../hooks/useThemeColors": theme,
      "../../../assets/images/profile/asinu-profile-mascot-v1.webp":
        "MascotArt",
      "../../../assets/images/profile/profile-ocean-wave-v1.webp":
        "OceanWaveArt",
    }).ProfileMascotGreeting();
    const speechProps = nodes(speech).find((node) => node.type === MascotSpeechBubble).props;
    const profileProps = nodes(profile).find((node) => node.type === MascotSpeechBubble).props;
    assert.equal(speechProps.text, catalogs.careCircle.qrConnectFamilyNow);
    assert.equal(profileProps.text, catalogs.profile.mascotGreeting);
    const water = nodes(profile).find(node => node.type === 'Image' && node.props.source === 'OceanWaveArt');
    assert.ok(water, 'The real-water asset replaces the flat SVG waves');
    assert.equal(water.props.accessible, false);
    for (isDark of [false, true]) {
      const speechTree = MascotSpeechBubble(speechProps);
      const profileTree = MascotSpeechBubble(profileProps);
      const speechText = nodes(speechTree).find(node => node.type === TypewriterText);
      const profileText = nodes(profileTree).find(node => node.type === TypewriterText);
      assert.deepEqual(profileText.props.style, speechText.props.style, 'Text size, weight, alignment and color match');
      assert.equal(profileText.props.style.at(-1).color, isDark ? '#ecfdf5' : '#064e3b');
      assert.deepEqual(profileTree.props.children[0].props.style, speechTree.props.children[0].props.style, 'Bubble shape and background match');
      const tail = nodes(profileTree).find(node => node.type === 'Path');
      assert.equal(tail.props.fill, isDark ? '#134e4a' : '#d1fae5');
      assert.equal(profileTree.props.accessibilityElementsHidden, false, 'The greeting remains readable to assistive technology');
      assert.equal(speechTree.props.accessibilityElementsHidden, true, 'Decorative connection guidance stays decorative');
    }
  });
}
test("blurring and unmounting cancel timers, including already queued callbacks", () => {
  const h = harness("Xin chào");
  h.timer.advance(200);
  const queued = h.timer.callbacks();
  h.blur();
  const writes = h.writes();
  assert.equal(h.timer.pending(), 0);
  queued.forEach((work) => work());
  h.timer.advance(10000);
  assert.equal(h.writes(), writes);
  h.focus();
  assert.equal(h.text(), "");
  h.timer.advance(100);
  assert.equal(h.text(), "X");
  h.unmount();
  assert.equal(h.timer.pending(), 0);
});
test("changing language cancels the old phrase and restarts the new one", () => {
  const h = harness("Xin chào");
  h.timer.advance(400);
  const stale = h.timer.callbacks();
  h.changeText("Hello");
  assert.equal(h.text(), "");
  assert.equal(h.timer.pending(), 1);
  stale.forEach((work) => work());
  h.timer.advance(100);
  assert.equal(h.text(), "H");
});
test("decomposed Vietnamese accents appear attached to each letter; empty phrases have no timer", () => {
  const h = harness("Kết nối ngay");
  h.timer.advance(200);
  assert.equal(h.text(), "Kế");
  assert.equal(h.parts().shown + h.parts().pending, "Kết nối ngay");
  const empty = harness("");
  assert.equal(empty.text(), "");
  assert.equal(empty.timer.pending(), 0);
});
console.log(`Typewriter text: ${checks} regression groups passed.`);
